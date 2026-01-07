package extractor

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseLowestHeight(t *testing.T) {
	cases := []struct {
		name           string
		errMsg         string
		expectedHeight uint64
		expectedOk     bool
	}{
		{
			name:           "standard error message",
			errMsg:         "height 60 is not available, lowest height is 28566001",
			expectedHeight: 28566001,
			expectedOk:     true,
		},
		{
			name:           "wrapped error message",
			errMsg:         "failed to get block data: Failed after 3 retries: error invoking method: rpc error: code = Unknown desc = height 60 is not available, lowest height is 28566001",
			expectedHeight: 28566001,
			expectedOk:     true,
		},
		{
			name:           "different height values",
			errMsg:         "height 1 is not available, lowest height is 100",
			expectedHeight: 100,
			expectedOk:     true,
		},
		{
			name:           "large height value",
			errMsg:         "lowest height is 9999999999",
			expectedHeight: 9999999999,
			expectedOk:     true,
		},
		{
			name:           "no match - different error",
			errMsg:         "connection refused",
			expectedHeight: 0,
			expectedOk:     false,
		},
		{
			name:           "no match - empty string",
			errMsg:         "",
			expectedHeight: 0,
			expectedOk:     false,
		},
		{
			name:           "no match - partial message",
			errMsg:         "lowest height is",
			expectedHeight: 0,
			expectedOk:     false,
		},
		{
			name:           "no match - non-numeric height",
			errMsg:         "lowest height is abc",
			expectedHeight: 0,
			expectedOk:     false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			height, ok := parseLowestHeight(tc.errMsg)
			assert.Equal(t, tc.expectedOk, ok, "ok mismatch")
			assert.Equal(t, tc.expectedHeight, height, "height mismatch")
		})
	}
}

func TestErrHeightNotAvailable(t *testing.T) {
	err := &ErrHeightNotAvailable{
		RequestedHeight: 1,
		LowestHeight:    28566001,
	}

	assert.Equal(t, "height 1 is not available, lowest height is 28566001", err.Error())

	// Verify we can parse our own error message
	height, ok := parseLowestHeight(err.Error())
	assert.True(t, ok)
	assert.Equal(t, uint64(28566001), height)
}
