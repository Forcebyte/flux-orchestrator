import React, { useState, useEffect } from 'react';
import { clusterApi } from '../api';
import { Cluster } from '../types';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';

const Clusters: React.FC = () => {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    kubeconfig: '',
  });
  const navigate = useNavigate();
  const { toasts, removeToast, success, error, info } = useToast();

  useEffect(() => {
    loadClusters();
  }, []);

  const loadClusters = async () => {
    try {
      const response = await clusterApi.list();
      setClusters(response.data);
    } catch (err) {
      console.error('Failed to load clusters:', err);
      error('Failed to load clusters');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await clusterApi.create(formData);
      setShowModal(false);
      setFormData({ name: '', description: '', kubeconfig: '' });
      success(`Cluster "${formData.name}" created successfully`);
      loadClusters();
    } catch (err) {
      console.error('Failed to create cluster:', err);
      error('Failed to create cluster. Please check your kubeconfig.');
    }
  };

  const handleDelete = async (id: string) => {
    const cluster = clusters.find(c => c.id === id);
    if (!confirm(`Are you sure you want to delete cluster "${cluster?.name}"?`)) return;
    try {
      await clusterApi.delete(id);
      success('Cluster deleted successfully');
      loadClusters();
    } catch (err) {
      console.error('Failed to delete cluster:', err);
      error('Failed to delete cluster');
    }
  };

  const handleSync = async (id: string) => {
    try {
      await clusterApi.syncResources(id);
      info('Sync triggered successfully');
    } catch (err) {
      console.error('Failed to sync cluster:', err);
      error('Failed to sync cluster');
    }
  };

  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await clusterApi.toggleFavorite(id);
      loadClusters();
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      error('Failed to toggle favorite');
    }
  };

  const handleExport = async (id: string, format: 'json' | 'csv', e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await clusterApi.exportCluster(id, format);
      const cluster = clusters.find(c => c.id === id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${cluster?.name || id}-export.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      success(`Exported cluster as ${format.toUpperCase()}`);
    } catch (err) {
      console.error('Failed to export cluster:', err);
      error('Failed to export cluster');
    }
  };

  // Sort clusters: favorites first, then by name
  const sortedClusters = [...clusters].sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1;
    if (!a.is_favorite && b.is_favorite) return 1;
    return a.name.localeCompare(b.name);
  });

  if (loading) {
    return <div className="loading">Loading clusters...</div>;
  }

  return (
    <div>
      <Toast toasts={toasts} removeToast={removeToast} />
      
      <div className="header">
        <h2>Clusters</h2>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add Cluster
          </button>
        </div>
      </div>

      <div className="content">
        {clusters.length === 0 ? (
          <div className="empty-state">
            <h3>No Clusters</h3>
            <p>Add your first Kubernetes cluster to get started</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              + Add Cluster
            </button>
          </div>
        ) : (
          <div className="grid">
            {sortedClusters.map((cluster) => (
              <div key={cluster.id} className="cluster-card" onClick={() => navigate(`/clusters/${cluster.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <button
                        className={`favorite-btn ${cluster.is_favorite ? 'favorite-active' : ''}`}
                        onClick={(e) => handleToggleFavorite(cluster.id, e)}
                        title={cluster.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        {cluster.is_favorite ? '⭐' : '☆'}
                      </button>
                      <h4 style={{ margin: 0 }}>{cluster.name}</h4>
                      {cluster.source === 'azure-aks' && (
                        <span className="source-badge" title="Azure AKS">☁️</span>
                      )}
                      {cluster.resource_count !== undefined && cluster.resource_count > 0 && (
                        <span className="resource-count-badge" title={`${cluster.resource_count} resources`}>
                          {cluster.resource_count}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, color: '#666' }}>{cluster.description || 'No description'}</p>
                  </div>
                  <span className={`status-badge status-${cluster.status}`}>
                    {cluster.status}
                  </span>
                </div>
                <div style={{ marginTop: '15px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-sm btn-success"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSync(cluster.id);
                    }}
                  >
                    Sync
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={(e) => handleExport(cluster.id, 'json', e)}
                    title="Export as JSON"
                  >
                    📥 JSON
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={(e) => handleExport(cluster.id, 'csv', e)}
                    title="Export as CSV"
                  >
                    📥 CSV
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(cluster.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Cluster</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Cluster Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Kubeconfig *</label>
                <textarea
                  className="form-control"
                  value={formData.kubeconfig}
                  onChange={(e) => setFormData({ ...formData, kubeconfig: e.target.value })}
                  required
                  placeholder="Paste your kubeconfig content here..."
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Cluster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clusters;
