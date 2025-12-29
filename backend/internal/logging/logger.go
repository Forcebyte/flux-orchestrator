package logging

import (
	"os"

	"go.uber.org/zap"
)

var logger *zap.Logger

// InitLogger initializes the global logger
func InitLogger(development bool) error {
	var err error
	if development {
		logger, err = zap.NewDevelopment()
	} else {
		logger, err = zap.NewProduction()
	}
	
	if err != nil {
		return err
	}
	
	// Replace global logger
	zap.ReplaceGlobals(logger)
	return nil
}

// GetLogger returns the global logger
func GetLogger() *zap.Logger {
	if logger == nil {
		// Fallback to a basic logger if not initialized
		logger, _ = zap.NewProduction()
	}
	return logger
}

// Sync flushes any buffered log entries
func Sync() error {
	if logger != nil {
		return logger.Sync()
	}
	return nil
}

// WithRequestID creates a logger with request ID field
func WithRequestID(requestID string) *zap.Logger {
	return GetLogger().With(zap.String("request_id", requestID))
}

// WithUserID creates a logger with user ID field
func WithUserID(userID string) *zap.Logger {
	return GetLogger().With(zap.String("user_id", userID))
}

// IsDevelopment checks if running in development mode
func IsDevelopment() bool {
	env := os.Getenv("ENV")
	return env == "development" || env == "dev" || env == ""
}
