package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// HTTP metrics
	HTTPRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "flux_orchestrator_http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	HTTPRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "flux_orchestrator_http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	// Cluster metrics
	ClustersTotal = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "flux_orchestrator_clusters_total",
			Help: "Total number of registered clusters",
		},
	)

	ClustersHealthy = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "flux_orchestrator_clusters_healthy",
			Help: "Number of healthy clusters",
		},
	)

	// Resource metrics
	FluxResourcesTotal = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "flux_orchestrator_flux_resources_total",
			Help: "Total number of Flux resources",
		},
		[]string{"cluster_id", "kind", "status"},
	)

	// Reconciliation metrics
	ReconciliationsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "flux_orchestrator_reconciliations_total",
			Help: "Total number of reconciliation requests",
		},
		[]string{"cluster_id", "kind", "status"},
	)

	// Sync worker metrics
	SyncDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "flux_orchestrator_sync_duration_seconds",
			Help:    "Duration of sync operations",
			Buckets: []float64{1, 5, 10, 30, 60, 120, 300},
		},
	)

	SyncErrorsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "flux_orchestrator_sync_errors_total",
			Help: "Total number of sync errors",
		},
		[]string{"cluster_id", "error_type"},
	)

	// Database metrics
	DatabaseQueriesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "flux_orchestrator_database_queries_total",
			Help: "Total number of database queries",
		},
		[]string{"operation", "table"},
	)

	DatabaseQueryDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "flux_orchestrator_database_query_duration_seconds",
			Help:    "Database query duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"operation", "table"},
	)
)
