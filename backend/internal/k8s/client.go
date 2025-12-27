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

// SuspendResource suspends reconciliation for a Flux resource
func (c *Client) SuspendResource(ctx context.Context, clusterID, kind, namespace, name string) error {
	return c.setSuspended(ctx, clusterID, kind, namespace, name, true)
}

// ResumeResource resumes reconciliation for a Flux resource
func (c *Client) ResumeResource(ctx context.Context, clusterID, kind, namespace, name string) error {
	return c.setSuspended(ctx, clusterID, kind, namespace, name, false)
}

// setSuspended sets the suspended field on a Flux resource
func (c *Client) setSuspended(ctx context.Context, clusterID, kind, namespace, name string, suspended bool) error {
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

	// Set suspended field
	if err := unstructured.SetNestedField(resource.Object, suspended, "spec", "suspend"); err != nil {
		return fmt.Errorf("failed to set suspend field: %w", err)
	}

	// Update the resource
	_, err = client.Resource(gvr).Namespace(namespace).Update(ctx, resource, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update resource: %w", err)
	}

	return nil
}

// UpdateFluxResource updates spec fields of a Flux resource
func (c *Client) UpdateFluxResource(ctx context.Context, clusterID, kind, namespace, name string, patch map[string]interface{}) error {
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

	// Apply patch to spec
	if specPatch, ok := patch["spec"].(map[string]interface{}); ok {
		currentSpec, found, err := unstructured.NestedMap(resource.Object, "spec")
		if err != nil {
			return fmt.Errorf("failed to get spec: %w", err)
		}
		if !found {
			currentSpec = make(map[string]interface{})
		}

		// Merge patch into current spec
		for key, value := range specPatch {
			currentSpec[key] = value
		}

		if err := unstructured.SetNestedMap(resource.Object, currentSpec, "spec"); err != nil {
			return fmt.Errorf("failed to set spec: %w", err)
		}
	}

	// Update the resource
	_, err = client.Resource(gvr).Namespace(namespace).Update(ctx, resource, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update resource: %w", err)
	}

	return nil
}

// GetResourcesCreatedByFlux gets all resources created by a specific Flux resource
func (c *Client) GetResourcesCreatedByFlux(ctx context.Context, clusterID, kind, namespace, name string) ([]map[string]interface{}, error) {
	client, err := c.GetClient(clusterID)
	if err != nil {
		return nil, err
	}

	gvr, err := c.getGVRForKind(kind)
	if err != nil {
		return nil, err
	}

	// Get the Flux resource
	fluxResource, err := client.Resource(gvr).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get flux resource: %w", err)
	}

	// Get the inventory from status
	inventory, found, err := unstructured.NestedSlice(fluxResource.Object, "status", "inventory", "entries")
	if err != nil || !found {
		return []map[string]interface{}{}, nil
	}

	// Fetch details for each resource in inventory
	resources := []map[string]interface{}{}
	for _, entry := range inventory {
		entryMap, ok := entry.(map[string]interface{})
		if !ok {
			continue
		}

		// Parse inventory entry format: "<id>_<namespace>_<name>"
		id, _, _ := unstructured.NestedString(entryMap, "id")
		v, _, _ := unstructured.NestedString(entryMap, "v")

		resourceInfo := map[string]interface{}{
			"id":      id,
			"version": v,
		}

		// Try to fetch the actual resource
		// Inventory format is typically: namespace_name_group_kind
		// We'll try to get more details if possible
		resources = append(resources, resourceInfo)
	}

	return resources, nil
}

