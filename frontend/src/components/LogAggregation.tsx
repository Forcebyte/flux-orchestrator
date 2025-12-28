import React, { useState, useEffect } from 'react';
import { clusterApi } from '../api';
import '../styles/LogAggregation.css';

interface LogEntry {
  timestamp: string;
  cluster_id: string;
  cluster_name?: string;
  namespace: string;
  pod_name: string;
  container: string;
  message: string;
  level?: string;
}

const LogAggregation: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Filters
  const [selectedClusters, setSelectedClusters] = useState<string[]>([]);
  const [namespace, setNamespace] = useState('');
  const [labelSelector, setLabelSelector] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [tailLines, setTailLines] = useState(100);
  const [levelFilter, setLevelFilter] = useState<string>('all');

  useEffect(() => {
    loadClusters();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadLogs();
      }, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedClusters, namespace, labelSelector, tailLines]);

  const loadClusters = async () => {
    try {
      const response = await clusterApi.list();
      setClusters(response.data);
    } catch (err: any) {
      console.error('Failed to load clusters:', err);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      selectedClusters.forEach(id => params.append('cluster_id', id));
      if (namespace) params.append('namespace', namespace);
      if (labelSelector) params.append('label_selector', labelSelector);
      params.append('tail_lines', tailLines.toString());
      
      const response = await fetch(`/api/v1/logs/aggregated?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to load logs');
      }
      
      const data = await response.json();
      
      // Map cluster names
      const logsWithNames = data.logs.map((log: LogEntry) => ({
        ...log,
        cluster_name: clusters.find(c => c.id === log.cluster_id)?.name || log.cluster_id,
      }));
      
      setLogs(logsWithNames);
    } catch (err: any) {
      setError(err.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const toggleCluster = (clusterId: string) => {
    setSelectedClusters(prev =>
      prev.includes(clusterId)
        ? prev.filter(id => id !== clusterId)
        : [...prev, clusterId]
    );
  };

  const selectAllClusters = () => {
    setSelectedClusters(clusters.map(c => c.id));
  };

  const deselectAllClusters = () => {
    setSelectedClusters([]);
  };

  const filteredLogs = logs.filter(log => {
    // Search filter
    if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Level filter
    if (levelFilter !== 'all') {
      const message = log.message.toLowerCase();
      if (levelFilter === 'error' && !message.includes('error') && !message.includes('fatal')) {
        return false;
      }
      if (levelFilter === 'warn' && !message.includes('warn') && !message.includes('warning')) {
        return false;
      }
      if (levelFilter === 'info' && (message.includes('error') || message.includes('warn'))) {
        return false;
      }
    }
    
    return true;
  });

  const detectLogLevel = (message: string): string => {
    const lower = message.toLowerCase();
    if (lower.includes('error') || lower.includes('fatal') || lower.includes('fail')) return 'error';
    if (lower.includes('warn') || lower.includes('warning')) return 'warn';
    if (lower.includes('info')) return 'info';
    if (lower.includes('debug')) return 'debug';
    return 'default';
  };

  const downloadLogs = () => {
    const content = filteredLogs
      .map(log => `[${log.timestamp}] [${log.cluster_name}/${log.namespace}/${log.pod_name}/${log.container}] ${log.message}`)
      .join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="log-aggregation">
      <div className="log-header">
        <h2>Log Aggregation</h2>
        <div className="header-actions">
          <button
            className={`btn-refresh ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Auto-refresh every 5 seconds"
          >
            {autoRefresh ? '⏸ Pause' : '▶ Auto-Refresh'}
          </button>
          <button onClick={downloadLogs} disabled={logs.length === 0}>
            ⬇ Download
          </button>
          <button onClick={loadLogs} disabled={loading || selectedClusters.length === 0}>
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="log-filters">
        <div className="filter-section">
          <label>Clusters ({selectedClusters.length} selected)</label>
          <div className="cluster-selection">
            <div className="cluster-buttons">
              <button onClick={selectAllClusters} className="btn-sm">Select All</button>
              <button onClick={deselectAllClusters} className="btn-sm">Clear</button>
            </div>
            <div className="cluster-checkboxes">
              {clusters.map(cluster => (
                <label key={cluster.id}>
                  <input
                    type="checkbox"
                    checked={selectedClusters.includes(cluster.id)}
                    onChange={() => toggleCluster(cluster.id)}
                  />
                  <span>{cluster.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="filter-section">
          <label>Namespace (optional)</label>
          <input
            type="text"
            value={namespace}
            onChange={e => setNamespace(e.target.value)}
            placeholder="Leave empty for all namespaces"
          />
        </div>

        <div className="filter-section">
          <label>Label Selector (optional)</label>
          <input
            type="text"
            value={labelSelector}
            onChange={e => setLabelSelector(e.target.value)}
            placeholder="e.g., app=my-app"
          />
        </div>

        <div className="filter-section">
          <label>Tail Lines</label>
          <select value={tailLines} onChange={e => setTailLines(Number(e.target.value))}>
            <option value={50}>50 lines</option>
            <option value={100}>100 lines</option>
            <option value={200}>200 lines</option>
            <option value={500}>500 lines</option>
            <option value={1000}>1000 lines</option>
          </select>
        </div>

        <div className="filter-section">
          <label>Search Logs</label>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search in log messages..."
          />
        </div>

        <div className="filter-section">
          <label>Level Filter</label>
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
            <option value="all">All Levels</option>
            <option value="error">Errors Only</option>
            <option value="warn">Warnings Only</option>
            <option value="info">Info Only</option>
          </select>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="log-stats">
        <span>Total logs: {logs.length}</span>
        <span>Filtered: {filteredLogs.length}</span>
        {loading && <span className="loading-indicator">Loading...</span>}
      </div>

      <div className="log-container">
        {filteredLogs.length === 0 && !loading && (
          <div className="no-logs">
            {selectedClusters.length === 0
              ? 'Select at least one cluster and click Refresh'
              : 'No logs found matching the criteria'}
          </div>
        )}
        
        {filteredLogs.map((log, index) => {
          const level = detectLogLevel(log.message);
          return (
            <div key={index} className={`log-entry log-${level}`}>
              <div className="log-meta">
                <span className="log-cluster">{log.cluster_name}</span>
                <span className="log-namespace">{log.namespace}</span>
                <span className="log-pod">{log.pod_name}</span>
                <span className="log-container">{log.container}</span>
              </div>
              <div className="log-message">{log.message}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LogAggregation;
