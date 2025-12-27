import React, { useState, useEffect } from 'react';
import { fluxApi } from '../api';
import ResourceActionMenu from './ResourceActionMenu';
import LogsViewer from './LogsViewer';
import '../styles/KustomizationDetail.css';

interface KustomizationDetailProps {
  clusterId: string;
  namespace: string;
  name: string;
  onClose: () => void;
}

interface ManagedResource {
  id: string;
  version: string;
  Namespace?: string;
  Name?: string;
  Group?: string;
  Kind?: string;
}

const KustomizationDetail: React.FC<KustomizationDetailProps> = ({
  clusterId,
  namespace,
  name,
  onClose,
}) => {
  const [resources, setResources] = useState<ManagedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'kind' | 'namespace'>('kind');
  const [searchTerm, setSearchTerm] = useState('');
  const [logsView, setLogsView] = useState<{ namespace: string; podName: string } | null>(null);

  useEffect(() => {
    loadResources();
  }, [clusterId, namespace, name]);

  const loadResources = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fluxApi.getChildren(clusterId, 'Kustomization', namespace, name);
      setResources(response.data.resources as ManagedResource[]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load managed resources');
    } finally {
      setLoading(false);
    }
  };

  const filteredResources = resources.filter((res) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      res.Kind?.toLowerCase().includes(search) ||
      res.Name?.toLowerCase().includes(search) ||
      res.Namespace?.toLowerCase().includes(search)
    );
  });

  const groupedResources = filteredResources.reduce((acc, res) => {
    const key = groupBy === 'kind' ? (res.Kind || 'Unknown') : (res.Namespace || 'cluster-scoped');
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(res);
    return acc;
  }, {} as Record<string, ManagedResource[]>);

  const getKindIcon = (kind: string) => {
    const iconMap: Record<string, string> = {
      Deployment: '🚀',
      StatefulSet: '💾',
      DaemonSet: '👥',
      ReplicaSet: '📋',
      Pod: '🔷',
      Service: '🔌',
      Ingress: '🌐',
      IngressRoute: '🌐',
      ConfigMap: '⚙️',
      Secret: '🔒',
      Job: '⏱️',
      CronJob: '⏰',
      Namespace: '📁',
      PersistentVolumeClaim: '💿',
      ServiceAccount: '👤',
      ClusterRole: '🔐',
      ClusterRoleBinding: '🔗',
      Role: '🔑',
      RoleBinding: '🔗',
      NetworkPolicy: '🛡️',
      HelmRelease: '⎈',
      Kustomization: '📦',
      GitRepository: '📚',
      HelmRepository: '📊',
      CustomResourceDefinition: '📜',
      ResourceQuota: '📊',
      Middleware: '🔀',
      Provider: '📡',
      Alert: '🔔',
    };
    return iconMap[kind] || '📄';
  };

  return (
    <div className="kustomization-detail-overlay" onClick={onClose}>
      <div className="kustomization-detail" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <div>
            <h2>📦 {name}</h2>
            <p className="detail-subtitle">{namespace} namespace</p>
          </div>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="detail-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search resources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="group-toggle">
            <button
              className={groupBy === 'kind' ? 'active' : ''}
              onClick={() => setGroupBy('kind')}
            >
              Group by Kind
            </button>
            <button
              className={groupBy === 'namespace' ? 'active' : ''}
              onClick={() => setGroupBy('namespace')}
            >
              Group by Namespace
            </button>
          </div>
          <button className="refresh-button" onClick={loadResources}>
            🔄 Refresh
          </button>
        </div>

        <div className="detail-content">
          {loading ? (
            <div className="detail-loading">Loading managed resources...</div>
          ) : error ? (
            <div className="detail-error">{error}</div>
          ) : filteredResources.length === 0 ? (
            <div className="detail-empty">
              {searchTerm ? 'No resources match your search' : 'No managed resources found'}
            </div>
          ) : (
            <div className="resource-groups">
              {Object.entries(groupedResources)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([group, groupResources]) => (
                  <div key={group} className="resource-group">
                    <div className="group-header">
                      <h3>
                        {groupBy === 'kind' ? getKindIcon(group) : '📁'} {group}
                      </h3>
                      <span className="group-count">{groupResources.length}</span>
                    </div>
                    <div className="resource-list">
                      {groupResources.map((res, idx) => (
                        <div key={res.id || idx} className="resource-item">
                          <div className="resource-item-icon">
                            {getKindIcon(res.Kind || '')}
                          </div>
                          <div className="resource-item-info">
                            <div className="resource-item-name">{res.Name}</div>
                            <div className="resource-item-meta">
                              {groupBy === 'kind' ? (
                                <>
                                  {res.Namespace ? (
                                    <span className="meta-tag">{res.Namespace}</span>
                                  ) : (
                                    <span className="meta-tag cluster-scoped">cluster-scoped</span>
                                  )}
                                </>
                              ) : (
                                <span className="meta-tag">{res.Kind}</span>
                              )}
                              {res.Group && <span className="meta-group">{res.Group}</span>}
                            </div>
                          </div>
                          <div className="resource-item-version">
                            <span className="version-badge">{res.version}</span>
                          </div>
                          {res.Kind && res.Name && res.Namespace && (
                            <div className="resource-item-actions">
                              <ResourceActionMenu
                                clusterId={clusterId}
                                kind={res.Kind}
                                namespace={res.Namespace}
                                name={res.Name}
                                onLogsClick={() => 
                                  setLogsView({ 
                                    namespace: res.Namespace!, 
                                    podName: res.Name! 
                                  })
                                }
                                onActionComplete={loadResources}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="detail-footer">
          <span>Total: {filteredResources.length} resources</span>
          <span>Groups: {Object.keys(groupedResources).length}</span>
        </div>
      </div>

      {logsView && (
        <LogsViewer
          clusterId={clusterId}
          namespace={logsView.namespace}
          podName={logsView.podName}
          onClose={() => setLogsView(null)}
        />
      )}
    </div>
  );
};

export default KustomizationDetail;
