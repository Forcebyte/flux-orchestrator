import React, { useState } from 'react';
import { resourceApi } from '../api';
import '../styles/ResourceActionMenu.css';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';

interface ResourceActionMenuProps {
  clusterId: string;
  kind: string;
  namespace: string;
  name: string;
  onLogsClick?: () => void;
  onActionComplete?: () => void;
}

const ResourceActionMenu: React.FC<ResourceActionMenuProps> = ({
  clusterId,
  kind,
  namespace,
  name,
  onLogsClick,
  onActionComplete,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showScaleDialog, setShowScaleDialog] = useState(false);
  const [replicas, setReplicas] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const { toasts, success, error, removeToast } = useToast();

  const canScale = ['Deployment', 'StatefulSet', 'ReplicaSet'].includes(kind);
  const canRestart = ['Deployment', 'StatefulSet', 'DaemonSet'].includes(kind);
  const canViewLogs = kind === 'Pod';
  const canDelete = kind === 'Pod';

  const handleRestart = async () => {
    setLoading(true);
    try {
      await resourceApi.restart(clusterId, kind, namespace, name);
      success(`Restart triggered for ${kind} ${namespace}/${name}`);
      onActionComplete?.();
    } catch (err: any) {
      error(`Failed to restart: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
      setShowMenu(false);
    }
  };

  const handleScale = async () => {
    setLoading(true);
    try {
      await resourceApi.scale(clusterId, kind, namespace, name, replicas);
      success(`Scaled ${kind} ${namespace}/${name} to ${replicas}`);
      onActionComplete?.();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message;
      // Special-case RBAC forbidden with a clearer message
      if (msg && msg.toLowerCase().includes('forbidden')) {
        error('Insufficient permissions to scale this resource. Ensure the orchestrator service account has get/update permissions for deployments in this namespace.');
      } else {
        error(`Failed to scale: ${msg}`);
      }
    } finally {
      setLoading(false);
      setShowScaleDialog(false);
      setShowMenu(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await resourceApi.deletePod(clusterId, namespace, name);
      success(`Deleted Pod ${namespace}/${name}`);
      onActionComplete?.();
    } catch (err: any) {
      error(`Failed to delete: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
      setShowMenu(false);
    }
  };

  const handleViewLogs = () => {
    setShowMenu(false);
    onLogsClick?.();
  };

  if (!canScale && !canRestart && !canViewLogs && !canDelete) {
    return null;
  }

  return (
    <div className="resource-action-menu">
      <Toast toasts={toasts} removeToast={removeToast} />
      <button
        className="action-menu-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        disabled={loading}
      >
        ⋮
      </button>

      {showMenu && (
        <>
          <div className="action-menu-backdrop" onClick={() => setShowMenu(false)} />
          <div className="action-menu-dropdown">
            {canViewLogs && (
              <button onClick={handleViewLogs}>
                📋 View Logs
              </button>
            )}
            {canRestart && (
              <button onClick={handleRestart} disabled={loading}>
                🔄 Restart
              </button>
            )}
            {canScale && (
              <button onClick={() => { setShowMenu(false); setShowScaleDialog(true); }}>
                📊 Scale
              </button>
            )}
            {canDelete && (
              <button onClick={handleDelete} disabled={loading} className="danger">
                🗑️ Delete Pod
              </button>
            )}
          </div>
        </>
      )}

      {showScaleDialog && (
        <div className="scale-dialog-overlay" onClick={() => setShowScaleDialog(false)}>
          <div className="scale-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Scale {kind}</h3>
            <p>{namespace}/{name}</p>
            <div className="scale-input-group">
              <label>Replicas:</label>
              <input
                type="number"
                min="0"
                value={replicas}
                onChange={(e) => setReplicas(Number(e.target.value))}
                autoFocus
              />
            </div>
            <div className="scale-dialog-actions">
              <button onClick={() => setShowScaleDialog(false)} disabled={loading}>
                Cancel
              </button>
              <button onClick={handleScale} disabled={loading} className="primary">
                {loading ? 'Scaling...' : 'Scale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceActionMenu;
