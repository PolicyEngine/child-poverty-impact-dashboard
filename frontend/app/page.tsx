import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Child Poverty Impact Dashboard
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
          Enter your household details and see how policy reforms could affect your family.
          Model CTC expansions, EITC reforms, SNAP changes, and state-specific programs
          across all 50 US states and DC.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/analyze" className="btn btn-primary text-lg px-8 py-3">
            Start Analyzing
          </Link>
          <Link href="/compare" className="btn btn-secondary text-lg px-8 py-3">
            Compare States
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="grid md:grid-cols-3 gap-6">
        <div className="card">
          <div className="text-policyengine-teal text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold mb-2">Policy Reforms</h3>
          <p className="text-gray-600">
            Model Child Tax Credit expansions, EITC reforms, SNAP modifications,
            universal basic income, and state-specific programs.
          </p>
        </div>
        <div className="card">
          <div className="text-policyengine-teal text-4xl mb-4">🗺️</div>
          <h3 className="text-lg font-semibold mb-2">50-State Analysis</h3>
          <p className="text-gray-600">
            Compare reform impacts across all 50 states and DC. See which states
            benefit most and where resources are most effective.
          </p>
        </div>
        <div className="card">
          <div className="text-policyengine-teal text-4xl mb-4">📈</div>
          <h3 className="text-lg font-semibold mb-2">Comprehensive Metrics</h3>
          <p className="text-gray-600">
            View fiscal costs, child poverty reduction, distributional effects,
            and cost-effectiveness analysis for each reform.
          </p>
        </div>
      </section>

      {/* Available Reforms */}
      <section>
        <h2 className="section-title">Available Policy Reforms</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ReformCard
            title="Child Tax Credit (CTC)"
            description="Expand benefits by amount, age eligibility (prenatal-3, 0-5, 0-17), income basis, and phaseout structure"
            icon="👶"
          />
          <ReformCard
            title="Earned Income Tax Credit (EITC)"
            description="Individualization options, percentage expansions, and eligibility modifications"
            icon="💼"
          />
          <ReformCard
            title="Dependent Exemptions"
            description="Restore personal exemptions with various amounts and refundability options"
            icon="👨‍👩‍👧‍👦"
          />
          <ReformCard
            title="Universal Basic Income"
            description="Child allowances and full UBI with optional income phaseouts"
            icon="💵"
          />
          <ReformCard
            title="SNAP Modifications"
            description="Benefit increases, eligibility expansions, and asset test changes"
            icon="🍎"
          />
          <ReformCard
            title="State CTCs"
            description="Create or expand state-level child tax credits across all 50 states"
            icon="🏛️"
          />
        </div>
      </section>

      {/* Quick Stats */}
      <section className="bg-policyengine-blue/5 rounded-xl p-8">
        <h2 className="section-title text-center">Current Child Poverty in America</h2>
        <div className="grid md:grid-cols-4 gap-6 mt-6">
          <div className="stat-card">
            <div className="stat-value">12.4%</div>
            <div className="stat-label">Child Poverty Rate (2023)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">9.1M</div>
            <div className="stat-label">Children in Poverty</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">5.2%</div>
            <div className="stat-label">Deep Poverty Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">24</div>
            <div className="stat-label">States with State CTCs</div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="text-center py-8">
        <h2 className="text-2xl font-semibold mb-4">Ready to explore policy solutions?</h2>
        <Link href="/analyze" className="btn btn-teal text-lg px-8 py-3">
          Launch the Dashboard
        </Link>
      </section>
    </div>
  );
}

function ReformCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="text-2xl mb-2">{icon}</div>
      <h4 className="font-semibold text-gray-800 mb-1">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}
