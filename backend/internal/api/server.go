package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/Forcebyte/flux-orchestrator/backend/internal/auth"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/azure"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/database"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/encryption"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/k8s"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/models"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	httpSwagger "github.com/swaggo/http-swagger"
)

// Server represents the API server
type Server struct {
	db            *database.DB
	k8sClient     *k8s.Client
	azureClient   *azure.Client
	router        *mux.Router
	encryptor     *encryption.Encryptor
	oauthProvider *auth.OAuthProvider
	sessionStore  *auth.SessionStore
	authEnabled   bool
}

// NewServer creates a new API server
func NewServer(db *database.DB, k8sClient *k8s.Client, encryptor *encryption.Encryptor, oauthProvider *auth.OAuthProvider) *Server {
	s := &Server{
		db:            db,
		k8sClient:     k8sClient,
		azureClient:   azure.NewClient(),
		router:        mux.NewRouter(),
		encryptor:     encryptor,
		oauthProvider: oauthProvider,
		sessionStore:  auth.NewSessionStore(),
		authEnabled:   oauthProvider != nil,
	}
	s.routes()
	
	// Start session cleanup goroutine
	if s.authEnabled {
		go s.cleanupSessions()
	}
	
	// Start audit log cleanup goroutine
	go s.cleanupAuditLogs()
	
	// Load existing Azure subscriptions from database
	s.loadAzureSubscriptions()
	
	return s
}

// routes sets up the API routes
func (s *Server) routes() {
	// Enable CORS
	s.router.Use(corsMiddleware)

	// Auth routes (public)
	if s.authEnabled {
		s.router.HandleFunc("/api/v1/auth/login", s.handleAuthLogin).Methods("GET", "OPTIONS")
		s.router.HandleFunc("/api/v1/auth/callback", s.handleAuthCallback).Methods("GET", "OPTIONS")
		s.router.HandleFunc("/api/v1/auth/logout", s.handleAuthLogout).Methods("POST", "OPTIONS")
		s.router.HandleFunc("/api/v1/auth/me", s.handleAuthMe).Methods("GET", "OPTIONS")
		s.router.HandleFunc("/api/v1/auth/status", s.handleAuthStatus).Methods("GET", "OPTIONS")
	}

	// API routes
	api := s.router.PathPrefix("/api/v1").Subrouter()
	
	// Apply auth middleware if enabled
	if s.authEnabled {
		api.Use(s.authMiddleware)
	}

	// Cluster management
	api.HandleFunc("/clusters", s.listClusters).Methods("GET", "OPTIONS")
	api.HandleFunc("/clusters", s.createCluster).Methods("POST", "OPTIONS")
	api.HandleFunc("/clusters/{id}", s.getCluster).Methods("GET", "OPTIONS")
	api.HandleFunc("/clusters/{id}", s.updateCluster).Methods("PUT", "OPTIONS")
	api.HandleFunc("/clusters/{id}", s.deleteCluster).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/clusters/{id}/health", s.checkClusterHealth).Methods("GET", "OPTIONS")

	// Flux resources
	api.HandleFunc("/clusters/{id}/resources", s.listClusterResources).Methods("GET", "OPTIONS")
	api.HandleFunc("/clusters/{id}/resources/tree", s.getResourceTree).Methods("GET", "OPTIONS")
	api.HandleFunc("/clusters/{id}/flux/stats", s.getFluxStats).Methods("GET", "OPTIONS")
	api.HandleFunc("/clusters/{id}/flux/{kind}/{namespace}/{name}", s.getFluxResource).Methods("GET", "OPTIONS")
	api.HandleFunc("/clusters/{id}/flux/{kind}/{namespace}/{name}", s.updateFluxResource).Methods("PUT", "OPTIONS")
	api.HandleFunc("/clusters/{id}/flux/{kind}/{namespace}/{name}/reconcile", s.reconcileFluxResource).Methods("POST", "OPTIONS")
	api.HandleFunc("/clusters/{id}/flux/{kind}/{namespace}/{name}/suspend", s.suspendFluxResource).Methods("POST", "OPTIONS")
	api.HandleFunc("/clusters/{id}/flux/{kind}/{namespace}/{name}/resume", s.resumeFluxResource).Methods("POST", "OPTIONS")
	api.HandleFunc("/clusters/{id}/flux/{kind}/{namespace}/{name}/resources", s.getFluxResourceChildren).Methods("GET", "OPTIONS")
	api.HandleFunc("/resources", s.listAllResources).Methods("GET", "OPTIONS")
	api.HandleFunc("/resources/{id}", s.getResource).Methods("GET", "OPTIONS")
	api.HandleFunc("/resources/reconcile", s.reconcileResource).Methods("POST", "OPTIONS")

	// Sync resources from cluster
	api.HandleFunc("/clusters/{id}/sync", s.syncClusterResources).Methods("POST", "OPTIONS")

	// Resource management
	api.HandleFunc("/clusters/{id}/resources/{kind}/{namespace}/{name}/scale", s.scaleResource).Methods("POST", "OPTIONS")
	api.HandleFunc("/clusters/{id}/resources/{kind}/{namespace}/{name}/restart", s.restartResource).Methods("POST", "OPTIONS")
	api.HandleFunc("/clusters/{id}/resources/{kind}/{namespace}/{name}/spec", s.updateResourceSpec).Methods("PUT", "OPTIONS")
	api.HandleFunc("/clusters/{id}/pods/{namespace}/{name}/logs", s.getPodLogs).Methods("GET", "OPTIONS")
	api.HandleFunc("/clusters/{id}/pods/{namespace}/{name}/containers", s.getPodContainers).Methods("GET", "OPTIONS")
	api.HandleFunc("/clusters/{id}/pods/{namespace}/{name}", s.deletePod).Methods("DELETE", "OPTIONS")

	// Settings
	api.HandleFunc("/settings", s.getSettings).Methods("GET", "OPTIONS")
	api.HandleFunc("/settings/{key}", s.updateSetting).Methods("PUT", "OPTIONS")

	// Activities (audit log)
	api.HandleFunc("/activities", s.listActivities).Methods("GET", "OPTIONS")
	api.HandleFunc("/activities/{id}", s.getActivity).Methods("GET", "OPTIONS")
	api.HandleFunc("/activities/cleanup", s.cleanupAuditLogsNow).Methods("POST", "OPTIONS")

	// Cluster operations
	api.HandleFunc("/clusters/{id}/favorite", s.toggleFavorite).Methods("POST", "OPTIONS")
	api.HandleFunc("/clusters/{id}/export", s.exportCluster).Methods("GET", "OPTIONS")
	api.HandleFunc("/resources/export", s.exportResources).Methods("GET", "OPTIONS")

	// Azure AKS integration
	api.HandleFunc("/azure/subscriptions", s.listAzureSubscriptions).Methods("GET", "OPTIONS")
	api.HandleFunc("/azure/subscriptions", s.createAzureSubscription).Methods("POST", "OPTIONS")
	api.HandleFunc("/azure/subscriptions/{id}", s.getAzureSubscription).Methods("GET", "OPTIONS")
	api.HandleFunc("/azure/subscriptions/{id}", s.deleteAzureSubscription).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/azure/subscriptions/{id}/test", s.testAzureConnection).Methods("POST", "OPTIONS")
	api.HandleFunc("/azure/subscriptions/{id}/clusters", s.discoverAKSClusters).Methods("GET", "OPTIONS")
	api.HandleFunc("/azure/subscriptions/{id}/sync", s.syncAKSClusters).Methods("POST", "OPTIONS")

	// OAuth provider management
	api.HandleFunc("/oauth/providers", s.listOAuthProviders).Methods("GET", "OPTIONS")
	api.HandleFunc("/oauth/providers", s.createOAuthProvider).Methods("POST", "OPTIONS")
	api.HandleFunc("/oauth/providers/{id}", s.getOAuthProvider).Methods("GET", "OPTIONS")
	api.HandleFunc("/oauth/providers/{id}", s.updateOAuthProvider).Methods("PUT", "OPTIONS")
	api.HandleFunc("/oauth/providers/{id}", s.deleteOAuthProvider).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/oauth/providers/{id}/test", s.testOAuthProvider).Methods("POST", "OPTIONS")

	// Health check
	s.router.HandleFunc("/health", s.health).Methods("GET")

	// Swagger documentation
	s.router.PathPrefix("/swagger/").Handler(httpSwagger.Handler(
		httpSwagger.URL("/swagger/doc.json"),
		httpSwagger.DeepLinking(true),
		httpSwagger.DocExpansion("list"),
		httpSwagger.DomID("swagger-ui"),
	)).Methods("GET")

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
	fs := http.Dir("./frontend/dist")
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
	var clusters []models.Cluster
	if err := s.db.Select("id", "name", "description", "status", "created_at", "updated_at").
		Order("created_at DESC").
		Find(&clusters).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to query clusters")
		return
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
	cluster := models.Cluster{
		ID:          clusterID,
		Name:        req.Name,
		Description: req.Description,
		KubeConfig:  encryptedKubeconfig,
		Status:      status,
	}

	if err := s.db.Create(&cluster).Error; err != nil {
		s.logActivity("create", "cluster", clusterID, req.Name, clusterID, req.Name, "failed", fmt.Sprintf("Database error: %v", err))
		respondError(w, http.StatusInternalServerError, "Failed to save cluster")
		return
	}

	// Log successful creation
	s.logActivity("create", "cluster", clusterID, req.Name, clusterID, req.Name, "success", fmt.Sprintf("Cluster created with status: %s", status))

	// Clear kubeconfig from response
	cluster.KubeConfig = ""
	respondJSON(w, http.StatusCreated, cluster)
}

