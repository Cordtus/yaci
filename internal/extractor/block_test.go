package extractor

import (
	"sync"
	"testing"
)

func TestParseLowestHeight(t *testing.T) {
	tests := []struct {
		name      string
		errMsg    string
		wantOk    bool
		wantHeight uint64
	}{
		{
			name:       "standard cosmos error message",
			errMsg:     "height 60 is not available, lowest height is 28566001",
			wantOk:     true,
			wantHeight: 28566001,
		},
		{
			name:       "wrapped error message",
			errMsg:     "failed to get block data: rpc error: code = Unknown desc = height 1 is not available, lowest height is 12345",
			wantOk:     true,
			wantHeight: 12345,
		},
		{
			name:       "large height value",
			errMsg:     "lowest height is 999999999999",
			wantOk:     true,
			wantHeight: 999999999999,
		},
		{
			name:       "height 1",
			errMsg:     "lowest height is 1",
			wantOk:     true,
			wantHeight: 1,
		},
		{
			name:   "no match - different error",
			errMsg: "connection refused",
			wantOk: false,
		},
		{
			name:   "no match - empty string",
			errMsg: "",
			wantOk: false,
		},
		{
			name:   "no match - partial match",
			errMsg: "lowest height is",
			wantOk: false,
		},
		{
			name:   "no match - non-numeric",
			errMsg: "lowest height is abc",
			wantOk: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			height, ok := parseLowestHeight(tt.errMsg)
			if ok != tt.wantOk {
				t.Errorf("parseLowestHeight() ok = %v, want %v", ok, tt.wantOk)
			}
			if ok && height != tt.wantHeight {
				t.Errorf("parseLowestHeight() height = %v, want %v", height, tt.wantHeight)
			}
		})
	}
}

func TestErrHeightNotAvailable_Error(t *testing.T) {
	err := &ErrHeightNotAvailable{
		RequestedHeight: 100,
		LowestHeight:    50000,
	}

	want := "height 100 is not available, lowest height is 50000"
	if got := err.Error(); got != want {
		t.Errorf("ErrHeightNotAvailable.Error() = %q, want %q", got, want)
	}
}

func TestPrunedNodeSignal_Signal(t *testing.T) {
	t.Run("first signal succeeds", func(t *testing.T) {
		signal := &prunedNodeSignal{}
		if !signal.signal(1000) {
			t.Error("first signal() should return true")
		}
		if !signal.isDetected() {
			t.Error("isDetected() should return true after signal")
		}
		if signal.getLowestHeight() != 1000 {
			t.Errorf("getLowestHeight() = %d, want 1000", signal.getLowestHeight())
		}
	})

	t.Run("second signal fails", func(t *testing.T) {
		signal := &prunedNodeSignal{}
		signal.signal(1000)
		if signal.signal(2000) {
			t.Error("second signal() should return false")
		}
		// Should keep first value
		if signal.getLowestHeight() != 1000 {
			t.Errorf("getLowestHeight() = %d, want 1000 (first value)", signal.getLowestHeight())
		}
	})

	t.Run("signal calls cancel function", func(t *testing.T) {
		cancelled := false
		signal := &prunedNodeSignal{
			cancel: func() { cancelled = true },
		}
		signal.signal(1000)
		if !cancelled {
			t.Error("signal() should call cancel function")
		}
	})

	t.Run("concurrent signals", func(t *testing.T) {
		signal := &prunedNodeSignal{}
		var wg sync.WaitGroup
		successCount := 0
		var mu sync.Mutex

		// Launch 100 goroutines all trying to signal
		for i := 0; i < 100; i++ {
			wg.Add(1)
			go func(height uint64) {
				defer wg.Done()
				if signal.signal(height) {
					mu.Lock()
					successCount++
					mu.Unlock()
				}
			}(uint64(i))
		}

		wg.Wait()

		if successCount != 1 {
			t.Errorf("exactly one signal should succeed, got %d", successCount)
		}
		if !signal.isDetected() {
			t.Error("isDetected() should return true")
		}
	})
}

func TestPrunedNodeSignal_InitialState(t *testing.T) {
	signal := &prunedNodeSignal{}
	if signal.isDetected() {
		t.Error("new signal should not be detected")
	}
	if signal.getLowestHeight() != 0 {
		t.Errorf("new signal lowestHeight should be 0, got %d", signal.getLowestHeight())
	}
}
