import axios from 'axios';
import { Cluster, FluxResource, ReconcileRequest, FluxStats, FluxResourceChild, Setting, ResourceNode } from './types';

const API_BASE = '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
});

export const clusterApi = {
  list: () => api.get<Cluster[]>('/clusters'),
  get: (id: string) => api.get<Cluster>(`/clusters/${id}`),
  create: (data: { name: string; description: string; kubeconfig: string }) =>
    api.post<Cluster>('/clusters', data),
  update: (id: string, data: Partial<{ name: string; description: string; kubeconfig: string }>) =>
    api.put(`/clusters/${id}`, data),
  delete: (id: string) => api.delete(`/clusters/${id}`),
  checkHealth: (id: string) => api.get(`/clusters/${id}/health`),
  syncResources: (id: string) => api.post(`/clusters/${id}/sync`),
  getResourceTree: (id: string) => api.get<{ tree: ResourceNode[]; count: number }>(`/clusters/${id}/resources/tree`),
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

export default api;
