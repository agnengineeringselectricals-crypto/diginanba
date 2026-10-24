export default function Loading() {
  return (
    <main
      className="wrap"
      aria-busy="true"
      aria-live="polite"
      style={{ minHeight: '55vh', display: 'grid', alignContent: 'center', gap: 18 }}
    >
      <div className="panel" style={{ padding: 28, maxWidth: 760, width: '100%', margin: '0 auto' }}>
        <p className="eyebrow">DigiNanba</p>
        <h1 style={{ margin: '8px 0 10px', fontSize: 'clamp(24px, 4vw, 34px)' }}>
          Getting things ready…
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          Please wait while we load this page.
        </p>
        <div
          role="progressbar"
          aria-label="Loading page"
          aria-valuetext="Loading"
          style={{
            height: 6,
            marginTop: 24,
            borderRadius: 999,
            overflow: 'hidden',
            background: '#e8eaf0',
          }}
        >
          <div
            style={{
              height: '100%',
              width: '42%',
              borderRadius: 999,
              background: '#5b46f6',
              animation: 'diginanba-loading 1.4s ease-in-out infinite alternate',
            }}
          />
        </div>
        <style>{`
          @keyframes diginanba-loading {
            from { transform: translateX(0); }
            to { transform: translateX(130%); }
          }
          @media (prefers-reduced-motion: reduce) {
            [role="progressbar"] > div { animation: none !important; width: 100% !important; }
          }
        `}</style>
      </div>
    </main>
  );
}
