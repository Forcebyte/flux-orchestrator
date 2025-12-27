# Azure AKS Integration

Flux Orchestrator now supports automatic discovery and management of Azure AKS clusters using Azure Service Principal authentication.

## Features

- **Automatic Discovery**: Discover all AKS clusters in an Azure subscription
- **Service Principal Auth**: Use Azure service principals for authentication  
- **Kubelogin Integration**: Generates kubeconfigs with Azure AD authentication via kubelogin
- **Automatic Sync**: One-click sync to import all discovered AKS clusters
- **Encrypted Storage**: Azure credentials are encrypted at rest
- **Multi-Subscription**: Support for multiple Azure subscriptions

## Prerequisites

### 1. Azure Service Principal

Create an Azure service principal with appropriate permissions:

```bash
# Login to Azure CLI
az login

# Create service principal with Contributor role
az ad sp create-for-rbac --name "flux-orchestrator-sp" \
  --role "Azure Kubernetes Service Cluster User Role" \
  --scopes /subscriptions/{subscription-id}

# Output will include:
# - appId (Client ID)
# - password (Client Secret)  
# - tenant (Tenant ID)
```

**Required Permissions:**
- `Azure Kubernetes Service Cluster User Role` - to list and access AKS clusters
- `Reader` role on subscription - to discover resources

### 2. Install kubelogin

On your local machine or wherever Flux Orchestrator runs:

```bash
# macOS
brew install Azure/kubelogin/kubelogin

# Linux
wget https://github.com/Azure/kubelogin/releases/latest/download/kubelogin-linux-amd64.zip
unzip kubelogin-linux-amd64.zip
sudo mv bin/linux_amd64/kubelogin /usr/local/bin/

# Windows
choco install kubelogin

# Verify installation
kubelogin --version
```

**Note**: kube login must be available in the PATH where Flux Orchestrator runs.

## Setup Guide

### Step 1: Add Azure Subscription

1. Navigate to **Settings** in the Flux Orchestrator UI
2. Click **Azure Subscriptions** tab
3. Click **"+ Add Azure Subscription"**
4. Fill in the form:
   - **Name**: Friendly name (e.g., "Production Subscription")
   - **Subscription ID**: Your Azure subscription ID
   - **Tenant ID**: Azure AD tenant ID
   - **Client ID**: Service principal application (client) ID
   - **Client Secret**: Service principal password
5. Click **"Test Connection"** to verify credentials
6. Click **"Add Subscription"**

### Step 2: Discover AKS Clusters

1. In the **Azure Subscriptions** list, find your subscription
2. Click **"Discover Clusters"** button
3. View the list of discovered AKS clusters with details:
   - Cluster name
   - Resource group
   - Location (region)
   - Kubernetes version
   - Node count

### Step 3: Sync AKS Clusters

1. Click **"Sync Clusters"** to import all discovered AKS clusters
2. Flux Orchestrator will:
   - Generate kubeconfig for each cluster with Azure AD auth
   - Encrypt and store kubeconfigs
   - Add clusters to the cluster list
   - Check cluster health
3. View synced clusters in **Clusters** page

## How It Works

### Authentication Flow

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────┐
│ Flux Orchestr.  │────────▶│ Azure API    │────────▶│ AKS Cluster │
│ (Service        │◀────────│ (ARM)        │◀────────│             │
│  Principal)     │         └──────────────┘         └─────────────┘
└─────────────────┘                │
        │                           │
        │                           ▼
        │                  ┌──────────────────┐
        │                  │ Azure AD         │
        │                  │ (Token Provider) │
        └─────────────────▶└──────────────────┘
                 kubelogin
```

1. **Discovery**: Service principal authenticates to Azure Resource Manager API
2. **List Clusters**: AKS API returns all clusters in the subscription
3. **Generate Kubeconfig**: Retrieves cluster credentials with Azure AD integration
4. **Kubelogin**: Generated kubeconfig uses `kubelogin` exec plugin for token refresh
5. **Access Cluster**: kubelogin obtains Azure AD tokens for Kubernetes API access

### Kubeconfig Format

The generated kubeconfig uses the Kubernetes exec credential plugin:

```yaml
users:
- name: clusterUser_resourceGroup_clusterName
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: kubelogin
      args:
        - get-token
        - --login
        - spn  # Service Principal
        - --environment
        - AzurePublicCloud
        - --tenant-id
        - {tenant-id}
        - --server-id
        - 6dae42f8-4368-4678-94ff-3960e28e3630  # AKS AAD Server
        - --client-id
        - {client-id}
        - --client-secret
        - {client-secret}
```

## API Reference

### List Azure Subscriptions
```
GET /api/v1/azure/subscriptions
```

### Create Azure Subscription
```
POST /api/v1/azure/subscriptions
Content-Type: application/json

