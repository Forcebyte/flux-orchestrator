package rbac

import (
	"context"
	"net/http"

	"github.com/Forcebyte/flux-orchestrator/backend/internal/database"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/logging"
	"github.com/Forcebyte/flux-orchestrator/backend/internal/models"
	"go.uber.org/zap"
)

// ContextKey for storing user info in request context
type ContextKey string

const (
	UserContextKey ContextKey = "user"
)

// Manager handles RBAC operations
type Manager struct {
	db *database.DB
}

// NewManager creates a new RBAC manager
func NewManager(db *database.DB) *Manager {
	return &Manager{db: db}
}

// InitializeDefaultRoles creates default roles and permissions if they don't exist
func (m *Manager) InitializeDefaultRoles() error {
	logger := logging.GetLogger()
	
	// Default permissions
	permissions := []models.Permission{
		// Cluster permissions
		{ID: "cluster.read", Resource: "cluster", Action: "read", Description: "View clusters"},
		{ID: "cluster.create", Resource: "cluster", Action: "create", Description: "Add new clusters"},
		{ID: "cluster.update", Resource: "cluster", Action: "update", Description: "Update cluster configuration"},
		{ID: "cluster.delete", Resource: "cluster", Action: "delete", Description: "Delete clusters"},
		
		// Resource permissions
		{ID: "resource.read", Resource: "resource", Action: "read", Description: "View Flux resources"},
		{ID: "resource.reconcile", Resource: "resource", Action: "reconcile", Description: "Trigger resource reconciliation"},
		{ID: "resource.suspend", Resource: "resource", Action: "suspend", Description: "Suspend resources"},
		{ID: "resource.resume", Resource: "resource", Action: "resume", Description: "Resume resources"},
		{ID: "resource.update", Resource: "resource", Action: "update", Description: "Update resource configuration"},
		{ID: "resource.delete", Resource: "resource", Action: "delete", Description: "Delete resources"},
		
		// Settings permissions
		{ID: "setting.read", Resource: "setting", Action: "read", Description: "View settings"},
		{ID: "setting.update", Resource: "setting", Action: "update", Description: "Update settings"},
		
		// User/Role permissions
		{ID: "user.read", Resource: "user", Action: "read", Description: "View users"},
		{ID: "user.create", Resource: "user", Action: "create", Description: "Create users"},
		{ID: "user.update", Resource: "user", Action: "update", Description: "Update users"},
		{ID: "user.delete", Resource: "user", Action: "delete", Description: "Delete users"},
		{ID: "role.read", Resource: "role", Action: "read", Description: "View roles"},
		{ID: "role.create", Resource: "role", Action: "create", Description: "Create roles"},
		{ID: "role.update", Resource: "role", Action: "update", Description: "Update roles"},
		{ID: "role.delete", Resource: "role", Action: "delete", Description: "Delete roles"},
		
		// Azure permissions
		{ID: "azure.read", Resource: "azure", Action: "read", Description: "View Azure subscriptions"},
		{ID: "azure.create", Resource: "azure", Action: "create", Description: "Add Azure subscriptions"},
		{ID: "azure.update", Resource: "azure", Action: "update", Description: "Update Azure subscriptions"},
		{ID: "azure.delete", Resource: "azure", Action: "delete", Description: "Delete Azure subscriptions"},
	}
	
	// Create permissions
	for _, perm := range permissions {
		var existing models.Permission
		if err := m.db.Where("id = ?", perm.ID).First(&existing).Error; err != nil {
			if err := m.db.Create(&perm).Error; err != nil {
				logger.Error("Failed to create permission", zap.String("id", perm.ID), zap.Error(err))
			}
		}
	}
	
	// Default roles
	adminRole := models.Role{
		ID:          "admin",
		Name:        "Administrator",
		Description: "Full access to all resources",
		BuiltIn:     true,
	}
	
	operatorRole := models.Role{
		ID:          "operator",
		Name:        "Operator",
		Description: "Can manage resources but not users or settings",
		BuiltIn:     true,
	}
	
	viewerRole := models.Role{
		ID:          "viewer",
		Name:        "Viewer",
		Description: "Read-only access to all resources",
		BuiltIn:     true,
	}
	
	// Create or update roles
	for _, role := range []models.Role{adminRole, operatorRole, viewerRole} {
		var existing models.Role
		if err := m.db.Where("id = ?", role.ID).First(&existing).Error; err != nil {
			if err := m.db.Create(&role).Error; err != nil {
				logger.Error("Failed to create role", zap.String("id", role.ID), zap.Error(err))
				continue
			}
		}
	}
	
	// Assign permissions to admin role (all permissions)
	var admin models.Role
	if err := m.db.Preload("Permissions").Where("id = ?", "admin").First(&admin).Error; err == nil {
		if len(admin.Permissions) == 0 {
			var allPerms []models.Permission
			m.db.Find(&allPerms)
			m.db.Model(&admin).Association("Permissions").Append(allPerms)
		}
	}
	
	// Assign permissions to operator role (resource management + clusters)
	var operator models.Role
	if err := m.db.Preload("Permissions").Where("id = ?", "operator").First(&operator).Error; err == nil {
		if len(operator.Permissions) == 0 {
			var operatorPerms []models.Permission
			m.db.Where("resource IN ?", []string{"cluster", "resource", "azure"}).Find(&operatorPerms)
			m.db.Where("id = ?", "setting.read").Find(&operatorPerms)
			m.db.Model(&operator).Association("Permissions").Append(operatorPerms)
		}
	}
	
	// Assign permissions to viewer role (read-only)
	var viewer models.Role
	if err := m.db.Preload("Permissions").Where("id = ?", "viewer").First(&viewer).Error; err == nil {
		if len(viewer.Permissions) == 0 {
			var viewerPerms []models.Permission
			m.db.Where("action = ?", "read").Find(&viewerPerms)
			m.db.Model(&viewer).Association("Permissions").Append(viewerPerms)
		}
	}
	
	logger.Info("RBAC initialized with default roles and permissions")
	return nil
}

