import React, { useState, useEffect } from 'react';
import { settingsApi } from '../api';
import AzureSubscriptions from './AzureSubscriptions';
import '../styles/Settings.css';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'azure'>('general');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoSyncInterval, setAutoSyncInterval] = useState<string>('5');
  const [auditLogRetention, setAuditLogRetention] = useState<string>('90');
  const [cleaningUp, setCleaningUp] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await settingsApi.list();
      
      // Find auto sync interval setting
      const autoSync = response.data.find(s => s.key === 'auto_sync_interval_minutes');
      if (autoSync) {
        setAutoSyncInterval(autoSync.value);
      }

      // Find audit log retention setting
      const retention = response.data.find(s => s.key === 'audit_log_retention_days');
      if (retention) {
        setAuditLogRetention(retention.value);
      }
    } catch (err: any) {
      // If settings table doesn't exist yet, use defaults (will be created on first save)
      const errorMsg = err.response?.data?.error || '';
      if (errorMsg.includes("doesn't exist") || errorMsg.includes("does not exist")) {
        console.log('Settings table not found, using defaults');
      } else {
        setError(errorMsg || 'Failed to load settings');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAutoSync = async () => {
    try {
      setSaving(true);
      setError(null);
      
      const interval = parseInt(autoSyncInterval);
      if (isNaN(interval) || interval < 1) {
        setError('Interval must be a positive number');
        return;
      }

      await settingsApi.update('auto_sync_interval_minutes', autoSyncInterval);
      await loadSettings();
      // Use inline success message rather than alert
      setError('✅ Auto-sync interval saved. Changes apply within ~30 seconds.');
      setTimeout(() => setError(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRetention = async () => {
    try {
      setSaving(true);
      setError(null);
      
      const days = parseInt(auditLogRetention);
      if (isNaN(days) || days < 1) {
        setError('Retention must be a positive number');
        return;
      }

      await settingsApi.update('audit_log_retention_days', auditLogRetention);
      await loadSettings();
      setError('✅ Audit log retention updated');
      setTimeout(() => setError(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const handleCleanupNow = () => {
    setShowCleanupModal(true);
  };

  const confirmCleanup = async () => {
    setShowCleanupModal(false);
    
    try {
      setCleaningUp(true);
      setError(null);
      const response = await fetch('/api/v1/activities/cleanup', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Cleanup failed');
      }

      const data = await response.json();
      setError(null);
      // Show success message by temporarily using error field
      const successMsg = `✅ Cleanup completed successfully! ${data.remaining_activities} activities remaining.`;
      setError(successMsg);
      setTimeout(() => setError(null), 5000);
    } catch (err: any) {
      setError('❌ Failed to cleanup audit logs');
    } finally {
      setCleaningUp(false);
    }
  };

  if (loading) {
    return <div className="settings-loading">Loading settings...</div>;
  }

  return (
    <>
      {showCleanupModal && (
        <div className="modal-overlay" onClick={() => setShowCleanupModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🗑️ Cleanup Audit Logs</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowCleanupModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="warning-box">
                <span className="warning-icon">⚠️</span>
                <div>
                  <p><strong>This action cannot be undone</strong></p>
                  <p>This will permanently delete all audit logs older than <strong>{auditLogRetention} days</strong>.</p>
                </div>
              </div>
              <p>Audit logs include records of:</p>
              <ul>
                <li>Cluster management operations</li>
                <li>Resource reconciliation actions</li>
                <li>Configuration changes</li>
                <li>User activities</li>
              </ul>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-cancel" 
                onClick={() => setShowCleanupModal(false)}
                disabled={cleaningUp}
              >
                Cancel
              </button>
              <button 
                className="btn-confirm-delete" 
                onClick={confirmCleanup}
                disabled={cleaningUp}
              >
                {cleaningUp ? 'Cleaning...' : 'Delete Old Logs'}
              </button>
            </div>
          </div>
        </div>
      )}
      
    <div className="settings-container">
      <div className="settings-header">
        <h2>⚙️ Settings</h2>
      </div>

      <div className="settings-tabs">
        <button
          className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          className={`tab-button ${activeTab === 'azure' ? 'active' : ''}`}
          onClick={() => setActiveTab('azure')}
        >
          Azure AKS
        </button>
      </div>

      {activeTab === 'general' && (
        <>
          {error && (
            <div className="settings-error">
              {error}
            </div>
          )}

          <div className="settings-content">
            <div className="setting-section">
              <h3>Resource Synchronization</h3>
          <div className="setting-item">
            <label htmlFor="auto-sync-interval">
              <strong>Auto-Sync Interval (minutes)</strong>
              <p className="setting-description">
                How often to automatically refresh resources from all healthy clusters. 
                Changes take effect within 30 seconds.
              </p>
            </label>
            <div className="setting-control">
              <input
                id="auto-sync-interval"
                type="number"
                min="1"
                value={autoSyncInterval}
                onChange={(e) => setAutoSyncInterval(e.target.value)}
                disabled={saving}
              />
              <button
                onClick={handleSaveAutoSync}
                disabled={saving}
                className="btn-save"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <p className="setting-hint">
              Current: Every {autoSyncInterval} minute(s)
            </p>
          </div>
        </div>

            <div className="setting-section">
              <h3>Audit Log Settings</h3>
              <div className="setting-item">
                <label htmlFor="audit-retention">
                  <strong>Audit Log Retention (days)</strong>
                  <p className="setting-description">
                    Number of days to keep audit logs before automatic deletion. 
                    Cleanup runs daily at midnight.
                  </p>
                </label>
                <div className="setting-control">
                  <input
                    id="audit-retention"
                    type="number"
                    min="1"
                    value={auditLogRetention}
                    onChange={(e) => setAuditLogRetention(e.target.value)}
                    disabled={saving}
                  />
                  <button
                    onClick={handleSaveRetention}
                    disabled={saving}
                    className="btn-save"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <p className="setting-hint">
                  Current retention: {auditLogRetention} day(s)
                </p>
                <button
                  onClick={handleCleanupNow}
                  disabled={cleaningUp}
                  className="btn-cleanup"
                >
                  {cleaningUp ? 'Cleaning...' : '🗑️ Cleanup Old Logs Now'}
                </button>
              </div>
            </div>

            <div className="setting-section">
              <h3>Information</h3>
              <div className="info-box">
                <p>
                  <strong>About Auto-Sync:</strong> The system periodically syncs all Flux resources 
                  from healthy clusters to keep the database up to date. This includes Kustomizations, 
                  HelmReleases, GitRepositories, and other Flux resources.
                </p>
                <p>
                  <strong>About Audit Logs:</strong> Activity logs track all operations performed in the system, 
                  including cluster management, resource reconciliation, and configuration changes. 
                  Old logs are automatically deleted based on the retention period to prevent database bloat.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'azure' && (
        <AzureSubscriptions />
      )}
    </div>
    </>
  );
};

export default Settings;
