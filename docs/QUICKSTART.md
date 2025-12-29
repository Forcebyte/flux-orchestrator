---
layout: default
title: Quick Start
nav_order: 2
description: "Get started with Flux Orchestrator in 5 minutes"
---

# Quick Start Guide
{: .no_toc }

Get Flux Orchestrator up and running in 5 minutes.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

Get Flux Orchestrator up and running in minutes!

## Option 1: Local Development (Fastest)

### Prerequisites
- Go 1.21+
- Node.js 18+
- Docker (for database)

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/Forcebyte/flux-orchestrator.git
   cd flux-orchestrator
   ```

2. **Start a database**

   **Using PostgreSQL:**
   ```bash
   docker run -d \
     --name flux-orchestrator-postgres \
     -e POSTGRES_DB=flux_orchestrator \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgres \
     -p 5432:5432 \
     postgres:15-alpine
   ```

   **Using MySQL:**
   ```bash
   docker run -d \
     --name flux-orchestrator-mysql \
     -e MYSQL_DATABASE=flux_orchestrator \
     -e MYSQL_USER=flux \
     -e MYSQL_PASSWORD=flux \
     -e MYSQL_ROOT_PASSWORD=rootpass \
     -p 3306:3306 \
     mysql:8
   ```

3. **Start the backend** (in one terminal)

   **For PostgreSQL:**
   ```bash
   export DB_DRIVER=postgres
   export ENCRYPTION_KEY=$(python3 -c "import base64; import os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())")
   export ENV=development  # Optional: human-readable logs
   make backend-dev
   ```

   **For MySQL:**
   ```bash
   export DB_DRIVER=mysql
   export DB_HOST=localhost
   export DB_PORT=3306
   export DB_USER=flux
   export DB_PASSWORD=flux
   export DB_NAME=flux_orchestrator
   export PORT=8080
   go run backend/cmd/server/main.go
   ```

4. **Start the frontend** (in another terminal)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Access the UI**
   Open http://localhost:3000

## Option 2: Docker Compose

### Prerequisites
- Docker
- Docker Compose

### Steps

1. **Clone and build**
   ```bash
   git clone https://github.com/Forcebyte/flux-orchestrator.git
   cd flux-orchestrator
   make docker-build
   ```

2. **Start services**

   **With PostgreSQL (default):**
   ```bash
   docker-compose up -d
   ```

   **With MySQL:**
   ```bash
   docker-compose -f docker-compose-mysql.yml up -d
   ```

3. **Access the UI**
   Open http://localhost:8080

## Option 3: Kubernetes Deployment

### Prerequisites
- Kubernetes cluster
- kubectl configured

### Steps

1. **Use pre-built image from GitHub Container Registry**
   
   The manifests are already configured to use `ghcr.io/forcebyte/flux-orchestrator:latest`:

   ```bash
   kubectl apply -f deploy/kubernetes/manifests.yaml
   ```

   **Or build and push your own image:**
   ```bash
   # Build
   docker build -t your-registry/flux-orchestrator:latest .
   
   # Push to your registry
   docker push your-registry/flux-orchestrator:latest
   
   # Update the image in deploy/kubernetes/manifests.yaml
   # Then apply
   kubectl apply -f deploy/kubernetes/manifests.yaml
   ```

2. **Update image in manifests**
   Edit `deploy/kubernetes/manifests.yaml` and change the image:
   ```yaml
   image: your-registry/flux-orchestrator:latest
   ```

3. **Deploy**
   ```bash
   kubectl apply -f deploy/kubernetes/manifests.yaml
   ```

4. **Access the UI**
   ```bash
   kubectl port-forward -n flux-orchestrator svc/flux-orchestrator 8080:80
   ```
   Open http://localhost:8080

## First Time Setup

Once the application is running:

1. **Navigate to "Clusters"** in the sidebar

2. **Click "+ Add Cluster"**

3. **Enter cluster details:**
   - **Name**: A friendly name (e.g., "Production")
   - **Description**: Optional description
   - **Kubeconfig**: Paste your cluster's kubeconfig

   > Tip: See `docs/kubeconfig-example.yaml` for format

4. **Click "Add Cluster"**

5. **Sync resources:**
   - Click on the cluster card
   - Click "Sync All Resources"
   - Wait for resources to be discovered

6. **View your Flux resources!**
   - Dashboard shows overview across all clusters
   - Cluster detail shows resources for specific cluster
   - Click "Reconcile" on any resource to trigger Flux reconciliation

## What's Next?

- Read the [full documentation](../README.md)
- Explore the [architecture](./ARCHITECTURE.md)
- Learn about [development](./DEVELOPMENT.md)
- Check out [contributing](./CONTRIBUTING.md)

## Troubleshooting

### Backend won't start
- Check PostgreSQL is running: `docker ps | grep postgres`
- Check port 8080 is available: `lsof -i :8080`
- Verify ENCRYPTION_KEY is set

### Frontend won't start
- Check Node.js version: `node --version` (should be 18+)
- Delete node_modules and reinstall: `rm -rf node_modules && npm install`
- Check port 3000 is available: `lsof -i :3000`

### Can't connect to cluster
- Verify kubeconfig is valid: `kubectl --kubeconfig=<path> get nodes`
- Check network connectivity to cluster API
- Ensure cluster has Flux installed: `kubectl get crd | grep flux`

### Check Service Health
```bash
# Basic health check
curl http://localhost:8080/health

# Detailed readiness (checks database and K8s client)
curl http://localhost:8080/readiness
```

If readiness check fails, it will show which dependency is unavailable.

## Monitoring Your Deployment

### Logs

View application logs in real-time. Set `ENV=development` for human-readable format:
```bash
ENV=development go run backend/cmd/server/main.go
```

### Metrics

View Prometheus metrics at http://localhost:8080/metrics

Useful for monitoring:
- Request rates and latencies
- Cluster health status
- Resource sync performance
- Database query performance

### API Documentation

Swagger UI available at http://localhost:8080/swagger/index.html

## Next Steps

After setup, try:
1. Adding multiple clusters
2. Viewing resources across clusters
3. Triggering reconciliation
4. Monitoring resource health
5. Setting up periodic syncs

For detailed usage, see the [main README](../README.md).
