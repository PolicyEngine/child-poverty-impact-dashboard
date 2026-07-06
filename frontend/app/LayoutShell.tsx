'use client';

import Link from 'next/link';
import { Providers } from './providers';
import AppV2Header from '@/components/AppV2Header';

export default function LayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      {/* PolicyEngine app-v2 header (external nav) */}
      <AppV2Header />

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
                  <Link href="/state-credits" className="text-sm text-pe-gray-500 hover:text-pe-teal-600 transition-colors">
                    State Credits Map
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
