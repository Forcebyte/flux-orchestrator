import axios from 'axios';
import { Cluster, FluxResource, ReconcileRequest, FluxStats, FluxResourceChild } from './types';

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
};

export const resourceApi = {
  listAll: (kind?: string) => api.get<FluxResource[]>('/resources', { params: { kind } }),
  listByCluster: (clusterId: string) => api.get<FluxResource[]>(`/clusters/${clusterId}/resources`),
  get: (id: string) => api.get<FluxResource>(`/resources/${id}`),
  reconcile: (data: ReconcileRequest) => api.post('/resources/reconcile', data),
};

export const fluxApi = {
  getStats: (clusterId: string) => api.get<FluxStats>(`/clusters/${clusterId}/flux/stats`),
  getResource: (clusterId: string, kind: string, namespace: string, name: string) =>
    api.get<FluxResource>(`/clusters/${clusterId}/flux/${kind}/${namespace}/${name}`),
  reconcile: (clusterId: string, kind: string, namespace: string, name: string) =>
    api.post(`/clusters/${clusterId}/flux/${kind}/${namespace}/${name}/reconcile`),
  suspend: (clusterId: string, kind: string, namespace: string, name: string) =>
    api.post(`/clusters/${clusterId}/flux/${kind}/${namespace}/${name}/suspend`),
  resume: (clusterId: string, kind: string, namespace: string, name: string) =>
    api.post(`/clusters/${clusterId}/flux/${kind}/${namespace}/${name}/resume`),
  getChildren: (clusterId: string, kind: string, namespace: string, name: string) =>
    api.get<{ resources: FluxResourceChild[]; count: number }>(`/clusters/${clusterId}/flux/${kind}/${namespace}/${name}/resources`),
};

export default api;
