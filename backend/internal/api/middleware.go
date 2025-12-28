package api

import (
	"context"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Forcebyte/flux-orchestrator/backend/internal/logging"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/metrics"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// loggingMiddleware logs HTTP requests with structured logging
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		
		// Generate request ID
		requestID := uuid.New().String()
		
		// Create logger with request context
		logger := logging.WithRequestID(requestID)
		
		// Wrap response writer to capture status code
		wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		
		// Log request
		logger.Info("HTTP request",
			zap.String("method", r.Method),
			zap.String("path", r.URL.Path),
			zap.String("remote_addr", r.RemoteAddr),
			zap.String("user_agent", r.UserAgent()),
		)
		
		// Call next handler
		next.ServeHTTP(wrapped, r)
		
		// Calculate duration
		duration := time.Since(start)
		
		// Update metrics
		metrics.HTTPRequestsTotal.WithLabelValues(
			r.Method,
			r.URL.Path,
			strconv.Itoa(wrapped.statusCode),
		).Inc()
		
		metrics.HTTPRequestDuration.WithLabelValues(
			r.Method,
			r.URL.Path,
		).Observe(duration.Seconds())
		
		// Log response
		logger.Info("HTTP response",
			zap.String("method", r.Method),
			zap.String("path", r.URL.Path),
			zap.Int("status", wrapped.statusCode),
			zap.Duration("duration", duration),
		)
	})
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// timeoutMiddleware adds request timeout
func timeoutMiddleware(next http.Handler) http.Handler {
	// Get timeout from env or default to 30 seconds
	timeoutSeconds := 30
	if timeoutStr := os.Getenv("REQUEST_TIMEOUT_SECONDS"); timeoutStr != "" {
		if val, err := strconv.Atoi(timeoutStr); err == nil && val > 0 {
			timeoutSeconds = val
		}
	}
	
	timeout := time.Duration(timeoutSeconds) * time.Second
	
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		
		// Create a channel to signal completion
		done := make(chan struct{})
		
		// Wrap the response writer to detect if we've started writing
		wrapped := &timeoutResponseWriter{ResponseWriter: w}
		
		go func() {
			next.ServeHTTP(wrapped, r.WithContext(ctx))
			close(done)
		}()
		
		select {
		case <-done:
			// Request completed successfully
			return
		case <-ctx.Done():
			// Timeout occurred
			if !wrapped.written {
				logger := logging.GetLogger()
				logger.Warn("Request timeout",
					zap.String("method", r.Method),
					zap.String("path", r.URL.Path),
					zap.Duration("timeout", timeout),
				)
				http.Error(w, "Request timeout", http.StatusGatewayTimeout)
			}
		}
	})
}

// timeoutResponseWriter tracks if we've started writing the response
type timeoutResponseWriter struct {
	http.ResponseWriter
	written bool
}

func (w *timeoutResponseWriter) WriteHeader(code int) {
	w.written = true
	w.ResponseWriter.WriteHeader(code)
}

func (w *timeoutResponseWriter) Write(b []byte) (int, error) {
	w.written = true
	return w.ResponseWriter.Write(b)
}

// securityHeadersMiddleware adds security headers to responses
func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Content Security Policy
		// Allows: self, inline styles (for React), data URIs for images, blob for downloads
		w.Header().Set("Content-Security-Policy", 
			"default-src 'self'; "+
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'; "+
			"style-src 'self' 'unsafe-inline'; "+
			"img-src 'self' data: https:; "+
			"font-src 'self' data:; "+
			"connect-src 'self'; "+
			"frame-ancestors 'none'; "+
			"base-uri 'self'; "+
			"form-action 'self'")
		
		// HSTS - only in production with HTTPS
		if os.Getenv("ENV") == "production" && r.TLS != nil {
			w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		}
		
		// Additional security headers
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
		
		next.ServeHTTP(w, r)
	})
}

// inputValidationMiddleware validates common input patterns
func inputValidationMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger := logging.GetLogger()
		
		// Validate URL path for suspicious patterns
		if containsSuspiciousPattern(r.URL.Path) {
			logger.Warn("Suspicious path pattern detected",
				zap.String("path", r.URL.Path),
				zap.String("remote_addr", r.RemoteAddr),
			)
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}
		
		// Validate query parameters
		for key, values := range r.URL.Query() {
			for _, value := range values {
				if containsSuspiciousPattern(value) {
					logger.Warn("Suspicious query parameter detected",
						zap.String("key", key),
						zap.String("value", value),
						zap.String("remote_addr", r.RemoteAddr),
					)
					http.Error(w, "Invalid request", http.StatusBadRequest)
					return
				}
			}
		}
		
		// Check for excessively long headers (potential DoS)
		for key, values := range r.Header {
			for _, value := range values {
				if len(value) > 8192 {
					logger.Warn("Excessively long header detected",
						zap.String("header", key),
						zap.Int("length", len(value)),
						zap.String("remote_addr", r.RemoteAddr),
					)
					http.Error(w, "Invalid request", http.StatusBadRequest)
					return
				}
			}
		}
		
		next.ServeHTTP(w, r)
	})
}

// containsSuspiciousPattern checks for common attack patterns
func containsSuspiciousPattern(input string) bool {
	// Convert to lowercase for case-insensitive matching
	lower := strings.ToLower(input)
	
	// SQL injection patterns
	sqlPatterns := []string{
		"union select",
		"drop table",
		"insert into",
		"delete from",
		"update set",
		"exec(",
		"execute(",
		"script>",
		"javascript:",
		"onerror=",
		"onload=",
	}
	
	for _, pattern := range sqlPatterns {
		if strings.Contains(lower, pattern) {
			return true
		}
	}
	
	// Path traversal
	if strings.Contains(input, "../") || strings.Contains(input, "..\\") {
		return true
	}
	
	// Null bytes
	if strings.Contains(input, "\x00") {
		return true
	}
	
	// Command injection
	if regexp.MustCompile(`[;&|$<>\x60]`).MatchString(input) {
		return true
	}
	
	return false
}