// GetOrCreateUser gets or creates a user from OAuth info
func (m *Manager) GetOrCreateUser(email, name, provider string) (*models.User, error) {
	var user models.User
	err := m.db.Preload("Roles.Permissions").Where("email = ?", email).First(&user).Error
	
	if err != nil {
		// User doesn't exist, create it
		user = models.User{
			ID:       email, // Use email as ID for simplicity
			Email:    email,
			Name:     name,
			Provider: provider,
			Enabled:  true,
		}
		
		if err := m.db.Create(&user).Error; err != nil {
			return nil, err
		}
		
		// Assign default viewer role to new users
		var viewerRole models.Role
		if err := m.db.Where("id = ?", "viewer").First(&viewerRole).Error; err == nil {
			m.db.Model(&user).Association("Roles").Append(&viewerRole)
		}
		
		// Reload with permissions
		m.db.Preload("Roles.Permissions").Where("email = ?", email).First(&user)
	}
	
	return &user, nil
}

// CheckPermission checks if a user has a specific permission
func (m *Manager) CheckPermission(user *models.User, resource, action string) bool {
	if user == nil {
		return false
	}
	
	// Check if user is enabled
	if !user.Enabled {
		return false
	}
	
	// Check all roles for the permission
	for _, role := range user.Roles {
		for _, perm := range role.Permissions {
			if perm.Resource == resource && perm.Action == action {
				return true
			}
		}
	}
	
	return false
}

// HasAnyPermission checks if user has any of the specified permissions
func (m *Manager) HasAnyPermission(user *models.User, perms ...string) bool {
	if user == nil {
		return false
	}
	
	for _, permID := range perms {
		for _, role := range user.Roles {
			for _, perm := range role.Permissions {
				if perm.ID == permID {
					return true
				}
			}
		}
	}
	
	return false
}

// Middleware creates RBAC middleware that requires specific permission
func (m *Manager) Middleware(resource, action string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			logger := logging.GetLogger()
			
			// Get user from context
			user, ok := r.Context().Value(UserContextKey).(*models.User)
			if !ok || user == nil {
				logger.Warn("RBAC: No user in context", 
					zap.String("path", r.URL.Path),
					zap.String("required_permission", resource+"."+action))
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
			
			// Check permission
			if !m.CheckPermission(user, resource, action) {
				logger.Warn("RBAC: Permission denied",
					zap.String("user", user.Email),
					zap.String("resource", resource),
					zap.String("action", action),
					zap.String("path", r.URL.Path))
				http.Error(w, "Forbidden: insufficient permissions", http.StatusForbidden)
				return
			}
			
			next.ServeHTTP(w, r)
		})
	}
}

// GetUserFromContext retrieves user from request context
func GetUserFromContext(ctx context.Context) *models.User {
	user, _ := ctx.Value(UserContextKey).(*models.User)
	return user
}
