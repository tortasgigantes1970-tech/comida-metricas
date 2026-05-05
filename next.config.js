/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control',             value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Vercel-CDN-Cache-Control',  value: 'no-store' },
          { key: 'CDN-Cache-Control',         value: 'no-store' },
          { key: 'Surrogate-Control',         value: 'no-store' },
          { key: 'Pragma',                    value: 'no-cache' },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