{
  "name": "Production Subscription",
  "subscription_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "tenant_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "client_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "client_secret": "your-secret-here"
}
```

### Test Azure Connection
```
POST /api/v1/azure/subscriptions/{subscription_id}/test
```

### Discover AKS Clusters
```
GET /api/v1/azure/subscriptions/{subscription_id}/clusters
```

### Sync AKS Clusters
```
POST /api/v1/azure/subscriptions/{subscription_id}/sync
```

## Troubleshooting

### "kubelogin: command not found"

**Solution**: Install kubelogin and ensure it's in the PATH:
```bash
which kubelogin
# Should print: /usr/local/bin/kubelogin
```

### "Failed to authenticate with Azure"

**Causes**:
- Invalid service principal credentials
- Service principal doesn't have required permissions
- Tenant ID mismatch

**Solution**:
1. Verify service principal exists:
   ```bash
   az ad sp show --id {client-id}
   ```

2. Check role assignments:
   ```bash
   az role assignment list --assignee {client-id}
   ```

3. Ensure correct tenant ID

### "No AKS clusters discovered"

**Causes**:
- No AKS clusters in the subscription
- Service principal doesn't have Reader access

**Solution**:
1. List AKS clusters manually:
   ```bash
   az aks list --subscription {subscription-id}
   ```

2. Grant Reader role:
   ```bash
   az role assignment create \
     --assignee {client-id} \
     --role Reader \
     --scope /subscriptions/{subscription-id}
   ```

### "Failed to get cluster credentials"

**Causes**:
- Service principal doesn't have "Azure Kubernetes Service Cluster User Role"
- Cluster has local accounts disabled

**Solution**:
1. Grant AKS Cluster User role:
   ```bash
   az role assignment create \
     --assignee {client-id} \
     --role "Azure Kubernetes Service Cluster User Role" \
     --scope /subscriptions/{subscription-id}/resourceGroups/{rg}/providers/Microsoft.ContainerService/managedClusters/{cluster-name}
   ```

2. For admin access (not recommended):
   ```bash
   az role assignment create \
     --assignee {client-id} \
     --role "Azure Kubernetes Service Cluster Admin Role" \
     --scope /subscriptions/{subscription-id}
   ```

### Token Expired

Kubelogin automatically refreshes tokens. If you see authentication errors:

1. Test kubelogin manually:
   ```bash
   kubelogin get-token \
     --login spn \
     --tenant-id {tenant-id} \
     --client-id {client-id} \
     --client-secret {client-secret} \
     --server-id 6dae42f8-4368-4678-94ff-3960e28e3630
   ```

2. Verify service principal is not expired/disabled

## Security Best Practices

1. **Rotate Secrets**: Regularly rotate service principal client secrets
2. **Least Privilege**: Only grant required permissions (Cluster User, not Admin)
3. **Monitor Access**: Enable Azure AD audit logs for service principal activity
4. **Separate Subscriptions**: Use different service principals for different environments
5. **Secret Management**: Consider using Azure Key Vault for storing client secrets
6. **Network Security**: Restrict AKS API server access with authorized IP ranges

## Kubernetes Permissions

After syncing AKS clusters, configure RBAC in each cluster:

```yaml
# Give service principal view access
apiVersion: rbac.authorization.k8s.io/v1
kind:ClusterRoleBinding
metadata:
  name: flux-orchestrator-viewer
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: view
subjects:
- apiGroup: rbac.authorization.k8s.io
  kind: User
  name: {client-id}
```

## Comparison with Manual Kubeconfig

| Feature | Azure Integration | Manual Kubeconfig |
|---------|-------------------|-------------------|
| Discovery | Automatic | Manual |
| Setup | Service Principal | Export kubeconfig |
| Token Refresh | Automatic (kubelogin) | Manual refresh |
| Multi-Cluster | One-click sync | Individual setup |
| Credentials | Encrypted | Encrypted |
| Updates | Re-sync to update | Manual re-export |

## Limitations

- **kubelogin Required**: Must be installed on the Flux Orchestrator host
- **Azure Only**: Only works with AKS clusters (not other cloud providers)
- **Service Principal Auth**: Does not support managed identity or user authentication
- **Network Access**: Flux Orchestrator must have network access to AKS API servers

## Future Enhancements

- [ ] Support for Azure Managed Identity authentication
- [ ] Automatic periodic cluster discovery and sync
- [ ] Support for Azure Arc-enabled Kubernetes clusters
- [ ] Cluster auto-scaling recommendations based on metrics
- [ ] Cost analysis integration with Azure Cost Management

## Related Documentation

- [Azure Service Principals](https://learn.microsoft.com/en-us/azure/active-directory/develop/app-objects-and-service-principals)
- [AKS Azure AD Integration](https://learn.microsoft.com/en-us/azure/aks/azure-ad-integration-cli)
- [kubelogin Documentation](https://github.com/Azure/kubelogin)
- [Azure RBAC for AKS](https://learn.microsoft.com/en-us/azure/aks/concepts-identity#azure-rbac-for-kubernetes-authorization)
