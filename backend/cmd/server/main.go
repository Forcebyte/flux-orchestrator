package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/Forcebyte/flux-orchestrator/backend/internal/api"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/auth"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/database"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/encryption"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/k8s"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/logging"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/models"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/rbac"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/webhooks"

	_ "github.com/Forcebyte/flux-orchestrator/docs" // swagger docs
	"go.uber.org/zap"
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
	// Initialize logger
	isDev := logging.IsDevelopment()
	if err := logging.InitLogger(isDev); err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer logging.Sync()

	logger := logging.GetLogger()
	logger.Info("Starting Flux Orchestrator", zap.Bool("development", isDev))

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
		logger.Fatal("ENCRYPTION_KEY environment variable is required")
	}

	encryptor, err := encryption.NewEncryptor(encryptionKey)
	if err != nil {
		logger.Fatal("Failed to initialize encryptor", zap.Error(err))
	}
	logger.Info("Encryption initialized successfully")

	// Connect to database
	db, err := database.New(dbConfig)
	if err != nil {
		logger.Fatal("Failed to connect to database", zap.Error(err))
	}
	sqlDB, _ := db.DB.DB()
	defer sqlDB.Close()
	
	// Configure connection pool
	maxOpenConns := getEnvInt("DB_MAX_OPEN_CONNS", 25)
	maxIdleConns := getEnvInt("DB_MAX_IDLE_CONNS", 5)
	connMaxLifetime := getEnvInt("DB_CONN_MAX_LIFETIME_MINUTES", 5)
	
	sqlDB.SetMaxOpenConns(maxOpenConns)
	sqlDB.SetMaxIdleConns(maxIdleConns)
	sqlDB.SetConnMaxLifetime(time.Duration(connMaxLifetime) * time.Minute)
	
	logger.Info("Database connection established", 
		zap.String("driver", dbConfig.Driver),
		zap.Int("max_open_conns", maxOpenConns),
		zap.Int("max_idle_conns", maxIdleConns),
	)

	// Initialize database schema with GORM AutoMigrate
	if err := db.InitSchema(
		&models.Cluster{}, 
		&models.FluxResource{}, 
		&models.AzureSubscription{}, 
		&models.OAuthProvider{}, 
		&models.Activity{},
		&models.User{},
		&models.Role{},
		&models.Permission{},
		&models.UserRole{},
		&models.RolePermission{},
	); err != nil {
		logger.Fatal("Failed to initialize schema", zap.Error(err))
	}
	logger.Info("Database schema initialized")

	// Initialize RBAC with default roles and permissions
	rbacManager := rbac.NewManager(db)
	if err := rbacManager.InitializeDefaultRoles(); err != nil {
		logger.Error("Failed to initialize RBAC", zap.Error(err))
	}

	// Create Kubernetes client
	k8sClient := k8s.NewClient()

	// Check if we should scrape the cluster we're running in
	scrapeInCluster := getEnv("SCRAPE_IN_CLUSTER", "false") == "true"
	inClusterName := getEnv("IN_CLUSTER_NAME", "in-cluster")
	inClusterDesc := getEnv("IN_CLUSTER_DESCRIPTION", "Local cluster where Flux Orchestrator is deployed")

	if scrapeInCluster {
		logger.Info("SCRAPE_IN_CLUSTER enabled - attempting to register in-cluster configuration")
		
		// Check if in-cluster config already exists
		var existingCluster models.Cluster
		err := db.Where("name = ?", inClusterName).First(&existingCluster).Error
		
		if err != nil && err.Error() != "record not found" {
			logger.Warn("Failed to check for existing in-cluster config", zap.Error(err))
		} else if existingCluster.ID == "" {
			// Register in-cluster configuration
			inClusterID := "in-cluster"
			
			// Use empty string to signal in-cluster config to k8s client
			if err := k8sClient.AddInClusterConfig(inClusterID); err != nil {
				logger.Warn("Failed to add in-cluster configuration", zap.Error(err))
			} else {
				// Check health before saving
				status, healthErr := k8sClient.CheckClusterHealth(inClusterID)
				if healthErr != nil {
					logger.Warn("In-cluster health check failed", zap.Error(healthErr))
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
					logger.Warn("Failed to save in-cluster configuration to database", zap.Error(err))
				} else {
					logger.Info("Successfully registered in-cluster configuration", zap.String("name", inClusterName))
				}
			}
		} else {
			// In-cluster already exists, just ensure it's loaded
			if err := k8sClient.AddInClusterConfig(existingCluster.ID); err != nil {
				logger.Warn("Failed to reload in-cluster configuration", zap.Error(err))
			} else {
				logger.Info("In-cluster configuration already registered", zap.String("id", existingCluster.ID))
			}
		}
	}

	// Load existing clusters from database
	var clusters []models.Cluster
	if err := db.Where("kubeconfig != ?", "").Find(&clusters).Error; err != nil {
		logger.Warn("Failed to load existing clusters", zap.Error(err))
	} else {
		for _, cluster := range clusters {
			// Decrypt kubeconfig
			kubeconfig, err := encryptor.Decrypt(cluster.KubeConfig)
			if err != nil {
				logger.Warn("Failed to decrypt kubeconfig", zap.String("cluster_id", cluster.ID), zap.Error(err))
				continue
			}

			if err := k8sClient.AddCluster(cluster.ID, kubeconfig); err != nil {
				logger.Warn("Failed to add cluster", zap.String("cluster_id", cluster.ID), zap.Error(err))
			} else {
				logger.Info("Loaded cluster", zap.String("cluster_id", cluster.ID))
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
			logger.Fatal("Failed to initialize OAuth provider", zap.Error(err))
		}
		logger.Info("OAuth enabled", zap.String("provider", oauthConfig.Provider))
	} else {
		logger.Info("OAuth disabled - running in open mode")
	}

	// Configure webhooks
	webhookURLsStr := getEnv("WEBHOOK_URLS", "")
	webhookURLs := webhooks.ParseWebhookURLs(webhookURLsStr)
	notifier := webhooks.NewNotifier(webhookURLs, logger.Named("webhooks"))
	if len(webhookURLs) > 0 {
		logger.Info("Webhook notifications enabled", zap.Int("webhook_count", len(webhookURLs)))
	}

	// Create API server
	apiServer := api.NewServer(db, k8sClient, encryptor, oauthProvider, notifier)

	// Start background sync worker with dynamic interval
	syncCtx, syncCancel := context.WithCancel(context.Background())
	syncDone := make(chan struct{})
	go func() {
		syncWorker(syncCtx, db, k8sClient, notifier)
		close(syncDone)
	}()

	// Start HTTP server
	port := getEnv("PORT", "8080")
	addr := fmt.Sprintf(":%s", port)
	
	// Configure timeouts
	readTimeout := getEnvInt("HTTP_READ_TIMEOUT_SECONDS", 30)
	writeTimeout := getEnvInt("HTTP_WRITE_TIMEOUT_SECONDS", 30)
	idleTimeout := getEnvInt("HTTP_IDLE_TIMEOUT_SECONDS", 120)
	
	server := &http.Server{
		Addr:         addr,
		Handler:      apiServer,
		ReadTimeout:  time.Duration(readTimeout) * time.Second,
		WriteTimeout: time.Duration(writeTimeout) * time.Second,
		IdleTimeout:  time.Duration(idleTimeout) * time.Second,
	}

	// Channel to listen for server errors
	serverErrors := make(chan error, 1)
	
	// Start server in goroutine
	go func() {
		logger.Info("Server starting", 
			zap.String("address", addr),
			zap.Bool("oauth_enabled", oauthProvider != nil),
			zap.Int("read_timeout", readTimeout),
			zap.Int("write_timeout", writeTimeout),
		)
		serverErrors <- server.ListenAndServe()
	}()

	// Listen for shutdown signals
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	// Block until we receive a signal or server error
	select {
	case err := <-serverErrors:
		logger.Fatal("Server failed to start", zap.Error(err))
	case sig := <-shutdown:
		logger.Info("Shutdown signal received", zap.String("signal", sig.String()))

		// Give outstanding requests time to complete
		shutdownTimeout := getEnvInt("SHUTDOWN_TIMEOUT_SECONDS", 30)
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(shutdownTimeout)*time.Second)
		defer cancel()

		// Stop accepting new requests
		logger.Info("Shutting down HTTP server", zap.Int("timeout_seconds", shutdownTimeout))
		if err := server.Shutdown(ctx); err != nil {
			logger.Error("HTTP server shutdown error", zap.Error(err))
			server.Close()
		}

		// Stop sync worker
		logger.Info("Stopping sync worker")
		syncCancel()
		
		// Wait for sync worker to finish (with timeout)
		select {
		case <-syncDone:
			logger.Info("Sync worker stopped gracefully")
		case <-time.After(10 * time.Second):
			logger.Warn("Sync worker did not stop in time")
		}

		// Close database connection
		logger.Info("Closing database connection")
		if err := sqlDB.Close(); err != nil {
			logger.Error("Error closing database", zap.Error(err))
		}

		logger.Info("Shutdown complete")
	}
}

