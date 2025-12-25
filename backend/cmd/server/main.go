package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/Forcebyte/flux-orchestrator/backend/internal/api"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/database"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/k8s"
)

func main() {
	log.Println("Starting Flux Orchestrator...")

	// Load database configuration from environment
	dbConfig := database.Config{
		Host:     getEnv("DB_HOST", "localhost"),
		Port:     getEnvInt("DB_PORT", 5432),
		User:     getEnv("DB_USER", "postgres"),
		Password: getEnv("DB_PASSWORD", "postgres"),
		DBName:   getEnv("DB_NAME", "flux_orchestrator"),
		SSLMode:  getEnv("DB_SSLMODE", "disable"),
	}

	// Connect to database
	db, err := database.New(dbConfig)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize database schema
	if err := db.InitSchema(); err != nil {
		log.Fatalf("Failed to initialize schema: %v", err)
	}

	// Create Kubernetes client
	k8sClient := k8s.NewClient()

	// Load existing clusters from database
	rows, err := db.Query("SELECT id, kubeconfig FROM clusters")
	if err != nil {
		log.Printf("Warning: Failed to load existing clusters: %v", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var id, kubeconfig string
			if err := rows.Scan(&id, &kubeconfig); err != nil {
				continue
			}
			if err := k8sClient.AddCluster(id, kubeconfig); err != nil {
				log.Printf("Warning: Failed to add cluster %s: %v", id, err)
			} else {
				log.Printf("Loaded cluster: %s", id)
			}
		}
	}

	// Create API server
	apiServer := api.NewServer(db, k8sClient)

	// Start background sync worker
	go syncWorker(db, k8sClient)

	// Start HTTP server
	port := getEnv("PORT", "8080")
	addr := fmt.Sprintf(":%s", port)

	log.Printf("Server listening on %s", addr)
	if err := http.ListenAndServe(addr, apiServer); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

// syncWorker periodically syncs resources from all clusters
func syncWorker(db *database.DB, k8sClient *k8s.Client) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		log.Println("Running periodic sync...")

		rows, err := db.Query("SELECT id FROM clusters WHERE status = 'healthy'")
		if err != nil {
			log.Printf("Sync worker: Failed to query clusters: %v", err)
			continue
		}

		var clusterIDs []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				continue
			}
			clusterIDs = append(clusterIDs, id)
		}
		rows.Close()

		for _, clusterID := range clusterIDs {
			// Check cluster health
			status, err := k8sClient.CheckClusterHealth(clusterID)
			db.Exec("UPDATE clusters SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", status, clusterID)

			if err != nil {
				log.Printf("Sync worker: Cluster %s is unhealthy: %v", clusterID, err)
				continue
			}

			// Sync resources
			resources, err := k8sClient.GetFluxResources(clusterID)
			if err != nil {
				log.Printf("Sync worker: Failed to get resources for cluster %s: %v", clusterID, err)
				continue
			}

			for _, res := range resources {
				_, err := db.Exec(`
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
					log.Printf("Sync worker: Failed to save resource %s: %v", res.ID, err)
				}
			}

			log.Printf("Sync worker: Synced %d resources from cluster %s", len(resources), clusterID)
		}
	}
}

// getEnv gets an environment variable with a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvInt gets an integer environment variable with a default value
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
