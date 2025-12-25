import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { clusterApi, resourceApi } from '../api';
import { Cluster, FluxResource } from '../types';

const ClusterDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [resources, setResources] = useState<FluxResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');

  useEffect(() => {
    loadData();
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
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async (resource: FluxResource) => {
    try {
      await resourceApi.reconcile({
        cluster_id: resource.cluster_id,
        kind: resource.kind,
        name: resource.name,
        namespace: resource.namespace,
      });
      alert('Reconciliation triggered');
      setTimeout(loadData, 2000);
    } catch (error) {
      console.error('Failed to reconcile:', error);
      alert('Failed to trigger reconciliation');
    }
  };

  const handleSync = async () => {
    if (!id) return;
    try {
      await clusterApi.syncResources(id);
      alert('Sync triggered');
      setTimeout(loadData, 2000);
    } catch (error) {
      console.error('Failed to sync:', error);
      alert('Failed to sync cluster');
    }
  };

  const filteredResources = activeTab === 'all'
    ? resources
    : resources.filter(r => r.kind === activeTab);

  const resourcesByKind = resources.reduce((acc, r) => {
    acc[r.kind] = (acc[r.kind] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!cluster) {
    return <div className="content">Cluster not found</div>;
  }

  return (
    <div>
      <div className="header">
        <h2>{cluster.name}</h2>
        <p style={{ color: '#718096', marginTop: '5px' }}>{cluster.description}</p>
        <div className="header-actions">
          <span className={`status-badge status-${cluster.status}`}>
            {cluster.status}
          </span>
          <button className="btn btn-success" onClick={handleSync}>
            Sync All Resources
          </button>
        </div>
      </div>

      <div className="content">
        <div className="card">
          <h3>Resource Summary</h3>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2d3748' }}>
                {resources.length}
              </div>
              <div style={{ fontSize: '12px', color: '#718096' }}>Total Resources</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#48bb78' }}>
                {resources.filter(r => r.status === 'Ready').length}
              </div>
              <div style={{ fontSize: '12px', color: '#718096' }}>Ready</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f56565' }}>
                {resources.filter(r => r.status === 'NotReady').length}
              </div>
              <div style={{ fontSize: '12px', color: '#718096' }}>Not Ready</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Flux Resources</h3>

          <div className="tabs">
            <button
              className={`tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All ({resources.length})
            </button>
            {Object.entries(resourcesByKind).map(([kind, count]) => (
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
              <p>No resources found</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Kind</th>
                  <th>Namespace</th>
                  <th>Status</th>
                  <th>Last Reconcile</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredResources.map((resource) => (
                  <tr key={resource.id}>
                    <td>{resource.name}</td>
                    <td>{resource.kind}</td>
                    <td>{resource.namespace}</td>
                    <td>
                      <span className={`status-badge status-${resource.status.toLowerCase()}`}>
                        {resource.status}
                      </span>
                      {resource.message && (
                        <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                          {resource.message}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {resource.last_reconcile
                        ? new Date(resource.last_reconcile).toLocaleString()
                        : 'Never'}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleReconcile(resource)}
                      >
                        Reconcile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClusterDetail;
