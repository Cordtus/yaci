package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/manifest-network/yaci/internal/client"
	"github.com/manifest-network/yaci/internal/utils"
)

// ChainConfig defines a chain to analyze
type ChainConfig struct {
	Name     string
	Endpoint string
	Insecure bool
}

// StructureAnalysis holds the analysis results for a chain
type StructureAnalysis struct {
	ChainName           string                   `json:"chain_name"`
	BlocksAnalyzed      int                      `json:"blocks_analyzed"`
	TotalTransactions   int                      `json:"total_transactions"`
	HasLogs             bool                     `json:"has_logs"`
	HasEvents           bool                     `json:"has_events"`
	LogsStructure       map[string]interface{}   `json:"logs_structure,omitempty"`
	EventsStructure     map[string]interface{}   `json:"events_structure,omitempty"`
	SampleTransaction   map[string]interface{}   `json:"sample_transaction,omitempty"`
	MessageTypes        map[string]int           `json:"message_types"`
	EventTypes          map[string]int           `json:"event_types"`
	HasMsgIndexInLogs   bool                     `json:"has_msg_index_in_logs"`
	HasMsgIndexInEvents bool                     `json:"has_msg_index_in_events"`
	Errors              []string                 `json:"errors,omitempty"`
}

func main() {
	chains := []ChainConfig{
		{Name: "Planq", Endpoint: "grpc.planq.network:443", Insecure: false},
		{Name: "Juno", Endpoint: "grpc.juno.basementnodes.ca:443", Insecure: false},
		{Name: "Osmosis", Endpoint: "grpc.osmosis.zone:443", Insecure: false},
		{Name: "Cosmos Hub", Endpoint: "cosmos-grpc.publicnode.com:443", Insecure: false},
	}

	results := make([]StructureAnalysis, 0, len(chains))

	for _, chain := range chains {
		fmt.Printf("\n=== Analyzing %s ===\n", chain.Name)
		analysis, err := analyzeChain(chain)
		if err != nil {
			log.Printf("Error analyzing %s: %v", chain.Name, err)
			analysis.Errors = append(analysis.Errors, err.Error())
		}
		results = append(results, analysis)

		// Small delay between chains
		time.Sleep(2 * time.Second)
	}

	// Write results to JSON file
	output, err := json.MarshalIndent(results, "", "  ")
	if err != nil {
		log.Fatalf("Failed to marshal results: %v", err)
	}

	filename := fmt.Sprintf("chain-analysis-%s.json", time.Now().Format("20060102-150405"))
	if err := os.WriteFile(filename, output, 0644); err != nil {
		log.Fatalf("Failed to write results: %v", err)
	}

	fmt.Printf("\n\n=== Analysis Complete ===\n")
	fmt.Printf("Results written to: %s\n", filename)

	// Print summary
	printSummary(results)
}

func analyzeChain(config ChainConfig) (StructureAnalysis, error) {
	analysis := StructureAnalysis{
		ChainName:     config.Name,
		MessageTypes:  make(map[string]int),
		EventTypes:    make(map[string]int),
		Errors:        make([]string, 0),
	}

	// Create context
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	// Create gRPC client
	gRPCClient, err := client.NewGRPCClient(
		ctx,
		config.Endpoint,
		config.Insecure,
		4*1024*1024, // 4MB max message size
	)
	if err != nil {
		return analysis, fmt.Errorf("failed to create gRPC client: %w", err)
	}

	// Get latest block height
	latestHeight, err := utils.GetLatestBlockHeightWithRetry(gRPCClient, 3)
	if err != nil {
		return analysis, fmt.Errorf("failed to get latest height: %w", err)
	}

	fmt.Printf("Latest height: %d\n", latestHeight)

	// Analyze recent blocks (up to 30)
	blocksToAnalyze := uint64(30)
	if latestHeight < blocksToAnalyze {
		blocksToAnalyze = latestHeight
	}
	startHeight := latestHeight - blocksToAnalyze + 1

	fmt.Printf("Analyzing blocks %d to %d\n", startHeight, latestHeight)

	// Fetch blocks
	for height := startHeight; height <= latestHeight; height++ {
		if err := analyzeBlock(gRPCClient, height, &analysis); err != nil {
			errMsg := fmt.Sprintf("block %d: %v", height, err)
			analysis.Errors = append(analysis.Errors, errMsg)
			log.Printf("Error analyzing block %d: %v", height, err)
			continue
		}
		analysis.BlocksAnalyzed++

		// Progress indicator
		if (height-startHeight+1)%5 == 0 {
			fmt.Printf("  Processed %d/%d blocks\n", height-startHeight+1, blocksToAnalyze)
		}
	}

	return analysis, nil
}

