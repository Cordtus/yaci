// Package alpnfix disables grpc-go's ALPN enforcement for servers that don't support it.
// Import with blank identifier before any grpc imports: _ "github.com/manifest-network/yaci/internal/alpnfix"
package alpnfix

import "os"

func init() {
	os.Setenv("GRPC_ENFORCE_ALPN_ENABLED", "false")
}
