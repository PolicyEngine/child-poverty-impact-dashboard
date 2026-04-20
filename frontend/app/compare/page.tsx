import type { Metadata } from 'next';
import ComparePage from './CompareClient';

export const metadata: Metadata = {
  title: 'Compare States',
  description:
    'Compare how policy reforms affect child poverty rates across different US states. Analyze CTC expansions, EITC changes, and more with state-by-state rankings.',
  alternates: {
    canonical: '/compare',
  },
  openGraph: {
    title: 'Compare States | Child Poverty Impact Dashboard',
    description:
      'Compare how policy reforms affect child poverty rates across different US states with state-by-state rankings.',
    url: '/compare',
  },
};

export default function Page() {
  return <ComparePage />;
}
