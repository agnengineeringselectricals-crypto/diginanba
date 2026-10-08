'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '80px auto', padding: 24 }}>
          <p style={{ fontWeight: 700 }}>DigiNanba</p>
          <h1>Something went wrong.</h1>
          <p>Please try again. If the problem continues, return to the marketplace.</p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ marginTop: 16, padding: '10px 16px', borderRadius: 8, border: 0, cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
