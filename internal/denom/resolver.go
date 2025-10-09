package denom

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"strings"
	"sync"

	"github.com/manifest-network/yaci/internal/client"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/dynamicpb"
)

// Resolver handles IBC denom trace resolution via gRPC
type Resolver struct {
	client  *client.GRPCClient
	storage *Storage
	cache   map[string]*DenomTrace
	mu      sync.RWMutex
}

// DenomTrace represents an IBC denom trace
type DenomTrace struct {
	Path      string
	BaseDenom string
	IBCHash   string
}

// Metadata represents complete denom metadata
type Metadata struct {
	Denom       string
	BaseDenom   string
	DisplayName string
	Symbol      string
	Decimals    int
	IsIBC       bool
	IBCHash     string
	IBCPath     string
	ChainID     string
}

// NewResolver creates a new denom resolver
func NewResolver(client *client.GRPCClient, storage *Storage) *Resolver {
	return &Resolver{
		client:  client,
		storage: storage,
		cache:   make(map[string]*DenomTrace),
	}
}

// IsIBCDenom checks if a denom string is an IBC denom
func IsIBCDenom(denom string) bool {
	return strings.HasPrefix(denom, "ibc/") && len(denom) == 68 // "ibc/" + 64 char hex
}

// ExtractIBCHash extracts the hash from an IBC denom string
func ExtractIBCHash(denom string) string {
	if !IsIBCDenom(denom) {
		return ""
	}
	return strings.TrimPrefix(denom, "ibc/")
}

// CalculateIBCDenom calculates the IBC denom from a path and base denom
// This follows the IBC spec: ibc/hash(path + "/" + baseDenom)
func CalculateIBCDenom(path, baseDenom string) string {
	fullPath := path + "/" + baseDenom
	hash := sha256.Sum256([]byte(fullPath))
	return "ibc/" + strings.ToUpper(hex.EncodeToString(hash[:]))
}

// QueryDenomTrace queries the IBC denom trace from the chain via gRPC
func (r *Resolver) QueryDenomTrace(ctx context.Context, hash string) (*DenomTrace, error) {
	// Check cache first
	r.mu.RLock()
	if trace, ok := r.cache[hash]; ok {
		r.mu.RUnlock()
		return trace, nil
	}
	r.mu.RUnlock()

	slog.Debug("Querying IBC denom trace", "hash", hash)

	// Query via gRPC using yaci's pattern
	serviceName := "ibc.applications.transfer.v1.Query"
	methodName := "DenomTrace"

	// Find method descriptor
	methodDescriptor, err := r.client.Resolver.FindMethodDescriptor(serviceName, methodName)
	if err != nil {
		return nil, fmt.Errorf("failed to find method descriptor: %w", err)
	}

	// Build full method name
	fullMethodName := "/" + string(methodDescriptor.FullName())
	lastDot := strings.LastIndex(fullMethodName, ".")
	if lastDot != -1 {
		fullMethodName = fullMethodName[:lastDot] + "/" + fullMethodName[lastDot+1:]
	}

	// Create request and response messages
	req := dynamicpb.NewMessage(methodDescriptor.Input())
	resp := dynamicpb.NewMessage(methodDescriptor.Output())

	// Set the hash field in request
	hashField := req.Descriptor().Fields().ByName("hash")
	if hashField == nil {
		return nil, fmt.Errorf("hash field not found in DenomTraceRequest")
	}
	req.Set(hashField, protoreflect.ValueOfString(hash))

	// Invoke the method
	err = r.client.Conn.Invoke(ctx, fullMethodName, req, resp)
	if err != nil {
		return nil, fmt.Errorf("failed to invoke DenomTrace: %w", err)
	}

	// Parse response
	denomTraceField := resp.Descriptor().Fields().ByName("denom_trace")
	if denomTraceField == nil {
		return nil, fmt.Errorf("denom_trace field not found in response")
	}

	denomTraceMsg := resp.Get(denomTraceField).Message()
	if !denomTraceMsg.IsValid() {
		return nil, fmt.Errorf("invalid denom_trace in response")
	}

	// Extract path and base_denom
	pathField := denomTraceMsg.Descriptor().Fields().ByName("path")
	baseDenomField := denomTraceMsg.Descriptor().Fields().ByName("base_denom")

	if pathField == nil || baseDenomField == nil {
		return nil, fmt.Errorf("path or base_denom field not found")
	}

	trace := &DenomTrace{
		Path:      denomTraceMsg.Get(pathField).String(),
		BaseDenom: denomTraceMsg.Get(baseDenomField).String(),
		IBCHash:   hash,
	}

	// Cache the result
	r.mu.Lock()
	r.cache[hash] = trace
	r.mu.Unlock()

	slog.Debug("Resolved IBC denom trace",
		"hash", hash,
		"path", trace.Path,
		"base_denom", trace.BaseDenom)

	return trace, nil
}

