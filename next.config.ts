import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image domains for external images (expand as needed)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.shivaksatechnology.com',
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
        ],
      },
      {
        // Bearer-token wholesale provider pages: never cached, never indexed.
        source: '/wholesale/provider/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, private'
          },
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive'
          },
        ],
      },
      {
        // The isolated WebRTC echo test page is the only surface allowed
        // to request the microphone, and only for this origin.
        source: '/admin/voice-test/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()'
          },
        ],
      },
    ];
  },

  // Enable compression
  compress: true,
};

export default nextConfig;
