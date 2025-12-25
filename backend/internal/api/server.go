package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/Forcebyte/flux-orchestrator/backend/internal/database"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/encryption"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/k8s"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/models"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// Server represents the API server
type Server struct {
	db        *database.DB
	k8sClient *k8s.Client
	router    *mux.Router
	encryptor *encryption.Encryptor
}

// NewServer creates a new API server
func NewServer(db *database.DB, k8sClient *k8s.Client, encryptor *encryption.Encryptor) *Server {
	s := &Server{
		db:        db,
		k8sClient: k8sClient,
		router:    mux.NewRouter(),
		encryptor: encryptor,
	}
	s.routes()
	return s
}

// routes sets up the API routes
func (s *Server) routes() {
	// Enable CORS
	s.router.Use(corsMiddleware)

	// API routes
	api := s.router.PathPrefix("/api/v1").Subrouter()

	// Cluster management
	api.HandleFunc("/clusters", s.listClusters).Methods("GET", "OPTIONS")
	api.HandleFunc("/clusters", s.createCluster).Methods("POST", "OPTIONS")
	api.HandleFunc("/clusters/{id}", s.getCluster).Methods("GET", "OPTIONS")
	api.HandleFunc("/clusters/{id}", s.updateCluster).Methods("PUT", "OPTIONS")
	api.HandleFunc("/clusters/{id}", s.deleteCluster).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/clusters/{id}/health", s.checkClusterHealth).Methods("GET", "OPTIONS")

	// Flux resources
	api.HandleFunc("/clusters/{id}/resources", s.listClusterResources).Methods("GET", "OPTIONS")
	api.HandleFunc("/clusters/{id}/flux/stats", s.getFluxStats).Methods("GET", "OPTIONS")
	api.HandleFunc("/clusters/{id}/flux/{kind}/{namespace}/{name}", s.getFluxResource).Methods("GET", "OPTIONS")
	api.HandleFunc("/clusters/{id}/flux/{kind}/{namespace}/{name}/reconcile", s.reconcileFluxResource).Methods("POST", "OPTIONS")
	api.HandleFunc("/clusters/{id}/flux/{kind}/{namespace}/{name}/suspend", s.suspendFluxResource).Methods("POST", "OPTIONS")
	api.HandleFunc("/clusters/{id}/flux/{kind}/{namespace}/{name}/resume", s.resumeFluxResource).Methods("POST", "OPTIONS")
	api.HandleFunc("/clusters/{id}/flux/{kind}/{namespace}/{name}/resources", s.getFluxResourceChildren).Methods("GET", "OPTIONS")
	api.HandleFunc("/resources", s.listAllResources).Methods("GET", "OPTIONS")
	api.HandleFunc("/resources/{id}", s.getResource).Methods("GET", "OPTIONS")
	api.HandleFunc("/resources/reconcile", s.reconcileResource).Methods("POST", "OPTIONS")

	// Sync resources from cluster
	api.HandleFunc("/clusters/{id}/sync", s.syncClusterResources).Methods("POST", "OPTIONS")

	// Health check
	s.router.HandleFunc("/health", s.health).Methods("GET")

	// Serve frontend static files (if built) with SPA support
	s.router.PathPrefix("/").HandlerFunc(s.serveFrontend)
}

// corsMiddleware adds CORS headers
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// ServeHTTP implements http.Handler
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.router.ServeHTTP(w, r)
}

// health returns server health status
func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]string{"status": "healthy"})
}

