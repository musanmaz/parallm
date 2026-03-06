'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const LoginView = dynamic(() => import('./components/LoginView'), { ssr: false });
const ChatView = dynamic(() => import('./components/ChatView'), { ssr: false });
const AppShell = dynamic(() => import('./app/AppShell'), { ssr: false });

const LOADING = (
  <div
    id="app-loading"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      margin: 0,
    }}
  >
    Loading…
  </div>
);

export default function ClientRouter() {
  const router = useRouter();
  const [path, setPath] = useState(null);

  useEffect(() => {
    setPath(typeof window !== 'undefined' ? window.location.pathname : null);
  }, []);

  useEffect(() => {
    if (path === null) return;
    const onPop = () => setPath(window.location.pathname);
    const onRoute = (e) => setPath(e.detail || '/app');
    window.addEventListener('popstate', onPop);
    window.addEventListener('route-change', onRoute);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('route-change', onRoute);
    };
  }, [path]);

  useEffect(() => {
    if (path === null) return;
    if (path === '/register') {
      router.replace('/login');
      setPath('/login');
      return;
    }
    if (path !== '/login' && path !== '/app' && path !== '/') return;
    if (path === '/') {
      router.replace('/app');
      setPath('/app');
    }
  }, [path, router]);

  if (path === null) {
    return LOADING;
  }
  if (path === '/register') {
    return LOADING;
  }
  if (path === '/login') {
    return <LoginView />;
  }
  if (path === '/app') {
    return (
      <AppShell>
        <ChatView />
      </AppShell>
    );
  }
  return LOADING;
}
