package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/Forcebyte/flux-orchestrator/backend/internal/api"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/auth"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/database"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/encryption"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/k8s"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/models"
	
	_ "github.com/Forcebyte/flux-orchestrator/docs"
)

// @title Flux Orchestrator API
// @version 1.0
// @description API for managing Flux CD resources across multiple Kubernetes clusters
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.url https://github.com/Forcebyte/flux-orchestrator
// @contact.email support@example.com

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host localhost:8080
// @BasePath /api/v1
// @schemes http https

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

func main() {
	log.Println("Starting Flux Orchestrator...")

	// Load database configuration from environment
	dbConfig := database.Config{
		Driver:   getEnv("DB_DRIVER", "postgres"),
		Host:     getEnv("DB_HOST", "localhost"),
		Port:     getEnvInt("DB_PORT", 5432),
		User:     getEnv("DB_USER", "postgres"),
		Password: getEnv("DB_PASSWORD", "postgres"),
		DBName:   getEnv("DB_NAME", "flux_orchestrator"),
		SSLMode:  getEnv("DB_SSLMODE", "disable"),
	}

	// Initialize encryption
	encryptionKey := getEnv("ENCRYPTION_KEY", "")
	if encryptionKey == "" {
		log.Fatal("ENCRYPTION_KEY environment variable is required")
	}

	encryptor, err := encryption.NewEncryptor(encryptionKey)
	if err != nil {
		log.Fatalf("Failed to initialize encryptor: %v", err)
	}
	log.Println("Encryption initialized successfully")

	// Connect to database
	db, err := database.New(dbConfig)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	sqlDB, _ := db.DB.DB()
	defer sqlDB.Close()

	// Initialize database schema with GORM AutoMigrate
	if err := db.InitSchema(&models.Cluster{}, &models.FluxResource{}, &models.AzureSubscription{}, &models.Activity{}); err != nil {
		log.Fatalf("Failed to initialize schema: %v", err)
	}

	// Create Kubernetes client
	k8sClient := k8s.NewClient()

	// Check if we should scrape the cluster we're running in
	scrapeInCluster := getEnv("SCRAPE_IN_CLUSTER", "false") == "true"
	inClusterName := getEnv("IN_CLUSTER_NAME", "in-cluster")
	inClusterDesc := getEnv("IN_CLUSTER_DESCRIPTION", "Local cluster where Flux Orchestrator is deployed")

	if scrapeInCluster {
		log.Println("SCRAPE_IN_CLUSTER enabled - attempting to register in-cluster configuration")
		
		// Check if in-cluster config already exists
		var existingCluster models.Cluster
		err := db.Where("name = ?", inClusterName).First(&existingCluster).Error
		
		if err != nil && err.Error() != "record not found" {
			log.Printf("Warning: Failed to check for existing in-cluster config: %v", err)
		} else if existingCluster.ID == "" {
			// Register in-cluster configuration
			inClusterID := "in-cluster"
			
			// Use empty string to signal in-cluster config to k8s client
			if err := k8sClient.AddInClusterConfig(inClusterID); err != nil {
				log.Printf("Warning: Failed to add in-cluster configuration: %v", err)
			} else {
				// Check health before saving
				status, healthErr := k8sClient.CheckClusterHealth(inClusterID)
				if healthErr != nil {
					log.Printf("Warning: In-cluster health check failed: %v", healthErr)
					status = "unhealthy"
				}
				
				// Save to database with empty kubeconfig (indicates in-cluster)
				cluster := models.Cluster{
					ID:          inClusterID,
					Name:        inClusterName,
					Description: inClusterDesc,
					KubeConfig:  "",
					Status:      status,
				}
				err = db.Create(&cluster).Error
				
				if err != nil {
					log.Printf("Warning: Failed to save in-cluster configuration to database: %v", err)
				} else {
					log.Printf("Successfully registered in-cluster configuration as '%s'", inClusterName)
				}
			}
		} else {
			// In-cluster already exists, just ensure it's loaded
			if err := k8sClient.AddInClusterConfig(existingCluster.ID); err != nil {
				log.Printf("Warning: Failed to reload in-cluster configuration: %v", err)
			} else {
				log.Printf("In-cluster configuration already registered with ID: %s", existingCluster.ID)
			}
		}
	}

	// Load existing clusters from database
	var clusters []models.Cluster
	if err := db.Where("kubeconfig != ?", "").Find(&clusters).Error; err != nil {
		log.Printf("Warning: Failed to load existing clusters: %v", err)
	} else {
		for _, cluster := range clusters {
			// Decrypt kubeconfig
			kubeconfig, err := encryptor.Decrypt(cluster.KubeConfig)
			if err != nil {
				log.Printf("Warning: Failed to decrypt kubeconfig for cluster %s: %v", cluster.ID, err)
				continue
			}

			if err := k8sClient.AddCluster(cluster.ID, kubeconfig); err != nil {
				log.Printf("Warning: Failed to add cluster %s: %v", cluster.ID, err)
			} else {
				log.Printf("Loaded cluster: %s", cluster.ID)
			}
		}
	}

	// Configure OAuth if enabled
	var oauthProvider *auth.OAuthProvider
	if getEnv("OAUTH_ENABLED", "false") == "true" {
		oauthConfig := auth.Config{
			Enabled:      true,
			Provider:     getEnv("OAUTH_PROVIDER", "github"), // "github" or "entra"
			ClientID:     getEnv("OAUTH_CLIENT_ID", ""),
			ClientSecret: getEnv("OAUTH_CLIENT_SECRET", ""),
			RedirectURL:  getEnv("OAUTH_REDIRECT_URL", "http://localhost:8080/api/v1/auth/callback"),
			Scopes:       strings.Split(getEnv("OAUTH_SCOPES", ""), ","),
		}

		// Parse allowed users if specified
		if allowedUsersStr := getEnv("OAUTH_ALLOWED_USERS", ""); allowedUsersStr != "" {
			oauthConfig.AllowedUsers = strings.Split(allowedUsersStr, ",")
		}

		var err error
		oauthProvider, err = auth.NewOAuthProvider(oauthConfig)
		if err != nil {
			log.Fatalf("Failed to initialize OAuth provider: %v", err)
		}
		log.Printf("OAuth enabled with provider: %s", oauthConfig.Provider)
	} else {
		log.Println("OAuth disabled - running in open mode")
	}

	// Create API server
	apiServer := api.NewServer(db, k8sClient, encryptor, oauthProvider)

	// Start background sync worker with dynamic interval
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
	// Start with default interval
	interval := 5 * time.Minute
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Channel for dynamic interval updates
	updateInterval := make(chan time.Duration, 1)

	// Goroutine to check for interval changes
	go func() {
		for {
			time.Sleep(30 * time.Second) // Check every 30 seconds
			var setting models.Setting
			if err := db.Where("key = ?", "auto_sync_interval_minutes").First(&setting).Error; err == nil {
				if minutes, err := strconv.Atoi(setting.Value); err == nil && minutes > 0 {
					newInterval := time.Duration(minutes) * time.Minute
					if newInterval != interval {
						log.Printf("Auto-sync interval changed to %d minutes", minutes)
						updateInterval <- newInterval
					}
				}
			}
		}
	}()

	for {
		select {
		case newInterval := <-updateInterval:
			interval = newInterval
			ticker.Reset(interval)
		case <-ticker.C:
			log.Println("Running periodic sync...")

			var clusters []models.Cluster
			if err := db.Where("status = ?", "healthy").Find(&clusters).Error; err != nil {
				log.Printf("Sync worker: Failed to query clusters: %v", err)
				continue
			}

		for _, cluster := range clusters {
			clusterID := cluster.ID
			// Check cluster health
			status, err := k8sClient.CheckClusterHealth(clusterID)
			db.Model(&models.Cluster{}).Where("id = ?", clusterID).Update("status", status)

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
				// Use GORM's Clauses for upsert
				if err := db.Save(&res).Error; err != nil {
					log.Printf("Sync worker: Failed to save resource %s: %v", res.ID, err)
				}
			}

			log.Printf("Sync worker: Synced %d resources from cluster %s", len(resources), clusterID)
		}
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