// GetFluxStats gets statistics about Flux resources in a cluster
func (c *Client) GetFluxStats(clusterID string) (map[string]interface{}, error) {
	client, err := c.GetClient(clusterID)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	stats := map[string]interface{}{
		"kustomizations":    map[string]int{"total": 0, "ready": 0, "notReady": 0, "suspended": 0},
		"helmReleases":      map[string]int{"total": 0, "ready": 0, "notReady": 0, "suspended": 0},
		"gitRepositories":   map[string]int{"total": 0, "ready": 0, "notReady": 0, "suspended": 0},
		"helmRepositories":  map[string]int{"total": 0, "ready": 0, "notReady": 0, "suspended": 0},
	}

	fluxGVRs := []struct {
		gvr      schema.GroupVersionResource
		statsKey string
	}{
		{
			gvr: schema.GroupVersionResource{
				Group:    "kustomize.toolkit.fluxcd.io",
				Version:  "v1",
				Resource: "kustomizations",
			},
			statsKey: "kustomizations",
		},
		{
			gvr: schema.GroupVersionResource{
				Group:    "helm.toolkit.fluxcd.io",
				Version:  "v2",
				Resource: "helmreleases",
			},
			statsKey: "helmReleases",
		},
		{
			gvr: schema.GroupVersionResource{
				Group:    "source.toolkit.fluxcd.io",
				Version:  "v1",
				Resource: "gitrepositories",
			},
			statsKey: "gitRepositories",
		},
		{
			gvr: schema.GroupVersionResource{
				Group:    "source.toolkit.fluxcd.io",
				Version:  "v1",
				Resource: "helmrepositories",
			},
			statsKey: "helmRepositories",
		},
	}

	for _, item := range fluxGVRs {
		list, err := client.Resource(item.gvr).Namespace("").List(ctx, metav1.ListOptions{})
		if err != nil {
			continue
		}

		resourceStats := stats[item.statsKey].(map[string]int)
		resourceStats["total"] = len(list.Items)

		for _, obj := range list.Items {
			// Check if suspended
			suspended, _, _ := unstructured.NestedBool(obj.Object, "spec", "suspend")
			if suspended {
				resourceStats["suspended"]++
				continue
			}

			// Check Ready condition
			conditions, found, err := unstructured.NestedSlice(obj.Object, "status", "conditions")
			if err == nil && found && len(conditions) > 0 {
				for _, cond := range conditions {
					condMap, ok := cond.(map[string]interface{})
					if !ok {
						continue
					}
					condType, _, _ := unstructured.NestedString(condMap, "type")
					condStatus, _, _ := unstructured.NestedString(condMap, "status")

					if condType == "Ready" {
						if condStatus == "True" {
							resourceStats["ready"]++
						} else {
							resourceStats["notReady"]++
						}
						break
					}
				}
			}
		}
	}

	return stats, nil
}

// GetInClusterConfig returns the in-cluster config
func GetInClusterConfig() (*rest.Config, error) {
	return rest.InClusterConfig()
}

