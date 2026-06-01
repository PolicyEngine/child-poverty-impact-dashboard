import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Compare States',
  description:
    'Compare how policy reforms affect child poverty rates across different US states. Analyze CTC expansions, EITC changes, and more with state-by-state rankings.',
  alternates: {
    canonical: '/report',
  },
};

// State comparison now lives inside the report wizard — pick two or more
// states in the first step and the results page shows the Compare tab.
// The standalone /compare page used the legacy FastAPI backend and never
// got wired to Modal, so redirect rather than ship a broken surface.
export default function Page() {
  redirect('/report');
}
