import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';
const withNextIntl = createNextIntlPlugin('./src/18n/request.ts');

const nextConfig: NextConfig = {
	serverExternalPackages: ['better-sqlite3'],
	eslint: { ignoreDuringBuilds: true },
	outputFileTracingRoot: path.join(__dirname),
	poweredByHeader: false,
};

export default withNextIntl(nextConfig);
