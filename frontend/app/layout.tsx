'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Providers } from './providers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/analyze', label: 'Analyze' },
    { href: '/compare', label: 'Compare States' },
    { href: '/about', label: 'About' },
  ];

  return (
    <html lang="en">
      <head>
        <title>Child Poverty Impact Dashboard</title>
        <meta name="description" content="Model and compare policy reforms to reduce child poverty across US states" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-white flex flex-col">
        <Providers>
          {/* Header */}
          <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-pe-gray-100">
            <div className="max-w-7xl mx-auto px-6">
              <div className="flex items-center justify-between h-16">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pe-teal-400 to-pe-teal-600 flex items-center justify-center shadow-lg shadow-pe-teal-500/20 group-hover:shadow-pe-teal-500/30 transition-shadow">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold text-pe-gray-800 tracking-tight">
                      Child Poverty
                    </span>
                    <span className="text-xs font-medium text-pe-teal-600 -mt-0.5">
                      Impact Dashboard
                    </span>
                  </div>
                </Link>

                {/* Navigation */}
                <nav className="hidden md:flex items-center gap-1">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>

                {/* CTA Button */}
                <div className="flex items-center gap-4">
                  <Link
                    href="/analyze"
                    className="btn btn-primary btn-sm hidden sm:inline-flex"
                  >
                    Start Analysis
                  </Link>

                  {/* Mobile Menu Button */}
                  <button className="md:hidden p-2 rounded-lg hover:bg-pe-gray-100 transition-colors">
                    <svg
                      className="w-5 h-5 text-pe-gray-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
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
          <footer className="border-t border-pe-gray-100 bg-pe-gray-50">
            <div className="max-w-7xl mx-auto px-6 py-12">
              <div className="grid md:grid-cols-4 gap-8">
                {/* Brand Column */}
                <div className="md:col-span-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pe-teal-400 to-pe-teal-600 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    </div>
                    <span className="font-semibold text-pe-gray-800">Child Poverty Impact Dashboard</span>
                  </div>
                  <p className="text-sm text-pe-gray-500 max-w-sm">
                    Powered by PolicyEngine microsimulation. Model policy reforms
                    and their impact on child poverty across all 50 US states.
                  </p>
                </div>

                {/* Links Column */}
                <div>
                  <h4 className="font-semibold text-pe-gray-800 mb-3">Dashboard</h4>
                  <ul className="space-y-2">
                    <li>
                      <Link href="/analyze" className="text-sm text-pe-gray-500 hover:text-pe-teal-600 transition-colors">
                        Household Analysis
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
                </div>

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
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      </body>
    </html>
  );
}
