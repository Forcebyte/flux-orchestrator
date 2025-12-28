// Demo API - returns mock data instead of making real API calls
import { 
  mockClusters, 
  mockResources, 
  mockActivities, 
  mockFluxStats, 
  mockAzureSubscriptions, 
  mockOAuthProviders,
  mockSettings 
} from './mockData';
import type { Cluster, ResourceNode } from './types';

// Simulates network delay
const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to create mock response
const mockResponse = async <T,>(data: T) => {
  await delay();
  return { data };
};

export const demoClusterApi = {
  list: () => mockResponse(mockClusters),
  get: (id: string) => mockResponse(mockClusters.find(c => c.id === id) || mockClusters[0]),
  create: (data: { name: string; description: string; kubeconfig: string }) =>
    mockResponse({ 
      ...data, 
      id: `demo-cluster-${Date.now()}`, 
      status: 'healthy', 
      source: 'manual', 
      resource_count: 0,
      is_favorite: false,
      health_check_interval: 300,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Cluster),
  update: (id: string, data: Partial<Cluster>) =>
    mockResponse({ ...mockClusters.find(c => c.id === id), ...data }),
  delete: () => mockResponse({}),
  checkHealth: () => mockResponse({ status: 'healthy', message: 'Cluster is healthy' }),
  syncResources: () => mockResponse({ synced: 12, message: 'Resources synced successfully' }),
  getResourceTree: (id: string) => {
    const clusterResources = mockResources.filter(r => r.cluster_id === id);
    const tree: ResourceNode[] = clusterResources.map(r => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      namespace: r.namespace,
      status: r.status as 'Ready' | 'NotReady' | 'Unknown',
      health: (r.status === 'Ready' ? 'Healthy' : 'Degraded') as 'Healthy' | 'Degraded' | 'Progressing' | 'Unknown',
      created_at: r.created_at,
      children: [],
    }));
    return mockResponse({ tree, count: tree.length });
  },
  toggleFavorite: (id: string) => {
    const cluster = mockClusters.find(c => c.id === id);
    return mockResponse({ ...cluster, is_favorite: !cluster?.is_favorite } as Cluster);
  },
  exportCluster: () => mockResponse(new Blob(['mock export data'], { type: 'application/json' })),
};

export const demoResourceApi = {
  listAll: (kind?: string) => {
    const filtered = kind ? mockResources.filter(r => r.kind === kind) : mockResources;
    return mockResponse(filtered);
  },
  listByCluster: (clusterId: string) =>
    mockResponse(mockResources.filter(r => r.cluster_id === clusterId)),
  get: (id: string) =>
    mockResponse(mockResources.find(r => r.id === id) || mockResources[0]),
  reconcile: () =>
    mockResponse({ status: 'success', message: 'Resource reconciled successfully' }),
  scale: () =>
    mockResponse({ status: 'success', message: 'Resource scaled successfully' }),
  restart: () =>
    mockResponse({ status: 'success', message: 'Resource restarted successfully' }),
  updateSpec: () =>
    mockResponse({ status: 'success', message: 'Resource spec updated successfully' }),
  getPodLogs: () =>
    mockResponse({ logs: 'Demo log line 1\nDemo log line 2\nDemo log line 3\n...\nDemo log line 100' }),
  getPodContainers: () =>
    mockResponse({ containers: ['main', 'sidecar', 'init'] }),
  deletePod: () =>
    mockResponse({ status: 'success', message: 'Pod deleted successfully' }),
};

