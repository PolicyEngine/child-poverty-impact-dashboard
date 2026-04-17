'use client';

import './globals.css';
import Link from 'next/link';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { Providers } from './providers';

const GA_ID = 'G-2YHG89FY0N';
const TOOL_NAME = 'child-poverty-impact-dashboard';

export default function RootLayout({
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
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { tool_name: '${TOOL_NAME}' });
          `}
        </Script>
        <Script id="engagement-tracking" strategy="afterInteractive">
          {`
            (function() {
              var TOOL_NAME = '${TOOL_NAME}';
              if (typeof window === 'undefined' || !window.gtag) return;

              var scrollFired = {};
              window.addEventListener('scroll', function() {
                var docHeight = document.documentElement.scrollHeight - window.innerHeight;
                if (docHeight <= 0) return;
                var pct = Math.floor((window.scrollY / docHeight) * 100);
                [25, 50, 75, 100].forEach(function(m) {
                  if (pct >= m && !scrollFired[m]) {
                    scrollFired[m] = true;
                    window.gtag('event', 'scroll_depth', { percent: m, tool_name: TOOL_NAME });
                  }
                });
              }, { passive: true });

              [30, 60, 120, 300].forEach(function(sec) {
                setTimeout(function() {
                  if (document.visibilityState !== 'hidden') {
                    window.gtag('event', 'time_on_tool', { seconds: sec, tool_name: TOOL_NAME });
                  }
                }, sec * 1000);
              });

              document.addEventListener('click', function(e) {
                var link = e.target && e.target.closest ? e.target.closest('a') : null;
                if (!link || !link.href) return;
                try {
                  var url = new URL(link.href, window.location.origin);
                  if (url.hostname && url.hostname !== window.location.hostname) {
                    window.gtag('event', 'outbound_click', {
                      url: link.href,
                      target_hostname: url.hostname,
                      tool_name: TOOL_NAME
                    });
                  }
                } catch (err) {}
              });
            })();
          `}
        </Script>
      </head>
      <body className="min-h-screen bg-white flex flex-col">
        <Providers>
          {/* Header */}
          <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-pe-gray-100">
            <div className="max-w-7xl mx-auto px-6">
              <div className="flex items-center justify-between h-16">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                  <img
                    src="/assets/logos/policyengine/teal.svg"
                    alt="PolicyEngine"
                    className="h-8 w-auto"
                  />
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
                    href="/report"
                    className="btn btn-primary btn-sm hidden sm:inline-flex"
                  >
                    Build Report
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
                    <img
                      src="/assets/logos/policyengine/teal.svg"
                      alt="PolicyEngine"
                      className="h-6 w-auto"
                    />
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
