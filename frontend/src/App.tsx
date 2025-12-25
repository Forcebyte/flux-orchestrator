import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Clusters from './components/Clusters';
import ClusterDetail from './components/ClusterDetail';
import './App.css';

const Sidebar: React.FC = () => {
  const location = useLocation();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>Flux Orchestrator</h1>
        <p>Multi-Cluster GitOps</p>
      </div>
      <div className="sidebar-nav">
        <Link
          to="/"
          className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
        >
          Dashboard
        </Link>
        <Link
          to="/clusters"
          className={`nav-item ${location.pathname.startsWith('/clusters') ? 'active' : ''}`}
        >
          Clusters
        </Link>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clusters" element={<Clusters />} />
            <Route path="/clusters/:id" element={<ClusterDetail />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
