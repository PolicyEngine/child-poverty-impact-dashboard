import type { Metadata } from 'next';
import ReportResultsPage from './ResultsClient';
import { SHARE_PARAM, decodeReportConfig } from '@/lib/share-link';
import { US_STATES } from '@/lib/household-types';

const DEFAULT_TITLE = 'Report Results';
const DEFAULT_DESCRIPTION =
  'View your child poverty impact report results including poverty reduction, fiscal costs, and distributional analysis from PolicyEngine microsimulation.';

interface SharedConfig {
  states?: string[];
  state?: string;
  year?: number | null;
  reformLabels?: string[];
  selectedReforms?: string[];
}

/** Deep links carry the encoded report config, so shared URLs can unfurl
 *  with the actual reform and state instead of a generic page title. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const raw = params[SHARE_PARAM];
  const encoded = typeof raw === 'string' ? raw : undefined;
  const config = encoded ? decodeReportConfig<SharedConfig>(encoded) : null;

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  if (config) {
    const states = (config.states?.length ? config.states : [config.state]).filter(
      (s): s is string => !!s,
    );
    const stateNames = states.map((s) => US_STATES[s] ?? s);
    const where =
      stateNames.length === 0
        ? ''
        : stateNames.length <= 2
          ? stateNames.join(' & ')
          : `${stateNames.length} states`;
    const year = config.year ? ` (${config.year})` : '';
    const reforms = config.reformLabels?.length
      ? config.reformLabels.join('; ')
      : config.selectedReforms?.length
        ? `${config.selectedReforms.length} reform(s)`
        : 'Baseline';
    if (where) {
      title = `${where}${year}: ${reforms}`;
      description = `Child poverty impact of ${reforms} in ${where}${year} — poverty reduction, fiscal cost, and distributional effects from PolicyEngine microsimulation.`;
    }
  }

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary', title, description },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default function Page() {
  return <ReportResultsPage />;
}
