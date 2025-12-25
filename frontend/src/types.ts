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

export interface ReconcileRequest {
  cluster_id: string;
  kind: string;
  name: string;
  namespace: string;
}
