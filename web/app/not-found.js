export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem' }}>404</h1>
      <p style={{ margin: 0, color: '#888' }}>Page not found</p>
      <a href="/login" style={{ color: '#7cb3ff' }}>Return to login</a>
    </div>
  );
}
