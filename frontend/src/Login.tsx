import React, { useState } from 'react';
import { Sparkles, User, Lock, ArrowRight, Loader2 } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string) => void;
}

const API = 'http://127.0.0.1:8000/api';

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isRegistering) {
        // Register flow
        const regRes = await fetch(`${API}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        if (!regRes.ok) {
          const errData = await regRes.json();
          throw new Error(errData.detail || 'Registration failed');
        }
      }

      // Login flow (always runs after successful register, or directly)
      const loginRes = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!loginRes.ok) {
        const errData = await loginRes.json();
        throw new Error(errData.detail || 'Invalid username or password');
      }

      const data = await loginRes.json();
      onLoginSuccess(data.access_token);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Background elements matched from Landing */}
      <div className="poly-bg-wrapper">
        <div className="poly-glow" />
        <div className="poly-shape poly-1" />
        <div className="poly-shape poly-2" />
        <div className="poly-shape poly-3" />
        <div className="poly-shape poly-4" />
        <div className="poly-shape poly-5" />
      </div>

      <div className="login-box">
        <div className="login-header">
          <h2>Astro AI</h2>
          <p>{isRegistering ? 'Create your isolated workspace' : 'Welcome back to your workspace'}</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <User size={18} className="input-icon" />
            <input 
              type="text" 
              placeholder="Username or Workspace ID" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>
          
          <div className="input-group">
            <Lock size={18} className="input-icon" />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? <Loader2 className="spinning" size={20} /> : (isRegistering ? 'Create Workspace' : 'Sign In')}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="login-footer">
          {isRegistering ? 'Already have a workspace?' : "Don't have a workspace?"}
          <button type="button" className="toggle-mode-btn" onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? 'Sign In' : 'Create one now'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
