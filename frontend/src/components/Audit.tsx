import React from 'react';
import ActivityFeed from './ActivityFeed';
import '../styles/Dashboard.css';

const Audit: React.FC = () => {
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>📝 Audit Activity</h2>
        <p className="header-subtitle">Recent actions across clusters and resources</p>
      </div>

      <div className="dashboard-card">
        <ActivityFeed limit={100} />
      </div>
    </div>
  );
};

export default Audit;
