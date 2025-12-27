package azure

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"

	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/containerservice/armcontainerservice/v4"
)

// Credentials represents Azure service principal credentials
type Credentials struct {
	TenantID       string `json:"tenant_id"`
	ClientID       string `json:"client_id"`
	ClientSecret   string `json:"client_secret"`
	SubscriptionID string `json:"subscription_id"`
}

// Client manages Azure AKS cluster discovery and authentication
type Client struct {
	credentials map[string]*Credentials // subscriptionID -> credentials
}

// NewClient creates a new Azure client
func NewClient() *Client {
	return &Client{
		credentials: make(map[string]*Credentials),
	}
}

// AddCredentials adds Azure service principal credentials for a subscription
func (c *Client) AddCredentials(subscriptionID string, creds *Credentials) {
	c.credentials[subscriptionID] = creds
	log.Printf("Added Azure credentials for subscription: %s", subscriptionID)
}

// RemoveCredentials removes Azure credentials for a subscription
func (c *Client) RemoveCredentials(subscriptionID string) {
	delete(c.credentials, subscriptionID)
	log.Printf("Removed Azure credentials for subscription: %s", subscriptionID)
}

// AKSCluster represents an AKS cluster with its configuration
type AKSCluster struct {
	ID                string
	Name              string
	ResourceGroup     string
	Location          string
	KubernetesVersion string
	FQDN              string
	NodeCount         int
	SubscriptionID    string
	TenantID          string
}

// DiscoverClusters discovers all AKS clusters in a subscription
func (c *Client) DiscoverClusters(ctx context.Context, subscriptionID string) ([]AKSCluster, error) {
	creds, exists := c.credentials[subscriptionID]
	if !exists {
		return nil, fmt.Errorf("no credentials found for subscription: %s", subscriptionID)
	}

	// Create Azure credential
	credential, err := azidentity.NewClientSecretCredential(
		creds.TenantID,
		creds.ClientID,
		creds.ClientSecret,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create Azure credential: %w", err)
	}

	// Create AKS client
	clientFactory, err := armcontainerservice.NewClientFactory(subscriptionID, credential, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create AKS client: %w", err)
	}

	managedClustersClient := clientFactory.NewManagedClustersClient()

	// List all AKS clusters in the subscription
	pager := managedClustersClient.NewListPager(nil)
	var clusters []AKSCluster

	for pager.More() {
		page, err := pager.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to list AKS clusters: %w", err)
		}

		for _, cluster := range page.Value {
			if cluster.ID == nil || cluster.Name == nil {
				continue
			}

			// Extract resource group from cluster ID
			// Format: /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.ContainerService/managedClusters/{clusterName}
			resourceGroup := extractResourceGroup(*cluster.ID)

			aksCluster := AKSCluster{
				ID:                *cluster.ID,
				Name:              *cluster.Name,
				ResourceGroup:     resourceGroup,
				Location:          *cluster.Location,
				KubernetesVersion: *cluster.Properties.KubernetesVersion,
				SubscriptionID:    subscriptionID,
				TenantID:          creds.TenantID,
			}

			if cluster.Properties.Fqdn != nil {
				aksCluster.FQDN = *cluster.Properties.Fqdn
			}

			// Count total nodes across all agent pools
			if cluster.Properties.AgentPoolProfiles != nil {
				for _, pool := range cluster.Properties.AgentPoolProfiles {
					if pool.Count != nil {
						aksCluster.NodeCount += int(*pool.Count)
					}
				}
			}

			clusters = append(clusters, aksCluster)
		}
	}

	log.Printf("Discovered %d AKS clusters in subscription %s", len(clusters), subscriptionID)
	return clusters, nil
}

// GenerateKubeconfig generates a kubeconfig for an AKS cluster with Azure AD authentication
func (c *Client) GenerateKubeconfig(ctx context.Context, cluster AKSCluster) (string, error) {
	creds, exists := c.credentials[cluster.SubscriptionID]
	if !exists {
		return "", fmt.Errorf("no credentials found for subscription: %s", cluster.SubscriptionID)
	}

	// Create Azure credential
	credential, err := azidentity.NewClientSecretCredential(
		creds.TenantID,
		creds.ClientID,
		creds.ClientSecret,
		nil,
	)
	if err != nil {
		return "", fmt.Errorf("failed to create Azure credential: %w", err)
	}

	// Create AKS client
	clientFactory, err := armcontainerservice.NewClientFactory(cluster.SubscriptionID, credential, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create AKS client: %w", err)
	}

	managedClustersClient := clientFactory.NewManagedClustersClient()

	// Get cluster admin credentials
	credResult, err := managedClustersClient.ListClusterUserCredentials(ctx, cluster.ResourceGroup, cluster.Name, nil)
	if err != nil {
		return "", fmt.Errorf("failed to get cluster credentials: %w", err)
	}

	if credResult.Kubeconfigs == nil || len(credResult.Kubeconfigs) == 0 {
		return "", fmt.Errorf("no kubeconfig found for cluster")
	}

	// Get the first kubeconfig (user credentials)
	kubeconfigBytes := credResult.Kubeconfigs[0].Value

	// Parse and modify kubeconfig to use kubelogin for Azure AD authentication
	var kubeconfigData map[string]interface{}
	if err := json.Unmarshal(kubeconfigBytes, &kubeconfigData); err != nil {
		return "", fmt.Errorf("failed to parse kubeconfig: %w", err)
	}

	// Modify the user section to use exec credential plugin (kubelogin)
	if users, ok := kubeconfigData["users"].([]interface{}); ok && len(users) > 0 {
		if user, ok := users[0].(map[string]interface{}); ok {
			// Replace token-based auth with exec credential plugin
			user["user"] = map[string]interface{}{
				"exec": map[string]interface{}{
					"apiVersion": "client.authentication.k8s.io/v1beta1",
					"command":    "kubelogin",
					"args": []string{
						"get-token",
						"--login", "spn",
						"--environment", "AzurePublicCloud",
						"--tenant-id", creds.TenantID,
						"--server-id", "6dae42f8-4368-4678-94ff-3960e28e3630", // Azure Kubernetes Service AAD Server
						"--client-id", creds.ClientID,
						"--client-secret", creds.ClientSecret,
					},
					"env":                nil,
					"interactiveMode":    "Never",
					"provideClusterInfo": false,
				},
			}
		}
	}

	// Convert back to JSON
	modifiedKubeconfig, err := json.MarshalIndent(kubeconfigData, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal kubeconfig: %w", err)
	}

	return string(modifiedKubeconfig), nil
}

