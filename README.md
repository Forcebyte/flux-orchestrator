# Flux Orchestrator

A comprehensive multi-cluster GitOps management platform for Flux CD, providing a centralized UI and API similar to ArgoCD for managing Flux across multiple Kubernetes clusters.

## Features

- 🎯 **Multi-Cluster Management**: Monitor and manage Flux resources across multiple Kubernetes clusters from a single interface
- ☁️ **Azure AKS Integration**: Automatically discover and sync AKS clusters using Azure service principals
- 📊 **Unified Dashboard**: ArgoCD-inspired UI with real-time status of all Flux resources
- 🔄 **Resource Synchronization**: Trigger reconciliation for individual resources or entire clusters
- 💾 **Flexible Database Backend**: Support for PostgreSQL and MySQL
- 🔐 **Secure**: RBAC-enabled with Fernet-encrypted kubeconfig storage
- 🔒 **Encryption at Rest**: All sensitive kubeconfig data is encrypted using Fernet (AES-128-CBC with HMAC-SHA256)
- � **OAuth Authentication**: Optional OAuth support with GitHub and Microsoft Entra (Azure AD)
- 🌳 **Resource Tree View**: Visualize Kustomization resources and their managed workloads
- 📝 **Resource Management**: View logs, restart workloads, scale deployments, and manage child resources
- ⚡ **Auto-Sync**: Configurable automatic resource synchronization
- �🚀 **Easy Deployment**: Deploy to a central cluster with Kubernetes manifests

## Architecture

The Flux Orchestrator consists of:

- **Backend API** (Go): RESTful API server that manages clusters and Flux resources
- **Frontend UI** (React/TypeScript): Modern web interface for visualization and management
- **Database**: PostgreSQL or MySQL for storing cluster configurations and cached resource states
- **Kubernetes Integration**: Direct integration with Kubernetes API for multi-cluster management

## Quick Start

### Prerequisites

- Kubernetes cluster (central management cluster)
- PostgreSQL or MySQL database
- Go 1.21+ (for development)
- Node.js 18+ (for frontend development)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Forcebyte/flux-orchestrator.git
   cd flux-orchestrator
   ```

2. **Start a database**

   **Option A: PostgreSQL**
   ```bash
   docker run -d \
     --name postgres \
     -e POSTGRES_DB=flux_orchestrator \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgres \
     -p 5432:5432 \
     postgres:15-alpine
   ```

   **Option B: MySQL**
   ```bash
   docker run -d \
     --name mysql \
     -e MYSQL_DATABASE=flux_orchestrator \
     -e MYSQL_USER=flux \
     -e MYSQL_PASSWORD=flux \
     -e MYSQL_ROOT_PASSWORD=rootpass \
     -p 3306:3306 \
     mysql:8
   ```

3. **Generate an encryption key**
   ```bash
   # Using Python
   python3 -c "import base64; import os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
   
   # Or using Go
   go run ./tools/generate-key/main.go
   ```

4. **Start the backend**

   **For PostgreSQL:**
   ```bash
   export DB_DRIVER=postgres
   export DB_HOST=localhost
   export DB_PORT=5432
   export DB_USER=postgres
   export DB_PASSWORD=postgres
   export DB_NAME=flux_orchestrator
   export DB_SSLMODE=disable
   export PORT=8080
   export ENCRYPTION_KEY="your-generated-key-here"

   go run backend/cmd/server/main.go
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
   export ENCRYPTION_KEY="your-generated-key-here"

   go run backend/cmd/server/main.go
   ```

5. **Start the frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Access the UI**
   Open http://localhost:3000 in your browser

### Production Deployment

#### Using Pre-built Docker Image from GitHub Container Registry

The easiest way to deploy is using our pre-built images:

```bash
# Pull the latest image
docker pull ghcr.io/forcebyte/flux-orchestrator:latest

# Or use a specific version/branch
docker pull ghcr.io/forcebyte/flux-orchestrator:main
```

#### Using Kubernetes Manifests

1. **Update the image and database configuration**

   Edit `deploy/kubernetes/manifests.yaml`:
   - Update the image to use `ghcr.io/forcebyte/flux-orchestrator:latest`
   - Configure database settings (PostgreSQL is included by default)
   - Update database password in the Secret

2. **Deploy to Kubernetes**
   ```bash
   kubectl apply -f deploy/kubernetes/manifests.yaml
   ```

   This will create:
   - `flux-orchestrator` namespace
   - ServiceAccount with RBAC permissions
   - PostgreSQL StatefulSet (or configure your own database)
   - Flux Orchestrator Deployment
   - LoadBalancer Service

3. **Access the application**
   ```bash
   # Via port-forward
   kubectl port-forward -n flux-orchestrator svc/flux-orchestrator 8080:80
   
   # Or get the LoadBalancer IP
   kubectl get svc -n flux-orchestrator flux-orchestrator
   ```
   Open http://localhost:8080 in your browser

#### Using Your Own Database

To use an external PostgreSQL or MySQL database instead of the bundled one:

1. Remove the PostgreSQL StatefulSet from `deploy/kubernetes/manifests.yaml`
2. Update the ConfigMap with your database connection details:
   ```yaml
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: flux-orchestrator-config
     namespace: flux-orchestrator
   data:
     DB_DRIVER: "postgres"  # or "mysql"
     DB_HOST: "your-db-host"
     DB_PORT: "5432"        # or "3306" for MySQL
     DB_USER: "your-user"
     DB_NAME: "flux_orchestrator"
     DB_SSLMODE: "require"  # for PostgreSQL
     PORT: "8080"
   ```
3. Update the Secret with your database password

#### Building Your Own Docker Image

1. **Build the Docker image**
   ```bash
   docker build -t flux-orchestrator:latest .
   ```

2. **Push to your registry**
   ```bash
   docker tag flux-orchestrator:latest your-registry/flux-orchestrator:latest
   docker push your-registry/flux-orchestrator:latest
   ```

3. **Update Kubernetes manifests**
   Edit `deploy/kubernetes/manifests.yaml` and change the image reference

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
| `DB_DRIVER` | Database driver (`postgres` or `mysql`) | `postgres` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |
| `DB_NAME` | Database name | `flux_orchestrator` |
| `DB_SSLMODE` | SSL mode (PostgreSQL only) | `disable` |
| `ENCRYPTION_KEY` | Fernet encryption key for kubeconfigs | **(Required)** |
| `PORT` | API server port | `8080` |
| `SCRAPE_IN_CLUSTER` | Enable in-cluster scraping | `false` |
| `IN_CLUSTER_NAME` | Name for in-cluster configuration | `in-cluster` |
| `IN_CLUSTER_DESCRIPTION` | Description for in-cluster | `Local cluster...` |
| **OAuth Configuration** | | |
| `OAUTH_ENABLED` | Enable OAuth authentication | `false` |
| `OAUTH_PROVIDER` | OAuth provider (`github` or `entra`) | - |
| `OAUTH_CLIENT_ID` | OAuth app client ID | - |
| `OAUTH_CLIENT_SECRET` | OAuth app client secret | - |
| `OAUTH_REDIRECT_URL` | OAuth callback URL | `http://localhost:8080/api/v1/auth/callback` |
| `OAUTH_SCOPES` | Comma-separated OAuth scopes | - |
| `OAUTH_ALLOWED_USERS` | Comma-separated allowed user emails (optional) | - |

