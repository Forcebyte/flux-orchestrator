export interface Cluster {
  id: string;
  name: string;
  description: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  source?: 'manual' | 'azure-aks';
  source_id?: string;
  is_favorite?: boolean;
  health_check_interval?: number;
  resource_count?: number;
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

export interface AzureSubscription {
  id: string;
  name: string;
  tenant_id: string;
  status: string;
  cluster_count: number;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AKSCluster {
  id: string;
  name: string;
  resource_group: string;
  location: string;
  kubernetes_version: string;
  fqdn: string;
  node_count: number;
}

export interface AzureCredentials {
  tenant_id: string;
  client_id: string;
  client_secret: string;
  subscription_id: string;
}

export interface Activity {
  id: number;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_name: string;
  cluster_id: string;
  cluster_name: string;
  user_id: string;
  status: 'success' | 'failed';
  message: string;
  created_at: string;
}
