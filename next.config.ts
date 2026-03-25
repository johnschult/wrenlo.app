import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
