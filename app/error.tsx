'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="wrap" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <div className="panel">
        <div className="eyebrow">Something went wrong</div>
        <h1>We could not load this page.</h1>
        <p className="muted">Please try again. If the problem continues, return to the DigiNanba marketplace.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
          <button className="btn primary" onClick={() => reset()}>Try again</button>
          <a className="btn" href="/">Back to DigiNanba</a>
        </div>
      </div>
    </main>
  );
}
