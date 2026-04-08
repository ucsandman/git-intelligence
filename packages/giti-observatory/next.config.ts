import type { NextConfig } from 'next';

const config: NextConfig = {
  output: process.env.OBSERVATORY_PUBLIC === 'true' ? 'export' : undefined,
  transpilePackages: ['three'],
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(vert|frag|glsl)$/,
      type: 'asset/source',
    });
    return config;
  },
};

export default config;
