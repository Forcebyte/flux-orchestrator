package models

import (
	"time"
)

// Cluster represents a Kubernetes cluster managed by the orchestrator
type Cluster struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	KubeConfig  string    `json:"-" db:"kubeconfig"` // Hidden from JSON
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
	Status      string    `json:"status" db:"status"` // healthy, unhealthy, unknown
}

// FluxResource represents a generic Flux resource
type FluxResource struct {
	ID           string    `json:"id" db:"id"`
	ClusterID    string    `json:"cluster_id" db:"cluster_id"`
	Kind         string    `json:"kind" db:"kind"` // Kustomization, HelmRelease, GitRepository, etc.
	Name         string    `json:"name" db:"name"`
	Namespace    string    `json:"namespace" db:"namespace"`
	Status       string    `json:"status" db:"status"` // Ready, NotReady, Unknown
	Message      string    `json:"message" db:"message"`
	LastReconcile time.Time `json:"last_reconcile" db:"last_reconcile"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
	Metadata     string    `json:"metadata" db:"metadata"` // JSON blob for additional data
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
