import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Child Poverty Impact Dashboard',
  description: 'Model and compare policy reforms to reduce child poverty across US states',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <Providers>
          <header className="bg-policyengine-blue text-white py-4 px-6 shadow-md">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold">Child Poverty Impact Dashboard</h1>
              </div>
              <nav className="flex gap-6">
                <a href="/" className="hover:text-policyengine-teal transition-colors">
                  Home
                </a>
                <a href="/analyze" className="hover:text-policyengine-teal transition-colors">
                  Analyze
                </a>
                <a href="/compare" className="hover:text-policyengine-teal transition-colors">
                  Compare States
                </a>
                <a href="/about" className="hover:text-policyengine-teal transition-colors">
                  About
                </a>
              </nav>
            </div>
          </header>
          <main className="max-w-7xl mx-auto py-8 px-6">
            {children}
          </main>
          <footer className="bg-gray-100 border-t py-6 px-6 mt-auto">
            <div className="max-w-7xl mx-auto text-center text-gray-600 text-sm">
              <p>Powered by PolicyEngine | Data updated 2024</p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
