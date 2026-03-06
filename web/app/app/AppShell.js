'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const loadingFallback = (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
    Loading…
  </div>
);


export default function AppShell({ children }) {
  const router = useRouter();
  const [currentThreadId, setCurrentThreadId] = useState(null);
  const [user, setUser] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      setCurrentThreadId(new URLSearchParams(window.location.search).get('thread'));
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    (async () => {
      try {
        const [meRes, threadsRes] = await Promise.all([
          fetch('/api/auth/me', { credentials: 'include' }),
          fetch('/api/threads', { credentials: 'include' }),
        ]);
        const meData = await meRes.json();
        if (meRes.status === 401 || !meData.user) {
          router.replace('/login');
          return;
        }
        setUser(meData.user);
        const threadsData = await threadsRes.json();
        setThreads(threadsData.threads || []);
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router, mounted]);

  useEffect(() => {
    const handler = () => refreshThreads();
    window.addEventListener('refresh-threads', handler);
    return () => window.removeEventListener('refresh-threads', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => setCurrentThreadId(e.detail ?? null);
    window.addEventListener('thread-nav', handler);
    return () => window.removeEventListener('thread-nav', handler);
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.dispatchEvent(new CustomEvent('route-change', { detail: '/login' }));
    router.replace('/login');
    router.refresh();
  }

  function refreshThreads() {
    fetch('/api/threads', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setThreads(d.threads || []))
      .catch(() => { });
  }

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  }

  async function deleteThread(e, id) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat?')) return;
    try {
      await fetch(`/api/threads/${id}`, { method: 'DELETE', credentials: 'include' });
      const current = new URLSearchParams(window.location.search).get('thread');
      if (current === id) {
        window.dispatchEvent(new CustomEvent('route-change', { detail: '/app' }));
        window.dispatchEvent(new CustomEvent('thread-nav', { detail: null }));
        window.history.replaceState(null, '', `/app`);
      }
      refreshThreads();
    } catch (_) { }
  }

  if (!mounted || loading) {
    return loadingFallback;
  }

  return (
    <div style={styles.wrapper}>
      {/* Mobile Overlay */}
      <div
        className={`mobile-sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar-container ${sidebarOpen ? 'open' : ''}`} style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.logo}>Multi-LLM</span>
          <Link
            href="/app"
            style={styles.newChatBtn}
            onClick={() => {
              setSidebarOpen(false);
              window.dispatchEvent(new CustomEvent('route-change', { detail: '/app' }));
              window.dispatchEvent(new CustomEvent('thread-nav', { detail: null }));
            }}
          >
            + New chat
          </Link>
        </div>
        <nav style={styles.threadList}>
          {threads.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
              <Link
                href={`/app?thread=${t.id}`}
                onClick={() => {
                  setSidebarOpen(false);
                  window.dispatchEvent(new CustomEvent('thread-nav', { detail: t.id }));
                }}
                style={{
                  ...styles.threadItem,
                  ...(currentThreadId === t.id ? styles.threadItemActive : {}),
                }}
              >
                <div style={styles.threadTitle}>{t.title || 'Chat'}</div>
                <div style={styles.threadDate} suppressHydrationWarning>
                  {t.updated_at ? new Date(t.updated_at).toLocaleDateString('en-US') : ''}
                </div>
              </Link>
              <button onClick={(e) => deleteThread(e, t.id)} style={styles.deleteBtn} title="Delete">
                🗑️
              </button>
            </div>
          ))}
        </nav>
        <div style={styles.sidebarFooter}>
          <span style={styles.userEmail}>{user?.username || user?.email}</span>
          <div className="sidebar-buttons" style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button type="button" onClick={toggleTheme} className="sidebar-btn" style={styles.footerBtn}>
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
            <button type="button" onClick={logout} className="sidebar-btn" style={styles.footerBtn}>
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        {/* Mobile Hamburger Header */}
        <div className="mobile-header" style={{ display: 'none' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', fontSize: '24px', cursor: 'pointer', marginRight: '16px' }}
          >
            ☰
          </button>
          <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Multi-LLM</span>
        </div>

        {children}
      </main>
    </div>
  );
}

const styles = {
  wrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    overflow: 'hidden',
    background: 'var(--bg-color)',
    color: 'var(--text-color)',
  },
  sidebar: {
    width: '260px',
    minWidth: '260px',
    background: 'var(--sidebar-bg)',
    borderRight: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarHeader: {
    padding: '1rem',
    borderBottom: '1px solid var(--border-color)',
  },
  logo: {
    fontWeight: 700,
    fontSize: '1.1rem',
    display: 'block',
    marginBottom: '0.75rem',
  },
  newChatBtn: {
    display: 'block',
    padding: '0.5rem 0.75rem',
    background: 'var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-color)',
    textAlign: 'center',
    fontSize: '0.9rem',
  },
  threadList: {
    flex: 1,
    overflow: 'auto',
    padding: '0.5rem',
  },
  threadItem: {
    flex: 1,
    display: 'block',
    padding: '0.6rem 0.75rem',
    borderRadius: '8px',
    color: 'var(--thread-text)',
    overflow: 'hidden',
  },
  threadItemActive: {
    background: 'var(--thread-hover)',
    color: 'var(--text-color)',
  },
  threadTitle: {
    display: 'block',
    fontSize: '0.9rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  threadDate: {
    fontSize: '0.75rem',
    color: 'var(--thread-text)',
    opacity: 0.8,
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--thread-text)',
    padding: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    opacity: 0.6,
  },
  sidebarFooter: {
    padding: '1rem',
    borderTop: '1px solid var(--border-color)',
  },
  userEmail: {
    fontSize: '0.8rem',
    color: 'var(--thread-text)',
    display: 'block',
  },
  footerBtn: {
    flex: 1,
    background: 'transparent',
    border: '1px solid var(--border-color)',
    color: 'var(--text-color)',
    padding: '0.5rem',
    borderRadius: '6px',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  },
};
