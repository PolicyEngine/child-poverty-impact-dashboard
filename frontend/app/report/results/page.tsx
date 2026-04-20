import type { Metadata } from 'next';
import ReportResultsPage from './ResultsClient';

export const metadata: Metadata = {
  title: 'Report Results',
  description:
    'View your child poverty impact report results including poverty reduction, fiscal costs, and distributional analysis from PolicyEngine microsimulation.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function Page() {
  return <ReportResultsPage />;
}