// getCluster returns a specific cluster
func (s *Server) getCluster(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var cluster models.Cluster
	if err := s.db.Select("id", "name", "description", "status", "created_at", "updated_at").
		Where("id = ?", id).
		First(&cluster).Error; err != nil {
		if err.Error() == "record not found" {
			respondError(w, http.StatusNotFound, "Cluster not found")
		} else {
			respondError(w, http.StatusInternalServerError, "Failed to query cluster")
		}
		return
	}

	respondJSON(w, http.StatusOK, cluster)
}

// updateCluster updates a cluster
func (s *Server) updateCluster(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		Name                string `json:"name"`
		Description         string `json:"description"`
		KubeConfig          string `json:"kubeconfig"`
		HealthCheckInterval *int   `json:"health_check_interval"`
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
	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.KubeConfig != "" {
		updates["kubeconfig"] = req.KubeConfig
	}
	if req.HealthCheckInterval != nil {
		updates["health_check_interval"] = *req.HealthCheckInterval
	}

	var cluster models.Cluster
	s.db.Select("name").Where("id = ?", id).First(&cluster)

	if err := s.db.Model(&models.Cluster{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		s.logActivity("update", "cluster", id, cluster.Name, id, cluster.Name, "failed", fmt.Sprintf("Database error: %v", err))
		respondError(w, http.StatusInternalServerError, "Failed to update cluster")
		return
	}

	// Log successful update
	updateFields := []string{}
	for k := range updates {
		updateFields = append(updateFields, k)
	}
	s.logActivity("update", "cluster", id, cluster.Name, id, cluster.Name, "success", fmt.Sprintf("Updated fields: %v", updateFields))

	respondJSON(w, http.StatusOK, map[string]string{"message": "Cluster updated"})
}

// deleteCluster deletes a cluster
func (s *Server) deleteCluster(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var cluster models.Cluster
	s.db.Select("name").Where("id = ?", id).First(&cluster)

	if err := s.db.Delete(&models.Cluster{}, "id = ?", id).Error; err != nil {
		s.logActivity("delete", "cluster", id, cluster.Name, id, cluster.Name, "failed", fmt.Sprintf("Database error: %v", err))
		respondError(w, http.StatusInternalServerError, "Failed to delete cluster")
		return
	}

	// Log successful deletion
	s.logActivity("delete", "cluster", id, cluster.Name, id, cluster.Name, "success", "Cluster deleted")

	respondJSON(w, http.StatusOK, map[string]string{"message": "Cluster deleted"})
}

// checkClusterHealth checks cluster connectivity
func (s *Server) checkClusterHealth(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	status, err := s.k8sClient.CheckClusterHealth(id)
	if err != nil {
		// Update database
		s.db.Model(&models.Cluster{}).Where("id = ?", id).Update("status", status)
		respondError(w, http.StatusServiceUnavailable, fmt.Sprintf("Cluster unhealthy: %v", err))
		return
	}

	// Update database
	s.db.Model(&models.Cluster{}).Where("id = ?", id).Update("status", status)

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
		if err := s.db.Save(&res).Error; err != nil {
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

	var resources []models.FluxResource
	if err := s.db.Where("cluster_id = ?", clusterID).
		Order("kind, namespace, name").
		Find(&resources).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to query resources")
		return
	}

	respondJSON(w, http.StatusOK, resources)
}

// listAllResources lists all resources across all clusters
func (s *Server) listAllResources(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")

	query := s.db.Model(&models.FluxResource{})

	if kind != "" {
		query = query.Where("kind = ?", kind).Order("cluster_id, namespace, name")
	} else {
		query = query.Order("cluster_id, kind, namespace, name")
	}

	var resources []models.FluxResource
	if err := query.Find(&resources).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to query resources")
		return
	}

	respondJSON(w, http.StatusOK, resources)
}

