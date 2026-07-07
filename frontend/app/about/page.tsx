import type { Metadata } from 'next';

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
              Adjust the 21 existing state child tax credits (amounts, age limits,
              phase-outs, refundability), revive Idaho&apos;s expired credit, or create a
              new credit in any state.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">State EITCs</h3>
            <p className="text-gray-600">
              Adjust the 31 existing state earned income tax credits (match rates,
              refundability, structured credits like Washington&apos;s WFTC and
              Minnesota&apos;s Working Family Credit) or create one where none exists.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Dependent Exemptions & Credits</h3>
            <p className="text-gray-600">
              Adjust, age-restrict, or eliminate the per-dependent exemptions and
              credits in 26 states — including AGI-stepped schedules — plus
              Idaho&apos;s grocery credit.
            </p>
          </div>
        </div>
        <p className="text-gray-600 mt-4">
          The <a href="/state-credits" className="text-pe-teal-500 hover:underline">state
          credits map</a> shows the existing programs these reforms start from.
        </p>
      </section>

      <section className="card" aria-labelledby="methodology-heading">
        <h2 id="methodology-heading" className="section-title">Methodology</h2>
        <div className="space-y-4 text-gray-700">
          <p>
            <strong>Data Source:</strong> The dashboard runs on{' '}
            <a href="https://github.com/PolicyEngine/populace" className="text-pe-teal-500 hover:underline">Populace</a>,
            PolicyEngine&apos;s calibrated national microdata file (
            <a href="https://huggingface.co/datasets/policyengine/populace-us" className="text-pe-teal-500 hover:underline">policyengine/populace-us</a>
            ) — roughly 57,000 households built from the Current Population Survey and
            IRS Public Use File, selected and reweighted with{' '}
            <a href="https://populace.dev/papers/l0" className="text-pe-teal-500 hover:underline">
              sparse L0 calibration
            </a>{' '}
            against thousands of administrative targets (IRS collections by state and
            income bracket, program totals, and demographics). One file covers all 50
            states and DC: each analysis simulates the full national file and slices
            results to the selected state&apos;s households. Both the dataset revision and
            the PolicyEngine US model version are pinned per deployment (shown at the
            backend&apos;s health endpoint) and bumped deliberately.
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
            the value of government benefits. Populace&apos;s national SPM rates track the
            Census Bureau&apos;s published figures closely (within about half a point
            overall); state-level SPM rates are still being refined — see Validation
            below.
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
            Every Populace release is scored against benchmarks it was <em>not</em>{' '}
            calibrated to, published on PolicyEngine&apos;s calibration dashboard:
            out-of-sample federal provisions scored by the Joint Committee on Taxation,
            official state budget outlays for existing state EITC and CTC programs, and
            Census state-level SPM poverty rates (overall and child, 2022&ndash;2024
            three-year averages). Nationally, simulated SPM poverty sits within about
            half a percentage point of the Census 2024 figures; state EITC totals
            typically land within roughly ten percent of official outlays.
          </p>
          <p>
            State-level poverty rates are the active work-in-progress: some states run
            high or low against the Census benchmarks, and young-child credits (for
            example California&apos;s YCTC) currently overshoot official totals. These gaps
            are tracked per release so improvements — and regressions — are visible
            before they reach this dashboard.
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
              <li>Gini coefficient change</li>
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
            Actual participation may be lower.
          </li>
          <li>
            <strong>State-Level Precision:</strong> State poverty <em>levels</em> are
            still being calibrated against Census benchmarks (see Validation); reform
            <em> impacts</em> — the changes the dashboard reports — are less sensitive
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
