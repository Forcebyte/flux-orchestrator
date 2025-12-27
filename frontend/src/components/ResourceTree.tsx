import React, { useState, useEffect } from 'react';
import { ResourceNode } from '../types';
import { clusterApi } from '../api';
import ResourceActionMenu from './ResourceActionMenu';
import LogsViewer from './LogsViewer';
import '../styles/ResourceTree.css';

interface ResourceTreeProps {
  clusterId: string;
}

const ResourceTree: React.FC<ResourceTreeProps> = ({ clusterId }) => {
  const [tree, setTree] = useState<ResourceNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [logsView, setLogsView] = useState<{ namespace: string; podName: string } | null>(null);

  useEffect(() => {
    loadTree();
  }, [clusterId]);

  const loadTree = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await clusterApi.getResourceTree(clusterId);
      setTree(response.data.tree);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load resource tree');
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: ResourceNode[]) => {
      nodes.forEach(node => {
        allIds.add(node.id);
        if (node.children && node.children.length > 0) {
          collectIds(node.children);
        }
      });
    };
    collectIds(tree);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const getHealthClass = (health: string) => {
    switch (health) {
      case 'Healthy':
        return 'health-healthy';
      case 'Degraded':
        return 'health-degraded';
      case 'Progressing':
        return 'health-progressing';
      default:
        return 'health-unknown';
    }
  };

  const getKindIcon = (kind: string) => {
    const iconMap: Record<string, string> = {
      Kustomization: '📦',
      HelmRelease: '⎈',
      GitRepository: '📚',
      HelmRepository: '📊',
      Deployment: '🚀',
      StatefulSet: '💾',
      DaemonSet: '👥',
      ReplicaSet: '📋',
      Pod: '🔷',
      Service: '🔌',
      Ingress: '🌐',
      ConfigMap: '⚙️',
      Secret: '🔒',
      Job: '⏱️',
      CronJob: '⏰',
      Namespace: '📁',
    };
    return iconMap[kind] || '📄';
  };

  const renderNode = (node: ResourceNode, level: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="tree-node" style={{ marginLeft: `${level * 20}px` }}>
        <div className={`node-content ${getHealthClass(node.health)}`}>
          {hasChildren && (
            <button
              className="expand-button"
              onClick={() => toggleNode(node.id)}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <span className="expand-spacer"></span>}
          
          <span className="node-icon">{getKindIcon(node.kind)}</span>
          
          <div className="node-info">
            <div className="node-header">
              <span className="node-kind">{node.kind}</span>
              <span className="node-name">{node.name}</span>
              {node.namespace && <span className="node-namespace">({node.namespace})</span>}
            </div>
            <div className="node-status">
              <span className={`status-badge ${node.health.toLowerCase()}`}>
                {node.health}
              </span>
              {node.status && node.status !== 'Unknown' && (
                <span className="status-text">{node.status}</span>
              )}
            </div>
          </div>

          <ResourceActionMenu
            clusterId={clusterId}
            kind={node.kind}
            namespace={node.namespace || ''}
            name={node.name}
            onLogsClick={() => setLogsView({ namespace: node.namespace || '', podName: node.name })}
            onActionComplete={loadTree}
          />
        </div>
        
        {isExpanded && hasChildren && (
          <div className="node-children">
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="tree-loading">Loading resource tree...</div>;
  }

  if (error) {
    return (
      <div className="tree-error">
        <p>Error: {error}</p>
        <button onClick={loadTree} className="btn-retry">Retry</button>
      </div>
    );
  }

  if (tree.length === 0) {
    return <div className="tree-empty">No resources found</div>;
  }

  return (
    <div className="resource-tree">
      <div className="tree-header">
        <h3>Resource Hierarchy</h3>
        <div className="tree-actions">
          <button onClick={expandAll} className="btn-tree-action">Expand All</button>
          <button onClick={collapseAll} className="btn-tree-action">Collapse All</button>
          <button onClick={loadTree} className="btn-tree-action">Refresh</button>
        </div>
      </div>
      
      <div className="tree-content">
        {tree.map(node => renderNode(node))}
      </div>
      
      <div className="tree-footer">
        <span className="tree-count">Total root resources: {tree.length}</span>
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

export default ResourceTree;
