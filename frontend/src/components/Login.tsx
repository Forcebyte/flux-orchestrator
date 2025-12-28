import React, { useEffect, useState } from 'react';
import { fluxApi } from '../api';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = () => {
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Check for error parameter in URL
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        invalid_state: 'Invalid OAuth state. Please try again.',
        state_mismatch: 'OAuth state mismatch. Please try again.',
        token_exchange_failed: 'Failed to exchange OAuth token. Please try again.',
        user_info_failed: 'Failed to retrieve user information.',
        unauthorized: 'You are not authorized to access this application.',
        session_failed: 'Failed to create session. Please try again.',
      };
      
      setError(errorMessages[errorParam] || 'An unknown error occurred during login.');
      
      // Clear the error from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleLogin = async () => {
    try {
      // Redirect to backend OAuth flow
      if (fluxApi.axios) {
        window.location.href = `${fluxApi.axios.defaults.baseURL}/auth/login`;
      }
    } catch (err) {
      setError('Failed to initiate login');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <div style={{
        background: 'white',
        padding: '3rem',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Flux Orchestrator
        </h1>
        <p style={{
          color: '#6b7280',
          marginBottom: '2rem',
        }}>
          Sign in to manage your Flux resources
        </p>

        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #ef4444',
            color: '#991b1b',
            padding: '0.75rem',
            borderRadius: '6px',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          style={{
            width: '100%',
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Sign in with OAuth
        </button>

        <p style={{
          marginTop: '1.5rem',
          fontSize: '0.875rem',
          color: '#9ca3af',
        }}>
          Supports GitHub and Microsoft Entra (Azure AD)
        </p>
      </div>
    </div>
  );
};
