import React, { useState, useEffect } from 'react';
import { clusterApi } from '../api';
import { Cluster } from '../types';
import { useNavigate } from 'react-router-dom';

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

  useEffect(() => {
    loadClusters();
  }, []);

  const loadClusters = async () => {
    try {
      const response = await clusterApi.list();
      setClusters(response.data);
    } catch (error) {
      console.error('Failed to load clusters:', error);
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
      loadClusters();
    } catch (error) {
      console.error('Failed to create cluster:', error);
      alert('Failed to create cluster. Please check your kubeconfig.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this cluster?')) return;
    try {
      await clusterApi.delete(id);
      loadClusters();
    } catch (error) {
      console.error('Failed to delete cluster:', error);
    }
  };

  const handleSync = async (id: string) => {
    try {
      await clusterApi.syncResources(id);
      alert('Sync triggered successfully');
    } catch (error) {
      console.error('Failed to sync cluster:', error);
      alert('Failed to sync cluster');
    }
  };

  if (loading) {
    return <div className="loading">Loading clusters...</div>;
  }

  return (
    <div>
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
            {clusters.map((cluster) => (
              <div key={cluster.id} className="cluster-card" onClick={() => navigate(`/clusters/${cluster.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h4>{cluster.name}</h4>
                    <p>{cluster.description || 'No description'}</p>
                  </div>
                  <span className={`status-badge status-${cluster.status}`}>
                    {cluster.status}
                  </span>
                </div>
                <div style={{ marginTop: '15px', display: 'flex', gap: '8px' }}>
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
