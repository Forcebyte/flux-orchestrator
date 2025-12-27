export interface Cluster {
  id: string;
  name: string;
  description: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  created_at: string;
  updated_at: string;
}

export interface FluxResource {
  id: string;
  cluster_id: string;
  kind: string;
  name: string;
  namespace: string;
  status: 'Ready' | 'NotReady' | 'Unknown';
  message: string;
  last_reconcile: string;
  created_at: string;
  updated_at: string;
  metadata?: string;
}

export interface FluxStats {
  kustomizations: ResourceStats;
  helmReleases: ResourceStats;
  gitRepositories: ResourceStats;
  helmRepositories: ResourceStats;
}

export interface ResourceStats {
  total: number;
  ready: number;
  notReady: number;
  suspended: number;
}

export interface FluxResourceChild {
  id: string;
  version: string;
}

export interface ReconcileRequest {
  cluster_id: string;
  kind: string;
  name: string;
  namespace: string;
}

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

export interface ResourceNode {
  id: string;
  kind: string;
  name: string;
  namespace: string;
  status: string;
  health: 'Healthy' | 'Degraded' | 'Progressing' | 'Unknown';
  created_at: string;
  children: ResourceNode[];
  metadata?: Record<string, any>;
}
