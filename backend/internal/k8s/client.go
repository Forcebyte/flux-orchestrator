package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Forcebyte/flux-orchestrator/backend/internal/models"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// Client manages Kubernetes clients for multiple clusters
type Client struct {
	clients map[string]dynamic.Interface
}

// NewClient creates a new multi-cluster Kubernetes client
func NewClient() *Client {
	return &Client{
		clients: make(map[string]dynamic.Interface),
	}
}

// AddCluster adds a cluster client from kubeconfig
func (c *Client) AddCluster(clusterID, kubeconfig string) error {
	config, err := clientcmd.RESTConfigFromKubeConfig([]byte(kubeconfig))
	if err != nil {
		return fmt.Errorf("failed to parse kubeconfig: %w", err)
	}

	client, err := dynamic.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create dynamic client: %w", err)
	}

	c.clients[clusterID] = client
	return nil
}

// AddInClusterConfig adds a cluster client using in-cluster configuration
func (c *Client) AddInClusterConfig(clusterID string) error {
	config, err := rest.InClusterConfig()
	if err != nil {
		return fmt.Errorf("failed to get in-cluster config: %w", err)
	}

	client, err := dynamic.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create dynamic client: %w", err)
	}

	c.clients[clusterID] = client
	return nil
}

// GetClient returns the Kubernetes client for a cluster
func (c *Client) GetClient(clusterID string) (dynamic.Interface, error) {
	client, ok := c.clients[clusterID]
	if !ok {
		return nil, fmt.Errorf("cluster %s not found", clusterID)
	}
	return client, nil
}

// CheckClusterHealth checks if a cluster is healthy
func (c *Client) CheckClusterHealth(clusterID string) (string, error) {
	client, err := c.GetClient(clusterID)
	if err != nil {
		return "unknown", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Try to list namespaces as a health check
	gvr := schema.GroupVersionResource{
		Group:    "",
		Version:  "v1",
		Resource: "namespaces",
	}

	_, err = client.Resource(gvr).List(ctx, metav1.ListOptions{Limit: 1})
	if err != nil {
		return "unhealthy", err
	}

	return "healthy", nil
}

// GetFluxResources retrieves Flux resources from a cluster
func (c *Client) GetFluxResources(clusterID string) ([]models.FluxResource, error) {
	client, err := c.GetClient(clusterID)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	resources := []models.FluxResource{}

	// Define Flux CRDs to query
	fluxGVRs := []struct {
		gvr  schema.GroupVersionResource
		kind string
	}{
		{
			gvr: schema.GroupVersionResource{
				Group:    "kustomize.toolkit.fluxcd.io",
				Version:  "v1",
				Resource: "kustomizations",
			},
			kind: "Kustomization",
		},
		{
			gvr: schema.GroupVersionResource{
				Group:    "helm.toolkit.fluxcd.io",
				Version:  "v2",
				Resource: "helmreleases",
			},
			kind: "HelmRelease",
		},
		{
			gvr: schema.GroupVersionResource{
				Group:    "source.toolkit.fluxcd.io",
				Version:  "v1",
				Resource: "gitrepositories",
			},
			kind: "GitRepository",
		},
		{
			gvr: schema.GroupVersionResource{
				Group:    "source.toolkit.fluxcd.io",
				Version:  "v1",
				Resource: "helmrepositories",
			},
			kind: "HelmRepository",
		},
	}

	for _, item := range fluxGVRs {
		list, err := client.Resource(item.gvr).Namespace("").List(ctx, metav1.ListOptions{})
		if err != nil {
			// If CRD doesn't exist, skip it
			continue
		}

		for _, obj := range list.Items {
			resource := c.parseFluxResource(clusterID, item.kind, &obj)
			resources = append(resources, resource)
		}
	}

	return resources, nil
}

// parseFluxResource converts an unstructured object to a FluxResource
func (c *Client) parseFluxResource(clusterID, kind string, obj *unstructured.Unstructured) models.FluxResource {
	status := "Unknown"
	message := ""
	var lastReconcile time.Time

	// Extract status conditions
	conditions, found, err := unstructured.NestedSlice(obj.Object, "status", "conditions")
	if err == nil && found && len(conditions) > 0 {
		for _, cond := range conditions {
			condMap, ok := cond.(map[string]interface{})
			if !ok {
				continue
			}
			condType, _, _ := unstructured.NestedString(condMap, "type")
			condStatus, _, _ := unstructured.NestedString(condMap, "status")
			condMessage, _, _ := unstructured.NestedString(condMap, "message")

			if condType == "Ready" {
				if condStatus == "True" {
					status = "Ready"
				} else {
					status = "NotReady"
				}
				message = condMessage
				break
			}
		}
	}

	// Extract last reconcile time
	lastReconcileStr, found, _ := unstructured.NestedString(obj.Object, "status", "lastHandledReconcileAt")
	if found {
		lastReconcile, _ = time.Parse(time.RFC3339, lastReconcileStr)
	}

	// Serialize metadata
	metadata, _ := json.Marshal(obj.Object)

	return models.FluxResource{
		ID:            fmt.Sprintf("%s/%s/%s/%s", clusterID, kind, obj.GetNamespace(), obj.GetName()),
		ClusterID:     clusterID,
		Kind:          kind,
		Name:          obj.GetName(),
		Namespace:     obj.GetNamespace(),
		Status:        status,
		Message:       message,
		LastReconcile: lastReconcile,
		CreatedAt:     obj.GetCreationTimestamp().Time,
		UpdatedAt:     time.Now(),
		Metadata:      string(metadata),
	}
}

// ReconcileResource triggers reconciliation for a Flux resource
func (c *Client) ReconcileResource(ctx context.Context, clusterID, kind, namespace, name string) error {
	client, err := c.GetClient(clusterID)
	if err != nil {
		return err
	}

	gvr, err := c.getGVRForKind(kind)
	if err != nil {
		return err
	}

	// Get the resource
	resource, err := client.Resource(gvr).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get resource: %w", err)
	}

	// Add reconcile annotation
	annotations := resource.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}
	annotations["reconcile.fluxcd.io/requestedAt"] = time.Now().Format(time.RFC3339)
	resource.SetAnnotations(annotations)

	// Update the resource
	_, err = client.Resource(gvr).Namespace(namespace).Update(ctx, resource, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update resource: %w", err)
	}

	return nil
}

// getGVRForKind returns the GroupVersionResource for a Flux kind
func (c *Client) getGVRForKind(kind string) (schema.GroupVersionResource, error) {
	switch kind {
	case "Kustomization":
		return schema.GroupVersionResource{
			Group:    "kustomize.toolkit.fluxcd.io",
			Version:  "v1",
			Resource: "kustomizations",
		}, nil
	case "HelmRelease":
		return schema.GroupVersionResource{
			Group:    "helm.toolkit.fluxcd.io",
			Version:  "v2",
			Resource: "helmreleases",
		}, nil
	case "GitRepository":
		return schema.GroupVersionResource{
			Group:    "source.toolkit.fluxcd.io",
			Version:  "v1",
			Resource: "gitrepositories",
		}, nil
	case "HelmRepository":
		return schema.GroupVersionResource{
			Group:    "source.toolkit.fluxcd.io",
			Version:  "v1",
			Resource: "helmrepositories",
		}, nil
	default:
		return schema.GroupVersionResource{}, fmt.Errorf("unknown kind: %s", kind)
	}
}

// GetInClusterConfig returns the in-cluster config
func GetInClusterConfig() (*rest.Config, error) {
	return rest.InClusterConfig()
}
