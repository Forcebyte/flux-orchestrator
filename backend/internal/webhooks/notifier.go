package webhooks

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"
)

// EventType represents the type of webhook event
type EventType string

const (
	EventClusterHealthChanged EventType = "cluster.health.changed"
	EventReconciliationFailed EventType = "reconciliation.failed"
	EventResourceDeployed     EventType = "resource.deployed"
	EventResourceFailed       EventType = "resource.failed"
	EventSyncCompleted        EventType = "sync.completed"
	EventSyncFailed           EventType = "sync.failed"
)

// Event represents a webhook event
type Event struct {
	Type      EventType              `json:"type"`
	Timestamp time.Time              `json:"timestamp"`
	ClusterID string                 `json:"cluster_id,omitempty"`
	Resource  map[string]interface{} `json:"resource,omitempty"`
	Message   string                 `json:"message"`
	Severity  string                 `json:"severity"` // info, warning, error
}

// Notifier sends webhook notifications
type Notifier struct {
	webhookURLs []string
	client      *http.Client
	logger      *zap.Logger
	enabled     bool
}

// NewNotifier creates a new webhook notifier
func NewNotifier(webhookURLs []string, logger *zap.Logger) *Notifier {
	return &Notifier{
		webhookURLs: webhookURLs,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		logger:  logger,
		enabled: len(webhookURLs) > 0,
	}
}

// Notify sends a webhook notification
func (n *Notifier) Notify(event Event) {
	if !n.enabled {
		return
	}

	// Set timestamp if not provided
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	// Marshal event to JSON
	payload, err := json.Marshal(event)
	if err != nil {
		n.logger.Error("Failed to marshal webhook event", zap.Error(err))
		return
	}

	// Send to all configured webhook URLs
	for _, url := range n.webhookURLs {
		go n.sendWebhook(url, payload, event)
	}
}

// sendWebhook sends the webhook to a single URL
func (n *Notifier) sendWebhook(url string, payload []byte, event Event) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(payload))
	if err != nil {
		n.logger.Error("Failed to create webhook request",
			zap.String("url", url),
			zap.Error(err),
		)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "FluxOrchestrator/1.0")
	req.Header.Set("X-Flux-Event-Type", string(event.Type))

	resp, err := n.client.Do(req)
	if err != nil {
		n.logger.Error("Failed to send webhook",
			zap.String("url", url),
			zap.String("event_type", string(event.Type)),
			zap.Error(err),
		)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		n.logger.Debug("Webhook sent successfully",
			zap.String("url", url),
			zap.String("event_type", string(event.Type)),
			zap.Int("status_code", resp.StatusCode),
		)
	} else {
		n.logger.Warn("Webhook returned non-2xx status",
			zap.String("url", url),
			zap.String("event_type", string(event.Type)),
			zap.Int("status_code", resp.StatusCode),
		)
	}
}

// NotifyClusterHealthChanged notifies when cluster health changes
func (n *Notifier) NotifyClusterHealthChanged(clusterID, oldStatus, newStatus string) {
	if oldStatus == newStatus {
		return
	}

	severity := "info"
	if newStatus == "unhealthy" {
		severity = "error"
	} else if newStatus == "healthy" && oldStatus == "unhealthy" {
		severity = "info"
	}

	n.Notify(Event{
		Type:      EventClusterHealthChanged,
		ClusterID: clusterID,
		Message:   fmt.Sprintf("Cluster health changed from %s to %s", oldStatus, newStatus),
		Severity:  severity,
	})
}

// NotifyReconciliationFailed notifies when a reconciliation fails
func (n *Notifier) NotifyReconciliationFailed(clusterID, kind, namespace, name, message string) {
	n.Notify(Event{
		Type:      EventReconciliationFailed,
		ClusterID: clusterID,
		Resource: map[string]interface{}{
			"kind":      kind,
			"namespace": namespace,
			"name":      name,
		},
		Message:  fmt.Sprintf("Reconciliation failed for %s/%s in %s: %s", kind, name, namespace, message),
		Severity: "error",
	})
}

// NotifyResourceDeployed notifies when a resource is deployed successfully
func (n *Notifier) NotifyResourceDeployed(clusterID, kind, namespace, name string) {
	n.Notify(Event{
		Type:      EventResourceDeployed,
		ClusterID: clusterID,
		Resource: map[string]interface{}{
			"kind":      kind,
			"namespace": namespace,
			"name":      name,
		},
		Message:  fmt.Sprintf("Resource %s/%s deployed successfully in %s", kind, name, namespace),
		Severity: "info",
	})
}

// NotifySyncCompleted notifies when a sync operation completes
func (n *Notifier) NotifySyncCompleted(clusterID string, resourceCount int) {
	n.Notify(Event{
		Type:      EventSyncCompleted,
		ClusterID: clusterID,
		Message:   fmt.Sprintf("Synced %d resources from cluster %s", resourceCount, clusterID),
		Severity:  "info",
	})
}

// NotifySyncFailed notifies when a sync operation fails
func (n *Notifier) NotifySyncFailed(clusterID, message string) {
	n.Notify(Event{
		Type:      EventSyncFailed,
		ClusterID: clusterID,
		Message:   fmt.Sprintf("Failed to sync cluster %s: %s", clusterID, message),
		Severity:  "error",
	})
}

// ParseWebhookURLs parses a comma-separated string of webhook URLs
func ParseWebhookURLs(urlsStr string) []string {
	if urlsStr == "" {
		return nil
	}

	urls := strings.Split(urlsStr, ",")
	result := make([]string, 0, len(urls))

	for _, url := range urls {
		url = strings.TrimSpace(url)
		if url != "" {
			result = append(result, url)
		}
	}

	return result
}
