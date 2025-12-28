# GitHub Copilot Instructions for Flux Orchestrator

## Project Overview

Flux Orchestrator is a centralized multi-cluster GitOps management platform for Flux CD, similar to ArgoCD's UI. It provides a unified interface to manage, monitor, and control Flux resources across multiple Kubernetes clusters.

## Architecture

### Backend (Go)
- **Framework**: Standard library HTTP with gorilla/mux router
- **Database**: GORM with PostgreSQL or MySQL support
- **Kubernetes**: client-go for direct cluster access
- **Logging**: Structured logging with uber-go/zap
- **Metrics**: Prometheus metrics via prometheus/client_golang
- **Security**: Fernet encryption for kubeconfig storage

**Key Packages:**
- `backend/cmd/server/` - Main application entry point
- `backend/internal/api/` - HTTP handlers and routes
- `backend/internal/k8s/` - Kubernetes client wrapper
- `backend/internal/database/` - Database models and operations
- `backend/internal/auth/` - OAuth authentication (GitHub/Entra)
- `backend/internal/azure/` - Azure AKS integration
- `backend/internal/encryption/` - Fernet encryption utilities
- `backend/internal/logging/` - Zap logger initialization
- `backend/internal/metrics/` - Prometheus metrics definitions

### Frontend (React + TypeScript)
- **Framework**: React 19+ with TypeScript
- **Bundler**: Vite
- **Router**: React Router v7
- **HTTP**: Axios
- **Demo Mode**: Supports mock data via `VITE_DEMO_MODE` env var

**Key Files:**
- `frontend/src/api.ts` - API client with demo mode switch
- `frontend/src/demoApi.ts` - Mock data for demo mode
- `frontend/src/components/` - React components
- `frontend/src/contexts/` - React context providers (Auth, Theme, Toast)

## Code Style & Conventions

### Go Backend
- Use structured logging with zap: `logger.Info("message", zap.String("key", value))`
- Add Prometheus metrics for new operations
- Always encrypt sensitive data (kubeconfig, secrets) using encryptor
- Use GORM for database operations
- Return proper HTTP status codes and JSON responses
- Add swagger comments for API endpoints

### TypeScript Frontend
- Use functional components with hooks
- Context API for global state (no Redux)
- Type all API responses
- Support both demo mode and real API mode
- Use CSS modules or scoped CSS files

## Common Patterns

### Adding a New API Endpoint

1. Add handler in `backend/internal/api/server.go`:
```go
func (s *Server) handleNewFeature(w http.ResponseWriter, r *http.Request) {
    logger := logging.GetLogger()
    logger.Info("handling new feature")
    
    // Add metrics
    metrics.SomeCounter.Inc()
    
    // Your logic here
    respondJSON(w, http.StatusOK, data)
}
```

2. Register route in `routes()`:
```go
api.HandleFunc("/new-feature", s.handleNewFeature).Methods("GET", "OPTIONS")
```

3. Add swagger documentation:
```go
// @Summary Get new feature
// @Description Returns new feature data
// @Tags features
// @Produce json
// @Success 200 {object} ResponseType
// @Router /new-feature [get]
```

### Adding Database Models

1. Define model in `backend/internal/models/models.go`:
```go
type NewModel struct {
    ID        string    `json:"id" gorm:"primaryKey"`
    Name      string    `json:"name" gorm:"not null"`
    CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
}
```

2. Add to schema initialization in `main.go`:
```go
db.InitSchema(&models.NewModel{})
```

### Kubernetes Operations

Use the k8s client wrapper in `backend/internal/k8s/client.go`:
```go
resources, err := k8sClient.GetFluxResources(clusterID)
status, err := k8sClient.CheckClusterHealth(clusterID)
err := k8sClient.ReconcileResource(clusterID, kind, namespace, name)
```

### Authentication

- OAuth is optional (controlled by `OAUTH_ENABLED` env var)
- Supports GitHub and Microsoft Entra (Azure AD)
- Uses session-based authentication with in-memory store
- Check `s.authEnabled` before applying auth middleware

### Encryption

All sensitive data (kubeconfig, OAuth secrets) must be encrypted:
```go
encrypted, err := s.encryptor.Encrypt(plaintext)
decrypted, err := s.encryptor.Decrypt(encrypted)
```

## Testing

- No tests currently exist (TODO: add unit and integration tests)
- Manual testing with demo mode: `npm run dev:demo`
- Backend: Test with curl or Postman

## Deployment

- Docker image: `ghcr.io/forcebyte/flux-orchestrator:latest`
- Kubernetes manifests: `deploy/kubernetes/manifests.yaml`
- Supports in-cluster discovery with `SCRAPE_IN_CLUSTER=true`
- Azure AKS integration via service principals

## Important Notes

1. **Security**: Never log or expose encryption keys, OAuth secrets, or kubeconfig contents
2. **Multi-cluster**: All operations require a cluster ID - never assume a default cluster
3. **Error Handling**: Always use structured logging for errors with context
4. **CORS**: Enabled for development; configure properly for production
5. **Demo Mode**: UI must work in both demo and real API modes
6. **Health Checks**: Use `/readiness` for K8s probes (checks dependencies)
7. **Observability**: Add metrics for new features, use request IDs for tracing

## Environment Variables

Key variables to be aware of:
- `ENV` - development/production (affects logging format)
- `ENCRYPTION_KEY` - Required, Fernet key for encrypting secrets
- `DB_*` - Database configuration
- `OAUTH_*` - Optional OAuth configuration
- `SCRAPE_IN_CLUSTER` - Enable in-cluster Kubernetes discovery
- `VITE_DEMO_MODE` - Frontend demo mode flag

## Resources

- Flux CD API: https://fluxcd.io/flux/components/
- GORM Docs: https://gorm.io/
- Prometheus Go Client: https://prometheus.io/docs/guides/go-application/
- Azure SDK for Go: https://github.com/Azure/azure-sdk-for-go
