'use client';

import { Header } from '@policyengine/ui-kit';

const NAV_ITEMS = [
  { label: 'Research', href: 'https://policyengine.org/us/research' },
  { label: 'Model', href: 'https://policyengine.org/us/model' },
  { label: 'API', href: 'https://policyengine.org/us/api' },
  { label: 'Python', href: 'https://policyengine.org/us/python' },
  {
    label: 'About',
    href: 'https://policyengine.org/us/about',
    children: [
      { label: 'Team', href: 'https://policyengine.org/us/team' },
      { label: 'Supporters', href: 'https://policyengine.org/us/supporters' },
    ],
  },
  { label: 'Donate', href: 'https://policyengine.org/us/donate' },
];

const COUNTRIES = [
  { id: 'us', label: 'United States' },
  { id: 'uk', label: 'United Kingdom' },
];

export default function AppV2Header() {
  return (
    <Header
      navItems={NAV_ITEMS}
      countries={COUNTRIES}
      currentCountry="us"
      onCountryChange={(id) => {
        window.location.href = `https://policyengine.org/${id}`;
      }}
      logoSrc="https://policyengine.org/assets/logos/policyengine/white.svg"
      logoHref="https://policyengine.org/us"
    />
  );
}
