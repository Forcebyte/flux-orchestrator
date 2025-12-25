package database

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

// DB holds the database connection
type DB struct {
	*sql.DB
}

// Config holds database configuration
type Config struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// New creates a new database connection
func New(cfg Config) (*DB, error) {
	connStr := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &DB{db}, nil
}

// InitSchema initializes the database schema
func (db *DB) InitSchema() error {
	schema := `
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
		cluster_id VARCHAR(255) NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
		kind VARCHAR(100) NOT NULL,
		name VARCHAR(255) NOT NULL,
		namespace VARCHAR(255) NOT NULL,
		status VARCHAR(50) DEFAULT 'Unknown',
		message TEXT,
		last_reconcile TIMESTAMP,
		metadata JSONB,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(cluster_id, kind, namespace, name)
	);

	CREATE INDEX IF NOT EXISTS idx_flux_resources_cluster ON flux_resources(cluster_id);
	CREATE INDEX IF NOT EXISTS idx_flux_resources_kind ON flux_resources(kind);
	CREATE INDEX IF NOT EXISTS idx_flux_resources_status ON flux_resources(status);
	`

	if _, err := db.Exec(schema); err != nil {
		return fmt.Errorf("failed to initialize schema: %w", err)
	}

	log.Println("Database schema initialized successfully")
	return nil
}