// getResource returns a specific resource
func (s *Server) getResource(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var res models.FluxResource
	if err := s.db.Where("id = ?", id).First(&res).Error; err != nil {
		if err.Error() == "record not found" {
			respondError(w, http.StatusNotFound, "Resource not found")
		} else {
			respondError(w, http.StatusInternalServerError, "Failed to query resource")
		}
		return
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

	var cluster models.Cluster
	s.db.Select("name").Where("id = ?", clusterID).First(&cluster)

	ctx := context.Background()
	err := s.k8sClient.ReconcileResource(ctx, clusterID, kind, namespace, name)
	if err != nil {
		s.logActivity("reconcile", kind, fmt.Sprintf("%s/%s", namespace, name), name, clusterID, cluster.Name, "failed", fmt.Sprintf("Error: %v", err))
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to reconcile: %v", err))
		return
	}

	// Log successful reconciliation
	s.logActivity("reconcile", kind, fmt.Sprintf("%s/%s", namespace, name), name, clusterID, cluster.Name, "success", fmt.Sprintf("Reconciled %s/%s", namespace, name))

	respondJSON(w, http.StatusOK, map[string]string{"message": "Reconciliation triggered"})
}

// suspendFluxResource suspends reconciliation for a Flux resource
func (s *Server) suspendFluxResource(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	kind := vars["kind"]
	namespace := vars["namespace"]
	name := vars["name"]

	var cluster models.Cluster
	s.db.Select("name").Where("id = ?", clusterID).First(&cluster)

	ctx := context.Background()
	err := s.k8sClient.SuspendResource(ctx, clusterID, kind, namespace, name)
	if err != nil {
		s.logActivity("suspend", kind, fmt.Sprintf("%s/%s", namespace, name), name, clusterID, cluster.Name, "failed", fmt.Sprintf("Error: %v", err))
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to suspend: %v", err))
		return
	}

	// Log successful suspension
	s.logActivity("suspend", kind, fmt.Sprintf("%s/%s", namespace, name), name, clusterID, cluster.Name, "success", fmt.Sprintf("Suspended %s/%s", namespace, name))

	respondJSON(w, http.StatusOK, map[string]string{"message": "Resource suspended"})
}

// resumeFluxResource resumes reconciliation for a Flux resource
func (s *Server) resumeFluxResource(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	kind := vars["kind"]
	namespace := vars["namespace"]
	name := vars["name"]

	var cluster models.Cluster
	s.db.Select("name").Where("id = ?", clusterID).First(&cluster)

	ctx := context.Background()
	err := s.k8sClient.ResumeResource(ctx, clusterID, kind, namespace, name)
	if err != nil {
		s.logActivity("resume", kind, fmt.Sprintf("%s/%s", namespace, name), name, clusterID, cluster.Name, "failed", fmt.Sprintf("Error: %v", err))
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to resume: %v", err))
		return
	}

	// Log successful resume
	s.logActivity("resume", kind, fmt.Sprintf("%s/%s", namespace, name), name, clusterID, cluster.Name, "success", fmt.Sprintf("Resumed %s/%s", namespace, name))

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

// getSettings returns all settings
func (s *Server) getSettings(w http.ResponseWriter, r *http.Request) {
	var settings []models.Setting
	if err := s.db.Find(&settings).Error; err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch settings: %v", err))
		return
	}

	respondJSON(w, http.StatusOK, settings)
}

// updateSetting updates a setting value
func (s *Server) updateSetting(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	key := vars["key"]

	var req struct {
		Value string `json:"value"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Value == "" {
		respondError(w, http.StatusBadRequest, "Value is required")
		return
	}

	// Use GORM's Save which does an upsert (insert or update)
	setting := models.Setting{
		Key:   key,
		Value: req.Value,
	}
	
	// Save will update if exists, create if not
	if err := s.db.Where(models.Setting{Key: key}).Assign(models.Setting{Value: req.Value}).FirstOrCreate(&setting).Error; err != nil {
		s.logActivity("update", "setting", key, key, "", "", "failed", fmt.Sprintf("Database error: %v", err))
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to save setting: %v", err))
		return
	}

	// Log successful settings update
	s.logActivity("update", "setting", key, key, "", "", "success", fmt.Sprintf("Updated %s to %s", key, req.Value))

	respondJSON(w, http.StatusOK, setting)
}

// getResourceTree returns hierarchical tree of all resources in a cluster
func (s *Server) getResourceTree(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]

	ctx := r.Context()
	tree, err := s.k8sClient.GetResourceTree(ctx, clusterID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to get resource tree: %v", err))
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"tree":  tree,
		"count": len(tree),
	})
}

// updateFluxResource updates a Flux resource configuration
func (s *Server) updateFluxResource(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	kind := vars["kind"]
	namespace := vars["namespace"]
	name := vars["name"]

	var patch map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	ctx := r.Context()
	if err := s.k8sClient.UpdateFluxResource(ctx, clusterID, kind, namespace, name, patch); err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to update resource: %v", err))
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Resource updated successfully",
	})
}

// scaleResource scales a Deployment, StatefulSet, or ReplicaSet
func (s *Server) scaleResource(w http.ResponseWriter, r *http.Request) {
vars := mux.Vars(r)
clusterID := vars["id"]
kind := vars["kind"]
namespace := vars["namespace"]
name := vars["name"]

var req struct {
Replicas int32 `json:"replicas"`
}
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
respondError(w, http.StatusBadRequest, "Invalid request body")
return
}

ctx := r.Context()
if err := s.k8sClient.ScaleResource(ctx, clusterID, kind, namespace, name, req.Replicas); err != nil {
respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to scale resource: %v", err))
return
}

respondJSON(w, http.StatusOK, map[string]string{"message": "Resource scaled successfully"})
}

// restartResource performs a rollout restart
func (s *Server) restartResource(w http.ResponseWriter, r *http.Request) {
vars := mux.Vars(r)
clusterID := vars["id"]
kind := vars["kind"]
namespace := vars["namespace"]
name := vars["name"]

ctx := r.Context()
if err := s.k8sClient.RestartResource(ctx, clusterID, kind, namespace, name); err != nil {
respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to restart resource: %v", err))
return
}

respondJSON(w, http.StatusOK, map[string]string{"message": "Resource restarted successfully"})
}

// updateResourceSpec updates a resource's spec
func (s *Server) updateResourceSpec(w http.ResponseWriter, r *http.Request) {
vars := mux.Vars(r)
clusterID := vars["id"]
kind := vars["kind"]
namespace := vars["namespace"]
name := vars["name"]

var patch map[string]interface{}
if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
respondError(w, http.StatusBadRequest, "Invalid request body")
return
}

ctx := r.Context()
if err := s.k8sClient.UpdateResourceSpec(ctx, clusterID, kind, namespace, name, patch); err != nil {
respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to update resource: %v", err))
return
}

respondJSON(w, http.StatusOK, map[string]string{"message": "Resource updated successfully"})
}

// getPodLogs retrieves logs from a pod
func (s *Server) getPodLogs(w http.ResponseWriter, r *http.Request) {
vars := mux.Vars(r)
clusterID := vars["id"]
namespace := vars["namespace"]
podName := vars["name"]

containerName := r.URL.Query().Get("container")
tailLinesStr := r.URL.Query().Get("tail")

var tailLines int64 = 1000
if tailLinesStr != "" {
if parsed, err := strconv.ParseInt(tailLinesStr, 10, 64); err == nil {
tailLines = parsed
}
}

ctx := r.Context()
logs, err := s.k8sClient.GetPodLogs(ctx, clusterID, namespace, podName, containerName, tailLines, false)
if err != nil {
respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to get logs: %v", err))
return
}

respondJSON(w, http.StatusOK, map[string]string{"logs": logs})
}

// getPodContainers gets the list of containers in a pod
func (s *Server) getPodContainers(w http.ResponseWriter, r *http.Request) {
vars := mux.Vars(r)
clusterID := vars["id"]
namespace := vars["namespace"]
podName := vars["name"]

ctx := r.Context()
containers, err := s.k8sClient.GetPodContainers(ctx, clusterID, namespace, podName)
if err != nil {
respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to get containers: %v", err))
return
}

respondJSON(w, http.StatusOK, map[string]interface{}{"containers": containers})
}

// deletePod deletes a pod
func (s *Server) deletePod(w http.ResponseWriter, r *http.Request) {
vars := mux.Vars(r)
clusterID := vars["id"]
namespace := vars["namespace"]
podName := vars["name"]

ctx := r.Context()
if err := s.k8sClient.DeletePod(ctx, clusterID, namespace, podName); err != nil {
respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to delete pod: %v", err))
return
}

respondJSON(w, http.StatusOK, map[string]string{"message": "Pod deleted successfully"})
}

// Auth handlers

func (s *Server) handleAuthStatus(w http.ResponseWriter, r *http.Request) {
respondJSON(w, http.StatusOK, map[string]interface{}{
"enabled": s.authEnabled,
})
}

func (s *Server) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	state, err := auth.GenerateState()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to generate state")
		return
	}

	// Store state in cookie for validation
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		MaxAge:   600, // 10 minutes
		HttpOnly: true,
		Secure:   true, // Ensure cookie is only sent over HTTPS
		SameSite: http.SameSiteLaxMode,
	})

	authURL := s.oauthProvider.GetAuthURL(state)
	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

func (s *Server) handleAuthCallback(w http.ResponseWriter, r *http.Request) {
// Verify state
stateCookie, err := r.Cookie("oauth_state")
if err != nil {
http.Redirect(w, r, "/?error=invalid_state", http.StatusTemporaryRedirect)
return
}

state := r.URL.Query().Get("state")
if state != stateCookie.Value {
http.Redirect(w, r, "/?error=state_mismatch", http.StatusTemporaryRedirect)
return
}

// Exchange code for token
code := r.URL.Query().Get("code")
token, err := s.oauthProvider.Exchange(r.Context(), code)
if err != nil {
log.Printf("OAuth token exchange failed: %v", err)
http.Redirect(w, r, "/?error=token_exchange_failed", http.StatusTemporaryRedirect)
return
}

// Get user info
userInfo, err := s.oauthProvider.GetUserInfo(r.Context(), token)
if err != nil {
log.Printf("Failed to get user info: %v", err)
http.Redirect(w, r, "/?error=user_info_failed", http.StatusTemporaryRedirect)
return
}

// Check if user is allowed
if !s.oauthProvider.IsUserAllowed(userInfo) {
log.Printf("User not allowed: %s", userInfo.Email)
http.Redirect(w, r, "/?error=unauthorized", http.StatusTemporaryRedirect)
return
}

// Create session
sessionToken, err := s.sessionStore.Create(userInfo)
if err != nil {
log.Printf("Failed to create session: %v", err)
http.Redirect(w, r, "/?error=session_failed", http.StatusTemporaryRedirect)
return
}

// Set session cookie
http.SetCookie(w, &http.Cookie{
Name:     "session_token",
Value:    sessionToken,
Path:     "/",
MaxAge:   86400, // 24 hours
HttpOnly: true,
Secure:   true, // Ensure cookie is only sent over HTTPS
SameSite: http.SameSiteLaxMode,
})

// Clear state cookie
http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})

	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}

func (s *Server) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_token")
	if err == nil {
		s.sessionStore.Delete(cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})

	respondJSON(w, http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

func (s *Server) handleAuthMe(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_token")
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	session, exists := s.sessionStore.Get(cookie.Value)
	if !exists {
		respondError(w, http.StatusUnauthorized, "Invalid session")
		return
	}

	respondJSON(w, http.StatusOK, session.UserInfo)
}

// Auth middleware
func (s *Server) authMiddleware(next http.Handler) http.Handler {
return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
if r.Method == "OPTIONS" {
next.ServeHTTP(w, r)
return
}

cookie, err := r.Cookie("session_token")
if err != nil {
respondError(w, http.StatusUnauthorized, "Authentication required")
return
}

session, exists := s.sessionStore.Get(cookie.Value)
if !exists {
respondError(w, http.StatusUnauthorized, "Invalid or expired session")
return
}

// Add user info to context
ctx := context.WithValue(r.Context(), "user", session.UserInfo)
next.ServeHTTP(w, r.WithContext(ctx))
})
}

// cleanupSessions periodically removes expired sessions
func (s *Server) cleanupSessions() {
ticker := time.NewTicker(1 * time.Hour)
defer ticker.Stop()

for range ticker.C {
s.sessionStore.CleanExpired()
}
}

// Azure AKS handlers

// loadAzureSubscriptions loads existing Azure subscriptions from database
func (s *Server) loadAzureSubscriptions() {
var subscriptions []models.AzureSubscription
if err := s.db.Find(&subscriptions).Error; err != nil {
log.Printf("Warning: Failed to load Azure subscriptions: %v", err)
return
}

for _, sub := range subscriptions {
// Decrypt credentials
decrypted, err := s.encryptor.Decrypt(sub.Credentials)
if err != nil {
log.Printf("Warning: Failed to decrypt credentials for subscription %s: %v", sub.ID, err)
continue
}

// Decode credentials
creds, err := azure.DecodeCredentials(decrypted)
if err != nil {
log.Printf("Warning: Failed to decode credentials for subscription %s: %v", sub.ID, err)
continue
}

s.azureClient.AddCredentials(sub.ID, creds)
log.Printf("Loaded Azure subscription: %s", sub.Name)
}
}

func (s *Server) listAzureSubscriptions(w http.ResponseWriter, r *http.Request) {
var subscriptions []models.AzureSubscription
if err := s.db.Find(&subscriptions).Error; err != nil {
respondError(w, http.StatusInternalServerError, "Failed to list Azure subscriptions")
return
}

respondJSON(w, http.StatusOK, subscriptions)
}

func (s *Server) createAzureSubscription(w http.ResponseWriter, r *http.Request) {
var req struct {
Name           string `json:"name"`
SubscriptionID string `json:"subscription_id"`
TenantID       string `json:"tenant_id"`
ClientID       string `json:"client_id"`
ClientSecret   string `json:"client_secret"`
}

if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
respondError(w, http.StatusBadRequest, "Invalid request body")
return
}

// Validate required fields
if req.Name == "" || req.SubscriptionID == "" || req.TenantID == "" || req.ClientID == "" || req.ClientSecret == "" {
respondError(w, http.StatusBadRequest, "Missing required fields")
return
}

// Create Azure credentials
creds := &azure.Credentials{
TenantID:       req.TenantID,
ClientID:       req.ClientID,
ClientSecret:   req.ClientSecret,
SubscriptionID: req.SubscriptionID,
}

// Test connection
s.azureClient.AddCredentials(req.SubscriptionID, creds)
if err := s.azureClient.TestConnection(r.Context(), req.SubscriptionID); err != nil {
s.azureClient.RemoveCredentials(req.SubscriptionID)
respondError(w, http.StatusUnauthorized, fmt.Sprintf("Failed to authenticate with Azure: %v", err))
return
}

// Encode credentials
encoded, err := azure.EncodeCredentials(creds)
if err != nil {
s.azureClient.RemoveCredentials(req.SubscriptionID)
respondError(w, http.StatusInternalServerError, "Failed to encode credentials")
return
}

// Encrypt credentials
encrypted, err := s.encryptor.Encrypt(encoded)
if err != nil {
s.azureClient.RemoveCredentials(req.SubscriptionID)
respondError(w, http.StatusInternalServerError, "Failed to encrypt credentials")
return
}

// Create database record
subscription := models.AzureSubscription{
ID:          req.SubscriptionID,
Name:        req.Name,
TenantID:    req.TenantID,
Credentials: encrypted,
Status:      "healthy",
}

if err := s.db.Create(&subscription).Error; err != nil {
s.azureClient.RemoveCredentials(req.SubscriptionID)
respondError(w, http.StatusInternalServerError, "Failed to save Azure subscription")
return
}

respondJSON(w, http.StatusCreated, subscription)
}

func (s *Server) getAzureSubscription(w http.ResponseWriter, r *http.Request) {
vars := mux.Vars(r)
id := vars["id"]

var subscription models.AzureSubscription
if err := s.db.First(&subscription, "id = ?", id).Error; err != nil {
respondError(w, http.StatusNotFound, "Azure subscription not found")
return
}

respondJSON(w, http.StatusOK, subscription)
}

func (s *Server) deleteAzureSubscription(w http.ResponseWriter, r *http.Request) {
vars := mux.Vars(r)
id := vars["id"]

// Delete from database
if err := s.db.Delete(&models.AzureSubscription{}, "id = ?", id).Error; err != nil {
respondError(w, http.StatusInternalServerError, "Failed to delete Azure subscription")
return
}

// Remove from Azure client
s.azureClient.RemoveCredentials(id)

// Delete all associated clusters
if err := s.db.Where("source = ? AND source_id LIKE ?", "azure-aks", fmt.Sprintf("/subscriptions/%s/%%", id)).Delete(&models.Cluster{}).Error; err != nil {
log.Printf("Warning: Failed to delete associated clusters: %v", err)
}

respondJSON(w, http.StatusOK, map[string]string{"message": "Azure subscription deleted successfully"})
}

func (s *Server) testAzureConnection(w http.ResponseWriter, r *http.Request) {
vars := mux.Vars(r)
id := vars["id"]

if err := s.azureClient.TestConnection(r.Context(), id); err != nil {
respondError(w, http.StatusUnauthorized, fmt.Sprintf("Connection test failed: %v", err))
return
}

respondJSON(w, http.StatusOK, map[string]string{"status": "healthy", "message": "Connection successful"})
}

func (s *Server) discoverAKSClusters(w http.ResponseWriter, r *http.Request) {
vars := mux.Vars(r)
subscriptionID := vars["id"]

clusters, err := s.azureClient.DiscoverClusters(r.Context(), subscriptionID)
if err != nil {
respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to discover AKS clusters: %v", err))
return
}

respondJSON(w, http.StatusOK, map[string]interface{}{
"count":    len(clusters),
"clusters": clusters,
})
}

func (s *Server) syncAKSClusters(w http.ResponseWriter, r *http.Request) {
vars := mux.Vars(r)
subscriptionID := vars["id"]

// Discover clusters
aksClusters, err := s.azureClient.DiscoverClusters(r.Context(), subscriptionID)
if err != nil {
respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to discover AKS clusters: %v", err))
return
}

var syncedClusters []models.Cluster
var errors []string

for _, aksCluster := range aksClusters {
// Generate kubeconfig with Azure AD auth
kubeconfig, err := s.azureClient.GenerateKubeconfig(r.Context(), aksCluster)
if err != nil {
errors = append(errors, fmt.Sprintf("Failed to generate kubeconfig for %s: %v", aksCluster.Name, err))
continue
}

// Encrypt kubeconfig
encryptedKubeconfig, err := s.encryptor.Encrypt(kubeconfig)
if err != nil {
errors = append(errors, fmt.Sprintf("Failed to encrypt kubeconfig for %s: %v", aksCluster.Name, err))
continue
}

// Create or update cluster record
clusterID := fmt.Sprintf("aks-%s", aksCluster.Name)
cluster := models.Cluster{
ID:          clusterID,
Name:        aksCluster.Name,
Description: fmt.Sprintf("AKS cluster in %s (%s nodes, k8s %s)", aksCluster.Location, fmt.Sprint(aksCluster.NodeCount), aksCluster.KubernetesVersion),
KubeConfig:  encryptedKubeconfig,
Status:      "unknown",
Source:      "azure-aks",
SourceID:    aksCluster.ID,
}

// Check if cluster already exists
var existing models.Cluster
if err := s.db.First(&existing, "id = ?", clusterID).Error; err == nil {
// Update existing cluster
cluster.CreatedAt = existing.CreatedAt
if err := s.db.Save(&cluster).Error; err != nil {
errors = append(errors, fmt.Sprintf("Failed to update cluster %s: %v", aksCluster.Name, err))
continue
}
} else {
// Create new cluster
if err := s.db.Create(&cluster).Error; err != nil {
errors = append(errors, fmt.Sprintf("Failed to create cluster %s: %v", aksCluster.Name, err))
continue
}
}

// Add to k8s client
if err := s.k8sClient.AddCluster(clusterID, kubeconfig); err != nil {
errors = append(errors, fmt.Sprintf("Failed to add cluster %s to k8s client: %v", aksCluster.Name, err))
continue
}

// Check health
status, err := s.k8sClient.CheckClusterHealth(clusterID)
if err != nil {
log.Printf("Warning: Failed to check health for cluster %s: %v", aksCluster.Name, err)
status = "unhealthy"
}
cluster.Status = status
s.db.Save(&cluster)

syncedClusters = append(syncedClusters, cluster)
}

// Update subscription last synced time and cluster count
if err := s.db.Model(&models.AzureSubscription{}).
Where("id = ?", subscriptionID).
Updates(map[string]interface{}{
"last_synced_at": time.Now(),
"cluster_count":  len(syncedClusters),
}).Error; err != nil {
log.Printf("Warning: Failed to update subscription sync time: %v", err)
}

response := map[string]interface{}{
"synced":   len(syncedClusters),
"clusters": syncedClusters,
}

if len(errors) > 0 {
response["errors"] = errors
}

respondJSON(w, http.StatusOK, response)
}

// toggleFavorite toggles the favorite status of a cluster
func (s *Server) toggleFavorite(w http.ResponseWriter, r *http.Request) {
vars := mux.Vars(r)
clusterID := vars["id"]

var cluster models.Cluster
if err := s.db.First(&cluster, "id = ?", clusterID).Error; err != nil {
respondError(w, http.StatusNotFound, "Cluster not found")
return
}

// Toggle favorite status
cluster.IsFavorite = !cluster.IsFavorite

if err := s.db.Save(&cluster).Error; err != nil {
log.Printf("Failed to toggle favorite: %v", err)
respondError(w, http.StatusInternalServerError, "Failed to update cluster")
return
}

// Log activity
s.logActivity("toggle_favorite", "cluster", clusterID, cluster.Name, clusterID, cluster.Name, "success", "")

respondJSON(w, http.StatusOK, cluster)
}

// listActivities returns recent activities
func (s *Server) listActivities(w http.ResponseWriter, r *http.Request) {
limitStr := r.URL.Query().Get("limit")
limit := 50
if limitStr != "" {
if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
limit = parsedLimit
}
}

clusterID := r.URL.Query().Get("cluster_id")

var activities []models.Activity
query := s.db.Order("created_at DESC").Limit(limit)

if clusterID != "" {
query = query.Where("cluster_id = ?", clusterID)
}

if err := query.Find(&activities).Error; err != nil {
log.Printf("Failed to list activities: %v", err)
respondError(w, http.StatusInternalServerError, "Failed to list activities")
return
}

respondJSON(w, http.StatusOK, activities)
}

// getActivity returns a single activity by ID
func (s *Server) getActivity(w http.ResponseWriter, r *http.Request) {
vars := mux.Vars(r)
id := vars["id"]

var activity models.Activity
if err := s.db.First(&activity, "id = ?", id).Error; err != nil {
respondError(w, http.StatusNotFound, "Activity not found")
return
}

respondJSON(w, http.StatusOK, activity)
}

// exportCluster exports cluster configuration as JSON or YAML
func (s *Server) exportCluster(w http.ResponseWriter, r *http.Request) {
vars := mux.Vars(r)
clusterID := vars["id"]
format := r.URL.Query().Get("format")
if format == "" {
format = "json"
}

var cluster models.Cluster
if err := s.db.First(&cluster, "id = ?", clusterID).Error; err != nil {
respondError(w, http.StatusNotFound, "Cluster not found")
return
}

// Get resources for this cluster
var resources []models.FluxResource
if err := s.db.Where("cluster_id = ?", clusterID).Find(&resources).Error; err != nil {
log.Printf("Failed to get resources: %v", err)
respondError(w, http.StatusInternalServerError, "Failed to get resources")
return
}

exportData := map[string]interface{}{
"cluster":   cluster,
"resources": resources,
"exported_at": time.Now(),
}

if format == "csv" {
// CSV export for resources
w.Header().Set("Content-Type", "text/csv")
w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s-resources.csv", cluster.Name))

// Write CSV header
fmt.Fprintf(w, "Kind,Namespace,Name,Status,Message,LastReconcile\n")

// Write rows
for _, res := range resources {
fmt.Fprintf(w, "%s,%s,%s,%s,\"%s\",%s\n",
res.Kind, res.Namespace, res.Name, res.Status,
res.Message, res.LastReconcile)
}
} else {
// JSON export
w.Header().Set("Content-Type", "application/json")
w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s-export.json", cluster.Name))
json.NewEncoder(w).Encode(exportData)
}

// Log activity
s.logActivity("export", "cluster", clusterID, cluster.Name, clusterID, cluster.Name, "success", fmt.Sprintf("Exported as %s", format))
}

// exportResources exports all resources across all clusters
func (s *Server) exportResources(w http.ResponseWriter, r *http.Request) {
format := r.URL.Query().Get("format")
if format == "" {
format = "json"
}

status := r.URL.Query().Get("status")
kind := r.URL.Query().Get("kind")

query := s.db.Model(&models.FluxResource{})
if status != "" {
query = query.Where("status = ?", status)
}
if kind != "" {
query = query.Where("kind = ?", kind)
}

var resources []models.FluxResource
if err := query.Find(&resources).Error; err != nil {
log.Printf("Failed to get resources: %v", err)
respondError(w, http.StatusInternalServerError, "Failed to get resources")
return
}

if format == "csv" {
w.Header().Set("Content-Type", "text/csv")
w.Header().Set("Content-Disposition", "attachment; filename=flux-resources.csv")

// Write CSV header
fmt.Fprintf(w, "ClusterID,Kind,Namespace,Name,Status,Message,LastReconcile\n")

// Write rows
for _, res := range resources {
fmt.Fprintf(w, "%s,%s,%s,%s,%s,\"%s\",%s\n",
res.ClusterID, res.Kind, res.Namespace, res.Name, res.Status,
res.Message, res.LastReconcile)
}
} else {
// JSON export
w.Header().Set("Content-Type", "application/json")
w.Header().Set("Content-Disposition", "attachment; filename=flux-resources.json")

exportData := map[string]interface{}{
"resources": resources,
"count":     len(resources),
"exported_at": time.Now(),
"filters": map[string]string{
"status": status,
"kind":   kind,
},
}

json.NewEncoder(w).Encode(exportData)
}

// Log activity
s.logActivity("export", "resources", "all", fmt.Sprintf("%d resources", len(resources)), "", "", "success", fmt.Sprintf("Exported as %s", format))
}

// logActivity logs an action to the activity table
func (s *Server) logActivity(action, resourceType, resourceID, resourceName, clusterID, clusterName, status, message string) {
activity := models.Activity{
Action:       action,
ResourceType: resourceType,
ResourceID:   resourceID,
ResourceName: resourceName,
ClusterID:    clusterID,
ClusterName:  clusterName,
Status:       status,
Message:      message,
UserID:       "system", // TODO: Get from auth context
}

if err := s.db.Create(&activity).Error; err != nil {
log.Printf("Warning: Failed to log activity: %v", err)
}
}

// cleanupAuditLogs runs periodically to clean up old audit logs based on retention setting
func (s *Server) cleanupAuditLogs() {
	ticker := time.NewTicker(24 * time.Hour) // Run once per day
	defer ticker.Stop()

	for range ticker.C {
		s.performAuditLogCleanup()
	}
}

// performAuditLogCleanup deletes audit logs older than the retention period
func (s *Server) performAuditLogCleanup() {
	// Get retention setting (default 90 days)
	var setting models.Setting
	err := s.db.Where("setting_key = ?", "audit_log_retention_days").First(&setting).Error
	
	retentionDays := 90 // Default
	if err == nil && setting.Value != "" {
		if days, err := strconv.Atoi(setting.Value); err == nil && days > 0 {
			retentionDays = days
		}
	}

	// Calculate cutoff date
	cutoffDate := time.Now().AddDate(0, 0, -retentionDays)

	// Delete old activities
	result := s.db.Where("created_at < ?", cutoffDate).Delete(&models.Activity{})
	if result.Error != nil {
		log.Printf("Error cleaning up audit logs: %v", result.Error)
		return
	}

	if result.RowsAffected > 0 {
		log.Printf("Cleaned up %d audit log entries older than %d days", result.RowsAffected, retentionDays)
	}
}

// cleanupAuditLogsNow manually triggers audit log cleanup
func (s *Server) cleanupAuditLogsNow(w http.ResponseWriter, r *http.Request) {
	s.performAuditLogCleanup()
	
	// Get count of remaining activities
	var count int64
	s.db.Model(&models.Activity{}).Count(&count)
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Audit log cleanup completed",
		"remaining_activities": count,
	})
}

// OAuth Provider Management

func (s *Server) listOAuthProviders(w http.ResponseWriter, r *http.Request) {
	var providers []models.OAuthProvider
	if err := s.db.Find(&providers).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list OAuth providers")
		return
	}

	respondJSON(w, http.StatusOK, providers)
}

func (s *Server) createOAuthProvider(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name         string `json:"name"`
		Provider     string `json:"provider"` // github, entra
		ClientID     string `json:"client_id"`
		ClientSecret string `json:"client_secret"`
		TenantID     string `json:"tenant_id,omitempty"`     // For Entra ID
		RedirectURL  string `json:"redirect_url"`
		Scopes       string `json:"scopes,omitempty"`        // Comma-separated
		AllowedUsers string `json:"allowed_users,omitempty"` // Comma-separated
		Enabled      bool   `json:"enabled"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate required fields
	if req.Name == "" || req.Provider == "" || req.ClientID == "" || req.ClientSecret == "" || req.RedirectURL == "" {
		respondError(w, http.StatusBadRequest, "Missing required fields")
		return
	}

	// Validate provider type
	if req.Provider != "github" && req.Provider != "entra" {
		respondError(w, http.StatusBadRequest, "Provider must be 'github' or 'entra'")
		return
	}

	// For Entra ID, tenant ID is required
	if req.Provider == "entra" && req.TenantID == "" {
		respondError(w, http.StatusBadRequest, "Tenant ID is required for Entra ID provider")
		return
	}

	// Encrypt client secret
	encryptedSecret, err := s.encryptor.Encrypt(req.ClientSecret)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to encrypt client secret")
		return
	}

	// Generate ID
	providerID := uuid.New().String()

	// Create database record
	provider := models.OAuthProvider{
		ID:           providerID,
		Name:         req.Name,
		Provider:     req.Provider,
		ClientID:     req.ClientID,
		ClientSecret: encryptedSecret,
		TenantID:     req.TenantID,
		RedirectURL:  req.RedirectURL,
		Scopes:       req.Scopes,
		AllowedUsers: req.AllowedUsers,
		Enabled:      req.Enabled,
		Status:       "unknown",
	}

	if err := s.db.Create(&provider).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to save OAuth provider")
		return
	}

	// Clear client secret from response
	provider.ClientSecret = ""
	respondJSON(w, http.StatusCreated, provider)
}

