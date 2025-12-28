// Mock data for demo mode
import { Cluster, FluxResource, Activity, FluxStats, AzureSubscription, OAuthProvider } from './types';

export const mockClusters: Cluster[] = [
  {
    id: 'demo-cluster-1',
    name: 'Production Cluster',
    description: 'Main production Kubernetes cluster',
    status: 'healthy',
    source: 'manual',
    is_favorite: true,
    health_check_interval: 300,
    resource_count: 12,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-12-27T14:30:00Z',
  },
  {
    id: 'demo-cluster-2',
    name: 'Staging Environment',
    description: 'Staging and testing cluster',
    status: 'healthy',
    source: 'azure-aks',
    source_id: '/subscriptions/demo-sub/resourceGroups/demo-rg/providers/Microsoft.ContainerService/managedClusters/staging',
    is_favorite: false,
    health_check_interval: 300,
    resource_count: 8,
    created_at: '2024-02-20T09:00:00Z',
    updated_at: '2024-12-27T14:25:00Z',
  },
  {
    id: 'demo-cluster-3',
    name: 'Development Cluster',
    description: 'Development and experimentation cluster',
    status: 'healthy',
    source: 'manual',
    is_favorite: false,
    health_check_interval: 300,
    resource_count: 15,
    created_at: '2024-03-10T11:00:00Z',
    updated_at: '2024-12-27T14:20:00Z',
  },
];

export const mockResources: FluxResource[] = [
  {
    id: 'demo-res-1',
    cluster_id: 'demo-cluster-1',
    kind: 'Kustomization',
    name: 'infrastructure',
    namespace: 'flux-system',
    status: 'Ready',
    message: 'Applied revision: main@sha1:abc123',
    last_reconcile: '2024-12-27T14:30:00Z',
    metadata: JSON.stringify({ path: './infrastructure', prune: true }),
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-12-27T14:30:00Z',
  },
  {
    id: 'demo-res-2',
    cluster_id: 'demo-cluster-1',
    kind: 'HelmRelease',
    name: 'nginx-ingress',
    namespace: 'ingress-nginx',
    status: 'Ready',
    message: 'Release reconciliation succeeded',
    last_reconcile: '2024-12-27T14:28:00Z',
    metadata: JSON.stringify({ chart: 'nginx-ingress', version: '4.8.3' }),
    created_at: '2024-01-15T11:00:00Z',
    updated_at: '2024-12-27T14:28:00Z',
  },
  {
    id: 'demo-res-3',
    cluster_id: 'demo-cluster-1',
    kind: 'GitRepository',
    name: 'flux-system',
    namespace: 'flux-system',
    status: 'Ready',
    message: 'Fetched revision: main@sha1:def456',
    last_reconcile: '2024-12-27T14:29:00Z',
    metadata: JSON.stringify({ url: 'https://github.com/company/flux-config', branch: 'main' }),
    created_at: '2024-01-15T10:15:00Z',
    updated_at: '2024-12-27T14:29:00Z',
  },
  {
    id: 'demo-res-4',
    cluster_id: 'demo-cluster-1',
    kind: 'HelmRepository',
    name: 'bitnami',
    namespace: 'flux-system',
    status: 'Ready',
    message: 'Fetched revision: sha256:ghi789',
    last_reconcile: '2024-12-27T14:27:00Z',
    metadata: JSON.stringify({ url: 'https://charts.bitnami.com/bitnami' }),
    created_at: '2024-01-15T10:20:00Z',
    updated_at: '2024-12-27T14:27:00Z',
  },
  {
    id: 'demo-res-5',
    cluster_id: 'demo-cluster-2',
    kind: 'Kustomization',
    name: 'apps',
    namespace: 'flux-system',
    status: 'Ready',
    message: 'Applied revision: staging@sha1:jkl012',
    last_reconcile: '2024-12-27T14:25:00Z',
    metadata: JSON.stringify({ path: './apps', prune: true }),
    created_at: '2024-02-20T09:30:00Z',
    updated_at: '2024-12-27T14:25:00Z',
  },
  {
    id: 'demo-res-6',
    cluster_id: 'demo-cluster-2',
    kind: 'HelmRelease',
    name: 'prometheus',
    namespace: 'monitoring',
    status: 'Ready',
    message: 'Release reconciliation succeeded',
    last_reconcile: '2024-12-27T14:24:00Z',
    metadata: JSON.stringify({ chart: 'prometheus', version: '15.18.0' }),
    created_at: '2024-02-20T10:00:00Z',
    updated_at: '2024-12-27T14:24:00Z',
  },
  {
    id: 'demo-res-7',
    cluster_id: 'demo-cluster-3',
    kind: 'Kustomization',
    name: 'backend',
    namespace: 'flux-system',
    status: 'NotReady',
    message: 'Dependency not ready: apps/gitrepository/backend-repo',
    last_reconcile: '2024-12-27T14:20:00Z',
    metadata: JSON.stringify({ path: './backend', prune: false }),
    created_at: '2024-03-10T11:30:00Z',
    updated_at: '2024-12-27T14:20:00Z',
  },
  {
    id: 'demo-res-8',
    cluster_id: 'demo-cluster-3',
    kind: 'GitRepository',
    name: 'backend-repo',
    namespace: 'apps',
    status: 'NotReady',
    message: 'Authentication failed',
    last_reconcile: '2024-12-27T14:19:00Z',
    metadata: JSON.stringify({ url: 'https://github.com/company/backend', branch: 'develop' }),
    created_at: '2024-03-10T11:15:00Z',
    updated_at: '2024-12-27T14:19:00Z',
  },
];

