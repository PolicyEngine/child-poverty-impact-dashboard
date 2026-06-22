'use client';

/**
 * Last-resort boundary that wraps the root layout itself. Only fires if the
 * root layout (or something it renders before the page tree) throws — the
 * one case app/error.tsx can't catch. Must render its own <html>/<body>.
 */

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          maxWidth: 640,
          margin: '0 auto',
          padding: '4rem 1rem',
          color: '#7f1d1d',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
          Something went wrong
        </h1>
        <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
          The dashboard failed to load. Please try again.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: '1.25rem',
            padding: '0.625rem 1.25rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: '#0d9488',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
