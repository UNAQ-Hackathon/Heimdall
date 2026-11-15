import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        padding: '32px',
        background: '#060a14',
        color: '#e2e8f0',
        textAlign: 'center',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: '#38bdf8',
          letterSpacing: '0.8px',
        }}
      >
        HEIMDALL NAVIGATION // 404
      </span>
      <h1 style={{ margin: 0, fontSize: '24px', color: '#f8fafc' }}>Route Not Found</h1>
      <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', maxWidth: '46ch' }}>
        The requested view does not exist. Return to Mission Hub, PSI Catalog, or FireHazR Lab.
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
        <Link
          to="/"
          style={{
            padding: '8px 14px',
            borderRadius: '7px',
            border: '1px solid #1e293b',
            background: '#0d1321',
            color: '#e2e8f0',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Mission Hub
        </Link>
        <Link
          to="/studies"
          style={{
            padding: '8px 14px',
            borderRadius: '7px',
            border: '1px solid rgba(56, 189, 248, 0.45)',
            background: 'rgba(56, 189, 248, 0.14)',
            color: '#bae6fd',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          PSI Catalog →
        </Link>
        <Link
          to="/flame"
          style={{
            padding: '8px 14px',
            borderRadius: '7px',
            border: '1px solid #1e293b',
            background: '#0d1321',
            color: '#e2e8f0',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          FireHazR Lab
        </Link>
      </div>
    </div>
  );
}