export const mockActivities: Activity[] = [
  {
    id: 1,
    action: 'reconcile',
    resource_type: 'kustomization',
    resource_id: 'demo-res-1',
    resource_name: 'infrastructure',
    cluster_id: 'demo-cluster-1',
    cluster_name: 'Production Cluster',
    user_id: 'demo-user',
    status: 'success',
    message: 'Resource reconciled successfully',
    created_at: '2024-12-27T14:30:00Z',
  },
  {
    id: 2,
    action: 'sync',
    resource_type: 'cluster',
    resource_id: 'demo-cluster-1',
    resource_name: 'Production Cluster',
    cluster_id: 'demo-cluster-1',
    cluster_name: 'Production Cluster',
    user_id: 'demo-user',
    status: 'success',
    message: 'Synced 12 resources from cluster',
    created_at: '2024-12-27T14:28:00Z',
  },
  {
    id: 3,
    action: 'resume',
    resource_type: 'helmrelease',
    resource_id: 'demo-res-2',
    resource_name: 'nginx-ingress',
    cluster_id: 'demo-cluster-1',
    cluster_name: 'Production Cluster',
    user_id: 'demo-user',
    status: 'success',
    message: 'HelmRelease resumed',
    created_at: '2024-12-27T14:25:00Z',
  },
  {
    id: 4,
    action: 'create',
    resource_type: 'cluster',
    resource_id: 'demo-cluster-3',
    resource_name: 'Development Cluster',
    cluster_id: 'demo-cluster-3',
    cluster_name: 'Development Cluster',
    user_id: 'demo-user',
    status: 'success',
    message: 'Cluster added successfully',
    created_at: '2024-12-27T14:20:00Z',
  },
  {
    id: 5,
    action: 'reconcile',
    resource_type: 'kustomization',
    resource_id: 'demo-res-7',
    resource_name: 'backend',
    cluster_id: 'demo-cluster-3',
    cluster_name: 'Development Cluster',
    user_id: 'demo-user',
    status: 'failed',
    message: 'Reconciliation failed: dependency not ready',
    created_at: '2024-12-27T14:19:00Z',
  },
];

export const mockFluxStats: Record<string, FluxStats> = {
  'demo-cluster-1': {
    kustomizations: { total: 3, ready: 3, notReady: 0, suspended: 0 },
    helmReleases: { total: 4, ready: 4, notReady: 0, suspended: 0 },
    gitRepositories: { total: 3, ready: 3, notReady: 0, suspended: 0 },
    helmRepositories: { total: 2, ready: 2, notReady: 0, suspended: 0 },
  },
  'demo-cluster-2': {
    kustomizations: { total: 2, ready: 2, notReady: 0, suspended: 0 },
    helmReleases: { total: 3, ready: 3, notReady: 0, suspended: 0 },
    gitRepositories: { total: 2, ready: 2, notReady: 0, suspended: 0 },
    helmRepositories: { total: 1, ready: 1, notReady: 0, suspended: 0 },
  },
  'demo-cluster-3': {
    kustomizations: { total: 4, ready: 2, notReady: 2, suspended: 0 },
    helmReleases: { total: 5, ready: 4, notReady: 1, suspended: 0 },
    gitRepositories: { total: 4, ready: 3, notReady: 1, suspended: 0 },
    helmRepositories: { total: 2, ready: 2, notReady: 0, suspended: 0 },
  },
};

export const mockAzureSubscriptions: AzureSubscription[] = [
  {
    id: 'demo-azure-sub-1',
    name: 'Production Subscription',
    tenant_id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    status: 'healthy',
    cluster_count: 1,
    last_synced_at: '2024-12-27T14:00:00Z',
    created_at: '2024-01-10T08:00:00Z',
    updated_at: '2024-12-27T14:00:00Z',
  },
];

