import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
	serverExternalPackages: ['better-sqlite3'],
	eslint: { ignoreDuringBuilds: true },
	outputFileTracingRoot: path.join(__dirname),
	poweredByHeader: false,
};

export default nextConfig;
