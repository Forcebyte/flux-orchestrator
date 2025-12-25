# Flux Orchestrator

A comprehensive multi-cluster GitOps management platform for Flux CD, providing a centralized UI and API similar to ArgoCD for managing Flux across multiple Kubernetes clusters.

## Features

- 🎯 **Multi-Cluster Management**: Monitor and manage Flux resources across multiple Kubernetes clusters from a single interface
- 📊 **Unified Dashboard**: ArgoCD-inspired UI with real-time status of all Flux resources
- 🔄 **Resource Synchronization**: Trigger reconciliation for individual resources or entire clusters
- 💾 **PostgreSQL Backend**: Persistent storage of cluster configurations and resource states
- 🔐 **Secure**: RBAC-enabled with secure kubeconfig storage
- 🚀 **Easy Deployment**: Deploy to a central cluster with Kubernetes manifests

## Architecture

The Flux Orchestrator consists of:

- **Backend API** (Go): RESTful API server that manages clusters and Flux resources
- **Frontend UI** (React/TypeScript): Modern web interface for visualization and management
- **PostgreSQL Database**: Stores cluster configurations and cached resource states
- **Kubernetes Integration**: Direct integration with Kubernetes API for multi-cluster management

## Quick Start

### Prerequisites

- Kubernetes cluster (central management cluster)
- PostgreSQL database
- Go 1.21+ (for development)
- Node.js 18+ (for frontend development)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Forcebyte/flux-orchestrator.git
   cd flux-orchestrator
   ```

2. **Start PostgreSQL**
   ```bash
   docker run -d \
     --name postgres \
     -e POSTGRES_DB=flux_orchestrator \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgres \
     -p 5432:5432 \
     postgres:15-alpine
   ```

3. **Start the backend**
   ```bash
   export DB_HOST=localhost
   export DB_PORT=5432
   export DB_USER=postgres
   export DB_PASSWORD=postgres
   export DB_NAME=flux_orchestrator
   export DB_SSLMODE=disable
   export PORT=8080

   go run backend/cmd/server/main.go
   ```

4. **Start the frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Access the UI**
   Open http://localhost:3000 in your browser

### Production Deployment

#### Using Docker

1. **Build the Docker image**
   ```bash
   docker build -t flux-orchestrator:latest .
   ```

2. **Deploy to Kubernetes**
   ```bash
   kubectl apply -f deploy/kubernetes/manifests.yaml
   ```

3. **Access the application**
   ```bash
   kubectl port-forward -n flux-orchestrator svc/flux-orchestrator 8080:80
   ```
   Open http://localhost:8080 in your browser

## Usage

### Adding a Cluster

1. Navigate to the "Clusters" page
2. Click "+ Add Cluster"
3. Provide:
   - **Cluster Name**: A friendly name for your cluster
   - **Description**: Optional description
   - **Kubeconfig**: Paste the kubeconfig content for the cluster
4. Click "Add Cluster"

The orchestrator will connect to the cluster and check its health status.

### Viewing Resources

1. Click on a cluster to view its Flux resources
2. Resources are organized by type:
   - Kustomizations
   - HelmReleases
   - GitRepositories
   - HelmRepositories
3. View status, last reconciliation time, and messages

### Triggering Reconciliation

- **Single Resource**: Click "Reconcile" button on any resource
- **All Resources**: Click "Sync All Resources" in cluster detail view

### Dashboard

The dashboard provides an overview of all resources across all clusters:
- Total resource count
- Status breakdown (Ready/Not Ready/Unknown)
- Resources grouped by cluster

## API Documentation

### Clusters

- `GET /api/v1/clusters` - List all clusters
- `POST /api/v1/clusters` - Create a new cluster
- `GET /api/v1/clusters/{id}` - Get cluster details
- `PUT /api/v1/clusters/{id}` - Update cluster
- `DELETE /api/v1/clusters/{id}` - Delete cluster
- `GET /api/v1/clusters/{id}/health` - Check cluster health
- `POST /api/v1/clusters/{id}/sync` - Sync cluster resources

### Resources

- `GET /api/v1/resources` - List all resources (with optional `?kind=` filter)
- `GET /api/v1/clusters/{id}/resources` - List resources for a cluster
- `GET /api/v1/resources/{id}` - Get resource details
- `POST /api/v1/resources/reconcile` - Trigger resource reconciliation

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `postgres` |
| `DB_NAME` | Database name | `flux_orchestrator` |
| `DB_SSLMODE` | SSL mode for PostgreSQL | `disable` |
| `PORT` | API server port | `8080` |

### RBAC Permissions

The orchestrator requires the following Kubernetes permissions:

- Read access to Flux CRDs (Kustomizations, HelmReleases, GitRepositories, etc.)
- Update/Patch access to trigger reconciliations
- List access to namespaces

See `deploy/kubernetes/manifests.yaml` for the complete RBAC configuration.

## Architecture Details

### Backend (Go)

```
backend/
├── cmd/server/         # Main application entry point
└── internal/
    ├── api/           # HTTP handlers and routing
    ├── database/      # Database connection and schema
    ├── k8s/           # Kubernetes client wrapper
    └── models/        # Data models
```

### Frontend (React/TypeScript)

```
frontend/
├── src/
│   ├── components/    # React components
│   ├── api.ts        # API client
│   ├── types.ts      # TypeScript types
│   └── App.tsx       # Main application
└── public/           # Static assets
```

### Database Schema

**clusters**
- `id`: Unique cluster identifier
- `name`: Cluster name
- `description`: Optional description
- `kubeconfig`: Encrypted kubeconfig
- `status`: Health status (healthy/unhealthy/unknown)
- `created_at`, `updated_at`: Timestamps

**flux_resources**
- `id`: Unique resource identifier
- `cluster_id`: Foreign key to clusters
- `kind`: Resource type (Kustomization, HelmRelease, etc.)
- `name`, `namespace`: Resource identifiers
- `status`: Resource status (Ready/NotReady/Unknown)
- `message`: Status message
- `last_reconcile`: Last reconciliation timestamp
- `metadata`: JSON blob with full resource data

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Inspired by [ArgoCD](https://argoproj.github.io/cd/)
- Built for [Flux CD](https://fluxcd.io/)
