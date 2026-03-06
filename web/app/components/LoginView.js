'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  card: {
    width: '100%',
    maxWidth: '360px',
    background: '#1a1a1a',
    borderRadius: '12px',
    padding: '2rem',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  },
  title: { margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 600 },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  error: {
    padding: '0.5rem',
    background: 'rgba(220, 80, 80, 0.2)',
    borderRadius: '6px',
    color: '#f88',
    fontSize: '0.9rem',
  },
  input: {
    padding: '0.75rem 1rem',
    border: '1px solid #333',
    borderRadius: '8px',
    background: '#0f0f0f',
    color: '#e4e4e4',
  },
  button: {
    padding: '0.75rem 1rem',
    border: 'none',
    borderRadius: '8px',
    background: '#3b82f6',
    color: '#fff',
    fontWeight: 600,
  },
};

export default function LoginView() {
  const router = useRouter();
  const [from, setFrom] = useState('/app');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFrom(new URLSearchParams(window.location.search).get('from') || '/app');
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      window.dispatchEvent(new CustomEvent('route-change', { detail: from }));
      router.push(from);
      router.refresh();
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Login</h1>
        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={styles.input}
          />
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
