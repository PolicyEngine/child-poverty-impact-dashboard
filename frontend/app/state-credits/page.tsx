import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'State EITCs & CTCs Map',
  description:
    'Interactive map of existing state earned income tax credits and child tax credits, showing each program’s cost and poverty impact by state and congressional district.',
  alternates: {
    canonical: '/state-credits',
  },
  openGraph: {
    title: 'State EITCs & CTCs Map | Child Poverty Impact Dashboard',
    description:
      'Interactive map of existing state earned income tax credits and child tax credits, showing each program’s cost and poverty impact by state and congressional district.',
    url: '/state-credits',
  },
};

const TOOL_URL = 'https://policyengine.github.io/us-state-eitcs-ctcs/';

export default function StateCreditsPage() {
  return (
    <article className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      <Link
        href="/"
        className="text-pe-gray-500 hover:text-pe-teal-600 text-sm inline-flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Home
      </Link>
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Existing state EITCs and CTCs
        </h1>
        <p className="text-gray-600">
          The credits states already have on the books &mdash; and what they do
          for poverty &mdash; before you model changes to them.
        </p>
      </div>

      <section className="card" aria-labelledby="map-context-heading">
        <h2 id="map-context-heading" className="section-title">
          How to read this map
        </h2>
        <p className="text-gray-700 leading-relaxed">
          PolicyEngine&apos;s state tax credits tool estimates the impact of each
          state&apos;s existing earned income tax credit and child tax credit by
          simulating their repeal: the difference between current law and a
          no-credit counterfactual gives each program&apos;s cost and its effect on
          poverty and child poverty. Estimates come from the same PolicyEngine US
          microsimulation model and state-calibrated Current Population Survey
          data that power this dashboard, at state and congressional-district
          resolution.
        </p>
        <p className="text-gray-700 leading-relaxed mt-3">
          These existing credits are the baseline that the{' '}
          <a href="/report" className="text-pe-teal-600 hover:underline">
            Build Report
          </a>{' '}
          page starts from &mdash; reforms you model there (raising a match,
          adding refundability, reviving an expired credit) are changes relative
          to what this map shows.
        </p>
      </section>

      <section aria-label="Interactive state credits map">
        <div className="card p-0 overflow-hidden">
          <iframe
            src={TOOL_URL}
            title="State EITCs and CTCs interactive map"
            className="w-full border-0"
            style={{ height: 'min(85vh, 900px)' }}
            loading="lazy"
          />
        </div>
        <p className="text-sm text-pe-gray-500 mt-3 text-center">
          Embedded from PolicyEngine&apos;s{' '}
          <a
            href={TOOL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pe-teal-600 hover:underline"
          >
            state tax credits tool
          </a>{' '}
          (also on{' '}
          <a
            href="https://policyengine.org/us/state-eitcs-ctcs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pe-teal-600 hover:underline"
          >
            policyengine.org
          </a>
          ). Source and methodology:{' '}
          <a
            href="https://github.com/PolicyEngine/us-state-eitcs-ctcs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pe-teal-600 hover:underline"
          >
            PolicyEngine/us-state-eitcs-ctcs
          </a>
          .
        </p>
      </section>
    </article>
  );
}
