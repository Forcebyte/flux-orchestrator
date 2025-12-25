import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { clusterApi, resourceApi } from '../api';
import { Cluster, FluxResource } from '../types';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';
import '../styles/ClusterDetail.css';

const ClusterDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [resources, setResources] = useState<FluxResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());
  const [isReconciling, setIsReconciling] = useState<Set<string>>(new Set());
  const { toasts, removeToast, success, error, info } = useToast();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      const [clusterRes, resourcesRes] = await Promise.all([
        clusterApi.get(id),
        resourceApi.listByCluster(id),
      ]);
      setCluster(clusterRes.data);
      setResources(resourcesRes.data);
    } catch (err) {
      console.error('Failed to load data:', err);
      error('Failed to load cluster data');
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async (resource: FluxResource) => {
    setIsReconciling((prev) => new Set(prev).add(resource.id));
    try {
      await resourceApi.reconcile({
        cluster_id: resource.cluster_id,
        kind: resource.kind,
        name: resource.name,
        namespace: resource.namespace,
      });
      success(`Reconciliation triggered for ${resource.name}`);
      setTimeout(loadData, 2000);
    } catch (err) {
      console.error('Failed to reconcile:', err);
      error(`Failed to trigger reconciliation for ${resource.name}`);
    } finally {
      setIsReconciling((prev) => {
        const next = new Set(prev);
        next.delete(resource.id);
        return next;
      });
    }
  };

  const handleSync = async () => {
    if (!id) return;
    try {
      await clusterApi.syncResources(id);
      info('Cluster sync initiated - refreshing resources...');
      setTimeout(loadData, 3000);
    } catch (err) {
      console.error('Failed to sync:', err);
      error('Failed to sync cluster');
    }
  };

  const toggleExpanded = (resourceId: string) => {
    setExpandedResources((prev) => {
      const next = new Set(prev);
      if (next.has(resourceId)) {
        next.delete(resourceId);
      } else {
        next.add(resourceId);
      }
      return next;
    });
  };

  const filteredResources = activeTab === 'all'
    ? resources
    : resources.filter((r) => r.kind === activeTab);

  const resourcesByKind = resources.reduce((acc, r) => {
    acc[r.kind] = (acc[r.kind] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Group resources by namespace and kind for better organization
  const groupedResources = filteredResources.reduce((acc, resource) => {
    const key = `${resource.namespace}/${resource.kind}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(resource);
    return acc;
  }, {} as Record<string, FluxResource[]>);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading cluster details...</p>
      </div>
    );
  }

  if (!cluster) {
    return (
      <div className="error-container">
        <h2>Cluster Not Found</h2>
        <p>The requested cluster could not be found.</p>
        <Link to="/clusters" className="btn btn-primary">
          Back to Clusters
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Toast toasts={toasts} removeToast={removeToast} />

      <div className="header">
        <div className="header-content">
          <div>
            <div className="breadcrumb">
              <Link to="/clusters">Clusters</Link>
              <span className="breadcrumb-separator">›</span>
              <span>{cluster.name}</span>
            </div>
            <h2>{cluster.name}</h2>
            {cluster.description && <p className="header-subtitle">{cluster.description}</p>}
          </div>
          <div className="header-actions">
            <span className={`status-badge status-${cluster.status}`}>
              {cluster.status}
            </span>
            <button className="btn btn-success" onClick={handleSync}>
              <span className="btn-icon">↻</span>
              Sync Resources
            </button>
          </div>
        </div>
      </div>

      <div className="content">
        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon stat-icon-total">📊</div>
            <div className="stat-content">
              <div className="stat-value">{resources.length}</div>
              <div className="stat-label">Total Resources</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-ready">✓</div>
            <div className="stat-content">
              <div className="stat-value stat-value-ready">
                {resources.filter((r) => r.status === 'Ready').length}
              </div>
              <div className="stat-label">Ready</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-notready">✕</div>
            <div className="stat-content">
              <div className="stat-value stat-value-notready">
                {resources.filter((r) => r.status === 'NotReady').length}
              </div>
              <div className="stat-label">Not Ready</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-unknown">?</div>
            <div className="stat-content">
              <div className="stat-value stat-value-unknown">
                {resources.filter((r) => r.status === 'Unknown').length}
              </div>
              <div className="stat-label">Unknown</div>
            </div>
          </div>
        </div>

        {/* Resource Tabs */}
        <div className="card">
          <div className="card-header">
            <h3>Flux Resources</h3>
          </div>

          <div className="tabs">
            <button
              className={`tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All ({resources.length})
            </button>
            {Object.entries(resourcesByKind)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([kind, count]) => (
                <button
                  key={kind}
                  className={`tab ${activeTab === kind ? 'active' : ''}`}
                  onClick={() => setActiveTab(kind)}
                >
                  {kind} ({count})
                </button>
              ))}
          </div>

          {filteredResources.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>No Resources Found</h3>
              <p>
                {activeTab === 'all'
                  ? 'This cluster has no Flux resources yet. Click "Sync Resources" to fetch them.'
                  : `No ${activeTab} resources found in this cluster.`}
              </p>
            </div>
          ) : (
            <div className="resource-groups">
              {Object.entries(groupedResources)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([groupKey, groupResources]) => {
                  const [namespace, kind] = groupKey.split('/');
                  return (
                    <div key={groupKey} className="resource-group">
                      <div className="resource-group-header">
                        <h4>
                          <span className="resource-kind-badge">{kind}</span>
                          <span className="resource-namespace">in {namespace}</span>
                        </h4>
                        <span className="resource-count">{groupResources.length} items</span>
                      </div>
                      <div className="resource-list">
                        {groupResources.map((resource) => {
                          const isExpanded = expandedResources.has(resource.id);
                          const isReconcilingNow = isReconciling.has(resource.id);
                          let metadata;
                          try {
                            metadata = resource.metadata ? JSON.parse(resource.metadata) : null;
                          } catch (e) {
                            metadata = null;
                          }

                          return (
                            <div
                              key={resource.id}
                              className={`resource-item ${isExpanded ? 'expanded' : ''}`}
                            >
                              <div
                                className="resource-item-header"
                                onClick={() => toggleExpanded(resource.id)}
                              >
                                <div className="resource-item-main">
                                  <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                                  <div className="resource-item-info">
                                    <div className="resource-name">{resource.name}</div>
                                    <div className="resource-meta">
                                      <span className={`status-dot status-${resource.status.toLowerCase()}`}></span>
                                      <span className="status-text">{resource.status}</span>
                                      {resource.last_reconcile && (
                                        <>
                                          <span className="meta-separator">•</span>
                                          <span className="last-reconcile">
                                            Last reconciled:{' '}
                                            {new Date(resource.last_reconcile).toLocaleString()}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  className={`btn btn-sm btn-primary ${isReconcilingNow ? 'btn-loading' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReconcile(resource);
                                  }}
                                  disabled={isReconcilingNow}
                                >
                                  {isReconcilingNow ? 'Reconciling...' : 'Reconcile'}
                                </button>
                              </div>

                              {isExpanded && (
                                <div className="resource-item-details">
                                  {resource.message && (
                                    <div className="detail-section">
                                      <label>Status Message:</label>
                                      <div className="detail-value message-box">{resource.message}</div>
                                    </div>
                                  )}

                                  <div className="detail-grid">
                                    <div className="detail-section">
                                      <label>Resource ID:</label>
                                      <div className="detail-value code">{resource.id}</div>
                                    </div>
                                    <div className="detail-section">
                                      <label>Created:</label>
                                      <div className="detail-value">
                                        {new Date(resource.created_at).toLocaleString()}
                                      </div>
                                    </div>
                                    <div className="detail-section">
                                      <label>Updated:</label>
                                      <div className="detail-value">
                                        {new Date(resource.updated_at).toLocaleString()}
                                      </div>
                                    </div>
                                  </div>

                                  {metadata && (
                                    <div className="detail-section">
                                      <label>Metadata:</label>
                                      <pre className="detail-value metadata-box">
                                        {JSON.stringify(metadata, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClusterDetail;
