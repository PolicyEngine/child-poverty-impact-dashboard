import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About & Methodology',
  description:
    'Learn about the methodology, data sources, and available policy reforms in the Child Poverty Impact Dashboard powered by PolicyEngine microsimulation.',
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: 'About & Methodology | Child Poverty Impact Dashboard',
    description:
      'Learn about the methodology, data sources, and available policy reforms in the Child Poverty Impact Dashboard powered by PolicyEngine microsimulation.',
    url: '/about',
  },
};

export default function AboutPage() {
  return (
    <article className="max-w-4xl mx-auto space-y-8">
      <div>
        <Link
          href="/"
          className="text-pe-gray-500 hover:text-pe-teal-600 text-sm mb-2 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">About the Dashboard</h1>
        <p className="text-gray-600">
          Understanding the methodology and data behind our policy analysis
        </p>
      </div>

      <section className="card" aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="section-title">Overview</h2>
        <p className="text-gray-700 leading-relaxed">
          The Child Poverty Impact Dashboard is a specialized analytical interface that enables
          users to model and compare policy reforms aimed at reducing child poverty across all 50
          US states and the District of Columbia. The dashboard uses PolicyEngine&apos;s open-source
          microsimulation model to estimate the effects of various policy changes on child poverty
          rates, fiscal costs, and income distribution.
        </p>
      </section>

      <section className="card" aria-labelledby="reforms-heading">
        <h2 id="reforms-heading" className="section-title">Available Policy Reforms</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-800">Child Tax Credit (CTC)</h3>
            <p className="text-gray-600">
              Model variations in credit amounts, age eligibility (prenatal-3, 0-5, 0-17),
              income basis, phaseout structure, and refundability. Includes preset options
              like the 2021 expanded CTC and Romney&apos;s Family Security Act.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Earned Income Tax Credit (EITC)</h3>
            <p className="text-gray-600">
              Analyze individualization options, percentage expansions, and eligibility
              modifications including childless worker expansions and age limit changes.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">SNAP Modifications</h3>
            <p className="text-gray-600">
              Model benefit increases, eligibility expansions, asset test removal, and
              additional child allotments.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Universal Basic Income / Child Allowance</h3>
            <p className="text-gray-600">
              Create child allowance programs with various amounts, age eligibility,
              and optional income phaseouts.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">State CTCs</h3>
            <p className="text-gray-600">
              Adjust the 21 existing state Child Tax Credits (amounts, age limits,
              phase-outs, refundability), revive Idaho&apos;s expired credit, or create a
              new credit in any state.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">State EITCs</h3>
            <p className="text-gray-600">
              Adjust the 31 existing state Earned Income Tax Credits (match rates,
              refundability, structured credits like Washington&apos;s WFTC and
              Minnesota&apos;s Working Family Credit) or create one where none exists.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Dependent Exemptions & Credits</h3>
            <p className="text-gray-600">
              Adjust, age-restrict, or eliminate the per-dependent exemptions and
              credits in 26 states (including AGI-stepped schedules), plus
              Idaho&apos;s grocery credit.
            </p>
          </div>
        </div>
        <p className="text-gray-600 mt-4">
          PolicyEngine&apos;s{' '}
          <a
            href="https://www.policyengine.org/us/state-eitcs-ctcs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pe-teal-500 hover:underline"
          >
            state EITCs and CTCs map
          </a>{' '}
          shows the existing programs these reforms start from.
        </p>
      </section>

      <section className="card" aria-labelledby="methodology-heading">
        <h2 id="methodology-heading" className="section-title">Methodology</h2>
        <div className="space-y-4 text-gray-700">
          <p>
            <strong>Data Source:</strong> The dashboard runs on{' '}
            <a href="https://github.com/PolicyEngine/policyengine.py" className="text-pe-teal-500 hover:underline">policyengine.py</a>,
            whose release bundle pins the PolicyEngine US model version and certifies
            the dataset used for state and congressional-district analysis: the
            local-area release of{' '}
            <a href="https://github.com/PolicyEngine/microcosm" className="text-pe-teal-500 hover:underline">Microcosm</a>,
            PolicyEngine&apos;s calibrated national microdata (
            <a href="https://huggingface.co/datasets/policyengine/populace-us" className="text-pe-teal-500 hover:underline">policyengine/populace-us</a>
            , October 2026 release): about 1.6 million households on a hybrid survey
            spine (the CPS ASEC carrying detailed program and tax information, plus the
            2024 American Community Survey for local-area density), reweighted against
            about 4,800 administrative targets: IRS Statistics of Income totals by state
            (including federal EITC amounts), USDA SNAP benefits and caseloads, Medicaid
            enrollment, and state and congressional-district populations. One file
            covers all 50 states and DC; each analysis simulates exactly the selected
            state&apos;s households, chosen the way policyengine.py selects a state. The
            policyengine.py version, and with it the model version and dataset release,
            is pinned per deployment (shown at the backend&apos;s health endpoint) and
            bumped deliberately.
          </p>
          <p>
            <strong>Microsimulation:</strong> PolicyEngine&apos;s open-source tax-benefit
            model computes federal and state taxes and benefit programs for every
            household under current law and under your reform; every reported impact is
            the difference between those two simulations for the analysis year.
          </p>
          <p>
            <strong>Poverty Measurement:</strong> We use the Supplemental Poverty Measure
            (SPM), which accounts for geographic cost-of-living differences, taxes, and
            the value of government benefits. Statewide results set each
            household&apos;s SPM threshold from its county; following the Census
            Bureau&apos;s ACS method, people in group quarters (such as dormitories and
            nursing homes) are outside the measure. The household calculator asks only
            for a state, so it uses national SPM thresholds. State child-SPM rates for
            2024 match the Census Bureau&apos;s CPS-based state estimates at a median
            deviation of &minus;0.6%, though individual states can differ much more;
            see Validation below.
          </p>
          <p>
            <strong>Fiscal Cost:</strong> Costs are calculated as the difference in total
            government spending and tax revenue between baseline and reform scenarios,
            split into federal tax, state tax, and benefit-outlay components, with
            per-program attributions for the credits the dashboard models.
          </p>
        </div>
      </section>

      <section className="card" aria-labelledby="validation-heading">
        <h2 id="validation-heading" className="section-title">Validation</h2>
        <div className="space-y-4 text-gray-700">
          <p>
            The dataset is calibrated to IRS Statistics of Income totals by state,
            SNAP benefits and caseloads (USDA, FY2024), Medicaid enrollment, and state
            and congressional-district populations; its release diagnostics put 96% of
            its 4,765 targets within 10%. Our audit measures the state population fit at
            a median +0.9%. Each release is also scored against benchmarks it was{' '}
            <em>not</em> calibrated to, published on PolicyEngine&apos;s calibration
            dashboard.
          </p>
          <p>
            <strong>State child poverty:</strong> for 2024, the year the microdata
            represents, simulated state child-SPM rates match the Census
            Bureau&apos;s CPS-based state estimates (three-year average, 2023&ndash;2025)
            at a median <em>signed</em> deviation of &minus;0.6%; absolute per-state
            errors are larger, with 31 of 51 states within ±25% and real outliers beyond
            that. Against the ACS-based 2023 state table they run lower (median
            &minus;19.7%, 26 of 51 within ±25%), as ACS-based SPM rates run higher than
            CPS-based ones. The model projects child poverty rising after 2024 (from
            13.4% nationally in 2024 to 15.4% in 2026), so the dashboard&apos;s{' '}
            <em>2026</em> baseline rates run 8.8% below the ACS 2023 table at the
            median and 10.1% above the CPS three-year estimates. Individual states can
            deviate substantially in either direction (against the ACS table, Vermont,
            Delaware, and Missouri high; Arkansas, Montana, and Hawaii low).
          </p>
          <p>
            <strong>State credit costs (2026 vs official outlays):</strong> state EITC
            totals land at a median +2.6% of official figures (23 of 29 states within
            ±25%). State CTC totals run about two-fifths above official outlays (median
            +40.8%), chiefly because the model assumes full take-up of refundable child
            credits, where real-world participation among low- and no-liability filers
            runs roughly 50&ndash;75%; several benchmarks also predate recent program
            restructures.
          </p>
          <p>
            <strong>Model and dataset update (October 2026):</strong> the dashboard
            moved to policyengine.py, which pins PolicyEngine US 2.2.1 and the October
            2026 release of the local-area dataset (previously PolicyEngine US 1.825.2 on
            the August 2026 release). The newer model projects higher child poverty for
            2026 (15.4% nationally, from 13.1%) and larger effects for some reforms
            (restoring the 2021 Child Tax Credit: &minus;3.9 points of national child
            poverty in 2026, from &minus;3.5), so results from before the update are not
            comparable.
          </p>
          <p>
            <strong>Dataset transition (August 2026):</strong> the dashboard moved from
            an earlier 57,000-household file to the current 1.6-million-household
            dataset with exactly-calibrated federal credit surfaces. Reform impacts
            changed with the recalibration, generally toward smaller, better-anchored
            poverty effects (the earlier file concentrated credit-responsive households
            too heavily), so results predating the switch are not comparable.
          </p>
        </div>
      </section>

      <section className="card" aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="section-title">Key Metrics</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Poverty Impact</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Child poverty rate (ages 0-17)</li>
              <li>Young child poverty rate (ages 0-3)</li>
              <li>Deep poverty rate (below 50% of poverty line)</li>
              <li>Number of children lifted out of poverty</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Fiscal Metrics</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Total annual cost</li>
              <li>Federal vs. state cost breakdown</li>
              <li>Cost per child</li>
              <li>Cost per child lifted from poverty</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Distribution</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Average gain by income decile</li>
              <li>Share of benefits to bottom 20%, 50%</li>
              <li>Percent of households gaining/losing</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">State Comparison</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>State-by-state poverty impacts</li>
              <li>Rankings by poverty reduction</li>
              <li>Rankings by cost-effectiveness</li>
              <li>Existing state CTC programs</li>
              <li>
                Congressional-district impacts (119th Congress boundaries and
                representatives; average household change, share gaining, and
                relative child poverty change per district)
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="limitations-heading">
        <h2 id="limitations-heading" className="section-title">Limitations</h2>
        <ul className="list-disc list-inside text-gray-600 space-y-2">
          <li>
            <strong>Static Analysis:</strong> The model does not account for behavioral
            responses to policy changes (e.g., changes in labor supply).
          </li>
          <li>
            <strong>Administrative Costs:</strong> Fiscal estimates do not include
            administrative costs of implementing new programs.
          </li>
          <li>
            <strong>Take-up Rates:</strong> The model assumes 100% take-up of benefits.
            Actual participation may be lower: for refundable state child credits,
            observed take-up runs roughly 50&ndash;75%, so those program costs and
            impacts are upper bounds.
          </li>
          <li>
            <strong>SSI:</strong> Supplemental Security Income is not among the
            dataset&apos;s calibration targets, and the simulated national total
            ($43.8 billion for 2024) runs below administrative totals; deep-poverty
            results and reforms interacting with SSI carry that bias.
          </li>
          <li>
            <strong>State-Level Precision:</strong> State poverty <em>levels</em> are
            still being calibrated against Census benchmarks (see Validation); reform
            <em> impacts</em>, the changes the dashboard reports, are less sensitive
            to level error than the rates themselves. Small states carry additional
            sampling noise.
          </li>
        </ul>
      </section>

      <section className="card" aria-labelledby="credits-heading">
        <h2 id="credits-heading" className="section-title">Credits</h2>
        <p className="text-gray-700">
          This dashboard is built by <a href="https://policyengine.org" className="text-pe-teal-500 hover:underline">PolicyEngine</a>,
          a nonprofit organization that builds open-source tools to analyze public policy.
          The underlying microsimulation model, PolicyEngine US, is available on{' '}
          <a href="https://github.com/PolicyEngine/policyengine-us" className="text-pe-teal-500 hover:underline">GitHub</a>.
        </p>
      </section>
    </article>
  );
}
