package denom

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
)

// Extractor handles extraction of denoms from transaction data
type Extractor struct {
	resolver *Resolver
	mu       sync.Mutex
	seen     map[string]bool
}

// NewExtractor creates a new denom extractor
func NewExtractor(resolver *Resolver) *Extractor {
	return &Extractor{
		resolver: resolver,
		seen:     make(map[string]bool),
	}
}

// ProcessTransactionData extracts and resolves denoms from transaction JSON
func (e *Extractor) ProcessTransactionData(ctx context.Context, txData []byte) error {
	var data map[string]interface{}
	if err := json.Unmarshal(txData, &data); err != nil {
		return err
	}

	denoms := e.extractDenomsFromData(data)

	for _, denom := range denoms {
		// Skip if already processed in this session
		e.mu.Lock()
		if e.seen[denom] {
			e.mu.Unlock()
			continue
		}
		e.seen[denom] = true
		e.mu.Unlock()

		// Resolve and store the denom
		_, err := e.resolver.ResolveDenom(ctx, denom)
		if err != nil {
			slog.Warn("Failed to resolve denom", "denom", denom, "error", err)
		}
	}

	return nil
}

// extractDenomsFromData recursively extracts denom strings from nested data
func (e *Extractor) extractDenomsFromData(data interface{}) []string {
	var denoms []string

	switch v := data.(type) {
	case map[string]interface{}:
		// Check for common denom field names
		if denom, ok := v["denom"].(string); ok && denom != "" {
			denoms = append(denoms, denom)
		}
		if denom, ok := v["base_denom"].(string); ok && denom != "" {
			denoms = append(denoms, denom)
		}

		// Check for amount objects with denom field
		if amount, ok := v["amount"].(map[string]interface{}); ok {
			if denom, ok := amount["denom"].(string); ok && denom != "" {
				denoms = append(denoms, denom)
			}
		}

		// Check for coin arrays
		if coins, ok := v["coins"].([]interface{}); ok {
			for _, coin := range coins {
				if coinMap, ok := coin.(map[string]interface{}); ok {
					if denom, ok := coinMap["denom"].(string); ok && denom != "" {
						denoms = append(denoms, denom)
					}
				}
			}
		}

		// Check for send/receive tokens in IBC messages
		if token, ok := v["token"].(map[string]interface{}); ok {
			if denom, ok := token["denom"].(string); ok && denom != "" {
				denoms = append(denoms, denom)
			}
		}

		// Recursively process all nested objects
		for _, value := range v {
			denoms = append(denoms, e.extractDenomsFromData(value)...)
		}

	case []interface{}:
		// Process arrays
		for _, item := range v {
			denoms = append(denoms, e.extractDenomsFromData(item)...)
		}
	}

	return denoms
}
