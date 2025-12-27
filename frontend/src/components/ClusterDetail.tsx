import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { clusterApi, resourceApi, fluxApi } from '../api';
import { Cluster, FluxResource, FluxStats, FluxResourceChild } from '../types';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';
import ResourceTree from './ResourceTree';
import FluxResourceEditDialog from './FluxResourceEditDialog';
import KustomizationDetail from './KustomizationDetail';
import '../styles/ClusterDetail.css';

const ClusterDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [resources, setResources] = useState<FluxResource[]>([]);
  const [fluxStats, setFluxStats] = useState<FluxStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());
  const [resourceChildren, setResourceChildren] = useState<Record<string, FluxResourceChild[]>>({});
  const [loadingChildren, setLoadingChildren] = useState<Set<string>>(new Set());
  const [isReconciling, setIsReconciling] = useState<Set<string>>(new Set());
  const [isSuspending, setIsSuspending] = useState<Set<string>>(new Set());
  const [editingResource, setEditingResource] = useState<FluxResource | null>(null);
  const [kustomizationDetail, setKustomizationDetail] = useState<{ namespace: string; name: string } | null>(null);
  const { toasts, removeToast, success, error, info } = useToast();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      const [clusterRes, resourcesRes, statsRes] = await Promise.all([
        clusterApi.get(id),
        resourceApi.listByCluster(id),
        fluxApi.getStats(id).catch(() => ({ data: null })),
      ]);
      setCluster(clusterRes.data);
      setResources(resourcesRes.data);
      if (statsRes.data) {
        setFluxStats(statsRes.data);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      error('Failed to load cluster data');
    } finally {
      setLoading(false);
    }
  };

  const loadResourceChildren = async (resource: FluxResource) => {
    if (resourceChildren[resource.id]) return;
    
    setLoadingChildren((prev) => new Set(prev).add(resource.id));
    try {
      const res = await fluxApi.getChildren(resource.cluster_id, resource.kind, resource.namespace, resource.name);
      setResourceChildren((prev) => ({
        ...prev,
        [resource.id]: res.data.resources,
      }));
    } catch (err) {
      console.error('Failed to load children:', err);
      // Don't show error toast as this is expected for some resources
    } finally {
      setLoadingChildren((prev) => {
        const next = new Set(prev);
        next.delete(resource.id);
        return next;
      });
    }
  };

  const handleReconcile = async (resource: FluxResource) => {
    setIsReconciling((prev) => new Set(prev).add(resource.id));
    try {
      await fluxApi.reconcile(resource.cluster_id, resource.kind, resource.namespace, resource.name);
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

  const handleSuspend = async (resource: FluxResource) => {
    setIsSuspending((prev) => new Set(prev).add(resource.id));
    try {
      await fluxApi.suspend(resource.cluster_id, resource.kind, resource.namespace, resource.name);
      success(`${resource.name} suspended`);
      setTimeout(loadData, 1000);
    } catch (err) {
      console.error('Failed to suspend:', err);
      error(`Failed to suspend ${resource.name}`);
    } finally {
      setIsSuspending((prev) => {
        const next = new Set(prev);
        next.delete(resource.id);
        return next;
      });
    }
  };

  const handleResume = async (resource: FluxResource) => {
    setIsSuspending((prev) => new Set(prev).add(resource.id));
    try {
      await fluxApi.resume(resource.cluster_id, resource.kind, resource.namespace, resource.name);
      success(`${resource.name} resumed`);
      setTimeout(loadData, 1000);
    } catch (err) {
      console.error('Failed to resume:', err);
      error(`Failed to resume ${resource.name}`);
    } finally {
      setIsSuspending((prev) => {
        const next = new Set(prev);
        next.delete(resource.id);
        return next;
      });
    }
  };

  const handleEdit = (resource: FluxResource) => {
    setEditingResource(resource);
  };

  const handleSaveEdit = async (patch: any) => {
    if (!editingResource) return;

    try {
      await fluxApi.updateResource(
        editingResource.cluster_id,
        editingResource.kind,
        editingResource.namespace,
        editingResource.name,
        patch
      );
      success(`${editingResource.name} updated successfully`);
      setTimeout(loadData, 2000);
    } catch (err: any) {
      throw err; // Let the dialog handle the error
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

  const toggleExpanded = async (resource: FluxResource) => {
    const isExpanding = !expandedResources.has(resource.id);
    
    setExpandedResources((prev) => {
      const next = new Set(prev);
      if (next.has(resource.id)) {
        next.delete(resource.id);
      } else {
        next.add(resource.id);
      }
      return next;
    });

    // Load children if expanding and haven't loaded yet
    if (isExpanding && (resource.kind === 'Kustomization' || resource.kind === 'HelmRelease')) {
      loadResourceChildren(resource);
    }
  };

  const isSuspended = (resource: FluxResource): boolean => {
    try {
      const metadata = resource.metadata ? JSON.parse(resource.metadata) : null;
      return metadata?.spec?.suspend === true;
    } catch {
      return false;
    }
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
      
      {editingResource && (
        <FluxResourceEditDialog
          resource={editingResource}
          onClose={() => setEditingResource(null)}
          onSave={handleSaveEdit}
        />
      )}

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
        {/* Flux Stats Cards */}
        {fluxStats && (
          <div className="stats-section">
            <h3 className="stats-title">Flux Statistics</h3>
            <div className="stats-grid flux-stats">
              {Object.entries(fluxStats).map(([key, stats]) => (
                <div key={key} className="stat-card flux-stat-card">
                  <div className="stat-header">
                    <h4>{key.replace(/([A-Z])/g, ' $1').trim()}</h4>
                  </div>
                  <div className="stat-breakdown">
                    <div className="stat-item">
                      <span className="stat-label">Total</span>
                      <span className="stat-number">{stats.total}</span>
                    </div>
                    <div className="stat-item stat-ready">
                      <span className="stat-label">Ready</span>
                      <span className="stat-number">{stats.ready}</span>
                    </div>
                    <div className="stat-item stat-notready">
                      <span className="stat-label">Not Ready</span>
                      <span className="stat-number">{stats.notReady}</span>
                    </div>
                    <div className="stat-item stat-suspended">
                      <span className="stat-label">Suspended</span>
                      <span className="stat-number">{stats.suspended}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Stats Cards */}
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
            <button
              className={`tab ${activeTab === 'tree' ? 'active' : ''}`}
              onClick={() => setActiveTab('tree')}
            >
              🌳 Tree View
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

          {activeTab === 'tree' ? (
            <div className="tab-content">
              <ResourceTree clusterId={id!} />
            </div>
          ) : filteredResources.length === 0 ? (
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
                          const isSuspendingNow = isSuspending.has(resource.id);
                          const suspended = isSuspended(resource);
                          const children = resourceChildren[resource.id];
                          const childrenLoading = loadingChildren.has(resource.id);
                          
                          let metadata;
                          try {
                            metadata = resource.metadata ? JSON.parse(resource.metadata) : null;
                          } catch (e) {
                            metadata = null;
                          }

                          return (
                            <div
                              key={resource.id}
                              className={`resource-item ${isExpanded ? 'expanded' : ''} ${suspended ? 'suspended' : ''}`}
                            >
                              <div
                                className="resource-item-header"
                                onClick={() => toggleExpanded(resource)}
                              >
                                <div className="resource-item-main">
                                  <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                                  <div className="resource-item-info">
                                    <div className="resource-name">
                                      {resource.name}
                                      {suspended && <span className="suspended-badge">⏸ Suspended</span>}
                                    </div>
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
                                <div className="resource-actions" onClick={(e) => e.stopPropagation()}>
                                  {resource.kind === 'Kustomization' && (
                                    <button
                                      className="btn btn-sm btn-info"
                                      onClick={() => setKustomizationDetail({
                                        namespace: resource.namespace,
                                        name: resource.name
                                      })}
                                    >
                                      📦 View Details
                                    </button>
                                  )}
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => handleEdit(resource)}
                                  >
                                    ✏️ Edit
                                  </button>
                                  {suspended ? (
                                    <button
                                      className={`btn btn-sm btn-success ${isSuspendingNow ? 'btn-loading' : ''}`}
                                      onClick={() => handleResume(resource)}
                                      disabled={isSuspendingNow}
                                    >
                                      {isSuspendingNow ? 'Resuming...' : '▶ Resume'}
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        className={`btn btn-sm btn-primary ${isReconcilingNow ? 'btn-loading' : ''}`}
                                        onClick={() => handleReconcile(resource)}
                                        disabled={isReconcilingNow}
                                      >
                                        {isReconcilingNow ? 'Reconciling...' : '↻ Reconcile'}
                                      </button>
                                      <button
                                        className={`btn btn-sm btn-warning ${isSuspendingNow ? 'btn-loading' : ''}`}
                                        onClick={() => handleSuspend(resource)}
                                        disabled={isSuspendingNow}
                                      >
                                        {isSuspendingNow ? 'Suspending...' : '⏸ Suspend'}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="resource-item-details">
                                  {resource.message && (
                                    <div className="detail-section">
                                      <label>Status Message:</label>
                                      <div className="detail-value message-box">{resource.message}</div>
                                    </div>
                                  )}

                                  {/* Show resources created by Flux */}
                                  {(resource.kind === 'Kustomization' || resource.kind === 'HelmRelease') && (
                                    <div className="detail-section">
                                      <label>Resources Created:</label>
                                      {childrenLoading ? (
                                        <div className="detail-value">Loading...</div>
                                      ) : children && children.length > 0 ? (
                                        <div className="children-list">
                                          <div className="children-count">{children.length} resources</div>
                                          <ul className="children-items">
                                            {children.slice(0, 10).map((child, idx) => (
                                              <li key={idx} className="child-item">
                                                <span className="child-icon">📄</span>
                                                <span className="child-id">{child.id}</span>
                                                {child.version && (
                                                  <span className="child-version">v{child.version}</span>
                                                )}
                                              </li>
                                            ))}
                                            {children.length > 10 && (
                                              <li className="child-item-more">
                                                + {children.length - 10} more resources
                                              </li>
                                            )}
                                          </ul>
                                        </div>
                                      ) : (
                                        <div className="detail-value">No inventory data available</div>
                                      )}
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
                                      <label>Full Resource Spec:</label>
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

      {kustomizationDetail && id && (
        <KustomizationDetail
          clusterId={id}
          namespace={kustomizationDetail.namespace}
          name={kustomizationDetail.name}
          onClose={() => setKustomizationDetail(null)}
        />
      )}
    </div>
  );
};

export default ClusterDetail;
