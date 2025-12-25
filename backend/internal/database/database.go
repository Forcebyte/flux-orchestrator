package database

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
)

// DB holds the database connection
type DB struct {
	*sql.DB
	driver string
}

// Config holds database configuration
type Config struct {
	Driver   string // "postgres" or "mysql"
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string // For PostgreSQL
}

// New creates a new database connection
func New(cfg Config) (*DB, error) {
	var connStr string
	var driver string

	// Default to postgres if not specified
	if cfg.Driver == "" {
		cfg.Driver = "postgres"
	}

	switch cfg.Driver {
	case "postgres":
		connStr = fmt.Sprintf(
			"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
			cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
		)
		driver = "postgres"
	case "mysql":
		// MySQL DSN format: user:password@tcp(host:port)/dbname
		connStr = fmt.Sprintf(
			"%s:%s@tcp(%s:%d)/%s?parseTime=true",
			cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.DBName,
		)
		driver = "mysql"
	default:
		return nil, fmt.Errorf("unsupported database driver: %s (supported: postgres, mysql)", cfg.Driver)
	}

	db, err := sql.Open(driver, connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Printf("Connected to %s database successfully", driver)
	return &DB{DB: db, driver: driver}, nil
}

// InitSchema initializes the database schema
func (db *DB) InitSchema() error {
	var schema string

	switch db.driver {
	case "postgres":
		schema = `
		CREATE TABLE IF NOT EXISTS clusters (
			id VARCHAR(255) PRIMARY KEY,
			name VARCHAR(255) NOT NULL UNIQUE,
			description TEXT,
			kubeconfig TEXT NOT NULL,
			status VARCHAR(50) DEFAULT 'unknown',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS flux_resources (
			id VARCHAR(255) PRIMARY KEY,
			cluster_id VARCHAR(255) NOT NULL,
			kind VARCHAR(100) NOT NULL,
			name VARCHAR(255) NOT NULL,
			namespace VARCHAR(255) NOT NULL,
			status VARCHAR(50) DEFAULT 'Unknown',
			message TEXT,
			last_reconcile TIMESTAMP,
			metadata JSON,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(cluster_id, kind, namespace, name),
			FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE CASCADE
		);

		CREATE INDEX IF NOT EXISTS idx_flux_resources_cluster ON flux_resources(cluster_id);
		CREATE INDEX IF NOT EXISTS idx_flux_resources_kind ON flux_resources(kind);
		CREATE INDEX IF NOT EXISTS idx_flux_resources_status ON flux_resources(status);
		`
	case "mysql":
		schema = `
		CREATE TABLE IF NOT EXISTS clusters (
			id VARCHAR(255) PRIMARY KEY,
			name VARCHAR(255) NOT NULL UNIQUE,
			description TEXT,
			kubeconfig TEXT NOT NULL,
			status VARCHAR(50) DEFAULT 'unknown',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS flux_resources (
			id VARCHAR(255) PRIMARY KEY,
			cluster_id VARCHAR(255) NOT NULL,
			kind VARCHAR(100) NOT NULL,
			name VARCHAR(255) NOT NULL,
			namespace VARCHAR(255) NOT NULL,
			status VARCHAR(50) DEFAULT 'Unknown',
			message TEXT,
			last_reconcile TIMESTAMP NULL,
			metadata JSON,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			UNIQUE KEY unique_resource (cluster_id, kind, namespace, name),
			FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE CASCADE
		);

		CREATE INDEX IF NOT EXISTS idx_flux_resources_cluster ON flux_resources(cluster_id);
		CREATE INDEX IF NOT EXISTS idx_flux_resources_kind ON flux_resources(kind);
		CREATE INDEX IF NOT EXISTS idx_flux_resources_status ON flux_resources(status);
		`
	default:
		return fmt.Errorf("unsupported database driver: %s", db.driver)
	}

	if _, err := db.Exec(schema); err != nil {
		return fmt.Errorf("failed to initialize schema: %w", err)
	}

	log.Println("Database schema initialized successfully")
	return nil
}