func (s *Server) getOAuthProvider(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var provider models.OAuthProvider
	if err := s.db.First(&provider, "id = ?", id).Error; err != nil {
		respondError(w, http.StatusNotFound, "OAuth provider not found")
		return
	}

	// Clear client secret from response
	provider.ClientSecret = ""
	respondJSON(w, http.StatusOK, provider)
}

func (s *Server) updateOAuthProvider(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		Name         *string `json:"name"`
		ClientID     *string `json:"client_id"`
		ClientSecret *string `json:"client_secret"`
		TenantID     *string `json:"tenant_id"`
		RedirectURL  *string `json:"redirect_url"`
		Scopes       *string `json:"scopes"`
		AllowedUsers *string `json:"allowed_users"`
		Enabled      *bool   `json:"enabled"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Build updates map
	updates := make(map[string]interface{})
	
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.ClientID != nil {
		updates["client_id"] = *req.ClientID
	}
	if req.ClientSecret != nil && *req.ClientSecret != "" {
		// Encrypt new client secret
		encryptedSecret, err := s.encryptor.Encrypt(*req.ClientSecret)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to encrypt client secret")
			return
		}
		updates["client_secret"] = encryptedSecret
	}
	if req.TenantID != nil {
		updates["tenant_id"] = *req.TenantID
	}
	if req.RedirectURL != nil {
		updates["redirect_url"] = *req.RedirectURL
	}
	if req.Scopes != nil {
		updates["scopes"] = *req.Scopes
	}
	if req.AllowedUsers != nil {
		updates["allowed_users"] = *req.AllowedUsers
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}

	if err := s.db.Model(&models.OAuthProvider{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update OAuth provider")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "OAuth provider updated"})
}

func (s *Server) deleteOAuthProvider(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Delete from database
	if err := s.db.Delete(&models.OAuthProvider{}, "id = ?", id).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete OAuth provider")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "OAuth provider deleted successfully"})
}

func (s *Server) testOAuthProvider(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Get provider from database
	var provider models.OAuthProvider
	if err := s.db.First(&provider, "id = ?", id).Error; err != nil {
		respondError(w, http.StatusNotFound, "OAuth provider not found")
		return
	}

	// Decrypt client secret
	clientSecret, err := s.encryptor.Decrypt(provider.ClientSecret)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to decrypt client secret")
		return
	}

	// Parse scopes
	var scopes []string
	if provider.Scopes != "" {
		scopes = []string{}
		for _, scope := range []string{provider.Scopes} {
			scopes = append(scopes, scope)
		}
	}

	// Create auth config
	authConfig := auth.Config{
		Enabled:      true,
		Provider:     provider.Provider,
		ClientID:     provider.ClientID,
		ClientSecret: clientSecret,
		RedirectURL:  provider.RedirectURL,
		Scopes:       scopes,
	}

	// Try to create OAuth provider (this validates the configuration)
	_, err = auth.NewOAuthProvider(authConfig)
	if err != nil {
		// Update status
		s.db.Model(&models.OAuthProvider{}).Where("id = ?", id).Update("status", "unhealthy")
		respondError(w, http.StatusBadRequest, fmt.Sprintf("Configuration test failed: %v", err))
		return
	}

	// Update status
	s.db.Model(&models.OAuthProvider{}).Where("id = ?", id).Update("status", "healthy")

	respondJSON(w, http.StatusOK, map[string]string{
		"status":  "healthy",
		"message": "OAuth provider configuration is valid",
	})
}
