/** @type {import('next').NextConfig} */
const config = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['mongodb'],
  },
};

export default config;
