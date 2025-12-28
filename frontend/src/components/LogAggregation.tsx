import React, { useState, useEffect } from 'react';
import { clusterApi, logsApi } from '../api';
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

interface ParsedLogEntry extends LogEntry {
  parsedTime: Date;
  fields: Record<string, string>;
}

const LogAggregation: React.FC = () => {
  const [logs, setLogs] = useState<ParsedLogEntry[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'raw'>('table');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  // Filters
  const [selectedClusters, setSelectedClusters] = useState<string[]>([]);
  const [namespace, setNamespace] = useState('flux-system');
  const [labelSelector, setLabelSelector] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [tailLines, setTailLines] = useState(100);
  const [levelFilter, setLevelFilter] = useState<string[]>([]);

  useEffect(() => {
    loadClusters();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadLogs();
      }, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedClusters, namespace, labelSelector, tailLines]);

  const loadClusters = async () => {
    try {
      const response = await clusterApi.list();
      setClusters(response.data);
      // Auto-select all clusters by default
      setSelectedClusters(response.data.map((c: any) => c.id));
    } catch (err: any) {
      console.error('Failed to load clusters:', err);
    }
  };

  const parseLogEntry = (log: LogEntry): ParsedLogEntry => {
    const fields: Record<string, string> = {};
    const message = log.message;
    
    // Try to extract JSON fields
    try {
      const jsonMatch = message.match(/\{.*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        Object.assign(fields, parsed);
      }
    } catch (e) {
      // Not JSON, try key=value pairs
      const kvMatches = message.matchAll(/(\w+)=("[^"]*"|'[^']*'|\S+)/g);
      for (const match of kvMatches) {
        fields[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
    
    return {
      ...log,
      parsedTime: new Date(log.timestamp),
      fields,
      level: detectLogLevel(message)
    };
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
      
      const response = await logsApi.getAggregatedLogs(params);
      const data = response.data;
      
      if (!data.logs || !Array.isArray(data.logs)) {
        setLogs([]);
        return;
      }
      
      const logsWithNames = data.logs.map((log: LogEntry) => ({
        ...log,
        cluster_name: clusters.find(c => c.id === log.cluster_id)?.name || log.cluster_id,
      }));
      
      const parsed = logsWithNames.map(parseLogEntry);
      setLogs(parsed.sort((a: ParsedLogEntry, b: ParsedLogEntry) => b.parsedTime.getTime() - a.parsedTime.getTime()));
    } catch (err: any) {
      setError(err.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const detectLogLevel = (message: string): string => {
    const lower = message.toLowerCase();
    if (lower.match(/\b(error|fatal|panic|critical)\b/)) return 'error';
    if (lower.match(/\b(warn|warning)\b/)) return 'warn';
    if (lower.match(/\b(info)\b/)) return 'info';
    if (lower.match(/\b(debug|trace)\b/)) return 'debug';
    return 'info';
  };

  const toggleLevelFilter = (level: string) => {
    setLevelFilter(prev =>
      prev.includes(level)
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  };

  const filteredLogs = logs.filter(log => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matches = 
        log.message.toLowerCase().includes(searchLower) ||
        log.cluster_name?.toLowerCase().includes(searchLower) ||
        log.namespace.toLowerCase().includes(searchLower) ||
        log.pod_name.toLowerCase().includes(searchLower);
      if (!matches) return false;
    }
    
    // Level filter
    if (levelFilter.length > 0 && !levelFilter.includes(log.level || 'info')) {
      return false;
    }
    
    return true;
  });

  const toggleRowExpansion = (index: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const highlightSearch = (text: string) => {
    if (!searchTerm) return text;
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === searchTerm.toLowerCase() 
        ? <mark key={i}>{part}</mark> 
        : part
    );
  };

  const downloadLogs = () => {
    const content = filteredLogs
      .map(log => `[${log.timestamp}] [${log.level?.toUpperCase()}] [${log.cluster_name}/${log.namespace}/${log.pod_name}] ${log.message}`)
      .join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flux-logs-${new Date().toISOString().replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLevelStats = () => {
    const stats = { error: 0, warn: 0, info: 0, debug: 0 };
    filteredLogs.forEach(log => {
      const level = log.level || 'info';
      if (level in stats) stats[level as keyof typeof stats]++;
    });
    return stats;
  };

  const stats = getLevelStats();

  return (
    <div className="log-aggregation">
      <div className="log-header">
        <div className="header-left">
          <h2>📊 Log Explorer</h2>
          <div className="view-toggle">
            <button
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              ☰ Table
            </button>
            <button
              className={viewMode === 'raw' ? 'active' : ''}
              onClick={() => setViewMode('raw')}
              title="Raw view"
            >
              ⚡ Raw
            </button>
          </div>
        </div>
        <div className="header-actions">
          <button
            className={`btn-refresh ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Auto-refresh every 10 seconds"
          >
            {autoRefresh ? '⏸ Pause' : '▶ Live'}
          </button>
          <button onClick={downloadLogs} disabled={filteredLogs.length === 0}>
            ⬇ Export
          </button>
          <button 
            onClick={loadLogs} 
            disabled={loading || selectedClusters.length === 0}
            className="btn-primary"
          >
            {loading ? '⏳ Loading...' : '🔍 Search'}
          </button>
        </div>
      </div>

      {/* Quick Filters Bar */}
      <div className="quick-filters">
        <div className="filter-group">
          <label>Log Level:</label>
          <div className="level-filters">
            <button
              className={`level-badge level-error ${levelFilter.includes('error') ? 'active' : ''}`}
              onClick={() => toggleLevelFilter('error')}
            >
              ❌ Error <span className="count">{stats.error}</span>
            </button>
            <button
              className={`level-badge level-warn ${levelFilter.includes('warn') ? 'active' : ''}`}
              onClick={() => toggleLevelFilter('warn')}
            >
              ⚠️ Warn <span className="count">{stats.warn}</span>
            </button>
            <button
              className={`level-badge level-info ${levelFilter.includes('info') ? 'active' : ''}`}
              onClick={() => toggleLevelFilter('info')}
            >
              ℹ️ Info <span className="count">{stats.info}</span>
            </button>
            <button
              className={`level-badge level-debug ${levelFilter.includes('debug') ? 'active' : ''}`}
              onClick={() => toggleLevelFilter('debug')}
            >
              🔧 Debug <span className="count">{stats.debug}</span>
            </button>
          </div>
        </div>
        <div className="search-box">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="🔍 Search logs (cluster, namespace, pod, or message)..."
            className="search-input"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>✕</button>
          )}
        </div>
      </div>

      {/* Collapsible Filters */}
      <details className="advanced-filters" open>
        <summary>⚙️ Advanced Filters</summary>
        <div className="filters-grid">
          <div className="filter-section">
            <label>🎯 Clusters ({selectedClusters.length}/{clusters.length})</label>
            <div className="cluster-pills">
              {clusters.map(cluster => (
                <button
                  key={cluster.id}
                  className={`cluster-pill ${selectedClusters.includes(cluster.id) ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedClusters(prev =>
                      prev.includes(cluster.id)
                        ? prev.filter(id => id !== cluster.id)
                        : [...prev, cluster.id]
                    );
                  }}
                >
                  {cluster.name}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <label>📦 Namespace</label>
            <input
              type="text"
              value={namespace}
              onChange={e => setNamespace(e.target.value)}
              placeholder="flux-system, default, kube-system..."
            />
          </div>

          <div className="filter-section">
            <label>🏷️ Label Selector</label>
            <input
              type="text"
              value={labelSelector}
              onChange={e => setLabelSelector(e.target.value)}
              placeholder="app=controller, tier=backend..."
            />
          </div>

          <div className="filter-section">
            <label>📜 Lines to Tail</label>
            <select value={tailLines} onChange={e => setTailLines(Number(e.target.value))}>
              <option value={50}>Last 50 lines</option>
              <option value={100}>Last 100 lines</option>
              <option value={200}>Last 200 lines</option>
              <option value={500}>Last 500 lines</option>
              <option value={1000}>Last 1000 lines</option>
            </select>
          </div>
        </div>
      </details>

      {error && <div className="error-banner">{error}</div>}

      {/* Results Summary */}
      <div className="results-summary">
        <span className="results-count">
          📋 <strong>{filteredLogs.length}</strong> events {logs.length !== filteredLogs.length && `(filtered from ${logs.length})`}
        </span>
        {loading && <span className="loading-spinner">⏳ Loading...</span>}
        {selectedClusters.length === 0 && (
          <span className="warning-text">⚠️ Select at least one cluster</span>
        )}
      </div>

      {/* Logs Display */}
      <div className="logs-viewer">
        {filteredLogs.length === 0 && !loading && (
          <div className="no-logs">
            {selectedClusters.length === 0 ? (
              <div>
                <div className="empty-icon">🎯</div>
                <h3>Select Clusters to Start</h3>
                <p>Choose one or more clusters from the filters above and click Search</p>
              </div>
            ) : logs.length === 0 ? (
              <div>
                <div className="empty-icon">📭</div>
                <h3>No Logs Found</h3>
                <ul className="suggestions">
                  <li>✓ Verify the namespace exists (current: <code>{namespace || 'all'}</code>)</li>
                  <li>✓ Check label selector syntax</li>
                  <li>✓ Ensure pods are running in the namespace</li>
                  <li>✓ Try increasing tail lines or removing filters</li>
                </ul>
              </div>
            ) : (
              <div>
                <div className="empty-icon">🔍</div>
                <h3>No Matching Logs</h3>
                <p>No logs match your search or filter criteria</p>
                {searchTerm && <p>Search term: <code>{searchTerm}</code></p>}
              </div>
            )}
          </div>
        )}

        {viewMode === 'table' && filteredLogs.length > 0 && (
          <div className="logs-table-container">
            <table className="logs-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th style={{ width: '180px' }}>Time</th>
                  <th style={{ width: '80px' }}>Level</th>
                  <th style={{ width: '120px' }}>Cluster</th>
                  <th style={{ width: '120px' }}>Namespace</th>
                  <th style={{ width: '200px' }}>Pod</th>
                  <th>Message</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, index) => (
                  <React.Fragment key={index}>
                    <tr className={`log-row level-${log.level}`}>
                      <td>
                        <button
                          className="expand-btn"
                          onClick={() => toggleRowExpansion(index)}
                          title={expandedRows.has(index) ? 'Collapse' : 'Expand'}
                        >
                          {expandedRows.has(index) ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="timestamp">
                        {log.parsedTime.toLocaleTimeString('en-US', { 
                          hour12: false, 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          second: '2-digit'
                        })}
                      </td>
                      <td>
                        <span className={`level-indicator level-${log.level}`}>
                          {log.level?.toUpperCase() || 'INFO'}
                        </span>
                      </td>
                      <td className="cluster-cell" title={log.cluster_name}>
                        {log.cluster_name}
                      </td>
                      <td className="namespace-cell" title={log.namespace}>
                        {log.namespace}
                      </td>
                      <td className="pod-cell" title={log.pod_name}>
                        {log.pod_name.length > 30 
                          ? log.pod_name.substring(0, 27) + '...' 
                          : log.pod_name}
                      </td>
                      <td className="message-cell">
                        <div className="message-preview">
                          {highlightSearch(
                            log.message.length > 200 
                              ? log.message.substring(0, 200) + '...' 
                              : log.message
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          className="action-btn"
                          onClick={() => copyToClipboard(log.message)}
                          title="Copy message"
                        >
                          📋
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(index) && (
                      <tr className="expanded-row">
                        <td></td>
                        <td colSpan={7}>
                          <div className="log-details">
                            <div className="detail-section">
                              <strong>Full Message:</strong>
                              <pre className="log-message-full">{log.message}</pre>
                            </div>
                            <div className="detail-grid">
                              <div className="detail-item">
                                <span className="detail-label">Container:</span>
                                <span className="detail-value">{log.container}</span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-label">Cluster ID:</span>
                                <span className="detail-value">{log.cluster_id}</span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-label">Timestamp:</span>
                                <span className="detail-value">{log.timestamp}</span>
                              </div>
                            </div>
                            {Object.keys(log.fields).length > 0 && (
                              <div className="detail-section">
                                <strong>Extracted Fields:</strong>
                                <div className="fields-grid">
                                  {Object.entries(log.fields).map(([key, value]) => (
                                    <div key={key} className="field-item">
                                      <span className="field-key">{key}:</span>
                                      <span className="field-value">{value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === 'raw' && filteredLogs.length > 0 && (
          <div className="logs-raw-container">
            {filteredLogs.map((log, index) => (
              <div key={index} className={`log-raw-entry level-${log.level}`}>
                <span className="log-time">{log.parsedTime.toISOString()}</span>
                <span className={`log-level-badge level-${log.level}`}>{log.level?.toUpperCase()}</span>
                <span className="log-source">[{log.cluster_name}/{log.namespace}/{log.pod_name}]</span>
                <span className="log-raw-message">{highlightSearch(log.message)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogAggregation;
