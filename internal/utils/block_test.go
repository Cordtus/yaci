package utils

import "testing"

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
			got := parseLowestHeightFromError(tt.errMsg)
			if got != tt.want {
				t.Errorf("parseLowestHeightFromError() = %d, want %d", got, tt.want)
			}
		})
	}
}
