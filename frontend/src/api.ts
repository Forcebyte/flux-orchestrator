import axios from 'axios';
import { Cluster, FluxResource, ReconcileRequest, FluxStats, FluxResourceChild, Setting, ResourceNode, AzureSubscription, AKSCluster, AzureCredentials, Activity, OAuthProvider } from './types';

const API_BASE = '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
});

export const clusterApi = {
  list: () => api.get<Cluster[]>('/clusters'),
  get: (id: string) => api.get<Cluster>(`/clusters/${id}`),
  create: (data: { name: string; description: string; kubeconfig: string }) =>
    api.post<Cluster>('/clusters', data),
  update: (id: string, data: Partial<{ name: string; description: string; kubeconfig: string; health_check_interval: number }>) =>
    api.put(`/clusters/${id}`, data),
  delete: (id: string) => api.delete(`/clusters/${id}`),
  checkHealth: (id: string) => api.get(`/clusters/${id}/health`),
  syncResources: (id: string) => api.post(`/clusters/${id}/sync`),
  getResourceTree: (id: string) => api.get<{ tree: ResourceNode[]; count: number }>(`/clusters/${id}/resources/tree`),
  toggleFavorite: (id: string) => api.post<Cluster>(`/clusters/${id}/favorite`),
  exportCluster: (id: string, format: 'json' | 'csv' = 'json') => 
    api.get(`/clusters/${id}/export?format=${format}`, { responseType: 'blob' }),
};

export const resourceApi = {
  listAll: (kind?: string) => api.get<FluxResource[]>('/resources', { params: { kind } }),
  listByCluster: (clusterId: string) => api.get<FluxResource[]>(`/clusters/${clusterId}/resources`),
  get: (id: string) => api.get<FluxResource>(`/resources/${id}`),
  reconcile: (data: ReconcileRequest) => api.post('/resources/reconcile', data),
  // Resource management
  scale: (clusterId: string, kind: string, namespace: string, name: string, replicas: number) =>
    api.post(`/clusters/${clusterId}/resources/${kind}/${namespace}/${name}/scale`, { replicas }),
  restart: (clusterId: string, kind: string, namespace: string, name: string) =>
    api.post(`/clusters/${clusterId}/resources/${kind}/${namespace}/${name}/restart`),
  updateSpec: (clusterId: string, kind: string, namespace: string, name: string, patch: any) =>
    api.put(`/clusters/${clusterId}/resources/${kind}/${namespace}/${name}/spec`, patch),
  // Pod management
  getPodLogs: (clusterId: string, namespace: string, podName: string, container?: string, tail?: number) =>
    api.get<{ logs: string }>(`/clusters/${clusterId}/pods/${namespace}/${podName}/logs`, {
      params: { container, tail }
    }),
  getPodContainers: (clusterId: string, namespace: string, podName: string) =>
    api.get<{ containers: string[] }>(`/clusters/${clusterId}/pods/${namespace}/${podName}/containers`),
  deletePod: (clusterId: string, namespace: string, podName: string) =>
    api.delete(`/clusters/${clusterId}/pods/${namespace}/${podName}`),
};

export const fluxApi = {
  // Expose the axios instance for direct usage
  axios: api,
  
  // Existing methods
  getStats: (clusterId: string) => api.get<FluxStats>(`/clusters/${clusterId}/flux/stats`),
  getResource: (clusterId: string, kind: string, namespace: string, name: string) =>
    api.get<FluxResource>(`/clusters/${clusterId}/flux/${kind}/${namespace}/${name}`),
  updateResource: (clusterId: string, kind: string, namespace: string, name: string, patch: any) =>
    api.put(`/clusters/${clusterId}/flux/${kind}/${namespace}/${name}`, patch),
  reconcile: (clusterId: string, kind: string, namespace: string, name: string) =>
    api.post(`/clusters/${clusterId}/flux/${kind}/${namespace}/${name}/reconcile`),
  suspend: (clusterId: string, kind: string, namespace: string, name: string) =>
    api.post(`/clusters/${clusterId}/flux/${kind}/${namespace}/${name}/suspend`),
  resume: (clusterId: string, kind: string, namespace: string, name: string) =>
    api.post(`/clusters/${clusterId}/flux/${kind}/${namespace}/${name}/resume`),
  getChildren: (clusterId: string, kind: string, namespace: string, name: string) =>
    api.get<{ resources: FluxResourceChild[]; count: number }>(`/clusters/${clusterId}/flux/${kind}/${namespace}/${name}/resources`),
};

export const settingsApi = {
  list: () => api.get<Setting[]>('/settings'),
  update: (key: string, value: string) => api.put<Setting>(`/settings/${key}`, { value }),
};

export const azureApi = {
  // List all Azure subscriptions
  listSubscriptions: () => api.get<AzureSubscription[]>('/azure/subscriptions'),
  
  // Get a specific subscription
  getSubscription: (id: string) => api.get<AzureSubscription>(`/azure/subscriptions/${id}`),
  
  // Create a new subscription
  createSubscription: (data: { name: string; credentials: AzureCredentials }) =>
    api.post<AzureSubscription>('/azure/subscriptions', data),
  
  // Delete a subscription
  deleteSubscription: (id: string) => api.delete(`/azure/subscriptions/${id}`),
  
  // Test connection
  testConnection: (id: string) => api.post<{ success: boolean; message: string }>(`/azure/subscriptions/${id}/test`),
  
  // Discover AKS clusters
  discoverClusters: (id: string) => api.get<{ clusters: AKSCluster[]; count: number }>(`/azure/subscriptions/${id}/clusters`),
  
  // Sync all AKS clusters
  syncClusters: (id: string) => api.post<{ synced: number; failed: number; clusters: Array<{ name: string; status: string; error?: string }> }>(`/azure/subscriptions/${id}/sync`),
};

export const activityApi = {
  // List recent activities
  list: (params?: { limit?: number; cluster_id?: string }) => 
    api.get<Activity[]>('/activities', { params }),
  
  // Get specific activity
  get: (id: number) => api.get<Activity>(`/activities/${id}`),
};

export const oauthApi = {
  // List all OAuth providers
  listProviders: () => api.get<OAuthProvider[]>('/oauth/providers'),
  
  // Get a specific provider
  getProvider: (id: string) => api.get<OAuthProvider>(`/oauth/providers/${id}`),
  
  // Create a new provider
  createProvider: (data: {
    name: string;
    provider: 'github' | 'entra';
    client_id: string;
    client_secret: string;
    tenant_id?: string;
    redirect_url: string;
    scopes?: string;
    allowed_users?: string;
    enabled: boolean;
  }) => api.post<OAuthProvider>('/oauth/providers', data),
  
  // Update a provider
  updateProvider: (id: string, data: {
    name?: string;
    client_id?: string;
    client_secret?: string;
    tenant_id?: string;
    redirect_url?: string;
    scopes?: string;
    allowed_users?: string;
    enabled?: boolean;
  }) => api.put(`/oauth/providers/${id}`, data),
  
  // Delete a provider
  deleteProvider: (id: string) => api.delete(`/oauth/providers/${id}`),
  
  // Test configuration
  testProvider: (id: string) => api.post<{ status: string; message: string }>(`/oauth/providers/${id}/test`),
};

export const exportApi = {
  // Export resources as CSV or JSON
  exportResources: (params?: { format?: 'json' | 'csv'; status?: string; kind?: string }) =>
    api.get('/resources/export', { params, responseType: 'blob' }),
};

export default api;
