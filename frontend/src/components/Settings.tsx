import React, { useState, useEffect } from 'react';
import { settingsApi } from '../api';
import '../styles/Settings.css';

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoSyncInterval, setAutoSyncInterval] = useState<string>('5');

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
      alert('Auto-sync interval updated successfully! Changes will take effect within 30 seconds.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="settings-loading">Loading settings...</div>;
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>⚙️ Settings</h2>
      </div>

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
          <h3>Information</h3>
          <div className="info-box">
            <p>
              <strong>About Auto-Sync:</strong> The system periodically syncs all Flux resources 
              from healthy clusters to keep the database up to date. This includes Kustomizations, 
              HelmReleases, GitRepositories, and other Flux resources.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
