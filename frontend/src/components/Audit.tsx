import React from 'react';
import ActivityFeed from './ActivityFeed';
import '../styles/Dashboard.css';

const Audit: React.FC = () => {
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h2>📝 Audit Activity</h2>
          <p>Recent actions across clusters and resources</p>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-card">
          <ActivityFeed limit={100} />
        </div>
      </div>
    </div>
  );
};

export default Audit;
