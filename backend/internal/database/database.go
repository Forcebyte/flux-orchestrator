package database

import (
	"fmt"
	"log"

	"github.com/Forcebyte/flux-orchestrator/backend/internal/models"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DB holds the database connection
type DB struct {
	*gorm.DB
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
	var dialector gorm.Dialector
	var driver string

	// Default to postgres if not specified
	if cfg.Driver == "" {
		cfg.Driver = "postgres"
	}

	switch cfg.Driver {
	case "postgres":
		dsn := fmt.Sprintf(
			"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
			cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
		)
		dialector = postgres.Open(dsn)
		driver = "postgres"
	case "mysql":
		// MySQL DSN format: user:password@tcp(host:port)/dbname?params
		dsn := fmt.Sprintf(
			"%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.DBName,
		)
		dialector = mysql.Open(dsn)
		driver = "mysql"
	default:
		return nil, fmt.Errorf("unsupported database driver: %s (supported: postgres, mysql)", cfg.Driver)
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test connection
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}

	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Printf("Connected to %s database successfully", driver)
	return &DB{DB: db}, nil
}

// InitSchema initializes the database schema using GORM AutoMigrate
func (db *DB) InitSchema(entities ...interface{}) error {
	if err := db.AutoMigrate(entities...); err != nil {
		return fmt.Errorf("failed to initialize schema: %w", err)
	}

	// Backward-compat migration: rename settings.key -> settings.setting_key
	// Some installations may have created the column as `key` (a reserved word in MySQL),
	// while the model now uses `setting_key`. AutoMigrate will not rename columns, so we
	// check and perform a safe rename once.
	migrator := db.Migrator()
	if migrator.HasTable(&models.Setting{}) {
		hasSettingKey := migrator.HasColumn(&models.Setting{}, "setting_key")
		hasLegacyKey := migrator.HasColumn(&models.Setting{}, "key")

		if !hasSettingKey && hasLegacyKey {
			var renameErr error
			switch db.Dialector.Name() {
			case "mysql":
				// Preserve size and NOT NULL; primary key will be preserved if it existed
				renameErr = db.Exec("ALTER TABLE settings CHANGE COLUMN `key` `setting_key` VARCHAR(100) NOT NULL").Error
			case "postgres":
				// Simple column rename for Postgres
				renameErr = db.Exec(`ALTER TABLE "settings" RENAME COLUMN "key" TO "setting_key"`).Error
			default:
				log.Printf("Unsupported dialect for settings column rename: %s", db.Dialector.Name())
			}

			if renameErr != nil {
				log.Printf("Warning: failed to rename settings.key to settings.setting_key: %v", renameErr)
			} else {
				log.Printf("Renamed settings.key to settings.setting_key for compatibility")
			}
		}
	}

	log.Println("Database schema initialized successfully")
	return nil
}