// GetClusterAdminCredentials gets admin credentials for an AKS cluster (for operations that require admin access)
func (c *Client) GetClusterAdminCredentials(ctx context.Context, cluster AKSCluster) (string, error) {
	creds, exists := c.credentials[cluster.SubscriptionID]
	if !exists {
		return "", fmt.Errorf("no credentials found for subscription: %s", cluster.SubscriptionID)
	}

	// Create Azure credential
	credential, err := azidentity.NewClientSecretCredential(
		creds.TenantID,
		creds.ClientID,
		creds.ClientSecret,
		nil,
	)
	if err != nil {
		return "", fmt.Errorf("failed to create Azure credential: %w", err)
	}

	// Create AKS client
	clientFactory, err := armcontainerservice.NewClientFactory(cluster.SubscriptionID, credential, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create AKS client: %w", err)
	}

	managedClustersClient := clientFactory.NewManagedClustersClient()

	// Get cluster admin credentials
	credResult, err := managedClustersClient.ListClusterAdminCredentials(ctx, cluster.ResourceGroup, cluster.Name, nil)
	if err != nil {
		return "", fmt.Errorf("failed to get cluster admin credentials: %w", err)
	}

	if credResult.Kubeconfigs == nil || len(credResult.Kubeconfigs) == 0 {
		return "", fmt.Errorf("no admin kubeconfig found for cluster")
	}

	// Return the first admin kubeconfig
	return string(credResult.Kubeconfigs[0].Value), nil
}

// TestConnection tests Azure credentials by attempting to list resource groups
func (c *Client) TestConnection(ctx context.Context, subscriptionID string) error {
	creds, exists := c.credentials[subscriptionID]
	if !exists {
		return fmt.Errorf("no credentials found for subscription: %s", subscriptionID)
	}

	// Create Azure credential
	credential, err := azidentity.NewClientSecretCredential(
		creds.TenantID,
		creds.ClientID,
		creds.ClientSecret,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to create Azure credential: %w", err)
	}

	// Test by creating an AKS client and listing clusters
	clientFactory, err := armcontainerservice.NewClientFactory(subscriptionID, credential, nil)
	if err != nil {
		return fmt.Errorf("failed to create AKS client: %w", err)
	}

	managedClustersClient := clientFactory.NewManagedClustersClient()
	
	// Attempt to list clusters (just to verify credentials work)
	pager := managedClustersClient.NewListPager(nil)
	if !pager.More() {
		// No clusters, but credentials are valid
		return nil
	}

	_, err = pager.NextPage(ctx)
	if err != nil {
		return fmt.Errorf("failed to verify credentials: %w", err)
	}

	return nil
}

// extractResourceGroup extracts resource group name from Azure resource ID
func extractResourceGroup(resourceID string) string {
	// Parse resource ID: /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/...
	const resourceGroupPrefix = "/resourceGroups/"
	const providersPrefix = "/providers/"

	startIdx := len("/subscriptions/")
	if idx := findNth(resourceID, "/", 4); idx != -1 {
		startIdx = idx + 1
	}

	endIdx := len(resourceID)
	if idx := findNth(resourceID, "/", 5); idx != -1 {
		endIdx = idx
	}

	if startIdx < endIdx && startIdx >= 0 && endIdx <= len(resourceID) {
		parts := resourceID[startIdx:endIdx]
		return parts
	}

	return ""
}

// findNth finds the nth occurrence of a substring
func findNth(s, substr string, n int) int {
	count := 0
	for i := 0; i < len(s); i++ {
		if i+len(substr) <= len(s) && s[i:i+len(substr)] == substr {
			count++
			if count == n {
				return i
			}
		}
	}
	return -1
}

// EncodeCredentials encodes Azure credentials to a base64 string for storage
func EncodeCredentials(creds *Credentials) (string, error) {
	jsonBytes, err := json.Marshal(creds)
	if err != nil {
		return "", fmt.Errorf("failed to marshal credentials: %w", err)
	}
	return base64.StdEncoding.EncodeToString(jsonBytes), nil
}

// DecodeCredentials decodes Azure credentials from a base64 string
func DecodeCredentials(encoded string) (*Credentials, error) {
	jsonBytes, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("failed to decode credentials: %w", err)
	}

	var creds Credentials
	if err := json.Unmarshal(jsonBytes, &creds); err != nil {
		return nil, fmt.Errorf("failed to unmarshal credentials: %w", err)
	}

	return &creds, nil
}