// ResolveDenom resolves a denom string to its metadata
func (r *Resolver) ResolveDenom(ctx context.Context, denom string) (*Metadata, error) {
	// Check database first if storage is configured
	if r.storage != nil {
		metadata, err := r.storage.GetDenomMetadata(ctx, denom)
		if err != nil {
			slog.Warn("Failed to query denom from storage", "denom", denom, "error", err)
		} else if metadata != nil {
			return metadata, nil
		}
	}

	var metadata *Metadata

	if !IsIBCDenom(denom) {
		// For native denoms, return basic metadata
		metadata = &Metadata{
			Denom:       denom,
			BaseDenom:   denom,
			DisplayName: GuessDisplayName(denom),
			Symbol:      GuessSymbol(denom),
			Decimals:    GuessDecimals(denom),
			IsIBC:       false,
		}
	} else {
		// Extract hash and query trace
		hash := ExtractIBCHash(denom)
		trace, err := r.QueryDenomTrace(ctx, hash)
		if err != nil {
			return nil, err
		}

		metadata = &Metadata{
			Denom:       denom,
			BaseDenom:   trace.BaseDenom,
			DisplayName: GuessDisplayName(trace.BaseDenom),
			Symbol:      GuessSymbol(trace.BaseDenom),
			Decimals:    GuessDecimals(trace.BaseDenom),
			IsIBC:       true,
			IBCHash:     hash,
			IBCPath:     trace.Path,
		}
	}

	// Store the resolved metadata if storage is configured
	if r.storage != nil {
		if err := r.storage.StoreDenomMetadata(ctx, metadata); err != nil {
			slog.Warn("Failed to store denom metadata", "denom", denom, "error", err)
		}
	}

	return metadata, nil
}

// GuessDisplayName provides a best-guess display name for a denom
func GuessDisplayName(denom string) string {
	knownDenoms := map[string]string{
		"ujuno":  "Juno",
		"uatom":  "Cosmos Hub",
		"uosmo":  "Osmosis",
		"uakt":   "Akash",
		"ustars": "Stargaze",
		"aevmos": "Evmos",
		"inj":    "Injective",
		"axl":    "Axelar",
		"umfx":   "Manifest",
		"upoa":   "POA",
	}

	if name, ok := knownDenoms[strings.ToLower(denom)]; ok {
		return name
	}

	// Strip prefix and return uppercased
	if strings.HasPrefix(denom, "u") {
		return strings.ToUpper(denom[1:])
	}
	if strings.HasPrefix(denom, "a") {
		return strings.ToUpper(denom[1:])
	}

	return strings.ToUpper(denom)
}

// GuessSymbol provides a best-guess symbol for a denom
func GuessSymbol(denom string) string {
	knownSymbols := map[string]string{
		"ujuno":  "JUNO",
		"uatom":  "ATOM",
		"uosmo":  "OSMO",
		"uakt":   "AKT",
		"ustars": "STARS",
		"aevmos": "EVMOS",
		"inj":    "INJ",
		"axl":    "AXL",
		"umfx":   "MFX",
		"upoa":   "POA",
	}

	if symbol, ok := knownSymbols[strings.ToLower(denom)]; ok {
		return symbol
	}

	// Strip prefix and return uppercased
	if strings.HasPrefix(denom, "u") || strings.HasPrefix(denom, "a") {
		return strings.ToUpper(denom[1:])
	}

	return strings.ToUpper(denom)
}

// GuessDecimals provides a best-guess decimal count for a denom
func GuessDecimals(denom string) int {
	// u-prefix typically means 6 decimals (micro)
	if strings.HasPrefix(denom, "u") {
		return 6
	}
	// a-prefix typically means 18 decimals (atto, for EVM chains)
	if strings.HasPrefix(denom, "a") {
		return 18
	}
	// Default to 6 for Cosmos chains
	return 6
}
