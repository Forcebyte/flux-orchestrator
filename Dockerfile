# syntax=docker/dockerfile:1.4

# Backend builder
FROM golang:1.25-alpine AS backend-builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies with cache mount
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# Copy source code
COPY backend ./backend
COPY tools ./tools

# Build with cache mounts for faster builds
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} \
    go build -ldflags="-s -w" -trimpath -o /flux-orchestrator ./backend/cmd/server

# Frontend builder
FROM node:25-alpine AS frontend-builder
WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

# Copy source code
COPY frontend ./

# Build with production optimizations
RUN npm run build

# Final image
FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/

# Copy built artifacts
COPY --from=backend-builder /flux-orchestrator .
COPY --from=frontend-builder /app/dist ./frontend/dist

# Add non-root user for security
RUN addgroup -g 1000 flux && \
    adduser -D -u 1000 -G flux flux && \
    chown -R flux:flux /root

USER flux

EXPOSE 8080
CMD ["./flux-orchestrator"]
