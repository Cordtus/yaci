# Build stage
FROM golang:1.24.6-alpine AS builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache git make ca-certificates

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binary with version info
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags "-X github.com/manifest-network/yaci/cmd/yaci.Version=${VERSION} -w -s" \
    -tags manifest \
    -o yaci \
    ./main.go

# Runtime stage
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1000 yaci && \
    adduser -D -u 1000 -G yaci yaci

# Copy binary from builder
COPY --from=builder /build/yaci /usr/local/bin/yaci

# Set ownership
RUN chown yaci:yaci /usr/local/bin/yaci

# Switch to non-root user
USER yaci

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD ["yaci", "version"]

ENTRYPOINT ["yaci"]
CMD ["--help"]
