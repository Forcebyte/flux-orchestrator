<div align="center">

<img src=".github/logo.png" alt="Flux Orchestrator Logo" width="200"/>

# Flux Orchestrator (v2)

<p><i>A comprehensive multi-cluster GitOps management platform for Flux CD</i></p>

[![View the Demo Site](https://img.shields.io/badge/view%20the%20demo-8A2BE2)](https://flux-orchestrator-demo.vercel.app)
[![Documentation](https://img.shields.io/badge/docs-github%20pages-blue)](https://forcebyte.github.io/flux-orchestrator)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)

</div>

---

[Try the Live Demo](demo.md) | [📖 Documentation](https://forcebyte.github.io/flux-orchestrator) | [Quick Start](#quick-start) | [Features](#features)

---

This service provides a centralized UI and API similar to ArgoCD for managing Flux across multiple Kubernetes clusters.

This allows an easy to access and manage method to view, validate, and remediate FluxCD configurations on clusters at scale

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

The easiest way to deploy is using one of the pre-built images:

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

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENV` | Environment mode (`development`, `dev`, or `production`) | `production` |
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
| **Timeouts and Performance** | | |
| `HTTP_READ_TIMEOUT_SECONDS` | HTTP server read timeout | `30` |
| `HTTP_WRITE_TIMEOUT_SECONDS` | HTTP server write timeout | `30` |
| `HTTP_IDLE_TIMEOUT_SECONDS` | HTTP server idle timeout | `120` |
| `SHUTDOWN_TIMEOUT_SECONDS` | Graceful shutdown timeout | `30` |
| `REQUEST_TIMEOUT_SECONDS` | Individual request timeout | `30` |
| `K8S_REQUEST_TIMEOUT_SECONDS` | Kubernetes API timeout | `30` |
| `DB_MAX_OPEN_CONNS` | Max open database connections | `25` |
| `DB_MAX_IDLE_CONNS` | Max idle database connections | `5` |
| `DB_CONN_MAX_LIFETIME_MINUTES` | Connection max lifetime | `5` |
| **Webhook Notifications** | | |
| `WEBHOOK_URLS` | Comma-separated webhook URLs | - |
| **OAuth Configuration** | | |
| `OAUTH_ENABLED` | Enable OAuth authentication | `false` |
| `OAUTH_PROVIDER` | OAuth provider (`github` or `entra`) | - |
| `OAUTH_CLIENT_ID` | OAuth app client ID | - |
| `OAUTH_CLIENT_SECRET` | OAuth app client secret | - |
| `OAUTH_REDIRECT_URL` | OAuth callback URL | `http://localhost:8080/api/v1/auth/callback` |
| `OAUTH_SCOPES` | Comma-separated OAuth scopes | - |
| `OAUTH_ALLOWED_USERS` | Comma-separated allowed user emails (optional) | - |

### Health Check Endpoints

The service exposes several health check endpoints:

- **`/health`** and **`/healthz`**: Basic health check (returns 200 OK)
- **`/readiness`**: Readiness probe that checks database connectivity and Kubernetes client
- **`/liveness`**: Liveness probe for Kubernetes (returns 200 OK)

These endpoints are useful for Kubernetes probes and load balancer health checks.

### Observability

**Structured Logging**: The application uses [zap](https://github.com/uber-go/zap) for structured logging. Set `ENV=development` for human-readable logs.

**Metrics**: Prometheus metrics are exposed at `/metrics` and include:
- HTTP request counts and durations
- Cluster health status
- Flux resource counts by type and status
- Reconciliation counts and errors
- Sync worker performance
- Database query metrics

**Request Tracing**: All HTTP requests include a unique `request_id` in logs for tracing.

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

For detailed setup instructions, see **[OAuth Authentication Guide](https://forcebyte.github.io/flux-orchestrator/oauth)**.


## Security

### Security Features

Flux Orchestrator implements multiple layers of security:

**Input Protection:**
- Input validation middleware detecting SQL injection patterns
- Path traversal protection
- Command injection detection
- XSS pattern filtering
- Header length validation

**HTTP Security Headers:**
- Content-Security-Policy (CSP)
- HTTP Strict Transport Security (HSTS) in production
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection
- Referrer-Policy

**Request Protection:**
- Configurable request timeouts
- Connection pooling limits
- Rate limiting via middleware

**Dependency Security:**
- Automated dependency updates via Dependabot
- Weekly security patch scanning
- Grouped minor/patch updates

### Kubeconfig Encryption

All kubeconfig data is encrypted at rest using **Fernet** (AES-128-CBC with HMAC-SHA256) before being stored in the database. This ensures that even with direct database access, the kubeconfig contents cannot be read without the encryption key.

**Setup:**
1. Generate an encryption key:
   ```bash
   python3 -c "import base64; import os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
   ```
2. Set the `ENCRYPTION_KEY` environment variable
3. Store the key securely (Kubernetes Secret, secrets manager, etc.)

For more details, see [Encryption Guide](https://forcebyte.github.io/flux-orchestrator/encryption).

### User Access Control (RBAC)

Flux Orchestrator includes a comprehensive Role-Based Access Control system for managing user permissions:

**Built-in Roles:**
- **Administrator**: Full access to all resources, users, and settings
- **Operator**: Can manage clusters and resources but not users or system settings
- **Viewer**: Read-only access to all resources

**Custom Roles:**
Create custom roles with specific permissions through the Settings > RBAC interface.

**Permission Model:**
- `cluster.*` - Cluster management (create, read, update, delete)
- `resource.*` - Flux resource operations (read, reconcile, suspend, resume, update, delete)
- `user.*` - User management
- `role.*` - Role management
- `setting.*` - System settings
- `azure.*` - Azure AKS integration

**Configuration:**
1. Enable OAuth authentication (GitHub or Microsoft Entra)
2. Users are automatically created on first login with "Viewer" role
3. Administrators can assign roles through Settings > RBAC
4. Configure role permissions to match your organization's needs

### Kubernetes RBAC Permissions

The orchestrator requires the following Kubernetes permissions:

- Read access to Flux CRDs (Kustomizations, HelmReleases, GitRepositories, etc.)
- Update/Patch access to trigger reconciliations
- List access to namespaces

See `deploy/kubernetes/manifests.yaml` for the complete RBAC configuration.

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

For detailed Azure integration documentation, see [Azure AKS Integration](https://forcebyte.github.io/flux-orchestrator/azure-aks).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Inspired by [ArgoCD](https://argoproj.github.io/cd/)
- Built for [Flux CD](https://fluxcd.io/)

