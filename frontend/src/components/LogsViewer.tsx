import React, { useState, useEffect } from 'react';
import { resourceApi } from '../api';
import '../styles/LogsViewer.css';

interface LogsViewerProps {
  clusterId: string;
  namespace: string;
  podName: string;
  onClose: () => void;
}

const LogsViewer: React.FC<LogsViewerProps> = ({ clusterId, namespace, podName, onClose }) => {
  const [logs, setLogs] = useState<string>('');
  const [containers, setContainers] = useState<string[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [tailLines, setTailLines] = useState<number>(1000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchContainers = async () => {
    try {
      const response = await resourceApi.getPodContainers(clusterId, namespace, podName);
      setContainers(response.data.containers);
      if (response.data.containers.length > 0 && !selectedContainer) {
        setSelectedContainer(response.data.containers[0]);
      }
    } catch (err: any) {
      console.error('Failed to fetch containers:', err);
    }
  };

  const fetchLogs = async () => {
    if (!selectedContainer) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await resourceApi.getPodLogs(
        clusterId,
        namespace,
        podName,
        selectedContainer,
        tailLines
      );
      setLogs(response.data.logs || '(No logs available)');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch logs');
      setLogs('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
  }, [clusterId, namespace, podName]);

  useEffect(() => {
    if (selectedContainer) {
      fetchLogs();
    }
  }, [selectedContainer, tailLines]);

  useEffect(() => {
    if (autoRefresh && selectedContainer) {
      const interval = setInterval(() => {
        fetchLogs();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedContainer, tailLines]);

  const handleDownload = () => {
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${podName}-${selectedContainer}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="logs-viewer-overlay" onClick={onClose}>
      <div className="logs-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="logs-header">
          <h3>Pod Logs: {podName}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="logs-controls">
          <div className="control-group">
            <label>Container:</label>
            <select
              value={selectedContainer}
              onChange={(e) => setSelectedContainer(e.target.value)}
              disabled={loading}
            >
              {containers.map((container) => (
                <option key={container} value={container}>
                  {container}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>Tail Lines:</label>
            <select
              value={tailLines}
              onChange={(e) => setTailLines(Number(e.target.value))}
              disabled={loading}
            >
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={5000}>5000</option>
            </select>
          </div>

          <div className="control-group">
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh (5s)
            </label>
          </div>

          <button onClick={fetchLogs} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>

          <button onClick={handleDownload} disabled={!logs}>
            Download
          </button>
        </div>

        <div className="logs-content">
          {error && <div className="logs-error">{error}</div>}
          {loading && !logs ? (
            <div className="logs-loading">Loading logs...</div>
          ) : (
            <pre>{logs}</pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogsViewer;
