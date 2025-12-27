package models

import (
	"time"

	"gorm.io/gorm"
)

// Cluster represents a Kubernetes cluster managed by the orchestrator
type Cluster struct {
	ID                  string    `json:"id" gorm:"primaryKey;size:100"`
	Name                string    `json:"name" gorm:"size:255;uniqueIndex;not null"`
	Description         string    `json:"description" gorm:"type:text"`
	KubeConfig          string    `json:"-" gorm:"column:kubeconfig;type:text;not null"` // Hidden from JSON
	Status              string    `json:"status" gorm:"size:50;default:'unknown'"`       // healthy, unhealthy, unknown
	Source              string    `json:"source" gorm:"size:50;default:'manual'"`        // manual, azure-aks
	SourceID            string    `json:"source_id" gorm:"size:255"`                     // Azure resource ID, etc.
	IsFavorite          bool      `json:"is_favorite" gorm:"default:false"`              // Favorite/pinned cluster
	HealthCheckInterval int       `json:"health_check_interval" gorm:"default:300"`      // Health check interval in seconds (default 5 min)
	ResourceCount       int       `json:"resource_count" gorm:"default:0"`               // Cached resource count
	CreatedAt           time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt           time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

// AzureSubscription represents an Azure subscription with service principal credentials
type AzureSubscription struct {
	ID             string    `json:"id" gorm:"primaryKey;size:100"` // Subscription ID
	Name           string    `json:"name" gorm:"size:255;not null"`
	TenantID       string    `json:"tenant_id" gorm:"size:100;not null"`
	Credentials    string    `json:"-" gorm:"type:text;not null"` // Encrypted JSON: {client_id, client_secret}
	Status         string    `json:"status" gorm:"size:50;default:'unknown'"` // healthy, unhealthy, unknown
	ClusterCount   int       `json:"cluster_count" gorm:"default:0"`
	LastSyncedAt   time.Time `json:"last_synced_at"`
	CreatedAt      time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

// Setting represents application settings
type Setting struct {
	Key       string    `json:"key" gorm:"primaryKey;size:100"`
	Value     string    `json:"value" gorm:"type:text;not null"`
	UpdatedAt time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

// Activity represents an audit log entry for user actions
type Activity struct {
	ID          uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	Action      string    `json:"action" gorm:"size:100;not null;index"`       // reconcile, suspend, resume, create, delete, etc.
	ResourceType string   `json:"resource_type" gorm:"size:50;index"`          // cluster, kustomization, helmrelease, etc.
	ResourceID   string   `json:"resource_id" gorm:"size:255;index"`           // ID of the affected resource
	ResourceName string   `json:"resource_name" gorm:"size:255"`               // Human-readable name
	ClusterID    string   `json:"cluster_id" gorm:"size:100;index"`            // Associated cluster
	ClusterName  string   `json:"cluster_name" gorm:"size:255"`                // Cached cluster name
	UserID       string   `json:"user_id" gorm:"size:100"`                     // User who performed the action
	Status       string   `json:"status" gorm:"size:50;default:'success'"`     // success, failed
	Message      string   `json:"message" gorm:"type:text"`                    // Additional details or error message
	CreatedAt    time.Time `json:"created_at" gorm:"autoCreateTime;index"`
}

// FluxResource represents a generic Flux resource
type FluxResource struct {
	ID            string    `json:"id" gorm:"primaryKey;size:255"`
	ClusterID     string    `json:"cluster_id" gorm:"size:100;not null;index;uniqueIndex:idx_unique_resource"`
	Kind          string    `json:"kind" gorm:"size:50;not null;index;uniqueIndex:idx_unique_resource"`             // Kustomization, HelmRelease, GitRepository, etc.
	Name          string    `json:"name" gorm:"size:255;not null;uniqueIndex:idx_unique_resource"`
	Namespace     string    `json:"namespace" gorm:"size:100;not null;uniqueIndex:idx_unique_resource"`
	Status        string    `json:"status" gorm:"size:50;default:'Unknown';index"` // Ready, NotReady, Unknown
	Message       string    `json:"message" gorm:"type:text"`
	LastReconcile time.Time `json:"last_reconcile" gorm:"column:last_reconcile"`
	Metadata      string    `json:"metadata" gorm:"type:text"` // JSON blob for additional data
	CreatedAt     time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time `json:"updated_at" gorm:"autoUpdateTime"`

	// Foreign key relationship
	Cluster Cluster `json:"-" gorm:"foreignKey:ClusterID;constraint:OnDelete:CASCADE"`
}

// TableName specifies the table name for FluxResource
func (FluxResource) TableName() string {
	return "flux_resources"
}

// BeforeSave is a GORM hook to ensure unique constraint
func (f *FluxResource) BeforeSave(tx *gorm.DB) error {
	return nil
}

// Kustomization represents a Flux Kustomization resource
type Kustomization struct {
	FluxResource
	SourceName      string `json:"source_name"`
	SourceNamespace string `json:"source_namespace"`
	Path            string `json:"path"`
	Interval        string `json:"interval"`
	Prune           bool   `json:"prune"`
	Suspended       bool   `json:"suspended"`
}

// HelmRelease represents a Flux HelmRelease resource
type HelmRelease struct {
	FluxResource
	Chart           string `json:"chart"`
	SourceName      string `json:"source_name"`
	SourceNamespace string `json:"source_namespace"`
	Version         string `json:"version"`
	Interval        string `json:"interval"`
	Suspended       bool   `json:"suspended"`
}

// GitRepository represents a Flux GitRepository resource
type GitRepository struct {
	FluxResource
	URL       string `json:"url"`
	Branch    string `json:"branch"`
	Interval  string `json:"interval"`
	Suspended bool   `json:"suspended"`
}

// HelmRepository represents a Flux HelmRepository resource
type HelmRepository struct {
	FluxResource
	URL       string `json:"url"`
	Interval  string `json:"interval"`
	Suspended bool   `json:"suspended"`
}

// ReconcileRequest represents a request to reconcile a Flux resource
type ReconcileRequest struct {
	ClusterID string `json:"cluster_id"`
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}
