package utils

import (
	"errors"
	"testing"

	"github.com/manifest-network/yaci/internal/client"
)

func TestParseLowestHeightFromError(t *testing.T) {
	tests := []struct {
		name   string
		errMsg string
		want   uint64
	}{
		{
			name:   "standard pruned node error",
			errMsg: "height 1 is not available, lowest height is 28566001",
			want:   28566001,
		},
		{
			name:   "wrapped error",
			errMsg: "rpc error: code = Unknown desc = height 1 is not available, lowest height is 12345",
			want:   12345,
		},
		{
			name:   "unrelated error",
			errMsg: "connection refused",
			want:   0,
		},
		{
			name:   "empty string",
			errMsg: "",
			want:   0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ParseLowestHeightFromError(tt.errMsg)
			if got != tt.want {
				t.Errorf("parseLowestHeightFromError() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestGetEarliestBlockHeight(t *testing.T) {
	// Save original and restore after test
	originalGetter := grpcResponseGetter
	t.Cleanup(func() {
		grpcResponseGetter = originalGetter
	})

	tests := []struct {
		name        string
		mockFunc    func(callCount *int) GRPCResponseFunc
		maxRetries  uint
		wantHeight  uint64
		wantErr     bool
		errContains string
	}{
		{
			name: "archive node - block 1 exists",
			mockFunc: func(callCount *int) GRPCResponseFunc {
				return func(_ *client.GRPCClient, _ string, _ uint, _ []byte) ([]byte, error) {
					*callCount++
					return []byte(`{"block":{}}`), nil
				}
			},
			maxRetries: 3,
			wantHeight: 1,
			wantErr:    false,
		},
		{
			name: "pruned node - error reveals boundary on first attempt",
			mockFunc: func(callCount *int) GRPCResponseFunc {
				return func(_ *client.GRPCClient, _ string, _ uint, _ []byte) ([]byte, error) {
					*callCount++
					return nil, errors.New("height 1 is not available, lowest height is 28566001")
				}
			},
			maxRetries: 3,
			wantHeight: 28566001,
			wantErr:    false,
		},
		{
			name: "transient failure then success on retry",
			mockFunc: func(callCount *int) GRPCResponseFunc {
				return func(_ *client.GRPCClient, _ string, _ uint, _ []byte) ([]byte, error) {
					*callCount++
					if *callCount == 1 {
						// First call: transient error (not a pruned node error)
						return nil, errors.New("connection timeout")
					}
					// Retry succeeds
					return []byte(`{"block":{}}`), nil
				}
			},
			maxRetries: 3,
			wantHeight: 1,
			wantErr:    false,
		},
		{
			name: "persistent non-pruned error",
			mockFunc: func(callCount *int) GRPCResponseFunc {
				return func(_ *client.GRPCClient, _ string, _ uint, _ []byte) ([]byte, error) {
					*callCount++
					return nil, errors.New("connection refused")
				}
			},
			maxRetries: 3,
			wantHeight: 0,
			wantErr:    true,
			errContains: "failed to determine earliest block height",
		},
		{
			name: "pruned node with wrapped rpc error",
			mockFunc: func(callCount *int) GRPCResponseFunc {
				return func(_ *client.GRPCClient, _ string, _ uint, _ []byte) ([]byte, error) {
					*callCount++
					return nil, errors.New("rpc error: code = Unknown desc = height 1 is not available, lowest height is 5000")
				}
			},
			maxRetries: 3,
			wantHeight: 5000,
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			callCount := 0
			grpcResponseGetter = tt.mockFunc(&callCount)

			got, err := GetEarliestBlockHeight(nil, tt.maxRetries)

			if tt.wantErr {
				if err == nil {
					t.Errorf("GetEarliestBlockHeight() expected error, got nil")
					return
				}
				if tt.errContains != "" && !contains(err.Error(), tt.errContains) {
					t.Errorf("GetEarliestBlockHeight() error = %q, want error containing %q", err.Error(), tt.errContains)
				}
			} else {
				if err != nil {
					t.Errorf("GetEarliestBlockHeight() unexpected error: %v", err)
					return
				}
			}

			if got != tt.wantHeight {
				t.Errorf("GetEarliestBlockHeight() = %d, want %d", got, tt.wantHeight)
			}
		})
	}
}

func TestGetEarliestBlockHeight_CallCount(t *testing.T) {
	originalGetter := grpcResponseGetter
	t.Cleanup(func() {
		grpcResponseGetter = originalGetter
	})

	t.Run("archive node makes only one call", func(t *testing.T) {
		callCount := 0
		grpcResponseGetter = func(_ *client.GRPCClient, _ string, _ uint, _ []byte) ([]byte, error) {
			callCount++
			return []byte(`{"block":{}}`), nil
		}

		_, err := GetEarliestBlockHeight(nil, 3)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if callCount != 1 {
			t.Errorf("expected 1 call for archive node, got %d", callCount)
		}
	})

	t.Run("pruned node makes only one call when boundary found", func(t *testing.T) {
		callCount := 0
		grpcResponseGetter = func(_ *client.GRPCClient, _ string, _ uint, _ []byte) ([]byte, error) {
			callCount++
			return nil, errors.New("height 1 is not available, lowest height is 1000")
		}

		_, err := GetEarliestBlockHeight(nil, 3)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if callCount != 1 {
			t.Errorf("expected 1 call for pruned node with boundary, got %d", callCount)
		}
	})

	t.Run("transient error triggers retry", func(t *testing.T) {
		callCount := 0
		grpcResponseGetter = func(_ *client.GRPCClient, _ string, _ uint, _ []byte) ([]byte, error) {
			callCount++
			return nil, errors.New("connection timeout")
		}

		_, _ = GetEarliestBlockHeight(nil, 3)
		if callCount != 2 {
			t.Errorf("expected 2 calls (initial + retry), got %d", callCount)
		}
	})
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > 0 && len(substr) > 0 && findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
