/** @type {import('next').NextConfig} */
const config = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['mongodb'],
  },
};

export default config;
