package reflection

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/bufbuild/protocompile"
	"github.com/bufbuild/protocompile/linker"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
)

// ProtoDir represents a directory containing .proto files that can be loaded
// as fallback types when server reflection fails to resolve deprecated types.
type ProtoDir struct {
	path     string
	registry *protoregistry.Files
	loaded   bool
	mu       sync.Mutex
}

// NewProtoDir creates a ProtoDir for the given directory path.
// The directory is not loaded until Load() is called or a lookup triggers lazy loading.
func NewProtoDir(path string) *ProtoDir {
	return &ProtoDir{
		path:     path,
		registry: &protoregistry.Files{},
	}
}

// Path returns the directory path.
func (p *ProtoDir) Path() string {
	return p.path
}

// Load compiles all .proto files in the directory and registers them.
// This method is safe to call multiple times (subsequent calls are no-ops).
// Uses protocompile to parse proto files with automatic import resolution.
func (p *ProtoDir) Load(ctx context.Context) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.loaded {
		return nil
	}

	// Verify directory exists
	info, err := os.Stat(p.path)
	if err != nil {
		return fmt.Errorf("proto directory %s: %w", p.path, err)
	}
	if !info.IsDir() {
		return fmt.Errorf("proto path %s is not a directory", p.path)
	}

	// Find all .proto files
	protoFiles, err := findProtoFiles(p.path)
	if err != nil {
		return fmt.Errorf("scanning proto directory %s: %w", p.path, err)
	}

	if len(protoFiles) == 0 {
		p.loaded = true
		return nil
	}

	// Make paths relative to the import path for protocompile
	relPaths := make([]string, len(protoFiles))
	for i, f := range protoFiles {
		rel, err := filepath.Rel(p.path, f)
		if err != nil {
			relPaths[i] = filepath.Base(f)
		} else {
			relPaths[i] = rel
		}
	}

	// Compile using protocompile with standard imports (google/protobuf/*)
	compiler := protocompile.Compiler{
		Resolver: protocompile.WithStandardImports(
			&protocompile.SourceResolver{
				ImportPaths: []string{p.path},
			},
		),
	}

	files, err := compiler.Compile(ctx, relPaths...)
	if err != nil {
		return fmt.Errorf("compiling proto files in %s: %w", p.path, err)
	}

	// Register all compiled files
	for _, file := range files {
		// protocompile results implement linker.File which embeds FileDescriptor
		if _, ok := file.(linker.Result); !ok {
			continue
		}

		if err := p.registry.RegisterFile(file); err != nil {
			// Skip duplicates (may already be registered via dependencies)
			if !strings.Contains(err.Error(), "already registered") {
				return fmt.Errorf("registering %s: %w", file.Path(), err)
			}
		}
	}

	p.loaded = true
	return nil
}

// FindDescriptorByName looks up a descriptor by full name.
// Triggers lazy loading if not already loaded.
func (p *ProtoDir) FindDescriptorByName(ctx context.Context, name protoreflect.FullName) (protoreflect.Descriptor, error) {
	if err := p.Load(ctx); err != nil {
		return nil, err
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	return p.registry.FindDescriptorByName(name)
}

// Registry returns the underlying file registry.
// Returns nil if not yet loaded.
func (p *ProtoDir) Registry() *protoregistry.Files {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.registry
}

// IsLoaded returns whether the proto directory has been loaded.
func (p *ProtoDir) IsLoaded() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.loaded
}

// findProtoFiles recursively finds all .proto files in a directory.
func findProtoFiles(dir string) ([]string, error) {
	var files []string
	err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && strings.HasSuffix(path, ".proto") {
			files = append(files, path)
		}
		return nil
	})
	return files, err
}

// SuggestProtoFile generates a hint about which proto file might contain a type.
// Used for error messages when type resolution fails.
func SuggestProtoFile(typeName string) string {
	parts := strings.Split(typeName, ".")
	if len(parts) < 2 {
		return "add the proto definition to your fallback directory"
	}

	// Construct likely proto file path from package
	// e.g., "tendermint.liquidity.v1beta1.MsgSwapWithinBatch"
	//       -> "tendermint/liquidity/v1beta1/*.proto"
	packagePath := strings.Join(parts[:len(parts)-1], "/")

	return fmt.Sprintf("add proto file to fallback directory at %s/*.proto", packagePath)
}