// ResourceNode represents a node in the resource tree
type ResourceNode struct {
	ID          string         `json:"id"`
	Kind        string         `json:"kind"`
	Name        string         `json:"name"`
	Namespace   string         `json:"namespace"`
	Status      string         `json:"status"`
	Health      string         `json:"health"`
	CreatedAt   string         `json:"created_at"`
	Children    []ResourceNode `json:"children,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// GetResourceTree builds a hierarchical tree of all Kubernetes resources in a cluster
func (c *Client) GetResourceTree(ctx context.Context, clusterID string) ([]ResourceNode, error) {
	client, err := c.GetClient(clusterID)
	if err != nil {
		return nil, err
	}

	// Get all resource types to query
	resourceTypes := []struct {
		gvr       schema.GroupVersionResource
		kind      string
		namespaced bool
	}{
		// Flux resources
		{schema.GroupVersionResource{Group: "kustomize.toolkit.fluxcd.io", Version: "v1", Resource: "kustomizations"}, "Kustomization", true},
		{schema.GroupVersionResource{Group: "helm.toolkit.fluxcd.io", Version: "v2", Resource: "helmreleases"}, "HelmRelease", true},
		{schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1", Resource: "gitrepositories"}, "GitRepository", true},
		{schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1", Resource: "helmrepositories"}, "HelmRepository", true},
		{schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1beta2", Resource: "buckets"}, "Bucket", true},
		{schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1beta2", Resource: "ocirepositories"}, "OCIRepository", true},
		
		// Core Kubernetes resources
		{schema.GroupVersionResource{Group: "", Version: "v1", Resource: "namespaces"}, "Namespace", false},
		{schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}, "Deployment", true},
		{schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "replicasets"}, "ReplicaSet", true},
		{schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "statefulsets"}, "StatefulSet", true},
		{schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "daemonsets"}, "DaemonSet", true},
		{schema.GroupVersionResource{Group: "", Version: "v1", Resource: "pods"}, "Pod", true},
		{schema.GroupVersionResource{Group: "", Version: "v1", Resource: "services"}, "Service", true},
		{schema.GroupVersionResource{Group: "", Version: "v1", Resource: "configmaps"}, "ConfigMap", true},
		{schema.GroupVersionResource{Group: "", Version: "v1", Resource: "secrets"}, "Secret", true},
		{schema.GroupVersionResource{Group: "networking.k8s.io", Version: "v1", Resource: "ingresses"}, "Ingress", true},
		{schema.GroupVersionResource{Group: "batch", Version: "v1", Resource: "jobs"}, "Job", true},
		{schema.GroupVersionResource{Group: "batch", Version: "v1", Resource: "cronjobs"}, "CronJob", true},
	}

	allResources := make(map[string]*ResourceNode)
	var rootResources []string

	// Fetch all resources
	for _, rt := range resourceTypes {
		var list *unstructured.UnstructuredList
		var err error

		if rt.namespaced {
			list, err = client.Resource(rt.gvr).List(ctx, metav1.ListOptions{})
		} else {
			list, err = client.Resource(rt.gvr).List(ctx, metav1.ListOptions{})
		}

		if err != nil {
			// Skip resources that don't exist in this cluster
			continue
		}

		for _, obj := range list.Items {
			node := c.parseResourceNode(&obj, rt.kind)
			allResources[node.ID] = &node

			// Track resources without owners as roots
			owners := obj.GetOwnerReferences()
			if len(owners) == 0 {
				rootResources = append(rootResources, node.ID)
			}
		}
	}

	// Build parent-child relationships
	for _, res := range allResources {
		// Find this resource's object to get owner references
		for _, rt := range resourceTypes {
			if rt.kind != res.Kind {
				continue
			}

			var obj *unstructured.Unstructured
			var err error

			if rt.namespaced {
				obj, err = client.Resource(rt.gvr).Namespace(res.Namespace).Get(ctx, res.Name, metav1.GetOptions{})
			} else {
				obj, err = client.Resource(rt.gvr).Get(ctx, res.Name, metav1.GetOptions{})
			}

			if err != nil {
				continue
			}

			owners := obj.GetOwnerReferences()
			for _, owner := range owners {
				parentID := fmt.Sprintf("%s/%s/%s", res.Namespace, string(owner.Kind), owner.Name)
				if parent, exists := allResources[parentID]; exists {
					parent.Children = append(parent.Children, *res)
				}
			}
			break
		}
	}

	// Build tree from root resources
	var tree []ResourceNode
	for _, rootID := range rootResources {
		if root, exists := allResources[rootID]; exists {
			tree = append(tree, *root)
		}
	}

	return tree, nil
}

// parseResourceNode converts an unstructured object to a ResourceNode
func (c *Client) parseResourceNode(obj *unstructured.Unstructured, kind string) ResourceNode {
	status := "Unknown"
	health := "Unknown"

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

			if condType == "Ready" {
				status = condStatus
				if condStatus == "True" {
					health = "Healthy"
				} else {
					health = "Degraded"
				}
				break
			}
		}
	}

	// Extract phase for Pods
	if kind == "Pod" {
		phase, found, _ := unstructured.NestedString(obj.Object, "status", "phase")
		if found {
			status = phase
			switch phase {
			case "Running", "Succeeded":
				health = "Healthy"
			case "Pending":
				health = "Progressing"
			case "Failed", "Unknown":
				health = "Degraded"
			}
		}
	}

	// Build metadata
	metadata := make(map[string]interface{})
	metadata["apiVersion"] = obj.GetAPIVersion()
	if labels := obj.GetLabels(); len(labels) > 0 {
		metadata["labels"] = labels
	}
	if annotations := obj.GetAnnotations(); len(annotations) > 0 {
		metadata["annotations"] = annotations
	}

	return ResourceNode{
		ID:        fmt.Sprintf("%s/%s/%s", obj.GetNamespace(), kind, obj.GetName()),
		Kind:      kind,
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		Status:    status,
		Health:    health,
		CreatedAt: obj.GetCreationTimestamp().Format(time.RFC3339),
		Children:  []ResourceNode{},
		Metadata:  metadata,
	}
}
