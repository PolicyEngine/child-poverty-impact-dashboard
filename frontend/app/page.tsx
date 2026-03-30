'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Animated counter component
function AnimatedStat({
  value,
  suffix = '',
  prefix = '',
  delay = 0,
}: {
  value: string;
  suffix?: string;
  prefix?: string;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <span
      className={`inline-block transition-all duration-700 ${
        isVisible
          ? 'opacity-100 transform translate-y-0 scale-100'
          : 'opacity-0 transform translate-y-4 scale-95'
      }`}
      style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
    >
      {prefix}
      {value}
      {suffix}
    </span>
  );
}

// Feature card with staggered animation
function FeatureCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`card card-hover group transition-all duration-500 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div className="w-12 h-12 rounded-xl bg-pe-teal-50 flex items-center justify-center mb-4 group-hover:bg-pe-teal-100 group-hover:scale-110 transition-all duration-300">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-pe-gray-800 mb-2">{title}</h3>
      <p className="text-pe-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

// Reform card component
function ReformCard({
  title,
  description,
  icon,
  delay,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  delay: number;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`group relative bg-white border border-pe-gray-100 rounded-xl p-5 transition-all duration-500 hover:border-pe-teal-200 hover:shadow-lg hover:-translate-y-1 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-pe-teal-50 flex items-center justify-center flex-shrink-0 group-hover:bg-pe-teal-100 transition-colors">
          {icon}
        </div>
        <div>
          <h4 className="font-semibold text-pe-gray-800 mb-1 group-hover:text-pe-teal-700 transition-colors">
            {title}
          </h4>
          <p className="text-sm text-pe-gray-500 leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-pe-teal-500/0 via-pe-teal-500/0 to-pe-teal-500/0 group-hover:from-pe-teal-500/5 group-hover:to-transparent transition-all duration-500" />
    </div>
  );
}

export default function HomePage() {
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    setHeroVisible(true);
  }, []);

  return (
    <div className="relative">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-radial from-pe-teal-100/40 via-transparent to-transparent" />
        <div className="absolute top-40 right-0 w-96 h-96 bg-pe-teal-50/50 rounded-full blur-3xl" />
        <div className="absolute top-80 left-0 w-64 h-64 bg-pe-teal-100/30 rounded-full blur-3xl" />
      </div>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div
            className={`text-center max-w-4xl mx-auto transition-all duration-1000 ${
              heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-pe-teal-50 border border-pe-teal-200 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 rounded-full bg-pe-teal-500 animate-pulse" />
              <span className="text-sm font-medium text-pe-teal-700">
                Powered by PolicyEngine Microsimulation
              </span>
            </div>

            {/* Main headline */}
            <h1 className="text-display font-bold text-pe-gray-900 mb-6 leading-tight">
              Explore how policy reforms{' '}
              <span className="text-gradient">reduce child poverty</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-pe-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
              Enter your household details and see how CTC expansions, EITC reforms,
              SNAP changes, and state programs could affect your family across all 50 states.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/report" className="btn btn-primary btn-lg group">
                <span>Build Report</span>
                <svg
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
              <Link href="/compare" className="btn btn-outline btn-lg">
                Compare States
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-sm font-semibold text-pe-teal-600 uppercase tracking-wide mb-2">
              The Challenge
            </h2>
            <p className="text-2xl font-semibold text-pe-gray-800">
              Child Poverty in America Today
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            <div className="stat-card group">
              <div className="stat-value-lg">
                <AnimatedStat value="12.4" suffix="%" delay={200} />
              </div>
              <div className="stat-label">Child Poverty Rate (2023)</div>
              <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-pe-gray-400">Supplemental Poverty Measure</span>
              </div>
            </div>

            <div className="stat-card group">
              <div className="stat-value-lg">
                <AnimatedStat value="9.1" suffix="M" delay={400} />
              </div>
              <div className="stat-label">Children in Poverty</div>
              <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-pe-gray-400">Under 18 years old</span>
              </div>
            </div>

            <div className="stat-card group">
              <div className="stat-value-lg">
                <AnimatedStat value="5.2" suffix="%" delay={600} />
              </div>
              <div className="stat-label">Deep Poverty Rate</div>
              <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-pe-gray-400">Below 50% of poverty line</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-20 px-6 bg-pe-gray-50/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="section-title">What You Can Do</h2>
            <p className="section-subtitle mx-auto">
              Explore comprehensive policy analysis tools designed for researchers,
              policymakers, and advocates.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              delay={200}
              icon={
                <svg className="w-6 h-6 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              title="Model Policy Reforms"
              description="Simulate Child Tax Credit expansions, EITC reforms, SNAP modifications, universal basic income, and state-specific programs with granular controls."
            />

            <FeatureCard
              delay={400}
              icon={
                <svg className="w-6 h-6 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="50-State Analysis"
              description="Compare reform impacts across all 50 states and DC. Identify which states benefit most and where resources are most effectively deployed."
            />

            <FeatureCard
              delay={600}
              icon={
                <svg className="w-6 h-6 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              }
              title="Comprehensive Metrics"
              description="View fiscal costs, poverty reduction rates, distributional effects by income decile, and cost-effectiveness analysis for each reform scenario."
            />
          </div>
        </div>
      </section>

      {/* Available Reforms Section */}
      <section className="relative py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-12">
            <div>
              <h2 className="section-title">Available Policy Reforms</h2>
              <p className="section-subtitle">
                Explore a comprehensive suite of federal and state policy levers.
              </p>
            </div>
            <Link
              href="/report"
              className="btn btn-ghost mt-4 lg:mt-0 self-start lg:self-auto"
            >
              Explore all options
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ReformCard
              delay={100}
              icon={
                <svg className="w-5 h-5 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              title="Child Tax Credit (CTC)"
              description="Expand benefits by amount, age eligibility (prenatal-3, 0-5, 0-17), income basis, and phaseout structure."
            />

            <ReformCard
              delay={200}
              icon={
                <svg className="w-5 h-5 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
              title="Earned Income Tax Credit"
              description="Individualization options, percentage expansions, and eligibility modifications for workers."
            />

            <ReformCard
              delay={300}
              icon={
                <svg className="w-5 h-5 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              title="Dependent Exemptions"
              description="Restore personal exemptions with various amounts and refundability options."
            />

            <ReformCard
              delay={400}
              icon={
                <svg className="w-5 h-5 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="Universal Basic Income"
              description="Child allowances and full UBI with optional income phaseouts."
            />

            <ReformCard
              delay={500}
              icon={
                <svg className="w-5 h-5 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              title="SNAP Modifications"
              description="Benefit increases, eligibility expansions, and asset test changes."
            />

            <ReformCard
              delay={600}
              icon={
                <svg className="w-5 h-5 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
              title="State CTCs"
              description="Create or expand state-level child tax credits across all 50 states."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pe-teal-600 via-pe-teal-500 to-pe-teal-400 p-12 md:p-16 text-center shadow-glow-lg">
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full" />
            </div>

            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to explore policy solutions?
              </h2>
              <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
                See how different reforms could affect your household and help reduce
                child poverty across America.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/report"
                  className="btn btn-lg bg-white text-pe-teal-600 hover:bg-pe-gray-50 shadow-lg"
                >
                  Build Your Report
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  href="/about"
                  className="btn btn-lg border-2 border-white/30 text-white hover:bg-white/10"
                >
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
