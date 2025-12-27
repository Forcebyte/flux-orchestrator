import React, { useState, useEffect } from 'react';
import { oauthApi } from '../api';
import { OAuthProvider } from '../types';
import '../styles/OAuthProviders.css';

const OAuthProviders: React.FC = () => {
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<OAuthProvider | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await oauthApi.listProviders();
      setProviders(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load OAuth providers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this OAuth provider? Users will not be able to authenticate using this provider.')) {
      return;
    }

    try {
      await oauthApi.deleteProvider(id);
      await loadProviders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete provider');
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      const response = await oauthApi.testProvider(id);
      alert(response.data.message);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Configuration test failed');
    }
  };

  const handleEdit = (provider: OAuthProvider) => {
    setEditingProvider(provider);
    setShowAddDialog(true);
  };

  if (loading) {
    return <div className="oauth-loading">Loading OAuth providers...</div>;
  }

  return (
    <div className="oauth-container">
      <div className="oauth-header">
        <h3>🔐 OAuth Authentication Providers</h3>
        <button className="btn-add" onClick={() => {
          setEditingProvider(null);
          setShowAddDialog(true);
        }}>
          + Add Provider
        </button>
      </div>

      {error && <div className="oauth-error">{error}</div>}

      {providers.length === 0 ? (
        <div className="oauth-empty">
          <p>No OAuth providers configured.</p>
          <p>Add a provider to enable user authentication with GitHub or Entra ID.</p>
          <button className="btn-primary" onClick={() => setShowAddDialog(true)}>
            Add Your First Provider
          </button>
        </div>
      ) : (
        <div className="oauth-list">
          {providers.map((provider) => (
            <div key={provider.id} className="oauth-card">
              <div className="oauth-card-header">
                <div className="oauth-card-title">
                  <h4>{provider.name}</h4>
                  <span className={`provider-badge provider-${provider.provider}`}>
                    {provider.provider === 'github' ? '🐙 GitHub' : '🔷 Entra ID'}
                  </span>
                  <span className={`status-badge status-${provider.status}`}>
                    {provider.status}
                  </span>
                  {provider.enabled && (
                    <span className="enabled-badge">✓ Enabled</span>
                  )}
                </div>
                <div className="oauth-card-actions">
                  <button
                    className="btn-icon"
                    onClick={() => handleTestConnection(provider.id)}
                    title="Test Configuration"
                  >
                    🔌
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => handleEdit(provider)}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => handleDelete(provider.id)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="oauth-card-body">
                <div className="oauth-info">
                  <div className="info-row">
                    <span className="label">Client ID:</span>
                    <span className="value">{provider.client_id}</span>
                  </div>
                  {provider.tenant_id && (
                    <div className="info-row">
                      <span className="label">Tenant ID:</span>
                      <span className="value">{provider.tenant_id}</span>
                    </div>
                  )}
                  <div className="info-row">
                    <span className="label">Redirect URL:</span>
                    <span className="value">{provider.redirect_url}</span>
                  </div>
                  {provider.scopes && (
                    <div className="info-row">
                      <span className="label">Scopes:</span>
                      <span className="value">{provider.scopes}</span>
                    </div>
                  )}
                  {provider.allowed_users && (
                    <div className="info-row">
                      <span className="label">Allowed Users:</span>
                      <span className="value">{provider.allowed_users}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddDialog && (
        <AddProviderDialog
          provider={editingProvider}
          onClose={() => {
            setShowAddDialog(false);
            setEditingProvider(null);
          }}
          onSuccess={() => {
            setShowAddDialog(false);
            setEditingProvider(null);
            loadProviders();
          }}
        />
      )}
    </div>
  );
};

interface AddProviderDialogProps {
  provider: OAuthProvider | null;
  onClose: () => void;
  onSuccess: () => void;
}

const AddProviderDialog: React.FC<AddProviderDialogProps> = ({ provider, onClose, onSuccess }) => {
  const isEdit = !!provider;
  const [formData, setFormData] = useState({
    name: provider?.name || '',
    provider: provider?.provider || 'github',
    client_id: provider?.client_id || '',
    client_secret: '',
    tenant_id: provider?.tenant_id || '',
    redirect_url: provider?.redirect_url || '',
    scopes: provider?.scopes || '',
    allowed_users: provider?.allowed_users || '',
    enabled: provider?.enabled ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.client_id || !formData.redirect_url) {
      setError('Name, Client ID, and Redirect URL are required');
      return;
    }

    if (!isEdit && !formData.client_secret) {
      setError('Client Secret is required');
      return;
    }

    if (formData.provider === 'entra' && !formData.tenant_id) {
      setError('Tenant ID is required for Entra ID provider');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      if (isEdit) {
        const updateData: any = {
          name: formData.name,
          client_id: formData.client_id,
          redirect_url: formData.redirect_url,
          scopes: formData.scopes,
          allowed_users: formData.allowed_users,
          enabled: formData.enabled,
        };

        if (formData.provider === 'entra') {
          updateData.tenant_id = formData.tenant_id;
        }

        if (formData.client_secret) {
          updateData.client_secret = formData.client_secret;
        }

        await oauthApi.updateProvider(provider!.id, updateData);
      } else {
        await oauthApi.createProvider({
          name: formData.name,
          provider: formData.provider,
          client_id: formData.client_id,
          client_secret: formData.client_secret,
          tenant_id: formData.tenant_id,
          redirect_url: formData.redirect_url,
          scopes: formData.scopes,
          allowed_users: formData.allowed_users,
          enabled: formData.enabled,
        });
      }
      
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${isEdit ? 'update' : 'add'} provider`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content oauth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit OAuth Provider' : 'Add OAuth Provider'}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        
        {error && <div className="modal-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Provider Name</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My GitHub OAuth"
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="provider">Provider Type</label>
            <select
              id="provider"
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value as 'github' | 'entra' })}
              disabled={saving || isEdit}
            >
              <option value="github">GitHub</option>
              <option value="entra">Entra ID (Azure AD)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="client_id">Client ID</label>
            <input
              id="client_id"
              type="text"
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              placeholder={formData.provider === 'github' ? 'GitHub OAuth App Client ID' : 'Azure App Registration Client ID'}
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="client_secret">
              Client Secret {isEdit && <span className="optional">(leave empty to keep existing)</span>}
            </label>
            <input
              id="client_secret"
              type="password"
              value={formData.client_secret}
              onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
              placeholder="Enter client secret"
              disabled={saving}
            />
          </div>

          {formData.provider === 'entra' && (
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
          )}

          <div className="form-group">
            <label htmlFor="redirect_url">Redirect URL</label>
            <input
              id="redirect_url"
              type="text"
              value={formData.redirect_url}
              onChange={(e) => setFormData({ ...formData, redirect_url: e.target.value })}
              placeholder="https://your-domain.com/api/v1/auth/callback"
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="scopes">
              Scopes <span className="optional">(comma-separated, optional)</span>
            </label>
            <input
              id="scopes"
              type="text"
              value={formData.scopes}
              onChange={(e) => setFormData({ ...formData, scopes: e.target.value })}
              placeholder={formData.provider === 'github' ? 'user:email,read:user' : 'openid,profile,email'}
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="allowed_users">
              Allowed Users <span className="optional">(comma-separated emails/usernames, optional)</span>
            </label>
            <input
              id="allowed_users"
              type="text"
              value={formData.allowed_users}
              onChange={(e) => setFormData({ ...formData, allowed_users: e.target.value })}
              placeholder="user1@example.com,user2@example.com"
              disabled={saving}
            />
            <small>Leave empty to allow all users</small>
          </div>

          <div className="form-group-checkbox">
            <label>
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                disabled={saving}
              />
              <span>Enable this provider</span>
            </label>
          </div>

          <div className="form-info">
            <p>
              <strong>Setup Instructions:</strong>
            </p>
            {formData.provider === 'github' ? (
              <ul>
                <li>Go to GitHub Settings → Developer settings → OAuth Apps</li>
                <li>Create a new OAuth App with the redirect URL above</li>
                <li>Copy the Client ID and generate a Client Secret</li>
              </ul>
            ) : (
              <ul>
                <li>Go to Azure Portal → App registrations</li>
                <li>Register a new application with Web platform</li>
                <li>Add the redirect URL to Authentication settings</li>
                <li>Generate a client secret in Certificates & secrets</li>
              </ul>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Provider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OAuthProviders;