export const demoFluxApi = {
  axios: null, // Not used in demo mode
  getStats: (clusterId: string) =>
    mockResponse(mockFluxStats[clusterId] || mockFluxStats['demo-cluster-1']),
  getResource: (clusterId: string, kind: string, namespace: string, name: string) =>
    mockResponse(mockResources.find(r => 
      r.cluster_id === clusterId && r.kind === kind && r.namespace === namespace && r.name === name
    ) || mockResources[0]),
  updateResource: () =>
    mockResponse({ status: 'success', message: 'Resource updated successfully' }),
  reconcile: () =>
    mockResponse({ status: 'success', message: 'Reconciliation triggered' }),
  suspend: () =>
    mockResponse({ status: 'success', message: 'Resource suspended' }),
  resume: () =>
    mockResponse({ status: 'success', message: 'Resource resumed' }),
  getChildren: () =>
    mockResponse({
      resources: [
        { id: 'child-1', kind: 'Deployment', name: 'app-deployment', namespace: 'default', status: 'Ready', version: 'v1' },
        { id: 'child-2', kind: 'Service', name: 'app-service', namespace: 'default', status: 'Ready', version: 'v1' },
        { id: 'child-3', kind: 'ConfigMap', name: 'app-config', namespace: 'default', status: 'Ready', version: 'v1' },
      ],
      count: 3,
    }),
};

export const demoSettingsApi = {
  list: () => mockResponse(mockSettings),
  update: (key: string, value: string) =>
    mockResponse({ key, value, updated_at: new Date().toISOString() }),
};

export const demoAzureApi = {
  listSubscriptions: () => mockResponse(mockAzureSubscriptions),
  getSubscription: (id: string) =>
    mockResponse(mockAzureSubscriptions.find(s => s.id === id) || mockAzureSubscriptions[0]),
  createSubscription: (data: any) =>
    mockResponse({ 
      ...data, 
      id: `demo-azure-sub-${Date.now()}`, 
      status: 'healthy',
      cluster_count: 0,
      last_synced_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  deleteSubscription: () => mockResponse({}),
  testConnection: () =>
    mockResponse({ success: true, message: 'Connection successful' }),
  discoverClusters: () =>
    mockResponse({
      clusters: [
        {
          id: '/subscriptions/demo/resourceGroups/rg-production/providers/Microsoft.ContainerService/managedClusters/aks-prod-001',
          name: 'aks-prod-001',
          resource_group: 'rg-production',
          location: 'eastus',
          kubernetes_version: '1.28.3',
          node_count: 3,
          fqdn: 'aks-prod-001-abc123.eastus.azmk8s.io',
          status: 'Running',
        },
        {
          id: '/subscriptions/demo/resourceGroups/rg-staging/providers/Microsoft.ContainerService/managedClusters/aks-staging-001',
          name: 'aks-staging-001',
          resource_group: 'rg-staging',
          location: 'westus2',
          kubernetes_version: '1.27.8',
          node_count: 2,
          fqdn: 'aks-staging-001-def456.westus2.azmk8s.io',
          status: 'Running',
        },
      ],
      count: 2,
    }),
  syncClusters: () =>
    mockResponse({
      synced: 2,
      failed: 0,
      clusters: [
        { name: 'aks-prod-001', status: 'synced' },
        { name: 'aks-staging-001', status: 'synced' },
      ],
    }),
};

export const demoActivityApi = {
  list: (params?: { limit?: number; cluster_id?: string }) => {
    let activities = [...mockActivities];
    if (params?.cluster_id) {
      activities = activities.filter(a => a.cluster_id === params.cluster_id);
    }
    if (params?.limit) {
      activities = activities.slice(0, params.limit);
    }
    return mockResponse(activities);
  },
  get: (id: number) =>
    mockResponse(mockActivities.find(a => a.id === id) || mockActivities[0]),
};

export const demoOAuthApi = {
  listProviders: () => mockResponse(mockOAuthProviders),
  getProvider: (id: string) =>
    mockResponse(mockOAuthProviders.find(p => p.id === id) || mockOAuthProviders[0]),
  createProvider: (data: any) =>
    mockResponse({ 
      ...data, 
      id: `demo-oauth-${Date.now()}`, 
      status: 'unknown',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  updateProvider: (id: string, data: any) => {
    const provider = mockOAuthProviders.find(p => p.id === id);
    return mockResponse({ ...provider, ...data });
  },
  deleteProvider: () => mockResponse({}),
  testProvider: () =>
    mockResponse({ status: 'success', message: 'OAuth configuration is valid' }),
};

export const demoExportApi = {
  exportResources: () =>
    mockResponse(new Blob(['mock export data'], { type: 'application/json' })),
};
