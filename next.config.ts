import type { NextConfig } from 'next';

const config: NextConfig = {
  devIndicators: { position: 'bottom-right' },
  poweredByHeader: false,
  reactStrictMode: true,
  ...(process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' } : {}),
};

export default config;