func analyzeBlock(gRPCClient *client.GRPCClient, height uint64, analysis *StructureAnalysis) error {
	// Get block data as JSON
	blockJsonParams := []byte(fmt.Sprintf(`{"height": %d}`, height))
	blockJsonBytes, err := utils.GetGRPCResponse(
		gRPCClient,
		"cosmos.tx.v1beta1.Service.GetBlockWithTxs",
		3, // max retries
		blockJsonParams,
	)
	if err != nil {
		return fmt.Errorf("failed to get block data: %w", err)
	}

	// Parse JSON response
	var blockData map[string]interface{}
	if err := json.Unmarshal(blockJsonBytes, &blockData); err != nil {
		return fmt.Errorf("failed to unmarshal block data: %w", err)
	}

	// Get transactions array
	txs, ok := blockData["txs"].([]interface{})
	if !ok || len(txs) == 0 {
		return nil // No transactions
	}

	analysis.TotalTransactions += len(txs)

	// Analyze first transaction in detail (for sample)
	if analysis.SampleTransaction == nil && len(txs) > 0 {
		firstTx, ok := txs[0].(map[string]interface{})
		if ok {
			analysis.SampleTransaction = firstTx

			// Check for txResponse structure
			if txResponse, ok := firstTx["txResponse"].(map[string]interface{}); ok {
				// Check for logs
				if logs, ok := txResponse["logs"].([]interface{}); ok && len(logs) > 0 {
					analysis.HasLogs = true
					if firstLog, ok := logs[0].(map[string]interface{}); ok {
						analysis.LogsStructure = firstLog

						// Check for msg_index in logs structure
						if _, hasMsgIndex := firstLog["msg_index"]; hasMsgIndex {
							analysis.HasMsgIndexInLogs = true
						} else if _, hasMsgIndex := firstLog["msgIndex"]; hasMsgIndex {
							analysis.HasMsgIndexInLogs = true
						}
					}
				}

				// Check for events
				if events, ok := txResponse["events"].([]interface{}); ok && len(events) > 0 {
					analysis.HasEvents = true
					if firstEvent, ok := events[0].(map[string]interface{}); ok {
						analysis.EventsStructure = firstEvent

						// Check for msg_index in event attributes
						if attrs, ok := firstEvent["attributes"].([]interface{}); ok {
							for _, attr := range attrs {
								if attrMap, ok := attr.(map[string]interface{}); ok {
									if key, ok := attrMap["key"].(string); ok && key == "msg_index" {
										analysis.HasMsgIndexInEvents = true
										break
									}
								}
							}
						}
					}
				}
			}
		}
	}

	// Count message and event types
	for _, tx := range txs {
		txMap, ok := tx.(map[string]interface{})
		if !ok {
			continue
		}

		txResponse, ok := txMap["txResponse"].(map[string]interface{})
		if !ok {
			continue
		}

		// Count message types
		if txField, ok := txResponse["tx"].(map[string]interface{}); ok {
			if body, ok := txField["body"].(map[string]interface{}); ok {
				if messages, ok := body["messages"].([]interface{}); ok {
					for _, msg := range messages {
						if msgMap, ok := msg.(map[string]interface{}); ok {
							if msgType, ok := msgMap["@type"].(string); ok {
								analysis.MessageTypes[msgType]++
							}
						}
					}
				}
			}
		}

		// Count event types
		if events, ok := txResponse["events"].([]interface{}); ok {
			for _, event := range events {
				if eventMap, ok := event.(map[string]interface{}); ok {
					if eventType, ok := eventMap["type"].(string); ok {
						analysis.EventTypes[eventType]++
					}
				}
			}
		}
	}

	return nil
}

func printSummary(results []StructureAnalysis) {
	fmt.Println("\n=== Summary ===\n")

	for _, result := range results {
		fmt.Printf("Chain: %s\n", result.ChainName)
		fmt.Printf("  Blocks analyzed: %d\n", result.BlocksAnalyzed)
		fmt.Printf("  Total transactions: %d\n", result.TotalTransactions)
		fmt.Printf("  Has logs: %v\n", result.HasLogs)
		fmt.Printf("  Has events: %v\n", result.HasEvents)
		fmt.Printf("  msg_index in logs: %v\n", result.HasMsgIndexInLogs)
		fmt.Printf("  msg_index in events: %v\n", result.HasMsgIndexInEvents)
		fmt.Printf("  Unique message types: %d\n", len(result.MessageTypes))
		fmt.Printf("  Unique event types: %d\n", len(result.EventTypes))
		if len(result.Errors) > 0 {
			fmt.Printf("  Errors: %d\n", len(result.Errors))
		}
		fmt.Println()
	}

	// Check for inconsistencies
	fmt.Println("=== Compatibility Analysis ===\n")

	hasLogsCount := 0
	hasMsgIndexInLogsCount := 0
	hasMsgIndexInEventsCount := 0

	for _, result := range results {
		if result.HasLogs {
			hasLogsCount++
		}
		if result.HasMsgIndexInLogs {
			hasMsgIndexInLogsCount++
		}
		if result.HasMsgIndexInEvents {
			hasMsgIndexInEventsCount++
		}
	}

	total := len(results)
	fmt.Printf("Chains with logs field: %d/%d\n", hasLogsCount, total)
	fmt.Printf("Chains with msg_index in logs: %d/%d\n", hasMsgIndexInLogsCount, total)
	fmt.Printf("Chains with msg_index in events: %d/%d\n", hasMsgIndexInEventsCount, total)

	if hasMsgIndexInLogsCount != total && hasMsgIndexInEventsCount != total {
		fmt.Println("\n⚠️  WARNING: Not all chains provide msg_index information!")
		fmt.Println("   This may cause issues with event-to-message association.")
	}

	if hasLogsCount != total {
		fmt.Println("\n⚠️  WARNING: Not all chains provide logs field!")
		fmt.Println("   Fallback to events field may be necessary.")
	}
}
