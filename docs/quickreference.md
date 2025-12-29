---
layout: default
title: Quick Reference
nav_order: 14
permalink: /quickreference
description: "Quick reference for common tasks"
---

# Quick Reference
{: .no_toc }

Quick reference guide for common tasks and commands.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Environment Variables

### Required

```bash
# Encryption key (required)
ENCRYPTION_KEY=your-fernet-key-here

# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=flux_orchestrator
```

### Optional

```bash
# Environment (development/production)
ENV=development

# OAuth (optional)
OAUTH_ENABLED=true
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GITHUB_REDIRECT_URL=http://localhost:8080/api/v1/auth/callback

# Azure AKS (optional)
SCRAPE_IN_CLUSTER=false
```

## API Endpoints

### Clusters

```bash
# List all clusters
GET /api/v1/clusters

# Get cluster details
GET /api/v1/clusters/{id}

# Create cluster
POST /api/v1/clusters
{
  "name": "production",
  "description": "Production cluster",
  "kubeconfig": "base64-encoded-kubeconfig"
}

# Delete cluster
DELETE /api/v1/clusters/{id}
```

### Resources

```bash
# List resources by cluster
GET /api/v1/clusters/{id}/resources

# Get resource tree
GET /api/v1/clusters/{id}/resources/tree

# Reconcile resource
POST /api/v1/clusters/{id}/flux/{kind}/{namespace}/{name}/reconcile

# Suspend/Resume
POST /api/v1/clusters/{id}/flux/{kind}/{namespace}/{name}/suspend
POST /api/v1/clusters/{id}/flux/{kind}/{namespace}/{name}/resume
```

### Logs

```bash
# Get aggregated logs
GET /api/v1/logs/aggregated?cluster_id=xxx&namespace=xxx&tail_lines=100

# Get pod logs
GET /api/v1/clusters/{id}/pods/{namespace}/{pod}/logs?container=xxx&tail=100
```

### RBAC

```bash
# List users
GET /api/v1/rbac/users

# List roles
GET /api/v1/rbac/roles

# Assign role to user
PUT /api/v1/rbac/users/{id}/roles
{
  "role_ids": ["role-1", "role-2"]
}
```

## Docker Commands

### Using Docker Compose

```bash
# Start with PostgreSQL
docker-compose up -d

# Start with MySQL
docker-compose -f docker-compose-mysql.yml up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild
docker-compose up -d --build
```

### Using Docker

```bash
# Run PostgreSQL
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=flux_orchestrator \
  -p 5432:5432 \
  postgres:15

# Run Flux Orchestrator
docker run -d \
  --name flux-orchestrator \
  -p 8080:8080 \
  -e DB_HOST=postgres \
  -e DB_PASSWORD=password \
  -e ENCRYPTION_KEY=your-key \
  ghcr.io/forcebyte/flux-orchestrator:latest
```

## CLI Commands

### Generate Encryption Key

```bash
# Using Go tool
cd tools/generate-key
go run main.go

# Using Python
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Using OpenSSL
openssl rand -base64 32
```

### Database Migrations

```bash
# The application auto-migrates on startup
# No manual migration commands needed

# To reset database (CAUTION: deletes all data)
docker-compose down -v
docker-compose up -d
```

## Kubernetes Deployment

```bash
# Apply manifests
kubectl apply -f deploy/kubernetes/manifests.yaml

# Check status
kubectl get pods -n flux-orchestrator
kubectl get svc -n flux-orchestrator

# View logs
kubectl logs -n flux-orchestrator -l app=flux-orchestrator -f

# Port forward for local access
kubectl port-forward -n flux-orchestrator svc/flux-orchestrator 8080:80
```

## Development Commands

### Backend

```bash
# Run backend
cd backend
go run cmd/server/main.go

# Run tests
go test ./...

# Build
go build -o server cmd/server/main.go
```

### Frontend

```bash
# Install dependencies
cd frontend
npm install

# Run development server
npm run dev

# Run in demo mode
npm run dev:demo

# Build for production
npm run build

# Preview production build
npm run preview
```

## Troubleshooting

### Connection Refused

```bash
# Check if backend is running
curl http://localhost:8080/readiness

# Check database connection
docker-compose logs postgres
```

### Authentication Errors

```bash
# Verify OAuth configuration
curl http://localhost:8080/api/v1/oauth/providers

# Check session
# Sessions are in-memory, restart to clear
```

### Resource Sync Issues

```bash
# Manually sync cluster
curl -X POST http://localhost:8080/api/v1/clusters/{id}/sync

# Check cluster health
curl http://localhost:8080/api/v1/clusters/{id}/health
```

## Health Checks

```bash
# Liveness probe (basic health)
curl http://localhost:8080/health

# Readiness probe (checks dependencies)
curl http://localhost:8080/readiness
```

## Monitoring

### Prometheus Metrics

```bash
# Scrape endpoint
curl http://localhost:8080/metrics

# Common metrics:
# - flux_orchestrator_requests_total
# - flux_orchestrator_request_duration_seconds
# - flux_orchestrator_cluster_count
# - flux_orchestrator_resource_count
```

### Activity Logs

```bash
# Get recent activities
GET /api/v1/activities?limit=50

# Filter by cluster
GET /api/v1/activities?cluster_id=xxx

# Filter by action type
GET /api/v1/activities?action=reconcile
```

## Common Issues

### "Encryption key required"
Set `ENCRYPTION_KEY` environment variable with a valid Fernet key.

### "Database connection failed"
Check database credentials and ensure database is running.

### "Kubeconfig invalid"
Ensure kubeconfig is base64 encoded and has valid cluster credentials.

### "403 Forbidden" in Kubernetes
Service account needs RBAC permissions for the resources you're accessing.

## Useful Links

- [📖 Documentation](https://forcebyte.github.io/flux-orchestrator)
- [🎯 Live Demo](https://flux-orchestrator-demo.vercel.app)
- [🐛 Report Issues](https://github.com/Forcebyte/flux-orchestrator/issues)
- [💬 Discussions](https://github.com/Forcebyte/flux-orchestrator/discussions)