// syncWorker periodically syncs resources from all clusters
func syncWorker(ctx context.Context, db *database.DB, k8sClient *k8s.Client, notifier *webhooks.Notifier) {
	logger := logging.GetLogger().Named("sync-worker")
	
	// Start with default interval
	interval := 5 * time.Minute
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Channel for dynamic interval updates
	updateInterval := make(chan time.Duration, 1)

	// Goroutine to check for interval changes
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-time.After(30 * time.Second):
				var setting models.Setting
				if err := db.Where("key = ?", "auto_sync_interval_minutes").First(&setting).Error; err == nil {
					if minutes, err := strconv.Atoi(setting.Value); err == nil && minutes > 0 {
						newInterval := time.Duration(minutes) * time.Minute
						if newInterval != interval {
							logger.Info("Auto-sync interval changed", zap.Int("minutes", minutes))
							updateInterval <- newInterval
						}
					}
				}
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			logger.Info("Sync worker shutting down")
			return
		case newInterval := <-updateInterval:
			interval = newInterval
			ticker.Reset(interval)
		case <-ticker.C:
			logger.Info("Running periodic sync")

			var clusters []models.Cluster
			if err := db.Where("status = ?", "healthy").Find(&clusters).Error; err != nil {
				logger.Error("Failed to query clusters", zap.Error(err))
				continue
			}

		for _, cluster := range clusters {
			clusterID := cluster.ID
			clusterLogger := logger.With(zap.String("cluster_id", clusterID))
			
			// Check cluster health
			oldStatus := cluster.Status
			status, err := k8sClient.CheckClusterHealth(clusterID)
			db.Model(&models.Cluster{}).Where("id = ?", clusterID).Update("status", status)

			// Notify if health changed
			if oldStatus != status {
				notifier.NotifyClusterHealthChanged(clusterID, oldStatus, status)
			}

			if err != nil {
				clusterLogger.Warn("Cluster is unhealthy", zap.Error(err))
				notifier.NotifySyncFailed(clusterID, err.Error())
				continue
			}

			// Sync resources
			resources, err := k8sClient.GetFluxResources(clusterID)
			if err != nil {
				clusterLogger.Error("Failed to get resources", zap.Error(err))
				notifier.NotifySyncFailed(clusterID, err.Error())
				continue
			}

			for _, res := range resources {
				// Use GORM's Clauses for upsert
				if err := db.Save(&res).Error; err != nil {
					clusterLogger.Error("Failed to save resource", zap.String("resource_id", res.ID), zap.Error(err))
				}
			}

			clusterLogger.Info("Synced resources", zap.Int("count", len(resources)))
			notifier.NotifySyncCompleted(clusterID, len(resources))
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
