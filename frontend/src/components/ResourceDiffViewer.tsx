import React, { useState, useEffect } from 'react';
import * as Diff from 'diff';
import '../styles/ResourceDiffViewer.css';

interface ResourceDiffViewerProps {
  clusterId: string;
  kind: string;
  namespace: string;
  name: string;
  onClose: () => void;
}

const ResourceDiffViewer: React.FC<ResourceDiffViewerProps> = ({
  clusterId,
  kind,
  namespace,
  name,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');

  useEffect(() => {
    loadManifest();
  }, [clusterId, kind, namespace, name]);

  const loadManifest = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `/api/v1/clusters/${clusterId}/resources/${kind}/${namespace}/${name}/manifest`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load resource manifest');
      }
      
      const data = await response.json();
      setManifest(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load manifest');
    } finally {
      setLoading(false);
    }
  };

  const formatYAML = (obj: any): string => {
    if (!obj) return '';
    
    // Remove managed fields and other noise
    const clean = { ...obj };
    if (clean.metadata) {
      delete clean.metadata.managedFields;
      delete clean.metadata.resourceVersion;
      delete clean.metadata.uid;
      delete clean.metadata.selfLink;
      delete clean.metadata.generation;
    }
    
    return JSON.stringify(clean, null, 2);
  };

  const getDesiredState = (): string => {
    if (!manifest) return '';
    
    const desired: any = { ...manifest };
    
    // Remove status and runtime fields for "desired" view
    delete desired.status;
    if (desired.metadata) {
      delete desired.metadata.creationTimestamp;
      delete desired.metadata.managedFields;
      delete desired.metadata.resourceVersion;
      delete desired.metadata.uid;
      delete desired.metadata.selfLink;
      delete desired.metadata.generation;
    }
    
    return formatYAML(desired);
  };

  const getActualState = (): string => {
    if (!manifest) return '';
    return formatYAML(manifest);
  };

  const renderDiff = () => {
    const desired = getDesiredState();
    const actual = getActualState();
    
    const diff = Diff.diffLines(desired, actual);
    
    if (viewMode === 'unified') {
      return (
        <div className="diff-unified">
          {diff.map((part, index) => {
            const className = part.added ? 'diff-added' : part.removed ? 'diff-removed' : 'diff-unchanged';
            return (
              <pre key={index} className={className}>
                {part.value}
              </pre>
            );
          })}
        </div>
      );
    }
    
    // Split view
    return (
      <div className="diff-split">
        <div className="diff-pane">
          <h3>Desired State (Spec)</h3>
          <pre className="code-block">{desired}</pre>
        </div>
        <div className="diff-divider"></div>
        <div className="diff-pane">
          <h3>Actual State (Full)</h3>
          <pre className="code-block">{actual}</pre>
        </div>
      </div>
    );
  };

  const renderStatus = () => {
    if (!manifest?.status) return null;
    
    const status = manifest.status;
    const conditions = status.conditions || [];
    
    return (
      <div className="resource-status">
        <h3>Resource Status</h3>
        {conditions.length > 0 && (
          <div className="conditions">
            {conditions.map((cond: any, idx: number) => (
              <div key={idx} className={`condition ${cond.status === 'True' ? 'success' : 'warning'}`}>
                <strong>{cond.type}:</strong> {cond.status}
                {cond.message && <div className="condition-message">{cond.message}</div>}
                {cond.reason && <div className="condition-reason">Reason: {cond.reason}</div>}
              </div>
            ))}
          </div>
        )}
        {status.lastHandledReconcileAt && (
          <div className="status-field">
            <strong>Last Reconcile:</strong> {new Date(status.lastHandledReconcileAt).toLocaleString()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content diff-modal" onClick={e => e.stopPropagation()}>
        <div className="diff-header">
          <div className="diff-title">
            <h2>Resource Diff Viewer</h2>
            <div className="resource-info">
              <span className="badge">{kind}</span>
              <span>{namespace}/{name}</span>
            </div>
          </div>
          <div className="diff-controls">
            <div className="view-toggle">
              <button
                className={viewMode === 'split' ? 'active' : ''}
                onClick={() => setViewMode('split')}
              >
                Split View
              </button>
              <button
                className={viewMode === 'unified' ? 'active' : ''}
                onClick={() => setViewMode('unified')}
              >
                Unified Diff
              </button>
            </div>
            <button className="btn-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {loading && <div className="loading">Loading manifest...</div>}
        
        {error && <div className="error-message">{error}</div>}
        
        {!loading && !error && manifest && (
          <>
            {renderStatus()}
            <div className="diff-content">
              {renderDiff()}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResourceDiffViewer;
