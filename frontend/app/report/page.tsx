import type { Metadata } from 'next';
import ReportBuilderPage from './ReportClient';

export const metadata: Metadata = {
  title: 'Build Report',
  description:
    'Configure a custom child poverty impact report. Select a state, household details, and policy reforms to analyze with PolicyEngine microsimulation.',
  alternates: {
    canonical: '/report',
  },
  openGraph: {
    title: 'Build Report | Child Poverty Impact Dashboard',
    description:
      'Configure a custom child poverty impact report by selecting a state, household details, and policy reforms.',
    url: '/report',
  },
};

export default function Page() {
  return <ReportBuilderPage />;
}
