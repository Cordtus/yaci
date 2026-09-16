//go:build fallback_integration

// These tests describe the intended fallback integration on CustomResolver
// (SetFallback / SetCurrentHeight). They are parked behind a build tag until
// that integration lands; run with `go test -tags fallback_integration`.
package reflection

import (
	"bytes"
	"context"
	"log/slog"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
)

func TestResolver_FallbackAndNegativeCache(t *testing.T) {
	// Capture log output
	var logBuf bytes.Buffer
	handler := slog.NewJSONHandler(&logBuf, &slog.HandlerOptions{Level: slog.LevelDebug})
	slog.SetDefault(slog.New(handler))

	t.Run("unavailable type logs warning and caches", func(t *testing.T) {
		logBuf.Reset()
		resolver := &CustomResolver{
			files:        &protoregistry.Files{},
			ctx:          context.Background(),
			seenSymbols:  make(map[string]bool),
			unavailTypes: make(map[string]bool),
			maxRetries:   1,
		}

		fakeType := protoreflect.FullName("tendermint.liquidity.v1beta1.MsgSwap")
		_, err := resolver.FindMessageByName(fakeType)
		require.Error(t, err)

		// Check warning logged with hint
		logOutput := logBuf.String()
		assert.Contains(t, logOutput, "Cannot decode message type")
		assert.Contains(t, logOutput, "tendermint/liquidity/v1beta1")

		// Second call hits negative cache - no new warning
		prevLen := logBuf.Len()
		_, err = resolver.FindMessageByName(fakeType)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "no available proto definition")
		assert.Equal(t, prevLen, logBuf.Len(), "No new log for cached type")
	})

	t.Run("fallback resolves deprecated type", func(t *testing.T) {
		logBuf.Reset()
		tmpDir := t.TempDir()

		// Create proto file
		protoDir := tmpDir + "/deprecated/v1"
		require.NoError(t, os.MkdirAll(protoDir, 0755))
		require.NoError(t, os.WriteFile(protoDir+"/msg.proto", []byte(`
syntax = "proto3";
package deprecated.v1;
message OldMsg { string data = 1; }
`), 0644))

		fallback := NewFallbackRegistry()
		fallback.SetProtoDir(NewProtoDir(tmpDir))

		resolver := &CustomResolver{
			files:        &protoregistry.Files{},
			ctx:          context.Background(),
			seenSymbols:  make(map[string]bool),
			unavailTypes: make(map[string]bool),
			maxRetries:   1,
		}
		resolver.SetFallback(fallback, 0) // no cutoff

		msgType, err := resolver.FindMessageByName("deprecated.v1.OldMsg")
		require.NoError(t, err)
		require.NotNil(t, msgType)
		assert.Contains(t, logBuf.String(), "Resolved deprecated message type from fallback")
	})
}

func TestResolver_FallbackCutoff(t *testing.T) {
	tmpDir := t.TempDir()
	protoDir := tmpDir + "/test/v1"
	require.NoError(t, os.MkdirAll(protoDir, 0755))
	require.NoError(t, os.WriteFile(protoDir+"/msg.proto", []byte(`
syntax = "proto3";
package test.v1;
message CutoffMsg { string x = 1; }
`), 0644))

	fallback := NewFallbackRegistry()
	fallback.SetProtoDir(NewProtoDir(tmpDir))

	resolver := &CustomResolver{
		files:        &protoregistry.Files{},
		ctx:          context.Background(),
		seenSymbols:  make(map[string]bool),
		unavailTypes: make(map[string]bool),
		maxRetries:   1,
	}
	resolver.SetFallback(fallback, 1000) // cutoff at block 1000

	// Below cutoff - should resolve
	resolver.SetCurrentHeight(500)
	msgType, err := resolver.FindMessageByName("test.v1.CutoffMsg")
	require.NoError(t, err)
	require.NotNil(t, msgType)

	// Reset for next test
	resolver.unavailTypes = make(map[string]bool)
	resolver.seenSymbols = make(map[string]bool)

	// Above cutoff - should fail (fallback disabled)
	resolver.SetCurrentHeight(1500)
	_, err = resolver.FindMessageByName("test.v1.CutoffMsg")
	require.Error(t, err)
}

func TestSuggestProtoFile(t *testing.T) {
	assert.Contains(t, SuggestProtoFile("cosmos.bank.v1beta1.MsgSend"), "cosmos/bank/v1beta1")
	assert.Contains(t, SuggestProtoFile("Simple"), "fallback directory")
}
