import type { Metadata } from 'next';
import HomePage from './HomeClient';

export const metadata: Metadata = {
  title: 'Child Poverty Impact Dashboard | PolicyEngine',
  description:
    'Explore how CTC expansions, EITC reforms, SNAP changes, and state programs reduce child poverty across all 50 US states. Powered by PolicyEngine microsimulation.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Child Poverty Impact Dashboard | PolicyEngine',
    description:
      'Explore how CTC expansions, EITC reforms, SNAP changes, and state programs reduce child poverty across all 50 US states.',
    url: '/',
  },
};

export default function Page() {
  return <HomePage />;
}