// serveFrontend serves the frontend SPA and handles client-side routing
func (s *Server) serveFrontend(w http.ResponseWriter, r *http.Request) {
	// For SPA routing, serve index.html for all non-API routes
	fs := http.Dir("./frontend/build")
	file, err := fs.Open(r.URL.Path)
	if err != nil {
		// File not found, serve index.html for SPA routing
		indexFile, err := fs.Open("index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer indexFile.Close()
		http.ServeContent(w, r, "index.html", time.Now(), indexFile.(io.ReadSeeker))
		return
	}
	defer file.Close()

	// Check if it's a directory
	stat, err := file.Stat()
	if err != nil || stat.IsDir() {
		// Serve index.html for directories
		indexFile, err := fs.Open("index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer indexFile.Close()
		http.ServeContent(w, r, "index.html", time.Now(), indexFile.(io.ReadSeeker))
		return
	}

	// Serve the actual file
	http.ServeContent(w, r, r.URL.Path, stat.ModTime(), file.(io.ReadSeeker))
}

// listClusters returns all registered clusters
func (s *Server) listClusters(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(`
		SELECT id, name, description, status, created_at, updated_at
		FROM clusters
		ORDER BY created_at DESC
	`)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to query clusters")
		return
	}
	defer rows.Close()

	clusters := []models.Cluster{}
	for rows.Next() {
		var c models.Cluster
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.Status, &c.CreatedAt, &c.UpdatedAt); err != nil {
			continue
		}
		clusters = append(clusters, c)
	}

	respondJSON(w, http.StatusOK, clusters)
}