### OAuth Authentication (Optional)

Flux Orchestrator supports optional OAuth authentication with GitHub and Microsoft Entra (Azure AD). When enabled, users must authenticate before accessing the application.

**Quick Setup:**

1. **Create OAuth App** (GitHub or Azure AD)
2. **Configure Environment Variables:**
   ```bash
   OAUTH_ENABLED=true
   OAUTH_PROVIDER=github  # or "entra"
   OAUTH_CLIENT_ID=your_client_id
   OAUTH_CLIENT_SECRET=your_client_secret
   OAUTH_REDIRECT_URL=http://localhost:8080/api/v1/auth/callback
   ```
3. **Restart Application**

For detailed setup instructions, see **[docs/OAUTH.md](docs/OAUTH.md)**.

**Features:**
- ✅ GitHub and Microsoft Entra support
- ✅ Optional user allow-list
- ✅ 24-hour session management
- ✅ CSRF protection
- ✅ Modern login UI

## Security

### Kubeconfig Encryption

All kubeconfig data is encrypted at rest using **Fernet** (AES-128-CBC with HMAC-SHA256) before being stored in the database. This ensures that even with direct database access, the kubeconfig contents cannot be read without the encryption key.

**Setup:**
1. Generate an encryption key:
   ```bash
   python3 -c "import base64; import os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
   ```
2. Set the `ENCRYPTION_KEY` environment variable
3. Store the key securely (Kubernetes Secret, secrets manager, etc.)

For more details, see [docs/ENCRYPTION.md](docs/ENCRYPTION.md).

### Best Practices

- 🔑 Never commit the `ENCRYPTION_KEY` to version control
- 🔐 Rotate encryption keys periodically
- 🛡️ Limit database access to authorized personnel only
- 📝 Enable database audit logging
- 🔒 Use Kubernetes RBAC to restrict access to secrets
- 🌐 Use TLS/HTTPS for all network communication

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
- `source`: Cluster source (manual/azure-aks)
- `source_id`: Azure resource ID or other source identifier
- `created_at`, `updated_at`: Timestamps

**azure_subscriptions**
- `id`: Azure subscription ID
- `name`: Subscription name
- `tenant_id`: Azure tenant ID
- `credentials`: Encrypted service principal credentials
- `status`: Connection status (active/error/unknown)
- `cluster_count`: Number of AKS clusters
- `last_synced_at`: Last sync timestamp
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

## Azure AKS Integration

Flux Orchestrator can automatically discover and manage AKS clusters using Azure service principals. This provides seamless integration with your Azure infrastructure without manually exporting kubeconfig files.

### Prerequisites

1. **Azure Service Principal** with permissions:
   - Azure Kubernetes Service Cluster User Role
   - Reader role on subscription or resource groups

2. **kubelogin** installed on the server running Flux Orchestrator:
   ```bash
   # Install kubelogin
   brew install Azure/kubelogin/kubelogin  # macOS
   # OR download from: https://github.com/Azure/kubelogin/releases
   ```

### Setup

1. **Create a Service Principal**:
   ```bash
   az ad sp create-for-rbac --name flux-orchestrator-sp --role "Azure Kubernetes Service Cluster User Role" --scopes /subscriptions/{subscription-id}
   ```

2. **Note the credentials** from the output:
   - `appId` → Client ID
   - `password` → Client Secret
   - `tenant` → Tenant ID

3. **Add Azure Subscription** in the UI:
   - Go to Settings → Azure AKS tab
   - Click "Add Subscription"
   - Enter your subscription details and service principal credentials
   - Click "Test Connection" to verify

4. **Discover and Sync Clusters**:
   - Click the 🔍 icon to discover AKS clusters
   - Review the list of discovered clusters
   - Click "Sync" to import all clusters

Clusters imported from Azure will be marked with a ☁️ badge and can be managed like any other cluster.

For detailed Azure integration documentation, see [docs/AZURE_AKS.md](docs/AZURE_AKS.md).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Inspired by [ArgoCD](https://argoproj.github.io/cd/)
- Built for [Flux CD](https://fluxcd.io/)
