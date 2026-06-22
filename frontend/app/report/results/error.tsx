'use client';

/**
 * Error boundary for the impact/results route. Async compute failures are
 * already caught per-tab in ResultsClient (rendered as TabError), so this
 * catches the remaining failure mode: an unexpected *synchronous render*
 * error in a results tab. Instead of a blank screen the user gets a friendly
 * card and can retry or go back to adjust their selection.
 */

import { useEffect } from 'react';
import Link from 'next/link';

export default function ResultsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Results page render error:', error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <div className="card border-red-200 bg-red-50">
        <h1 className="text-red-800 font-semibold text-lg">
          Something went wrong displaying these results
        </h1>
        <p className="text-red-600 text-sm mt-2">
          The impact analysis couldn&apos;t be rendered. This is usually
          temporary — try again, or go back and adjust your reform selection.
        </p>
        {error?.digest ? (
          <p className="text-red-400 text-xs mt-2">Reference: {error.digest}</p>
        ) : null}
        <div className="flex flex-wrap gap-3 mt-5">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/report" className="btn btn-outline">
            Back to reform builder
          </Link>
        </div>
      </div>
    </div>
  );
}
