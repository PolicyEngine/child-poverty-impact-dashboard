'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Providers } from './providers';

export default function LayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/report', label: 'Report' },
    { href: '/compare', label: 'Compare States' },
    { href: '/about', label: 'About' },
  ];

  return (
    <Providers>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-pe-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <img
                src="/assets/logos/policyengine/teal.svg"
                alt="PolicyEngine - Child Poverty Impact Dashboard"
                width={120}
                height={32}
                className="h-8 w-auto"
              />
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* CTA Button */}
            <div className="flex items-center gap-4">
              <Link
                href="/report"
                className="btn btn-primary btn-sm hidden sm:inline-flex"
              >
                Build Report
              </Link>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-2 rounded-lg hover:bg-pe-gray-100 transition-colors"
                aria-label="Open navigation menu"
              >
                <svg
                  className="w-5 h-5 text-pe-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-pe-gray-100 bg-pe-gray-50" role="contentinfo">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Brand Column */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img
                  src="/assets/logos/policyengine/teal.svg"
                  alt="PolicyEngine"
                  width={96}
                  height={24}
                  className="h-6 w-auto"
                />
              </div>
              <p className="text-sm text-pe-gray-500 max-w-sm">
                Powered by PolicyEngine microsimulation. Model policy reforms
                and their impact on child poverty across all 50 US states.
              </p>
            </div>

            {/* Links Column */}
            <nav aria-label="Dashboard pages">
              <h4 className="font-semibold text-pe-gray-800 mb-3">Dashboard</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/report" className="text-sm text-pe-gray-500 hover:text-pe-teal-600 transition-colors">
                    Build Report
                  </Link>
                </li>
                <li>
                  <Link href="/compare" className="text-sm text-pe-gray-500 hover:text-pe-teal-600 transition-colors">
                    State Comparison
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="text-sm text-pe-gray-500 hover:text-pe-teal-600 transition-colors">
                    Methodology
                  </Link>
                </li>
              </ul>
            </nav>

            {/* PolicyEngine Column */}
            <div>
              <h4 className="font-semibold text-pe-gray-800 mb-3">PolicyEngine</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://policyengine.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-pe-gray-500 hover:text-pe-teal-600 transition-colors inline-flex items-center gap-1"
                  >
                    Main Site
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/PolicyEngine"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-pe-gray-500 hover:text-pe-teal-600 transition-colors inline-flex items-center gap-1"
                  >
                    GitHub
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-pe-gray-200 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-pe-gray-400">
              Data updated 2024. Built with PolicyEngine microsimulation.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-pe-gray-400">Powered by</span>
              <a
                href="https://policyengine.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-pe-teal-600 hover:text-pe-teal-700 transition-colors"
              >
                PolicyEngine
              </a>
            </div>
          </div>
        </div>
      </footer>
    </Providers>
  );
}