// createCluster creates a new cluster
func (s *Server) createCluster(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		KubeConfig  string `json:"kubeconfig"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" || req.KubeConfig == "" {
		respondError(w, http.StatusBadRequest, "Name and kubeconfig are required")
		return
	}

	// Generate cluster ID
	clusterID := uuid.New().String()

	// Add cluster to k8s client
	if err := s.k8sClient.AddCluster(clusterID, req.KubeConfig); err != nil {
		respondError(w, http.StatusBadRequest, fmt.Sprintf("Failed to connect to cluster: %v", err))
		return
	}

	// Check cluster health
	status, _ := s.k8sClient.CheckClusterHealth(clusterID)

	// Encrypt kubeconfig before storing
	encryptedKubeconfig, err := s.encryptor.Encrypt(req.KubeConfig)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to encrypt kubeconfig")
		log.Printf("Encryption error: %v", err)
		return
	}

	// Save to database with encrypted kubeconfig
	_, err = s.db.Exec(`
		INSERT INTO clusters (id, name, description, kubeconfig, status)
		VALUES ($1, $2, $3, $4, $5)
	`, clusterID, req.Name, req.Description, encryptedKubeconfig, status)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to save cluster")
		return
	}

	cluster := models.Cluster{
		ID:          clusterID,
		Name:        req.Name,
		Description: req.Description,
		Status:      status,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	respondJSON(w, http.StatusCreated, cluster)
}

// getCluster returns a specific cluster
func (s *Server) getCluster(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var c models.Cluster
	err := s.db.QueryRow(`
		SELECT id, name, description, status, created_at, updated_at
		FROM clusters
		WHERE id = $1
	`, id).Scan(&c.ID, &c.Name, &c.Description, &c.Status, &c.CreatedAt, &c.UpdatedAt)

	if err == sql.ErrNoRows {
		respondError(w, http.StatusNotFound, "Cluster not found")
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to query cluster")
		return
	}

	respondJSON(w, http.StatusOK, c)
}

// updateCluster updates a cluster
func (s *Server) updateCluster(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		KubeConfig  string `json:"kubeconfig"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Update k8s client if kubeconfig is provided
	if req.KubeConfig != "" {
		if err := s.k8sClient.AddCluster(id, req.KubeConfig); err != nil {
			respondError(w, http.StatusBadRequest, fmt.Sprintf("Failed to connect to cluster: %v", err))
			return
		}

		// Encrypt kubeconfig before storing
		encryptedKubeconfig, err := s.encryptor.Encrypt(req.KubeConfig)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to encrypt kubeconfig")
			log.Printf("Encryption error: %v", err)
			return
		}
		req.KubeConfig = encryptedKubeconfig
	}

	// Update database
	_, err := s.db.Exec(`
		UPDATE clusters
		SET name = COALESCE(NULLIF($2, ''), name),
			description = COALESCE(NULLIF($3, ''), description),
			kubeconfig = COALESCE(NULLIF($4, ''), kubeconfig),
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, id, req.Name, req.Description, req.KubeConfig)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update cluster")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Cluster updated"})
}

// deleteCluster deletes a cluster
func (s *Server) deleteCluster(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	_, err := s.db.Exec("DELETE FROM clusters WHERE id = $1", id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete cluster")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Cluster deleted"})
}

// checkClusterHealth checks cluster connectivity
func (s *Server) checkClusterHealth(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	status, err := s.k8sClient.CheckClusterHealth(id)
	if err != nil {
		// Update database
		s.db.Exec("UPDATE clusters SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", status, id)
		respondError(w, http.StatusServiceUnavailable, fmt.Sprintf("Cluster unhealthy: %v", err))
		return
	}

	// Update database
	s.db.Exec("UPDATE clusters SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", status, id)

	respondJSON(w, http.StatusOK, map[string]string{"status": status})
}

// syncClusterResources syncs resources from a cluster to the database
func (s *Server) syncClusterResources(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]

	// Get resources from cluster
	resources, err := s.k8sClient.GetFluxResources(clusterID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to get resources: %v", err))
		return
	}

	// Save to database
	for _, res := range resources {
		_, err := s.db.Exec(`
			INSERT INTO flux_resources (id, cluster_id, kind, name, namespace, status, message, last_reconcile, metadata, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
			ON CONFLICT (cluster_id, kind, namespace, name)
			DO UPDATE SET
				status = EXCLUDED.status,
				message = EXCLUDED.message,
				last_reconcile = EXCLUDED.last_reconcile,
				metadata = EXCLUDED.metadata,
				updated_at = CURRENT_TIMESTAMP
		`, res.ID, res.ClusterID, res.Kind, res.Name, res.Namespace, res.Status, res.Message, res.LastReconcile, res.Metadata)

		if err != nil {
			log.Printf("Failed to save resource %s: %v", res.ID, err)
		}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Resources synced",
		"count":   len(resources),
	})
}

// listClusterResources lists all resources for a specific cluster
func (s *Server) listClusterResources(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]

	rows, err := s.db.Query(`
		SELECT id, cluster_id, kind, name, namespace, status, message, last_reconcile, created_at, updated_at
		FROM flux_resources
		WHERE cluster_id = $1
		ORDER BY kind, namespace, name
	`, clusterID)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to query resources")
		return
	}
	defer rows.Close()

	resources := []models.FluxResource{}
	for rows.Next() {
		var r models.FluxResource
		var lastReconcile sql.NullTime
		if err := rows.Scan(&r.ID, &r.ClusterID, &r.Kind, &r.Name, &r.Namespace, &r.Status, &r.Message, &lastReconcile, &r.CreatedAt, &r.UpdatedAt); err != nil {
			continue
		}
		if lastReconcile.Valid {
			r.LastReconcile = lastReconcile.Time
		}
		resources = append(resources, r)
	}

	respondJSON(w, http.StatusOK, resources)
}

// listAllResources lists all resources across all clusters
func (s *Server) listAllResources(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")

	query := `
		SELECT id, cluster_id, kind, name, namespace, status, message, last_reconcile, created_at, updated_at
		FROM flux_resources
	`

	var rows *sql.Rows
	var err error

	if kind != "" {
		query += " WHERE kind = $1"
		rows, err = s.db.Query(query+" ORDER BY cluster_id, namespace, name", kind)
	} else {
		rows, err = s.db.Query(query + " ORDER BY cluster_id, kind, namespace, name")
	}

	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to query resources")
		return
	}
	defer rows.Close()

	resources := []models.FluxResource{}
	for rows.Next() {
		var r models.FluxResource
		var lastReconcile sql.NullTime
		if err := rows.Scan(&r.ID, &r.ClusterID, &r.Kind, &r.Name, &r.Namespace, &r.Status, &r.Message, &lastReconcile, &r.CreatedAt, &r.UpdatedAt); err != nil {
			continue
		}
		if lastReconcile.Valid {
			r.LastReconcile = lastReconcile.Time
		}
		resources = append(resources, r)
	}

	respondJSON(w, http.StatusOK, resources)
}

// getResource returns a specific resource
func (s *Server) getResource(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var res models.FluxResource
	var lastReconcile sql.NullTime

	err := s.db.QueryRow(`
		SELECT id, cluster_id, kind, name, namespace, status, message, last_reconcile, metadata, created_at, updated_at
		FROM flux_resources
		WHERE id = $1
	`, id).Scan(&res.ID, &res.ClusterID, &res.Kind, &res.Name, &res.Namespace, &res.Status, &res.Message, &lastReconcile, &res.Metadata, &res.CreatedAt, &res.UpdatedAt)

	if err == sql.ErrNoRows {
		respondError(w, http.StatusNotFound, "Resource not found")
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to query resource")
		return
	}

	if lastReconcile.Valid {
		res.LastReconcile = lastReconcile.Time
	}

	respondJSON(w, http.StatusOK, res)
}

// reconcileResource triggers reconciliation for a resource
func (s *Server) reconcileResource(w http.ResponseWriter, r *http.Request) {
	var req models.ReconcileRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	ctx := context.Background()
	err := s.k8sClient.ReconcileResource(ctx, req.ClusterID, req.Kind, req.Namespace, req.Name)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to reconcile: %v", err))
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Reconciliation triggered"})
}

// getFluxStats returns statistics about Flux resources in a cluster
func (s *Server) getFluxStats(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]

	stats, err := s.k8sClient.GetFluxStats(clusterID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to get stats: %v", err))
		return
	}

	respondJSON(w, http.StatusOK, stats)
}

// getFluxResource returns details of a specific Flux resource
func (s *Server) getFluxResource(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	kind := vars["kind"]
	namespace := vars["namespace"]
	name := vars["name"]

	resources, err := s.k8sClient.GetFluxResources(clusterID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to get resources: %v", err))
		return
	}

	// Find the matching resource
	for _, res := range resources {
		if res.Kind == kind && res.Namespace == namespace && res.Name == name {
			respondJSON(w, http.StatusOK, res)
			return
		}
	}

	respondError(w, http.StatusNotFound, "Resource not found")
}

// reconcileFluxResource triggers reconciliation for a Flux resource
func (s *Server) reconcileFluxResource(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	kind := vars["kind"]
	namespace := vars["namespace"]
	name := vars["name"]

	ctx := context.Background()
	err := s.k8sClient.ReconcileResource(ctx, clusterID, kind, namespace, name)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to reconcile: %v", err))
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Reconciliation triggered"})
}

// suspendFluxResource suspends reconciliation for a Flux resource
func (s *Server) suspendFluxResource(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	kind := vars["kind"]
	namespace := vars["namespace"]
	name := vars["name"]

	ctx := context.Background()
	err := s.k8sClient.SuspendResource(ctx, clusterID, kind, namespace, name)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to suspend: %v", err))
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Resource suspended"})
}

// resumeFluxResource resumes reconciliation for a Flux resource
func (s *Server) resumeFluxResource(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	kind := vars["kind"]
	namespace := vars["namespace"]
	name := vars["name"]

	ctx := context.Background()
	err := s.k8sClient.ResumeResource(ctx, clusterID, kind, namespace, name)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to resume: %v", err))
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Resource resumed"})
}

// getFluxResourceChildren returns resources created by a Flux resource
func (s *Server) getFluxResourceChildren(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	kind := vars["kind"]
	namespace := vars["namespace"]
	name := vars["name"]

	ctx := context.Background()
	resources, err := s.k8sClient.GetResourcesCreatedByFlux(ctx, clusterID, kind, namespace, name)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to get resources: %v", err))
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"resources": resources,
		"count":     len(resources),
	})
}

// respondJSON writes a JSON response
func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// respondError writes an error response
func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}
