import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/agent', '/client'],
      },
    ],
    sitemap: 'https://app.shivaksatechnology.com/sitemap.xml',
  };
}
