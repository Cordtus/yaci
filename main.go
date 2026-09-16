package main

import (
	_ "github.com/manifest-network/yaci/internal/alpnfix" // Disable ALPN enforcement for servers that don't support it

	"github.com/manifest-network/yaci/cmd/yaci"
)

func main() {
	yaci.Execute()
}
