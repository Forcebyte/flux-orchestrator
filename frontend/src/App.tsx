import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import Dashboard from './components/Dashboard';
import Clusters from './components/Clusters';
import ClusterDetail from './components/ClusterDetail';
import Settings from './components/Settings';
import { Login } from './components/Login';
import './App.css';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user, authEnabled, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo-container">
          <img src="/flux-logo.png" alt="Flux Logo" className="sidebar-logo" />
        </div>
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
        <Link
          to="/settings"
          className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
        >
          Settings
        </Link>
        <button
          onClick={toggleDarkMode}
          className="nav-item"
          style={{ border: 'none', background: 'transparent', textAlign: 'left', width: '100%' }}
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? '☀️' : '🌙'} {darkMode ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>
      {authEnabled && user && (
        <div style={{
          marginTop: 'auto',
          padding: '1rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
            Signed in as
          </div>
          <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
            {user.name || user.username}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
            {user.email}
          </div>
          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: '0.5rem',
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, authEnabled, checkAuth } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '1.5rem',
      }}>
        Loading...
      </div>
    );
  }

  if (authEnabled && !isAuthenticated) {
    return <Login onLoginSuccess={checkAuth} />;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clusters" element={<Clusters />} />
          <Route path="/clusters/:id" element={<ClusterDetail />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
