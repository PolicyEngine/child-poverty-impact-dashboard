import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/report/results'],
      },
    ],
    sitemap: 'https://child-poverty.policyengine.org/sitemap.xml',
  };
}
