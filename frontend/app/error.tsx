'use client';

/**
 * App-level error boundary: catches render errors anywhere in the page tree
 * under the root layout (any route that doesn't define its own error.tsx).
 * Guarantees the dashboard degrades to a friendly, recoverable screen rather
 * than a blank page.
 */

import { useEffect } from 'react';
import Link from 'next/link';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <div className="card border-red-200 bg-red-50">
        <h1 className="text-red-800 font-semibold text-lg">
          Something went wrong
        </h1>
        <p className="text-red-600 text-sm mt-2">
          An unexpected error occurred. Try again, or return to the home page.
        </p>
        {error?.digest ? (
          <p className="text-red-400 text-xs mt-2">Reference: {error.digest}</p>
        ) : null}
        <div className="flex flex-wrap gap-3 mt-5">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="btn btn-outline">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
