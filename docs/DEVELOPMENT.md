---
layout: default
title: Development
nav_order: 4
permalink: /development
description: "Local development setup and guidelines"
---

# Development Guide
{: .no_toc }

Set up your local development environment.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

# Development Guide

## Prerequisites

- Go 1.21+
- Node.js 18+
- PostgreSQL 15+
- kubectl (for testing Kubernetes integration)

## Local Development Setup

### 1. Start PostgreSQL

Using Docker:
```bash
docker run -d \
  --name flux-orchestrator-postgres \
  -e POSTGRES_DB=flux_orchestrator \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15-alpine
```

Or use an existing PostgreSQL installation and create the database:
```sql
CREATE DATABASE flux_orchestrator;
```

### 2. Backend Development

```bash
# Install dependencies
go mod download

# Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_NAME=flux_orchestrator
export DB_SSLMODE=disable
export PORT=8080

# Run the backend
make backend-dev
# or
go run backend/cmd/server/main.go
```

The backend will:
- Connect to PostgreSQL
- Initialize the database schema
- Start the HTTP server on port 8080
- Load any existing cluster configurations

### 3. Frontend Development

In a new terminal:

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

The frontend will:
- Start Vite dev server on port 3000
- Proxy API requests to http://localhost:8080
- Auto-reload on file changes

Access the UI at http://localhost:3000

## Project Structure

```
flux-orchestrator/
├── backend/                    # Go backend
│   ├── cmd/
│   │   └── server/            # Main application
│   └── internal/
│       ├── api/               # HTTP handlers and routing
│       ├── database/          # Database connection and schema
│       ├── k8s/              # Kubernetes client
│       └── models/            # Data models
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── api.ts           # API client
│   │   ├── types.ts         # TypeScript types
│   │   └── App.tsx          # Main app
│   └── public/              # Static files
├── deploy/                   # Deployment manifests
│   └── kubernetes/
└── docs/                     # Documentation
```

## Making Changes

### Backend Changes

1. Edit files in `backend/`
2. The server will need to be restarted (no hot reload)
3. Run tests: `go test ./...`
4. Check logs in terminal (use `ENV=development` for readable format)

### Frontend Changes

1. Edit files in `frontend/src/`
2. Vite will auto-reload the browser
3. Check browser console for errors

### Database Schema Changes

1. Edit `backend/internal/database/database.go`
2. The schema is created on startup if tables don't exist
3. For migrations, you may need to manually update the database or drop tables

## Monitoring and Debugging

### Health Checks

Check service health:
```bash
# Basic health check
curl http://localhost:8080/health

# Readiness (checks database and K8s client)
curl http://localhost:8080/readiness

# Liveness
curl http://localhost:8080/liveness
```

### Metrics

View Prometheus metrics:
```bash
curl http://localhost:8080/metrics
```

Metrics include:
- HTTP request counts and durations
- Cluster health status
- Flux resource counts
- Reconciliation metrics
- Database query performance

### Logs

**Development mode** (human-readable):
```bash
ENV=development go run backend/cmd/server/main.go
```

**Production mode** (JSON for log aggregation):
```bash
go run backend/cmd/server/main.go
```

Each log entry includes a `request_id` for tracing requests through the system.

## Testing Locally

### Adding a Test Cluster

You'll need a kubeconfig for a cluster with Flux installed. You can use:

1. **Local kind/minikube cluster**: Set up a test cluster with Flux
2. **Existing cluster**: Use a development cluster (ensure you have appropriate permissions)

Example kubeconfig format:
```yaml
apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://your-cluster-api
    certificate-authority-data: <base64-cert>
  name: test-cluster
contexts:
- context:
    cluster: test-cluster
    user: test-user
  name: test-context
current-context: test-context
users:
- name: test-user
  user:
    token: <your-token>
```

### Testing Multi-Cluster

To test multi-cluster features:
1. Add multiple clusters through the UI
2. Ensure each cluster has Flux installed
3. Create some Flux resources (Kustomizations, HelmReleases, etc.)
4. Sync and observe resource status

## Building for Production

### Build Backend Binary

```bash
make build
# or
go build -o bin/flux-orchestrator ./backend/cmd/server
```

### Build Frontend

```bash
cd frontend
npm run build
```

This creates optimized static files in `frontend/build/`

### Build Docker Image

```bash
make docker-build
# or
docker build -t flux-orchestrator:latest .
```

## Debugging

### Backend Logs

The backend logs to stdout. Key log messages:
- Database connection status
- Cluster loading
- HTTP requests
- Sync worker activity

### Frontend Debugging

Use browser developer tools:
- Console: Check for JavaScript errors and API call logs
- Network tab: Inspect API requests/responses
- React DevTools: Inspect component state

### Database Debugging

Connect to PostgreSQL:
```bash
psql -h localhost -U postgres -d flux_orchestrator
```

Useful queries:
```sql
-- List clusters
SELECT id, name, status FROM clusters;

-- List resources
SELECT cluster_id, kind, name, namespace, status FROM flux_resources;

-- Check sync status
SELECT cluster_id, COUNT(*) as resource_count 
FROM flux_resources 
GROUP BY cluster_id;
```

## Common Issues

### Backend won't start

- Check PostgreSQL is running and accessible
- Verify database credentials
- Check if port 8080 is already in use

### Frontend can't connect to API

- Ensure backend is running on port 8080
- Check Vite proxy configuration in `vite.config.ts`
- Look for CORS errors in browser console

### Cluster connection fails

- Verify kubeconfig is valid
- Check network connectivity to cluster API
- Ensure cluster has Flux CRDs installed

## Code Style

### Go

- Follow standard Go formatting (`go fmt`)
- Use meaningful variable names
- Add comments for exported functions
- Keep functions focused and small

### TypeScript/React

- Use functional components with hooks
- Type all props and state
- Use meaningful component names
- Keep components focused on single responsibility

## Contributing

1. Create a feature branch
2. Make your changes
3. Test locally
4. Commit with clear messages
5. Push and create a pull request

## Resources

- [Flux CD Documentation](https://fluxcd.io/docs/)
- [Kubernetes Client Go](https://github.com/kubernetes/client-go)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
