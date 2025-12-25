import React, { useState, useEffect } from 'react';
import { resourceApi } from '../api';
import { FluxResource } from '../types';

const Dashboard: React.FC = () => {
  const [resources, setResources] = useState<FluxResource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResources();
    const interval = setInterval(loadResources, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadResources = async () => {
    try {
      const response = await resourceApi.listAll();
      setResources(response.data);
    } catch (error) {
      console.error('Failed to load resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupedByCluster = resources.reduce((acc, r) => {
    if (!acc[r.cluster_id]) {
      acc[r.cluster_id] = [];
    }
    acc[r.cluster_id].push(r);
    return acc;
  }, {} as Record<string, FluxResource[]>);

  const stats = {
    total: resources.length,
    ready: resources.filter(r => r.status === 'Ready').length,
    notReady: resources.filter(r => r.status === 'NotReady').length,
    unknown: resources.filter(r => r.status === 'Unknown').length,
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div>
      <div className="header">
        <h2>Dashboard</h2>
        <p style={{ color: '#718096', marginTop: '5px' }}>
          Overview of all Flux resources across clusters
        </p>
      </div>

      <div className="content">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          <div className="card">
            <h3 style={{ fontSize: '16px', color: '#718096' }}>Total Resources</h3>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2d3748', marginTop: '10px' }}>
              {stats.total}
            </div>
          </div>
          <div className="card">
            <h3 style={{ fontSize: '16px', color: '#718096' }}>Ready</h3>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#48bb78', marginTop: '10px' }}>
              {stats.ready}
            </div>
          </div>
          <div className="card">
            <h3 style={{ fontSize: '16px', color: '#718096' }}>Not Ready</h3>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f56565', marginTop: '10px' }}>
              {stats.notReady}
            </div>
          </div>
          <div className="card">
            <h3 style={{ fontSize: '16px', color: '#718096' }}>Unknown</h3>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#cbd5e0', marginTop: '10px' }}>
              {stats.unknown}
            </div>
          </div>
        </div>

        {Object.entries(groupedByCluster).map(([clusterId, clusterResources]) => (
          <div key={clusterId} className="card">
            <h3>Cluster: {clusterId}</h3>
            <div className="grid">
              {clusterResources.map((resource) => (
                <div key={resource.id} className="resource-card">
                  <h4>{resource.name}</h4>
                  <div className="resource-info">
                    <span className="resource-meta">
                      {resource.kind} • {resource.namespace}
                    </span>
                    <span className={`status-badge status-${resource.status.toLowerCase()}`}>
                      {resource.status}
                    </span>
                  </div>
                  {resource.message && (
                    <div style={{ fontSize: '12px', color: '#718096', marginTop: '8px' }}>
                      {resource.message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {resources.length === 0 && (
          <div className="empty-state">
            <h3>No Resources Found</h3>
            <p>Add a cluster and sync to see Flux resources</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
