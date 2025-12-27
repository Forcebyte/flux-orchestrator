import React, { useState, useEffect } from 'react';
import { azureApi } from '../api';
import { AzureSubscription, AKSCluster, AzureCredentials } from '../types';
import '../styles/AzureSubscriptions.css';

const AzureSubscriptions: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedSub, setSelectedSub] = useState<AzureSubscription | null>(null);
  const [showDiscovery, setShowDiscovery] = useState(false);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await azureApi.listSubscriptions();
      setSubscriptions(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load Azure subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Azure subscription? This will not delete the clusters from your account.')) {
      return;
    }

    try {
      await azureApi.deleteSubscription(id);
      await loadSubscriptions();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete subscription');
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      const response = await azureApi.testConnection(id);
      alert(response.data.message);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Connection test failed');
    }
  };

  const handleDiscover = (sub: AzureSubscription) => {
    setSelectedSub(sub);
    setShowDiscovery(true);
  };

  if (loading) {
    return <div className="azure-loading">Loading Azure subscriptions...</div>;
  }

  return (
    <div className="azure-container">
      <div className="azure-header">
        <h3>☁️ Azure AKS Subscriptions</h3>
        <button className="btn-add" onClick={() => setShowAddDialog(true)}>
          + Add Subscription
        </button>
      </div>

      {error && <div className="azure-error">{error}</div>}

      {subscriptions.length === 0 ? (
        <div className="azure-empty">
          <p>No Azure subscriptions configured.</p>
          <p>Add a subscription to automatically discover and manage AKS clusters.</p>
          <button className="btn-primary" onClick={() => setShowAddDialog(true)}>
            Add Your First Subscription
          </button>
        </div>
      ) : (
        <div className="azure-list">
          {subscriptions.map((sub) => (
            <div key={sub.id} className="azure-card">
              <div className="azure-card-header">
                <div className="azure-card-title">
                  <h4>{sub.name}</h4>
                  <span className={`status-badge status-${sub.status}`}>
                    {sub.status}
                  </span>
                </div>
                <div className="azure-card-actions">
                  <button
                    className="btn-icon"
                    onClick={() => handleTestConnection(sub.id)}
                    title="Test Connection"
                  >
                    🔌
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => handleDiscover(sub)}
                    title="Discover Clusters"
                  >
                    🔍
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => handleDelete(sub.id)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="azure-card-body">
                <div className="azure-info">
                  <div className="info-row">
                    <span className="label">Subscription ID:</span>
                    <span className="value">{sub.id}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Tenant ID:</span>
                    <span className="value">{sub.tenant_id}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Clusters:</span>
                    <span className="value">{sub.cluster_count}</span>
                  </div>
                  {sub.last_synced_at && (
                    <div className="info-row">
                      <span className="label">Last Synced:</span>
                      <span className="value">
                        {new Date(sub.last_synced_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddDialog && (
        <AddSubscriptionDialog
          onClose={() => setShowAddDialog(false)}
          onSuccess={() => {
            setShowAddDialog(false);
            loadSubscriptions();
          }}
        />
      )}

      {showDiscovery && selectedSub && (
        <ClusterDiscoveryDialog
          subscription={selectedSub}
          onClose={() => {
            setShowDiscovery(false);
            setSelectedSub(null);
            loadSubscriptions();
          }}
        />
      )}
    </div>
  );
};

interface AddSubscriptionDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

const AddSubscriptionDialog: React.FC<AddSubscriptionDialogProps> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    tenant_id: '',
    client_id: '',
    client_secret: '',
    subscription_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.tenant_id || !formData.client_id || 
        !formData.client_secret || !formData.subscription_id) {
      setError('All fields are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      await azureApi.createSubscription({
        name: formData.name,
        credentials: {
          tenant_id: formData.tenant_id,
          client_id: formData.client_id,
          client_secret: formData.client_secret,
          subscription_id: formData.subscription_id,
        },
      });
      
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add subscription');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Azure Subscription</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        
        {error && <div className="modal-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Subscription Name</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Azure Subscription"
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="subscription_id">Subscription ID</label>
            <input
              id="subscription_id"
              type="text"
              value={formData.subscription_id}
              onChange={(e) => setFormData({ ...formData, subscription_id: e.target.value })}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="tenant_id">Tenant ID</label>
            <input
              id="tenant_id"
              type="text"
              value={formData.tenant_id}
              onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="client_id">Client ID (App ID)</label>
            <input
              id="client_id"
              type="text"
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="client_secret">Client Secret</label>
            <input
              id="client_secret"
              type="password"
              value={formData.client_secret}
              onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
              placeholder="Enter client secret"
              disabled={saving}
            />
          </div>

          <div className="form-info">
            <p>
              <strong>Note:</strong> Your service principal needs the following permissions:
            </p>
            <ul>
              <li>Azure Kubernetes Service Cluster User Role</li>
              <li>Reader role on the subscription or resource groups</li>
            </ul>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Adding...' : 'Add Subscription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ClusterDiscoveryDialogProps {
  subscription: AzureSubscription;
  onClose: () => void;
}

const ClusterDiscoveryDialog: React.FC<ClusterDiscoveryDialogProps> = ({ subscription, onClose }) => {
  const [clusters, setClusters] = useState<AKSCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<any>(null);

  useEffect(() => {
    discoverClusters();
  }, []);

  const discoverClusters = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await azureApi.discoverClusters(subscription.id);
      setClusters(response.data.clusters);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to discover clusters');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!confirm(`Sync ${clusters.length} cluster(s) from ${subscription.name}?`)) {
      return;
    }

    try {
      setSyncing(true);
      setError(null);
      const response = await azureApi.syncClusters(subscription.id);
      setSyncResults(response.data);
      
      if (response.data.failed === 0) {
        alert(`Successfully synced ${response.data.synced} cluster(s)!`);
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to sync clusters');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Discover AKS Clusters - {subscription.name}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        {loading ? (
          <div className="modal-loading">Discovering AKS clusters...</div>
        ) : (
          <>
            <div className="discovery-summary">
              <p>Found <strong>{clusters.length}</strong> AKS cluster(s) in this subscription.</p>
            </div>

            {clusters.length === 0 ? (
              <div className="discovery-empty">
                <p>No AKS clusters found in this subscription.</p>
              </div>
            ) : (
              <>
                <div className="cluster-list">
                  {clusters.map((cluster) => (
                    <div key={cluster.id} className="cluster-item">
                      <div className="cluster-info">
                        <h4>{cluster.name}</h4>
                        <div className="cluster-details">
                          <span><strong>Resource Group:</strong> {cluster.resource_group}</span>
                          <span><strong>Location:</strong> {cluster.location}</span>
                          <span><strong>K8s Version:</strong> {cluster.kubernetes_version}</span>
                          <span><strong>Nodes:</strong> {cluster.node_count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {syncResults && (
                  <div className="sync-results">
                    <h4>Sync Results</h4>
                    <p>
                      <strong>Synced:</strong> {syncResults.synced} | 
                      <strong> Failed:</strong> {syncResults.failed}
                    </p>
                    {syncResults.clusters && syncResults.clusters.length > 0 && (
                      <div className="sync-details">
                        {syncResults.clusters.map((c: any, idx: number) => (
                          <div key={idx} className={`sync-item sync-${c.status}`}>
                            <span>{c.name}</span>
                            <span className="sync-status">{c.status}</span>
                            {c.error && <span className="sync-error">{c.error}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="modal-footer">
              <button onClick={onClose} disabled={syncing}>
                Close
              </button>
              {clusters.length > 0 && (
                <button 
                  onClick={handleSync} 
                  disabled={syncing}
                  className="btn-primary"
                >
                  {syncing ? 'Syncing...' : `Sync ${clusters.length} Cluster(s)`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AzureSubscriptions;
