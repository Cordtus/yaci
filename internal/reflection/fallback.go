package reflection

import (
	"context"
	"fmt"
	"sync"

	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"
)

// FallbackRegistry holds pre-compiled proto descriptors for types that may not
// be available via server reflection (e.g., deprecated modules).
type FallbackRegistry struct {
	files    *protoregistry.Files
	protoDir *ProtoDir // optional local proto directory
	mu       sync.RWMutex
}

// globalFallback is the default fallback registry used when no custom one is provided.
var globalFallback = &FallbackRegistry{
	files: &protoregistry.Files{},
}

// GlobalFallback returns the global fallback registry.
// Use this to register fallback descriptors that should be available to all clients.
func GlobalFallback() *FallbackRegistry {
	return globalFallback
}

// NewFallbackRegistry creates a new empty fallback registry.
func NewFallbackRegistry() *FallbackRegistry {
	return &FallbackRegistry{
		files: &protoregistry.Files{},
	}
}

// RegisterFileDescriptor registers a single file descriptor proto.
// Dependencies must be registered first.
func (r *FallbackRegistry) RegisterFileDescriptor(fdProto *descriptorpb.FileDescriptorProto) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Check if already registered
	if _, err := r.files.FindFileByPath(fdProto.GetName()); err == nil {
		return nil // Already registered
	}

	fd, err := protodesc.NewFile(fdProto, r.files)
	if err != nil {
		return fmt.Errorf("failed to create file descriptor for %s: %w", fdProto.GetName(), err)
	}

	if err := r.files.RegisterFile(fd); err != nil {
		return fmt.Errorf("failed to register file %s: %w", fdProto.GetName(), err)
	}

	return nil
}

// RegisterFileDescriptorSet registers multiple file descriptor protos.
// Files are registered in order, so dependencies should come first.
func (r *FallbackRegistry) RegisterFileDescriptorSet(fds *descriptorpb.FileDescriptorSet) error {
	for _, fdProto := range fds.File {
		if err := r.RegisterFileDescriptor(fdProto); err != nil {
			return err
		}
	}
	return nil
}

// FindDescriptorByName looks up a descriptor by its full name.
// First checks the in-memory registry, then the local proto directory if configured.
func (r *FallbackRegistry) FindDescriptorByName(ctx context.Context, name protoreflect.FullName) (protoreflect.Descriptor, error) {
	r.mu.RLock()

	// First check in-memory registry
	desc, err := r.files.FindDescriptorByName(name)
	if err == nil {
		r.mu.RUnlock()
		return desc, nil
	}

	// Check proto directory (lazy load if needed)
	protoDir := r.protoDir
	r.mu.RUnlock()

	if protoDir != nil {
		return protoDir.FindDescriptorByName(ctx, name)
	}

	return nil, err
}

// SetProtoDir configures a local proto directory for fallback resolution.
// The directory will be loaded lazily when first needed.
func (r *FallbackRegistry) SetProtoDir(dir *ProtoDir) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.protoDir = dir
}

// ProtoDir returns the configured proto directory, or nil if none.
func (r *FallbackRegistry) ProtoDir() *ProtoDir {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.protoDir
}

// Files returns the underlying file registry.
func (r *FallbackRegistry) Files() *protoregistry.Files {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.files
}

// MergeInto merges this fallback registry into a target protoregistry.Files.
// This is used during resolver initialization.
func (r *FallbackRegistry) MergeInto(target *protoregistry.Files) error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var mergeErr error
	r.files.RangeFiles(func(fd protoreflect.FileDescriptor) bool {
		// Skip if already registered
		if _, err := target.FindFileByPath(fd.Path()); err == nil {
			return true
		}
		if err := target.RegisterFile(fd); err != nil {
			mergeErr = fmt.Errorf("failed to merge file %s: %w", fd.Path(), err)
			return false
		}
		return true
	})

	return mergeErr
}
