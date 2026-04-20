import type { Metadata } from 'next';
import AnalyzePage from './AnalyzeClient';

export const metadata: Metadata = {
  title: 'Policy Impact Analysis',
  description:
    'Enter your household details and explore how Child Tax Credit, EITC, SNAP, and other policy reforms could affect your family across US states.',
  alternates: {
    canonical: '/analyze',
  },
  openGraph: {
    title: 'Policy Impact Analysis | Child Poverty Impact Dashboard',
    description:
      'Enter your household details and explore how policy reforms could affect your family.',
    url: '/analyze',
  },
};

export default function Page() {
  return <AnalyzePage />;
}
