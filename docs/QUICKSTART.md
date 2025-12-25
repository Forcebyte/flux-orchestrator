# Quick Start Guide

Get Flux Orchestrator up and running in minutes!

## Option 1: Local Development (Fastest)

### Prerequisites
- Go 1.21+
- Node.js 18+
- Docker (for PostgreSQL)

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/Forcebyte/flux-orchestrator.git
   cd flux-orchestrator
   ```

2. **Start PostgreSQL**
   ```bash
   docker run -d \
     --name flux-orchestrator-postgres \
     -e POSTGRES_DB=flux_orchestrator \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgres \
     -p 5432:5432 \
     postgres:15-alpine
   ```

3. **Start the backend** (in one terminal)
   ```bash
   make backend-dev
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
   ```bash
   docker-compose up -d
   ```

3. **Access the UI**
   Open http://localhost:8080

## Option 3: Kubernetes Deployment

### Prerequisites
- Kubernetes cluster
- kubectl configured

### Steps

1. **Build and push image**
   ```bash
   # Build
   docker build -t your-registry/flux-orchestrator:latest .
   
   # Push to your registry
   docker push your-registry/flux-orchestrator:latest
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

### Frontend won't start
- Check Node.js version: `node --version` (should be 18+)
- Delete node_modules and reinstall: `rm -rf node_modules && npm install`
- Check port 3000 is available: `lsof -i :3000`

### Can't connect to cluster
- Verify kubeconfig is valid: `kubectl --kubeconfig=<path> get nodes`
- Check network connectivity to cluster API
- Ensure cluster has Flux installed: `kubectl get crd | grep flux`

## Next Steps

After setup, try:
1. Adding multiple clusters
2. Viewing resources across clusters
3. Triggering reconciliation
4. Monitoring resource health
5. Setting up periodic syncs

For detailed usage, see the [main README](../README.md).
