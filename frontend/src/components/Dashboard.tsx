import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { resourceApi, clusterApi } from '../api';
import { FluxResource, Cluster } from '../types';
import ActivityFeed from './ActivityFeed';
import '../styles/Dashboard.css';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [resources, setResources] = useState<FluxResource[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [clusterFilter, setClusterFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [resourcesRes, clustersRes] = await Promise.all([
        resourceApi.listAll(),
        clusterApi.list(),
      ]);
      setResources(resourcesRes.data);
      setClusters(clustersRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupedByCluster = resources.reduce((acc, r) => {
    if (!acc[r.cluster_id]) {
      acc[r.cluster_id] = [];
    }
    acc[r.cluster_id].push(r);
    return acc;
  }, {} as Record<string, FluxResource[]>);

  const groupedByKind = resources.reduce((acc, r) => {
    if (!acc[r.kind]) {
      acc[r.kind] = [];
    }
    acc[r.kind].push(r);
    return acc;
  }, {} as Record<string, FluxResource[]>);

  const stats = {
    total: resources.length,
    ready: resources.filter(r => r.status === 'Ready').length,
    notReady: resources.filter(r => r.status === 'NotReady').length,
    unknown: resources.filter(r => r.status === 'Unknown').length,
    suspended: 0, // Suspend status not tracked in FluxResource type
  };

  const healthPercentage = stats.total > 0 
    ? Math.round((stats.ready / stats.total) * 100) 
    : 0;

  // Filter resources based on status filter
  const filteredResources = resources.filter(r => {
    // Status filter
    if (statusFilter !== 'all' && r.status.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    // Kind filter
    if (kindFilter !== 'all' && r.kind !== kindFilter) {
      return false;
    }
    // Cluster filter
    if (clusterFilter !== 'all' && r.cluster_id !== clusterFilter) {
      return false;
    }
    return true;
  });

  const handleStatusClick = (status: string) => {
    setStatusFilter(status);
    setKindFilter('all');
    setClusterFilter('all');
  };

  const handleKindClick = (kind: string) => {
    setKindFilter(kind);
    setStatusFilter('all');
    setClusterFilter('all');
  };

  const handleClusterClick = (clusterId: string) => {
    setClusterFilter(clusterId);
    setStatusFilter('all');
    setKindFilter('all');
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setKindFilter('all');
    setClusterFilter('all');
  };

  if (loading) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h2>📊 Dashboard</h2>
          <p>Overview of all Flux resources across clusters</p>
          {(statusFilter !== 'all' || kindFilter !== 'all' || clusterFilter !== 'all') && (
            <div className="active-filters">
              {statusFilter !== 'all' && <span className="filter-tag">Status: {statusFilter}</span>}
              {kindFilter !== 'all' && <span className="filter-tag">Type: {kindFilter}</span>}
              {clusterFilter !== 'all' && <span className="filter-tag">Cluster: {clusters.find(c => c.id === clusterFilter)?.name}</span>}
              <button className="clear-filters-btn" onClick={clearFilters}>Clear Filters</button>
            </div>
          )}
        </div>
        <button className="refresh-btn" onClick={loadData}>
          🔄 Refresh
        </button>
      </div>

      {/* Quick Filters */}
      <div className="quick-filters">
        <button 
          className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => handleStatusClick('all')}
        >
          All ({resources.length})
        </button>
        <button 
          className={`filter-btn filter-ready ${statusFilter === 'ready' ? 'active' : ''}`}
          onClick={() => handleStatusClick('ready')}
        >
          ✅ Ready ({stats.ready})
        </button>
        <button 
          className={`filter-btn filter-notready ${statusFilter === 'notready' ? 'active' : ''}`}
          onClick={() => handleStatusClick('notready')}
        >
          ⚠️ Not Ready ({stats.notReady})
        </button>
        <button 
          className={`filter-btn filter-unknown ${statusFilter === 'unknown' ? 'active' : ''}`}
          onClick={() => handleStatusClick('unknown')}
        >
          ❓ Unknown ({stats.unknown})
        </button>
      </div>

      {/* Top Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card total clickable" onClick={() => handleStatusClick('all')}>
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <h3>Total Resources</h3>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-trend">Across {clusters.length} cluster{clusters.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        <div className="stat-card ready clickable" onClick={() => handleStatusClick('ready')}>
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>Ready</h3>
            <div className="stat-value">{stats.ready}</div>
            <div className="stat-trend">{healthPercentage}% healthy</div>
          </div>
        </div>

        <div className="stat-card notready clickable" onClick={() => handleStatusClick('notready')}>
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <h3>Not Ready</h3>
            <div className="stat-value">{stats.notReady}</div>
            <div className="stat-trend">Requires attention</div>
          </div>
        </div>

        <div className="stat-card suspended clickable" onClick={() => handleStatusClick('unknown')}>
          <div className="stat-icon">⏸️</div>
          <div className="stat-content">
            <h3>Suspended</h3>
            <div className="stat-value">{stats.suspended}</div>
            <div className="stat-trend">Paused reconciliation</div>
          </div>
        </div>
      </div>

      {/* Health Bar */}
      <div className="health-overview">
        <h3>Overall Health</h3>
        <div className="health-bar">
          <div 
            className="health-segment ready" 
            style={{ width: `${(stats.ready / stats.total) * 100}%` }}
            title={`Ready: ${stats.ready}`}
          />
          <div 
            className="health-segment notready" 
            style={{ width: `${(stats.notReady / stats.total) * 100}%` }}
            title={`Not Ready: ${stats.notReady}`}
          />
          <div 
            className="health-segment unknown" 
            style={{ width: `${(stats.unknown / stats.total) * 100}%` }}
            title={`Unknown: ${stats.unknown}`}
          />
        </div>
        <div className="health-legend">
          <span><span className="legend-dot ready"></span> Ready ({stats.ready})</span>
          <span><span className="legend-dot notready"></span> Not Ready ({stats.notReady})</span>
          <span><span className="legend-dot unknown"></span> Unknown ({stats.unknown})</span>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Resources by Kind */}
        <div className="dashboard-card">
          <h3>Resources by Type</h3>
          <div className="kind-list">
            {Object.entries(groupedByKind)
              .sort((a, b) => b[1].length - a[1].length)
              .map(([kind, items]) => {
                const kindStats = {
                  ready: items.filter(r => r.status === 'Ready').length,
                  total: items.length,
                };
                return (
                  <div 
                    key={kind} 
                    className={`kind-item clickable ${kindFilter === kind ? 'selected' : ''}`}
                    onClick={() => handleKindClick(kind)}
                    title={`Click to filter by ${kind}`}
                  >
                    <div className="kind-info">
                      <span className="kind-icon">{getKindIcon(kind)}</span>
                      <span className="kind-name">{kind}</span>
                    </div>
                    <div className="kind-stats">
                      <span className="kind-count">{items.length}</span>
                      <div className="mini-health-bar">
                        <div 
                          className="mini-health-fill" 
                          style={{ width: `${(kindStats.ready / kindStats.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Cluster Overview */}
        <div className="dashboard-card">
          <h3>Clusters</h3>
          <div className="cluster-list">
            {clusters.map(cluster => {
              const clusterResources = groupedByCluster[cluster.id] || [];
              const clusterStats = {
                ready: clusterResources.filter(r => r.status === 'Ready').length,
                total: clusterResources.length,
              };
              return (
                <div 
                  key={cluster.id} 
                  className={`cluster-item clickable ${clusterFilter === cluster.id ? 'selected' : ''}`}
                  onClick={() => handleClusterClick(cluster.id)}
                  title={`Click to filter by ${cluster.name}`}
                >
                  <div className="cluster-header">
                    <div>
                      <div className="cluster-name">🖥️ {cluster.name}</div>
                      <div className="cluster-desc">{cluster.description || 'No description'}</div>
                    </div>
                    <div className={`cluster-status ${cluster.status}`}>
                      {cluster.status}
                    </div>
                  </div>
                  <div className="cluster-stats">
                    <div className="cluster-stat">
                      <span className="stat-label">Resources</span>
                      <span className="stat-number">{clusterStats.total}</span>
                    </div>
                    <div className="cluster-stat">
                      <span className="stat-label">Ready</span>
                      <span className="stat-number ready">{clusterStats.ready}</span>
                    </div>
                    <div className="cluster-stat">
                      <span className="stat-label">Health</span>
                      <span className="stat-number">
                        {clusterStats.total > 0 
                          ? Math.round((clusterStats.ready / clusterStats.total) * 100) 
                          : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Activity Feed and Recent Resources */}
      <div className="dashboard-bottom-grid">
        <div className="dashboard-card">
          <ActivityFeed limit={20} />
        </div>

        {/* Recent Resources */}
        <div className="dashboard-card">
          <h3>
            {kindFilter !== 'all' || clusterFilter !== 'all' || statusFilter !== 'all' 
              ? `Filtered Resources (${filteredResources.length})`
              : `Recent Resources`
            }
          </h3>
          <div className="recent-resources">
            {filteredResources
              .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
              .slice(0, 20)
              .map(resource => (
                <div
                  key={resource.id}
                  className="resource-row"
                  onClick={() => navigate(`/clusters/${resource.cluster_id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="resource-icon">{getKindIcon(resource.kind)}</span>
                  <div className="resource-details">
                    <div className="resource-name">{resource.name}</div>
                    <div className="resource-meta">
                      {resource.kind} • {resource.namespace || 'cluster-scoped'}
                    </div>
                  </div>
                  <span className={`status-badge status-${resource.status.toLowerCase()}`}>
                    {resource.status}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {resources.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No Resources Found</h3>
          <p>Add a cluster and sync to see Flux resources</p>
        </div>
      )}
    </div>
  );
};

function getKindIcon(kind: string): string {
  const iconMap: Record<string, string> = {
    Kustomization: '📦',
    HelmRelease: '⎈',
    GitRepository: '📚',
    HelmRepository: '📊',
    OCIRepository: '🗂️',
    Bucket: '🪣',
  };
  return iconMap[kind] || '📄';
}

export default Dashboard;
