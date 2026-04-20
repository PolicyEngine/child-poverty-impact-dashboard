import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import LayoutShell from './LayoutShell';

const GA_ID = 'G-2YHG89FY0N';
const TOOL_NAME = 'child-poverty-impact-dashboard';

const SITE_URL = 'https://child-poverty.policyengine.org';
const SITE_TITLE = 'Child Poverty Impact Dashboard | PolicyEngine';
const SITE_DESCRIPTION =
  'Model and compare policy reforms to reduce child poverty across all 50 US states. Simulate CTC expansions, EITC reforms, SNAP changes, and more with PolicyEngine microsimulation.';

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: '%s | Child Poverty Impact Dashboard',
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/',
  },
  keywords: [
    'child poverty',
    'policy reform',
    'Child Tax Credit',
    'CTC',
    'EITC',
    'SNAP',
    'universal basic income',
    'microsimulation',
    'PolicyEngine',
    'poverty reduction',
    'tax policy',
    'US states',
  ],
  authors: [{ name: 'PolicyEngine', url: 'https://policyengine.org' }],
  creator: 'PolicyEngine',
  publisher: 'PolicyEngine',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'Child Poverty Impact Dashboard',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Child Poverty Impact Dashboard - Model policy reforms to reduce child poverty',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
    creator: '@ThePolicyEngine',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Child Poverty Impact Dashboard',
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    applicationCategory: 'Government',
    operatingSystem: 'Web',
    creator: {
      '@type': 'Organization',
      name: 'PolicyEngine',
      url: 'https://policyengine.org',
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'Child Tax Credit simulations',
      'EITC reform modeling',
      'SNAP policy analysis',
      '50-state comparison',
      'Household impact calculations',
      'Distributional analysis by income decile',
    ],
  };

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