export const mockOAuthProviders: OAuthProvider[] = [
  {
    id: 'demo-oauth-1',
    name: 'GitHub OAuth',
    provider: 'github',
    client_id: 'demo_github_client_id',
    redirect_url: 'https://demo.example.com/api/v1/auth/callback',
    scopes: 'user:email,read:user',
    allowed_users: '',
    enabled: true,
    status: 'healthy',
    created_at: '2024-01-05T10:00:00Z',
    updated_at: '2024-12-27T10:00:00Z',
  },
  {
    id: 'demo-oauth-2',
    name: 'Company SSO',
    provider: 'entra',
    client_id: 'demo_entra_client_id',
    tenant_id: 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy',
    redirect_url: 'https://demo.example.com/api/v1/auth/callback',
    scopes: 'openid,profile,email',
    allowed_users: 'admin@company.com,user@company.com',
    enabled: false,
    status: 'unknown',
    created_at: '2024-02-15T09:00:00Z',
    updated_at: '2024-12-27T09:00:00Z',
  },
];

export const mockSettings = [
  { key: 'auto_sync_interval_minutes', value: '5', updated_at: '2024-12-27T10:00:00Z' },
  { key: 'audit_log_retention_days', value: '90', updated_at: '2024-12-27T10:00:00Z' },
];
// Generate mock log entries
const generateMockLogs = () => {
  const clusters = ['demo-cluster-1', 'demo-cluster-2', 'demo-cluster-3'];
  const clusterNames = ['Production Cluster', 'Staging Environment', 'Development Cluster'];
  const namespaces = ['flux-system', 'default', 'kube-system', 'monitoring'];
  const pods = [
    'source-controller-7d6c9d4f8-abc12',
    'kustomize-controller-5b9d8f6c7-def34',
    'helm-controller-6c8e9d7f5-ghi56',
    'notification-controller-8d7f6e5c4-jkl78',
    'image-reflector-controller-9e8f7d6c5-mno90',
    'image-automation-controller-7f6e5d4c3-pqr12',
  ];
  const containers = ['manager', 'sidecar', 'init'];
  
  const logMessages = [
    'INFO: Successfully reconciled resource',
    'INFO: Fetching artifact from source',
    'INFO: Applied kustomization successfully',
    'WARN: Rate limit approaching for git provider',
    'INFO: Health check passed for all resources',
    'DEBUG: Processing reconciliation request',
    'ERROR: Failed to fetch artifact: connection timeout',
    'INFO: Resource synchronized with cluster',
    'WARN: Deprecated API version detected in manifest',
    'INFO: Helm release deployed successfully',
    'DEBUG: Validating resource specifications',
    'INFO: Git repository synced at revision main/abc123def',
    'ERROR: Validation failed: spec.replicas is required',
    'INFO: ConfigMap updated, triggering rollout',
    'WARN: Image pull backoff detected on pod xyz',
    'INFO: Secret reconciliation completed',
    'DEBUG: Checking for resource drift',
    'INFO: Notification sent to webhook endpoint',
    'ERROR: Kustomization build failed: invalid YAML syntax',
    'INFO: Resource status updated to Ready',
    'WARN: Memory usage above 80% threshold',
    'INFO: Scanning for new container images',
    'DEBUG: Filtering resources by namespace',
    'INFO: OCIRepository artifact downloaded',
    'ERROR: HelmRelease installation failed: chart not found',
    'INFO: Pruning deleted resources from cluster',
    'WARN: SSL certificate expires in 30 days',
    'INFO: Image automation policy applied',
    'DEBUG: Calculating resource dependencies',
    'INFO: Flux CD version: v2.2.0',
  ];

  const logs = [];
  const now = new Date();
  
  for (let i = 0; i < 100; i++) {
    const clusterIdx = Math.floor(Math.random() * clusters.length);
    const timestamp = new Date(now.getTime() - Math.random() * 3600000); // Last hour
    
    logs.push({
      timestamp: timestamp.toISOString(),
      cluster_id: clusters[clusterIdx],
      cluster_name: clusterNames[clusterIdx],
      namespace: namespaces[Math.floor(Math.random() * namespaces.length)],
      pod_name: pods[Math.floor(Math.random() * pods.length)],
      container: containers[Math.floor(Math.random() * containers.length)],
      message: logMessages[Math.floor(Math.random() * logMessages.length)],
    });
  }
  
  // Sort by timestamp descending
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export const mockLogs = generateMockLogs();