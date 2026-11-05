import type { NextConfig } from 'next';
import path from 'node:path';
import { config } from 'dotenv';

config({ path: path.join(__dirname, '../../.env') });

const nextConfig: NextConfig = {
  transpilePackages: ['@solink/core', '@solink/adapters', '@solink/db', '@solink/ui'],
  serverExternalPackages: ['@react-pdf/renderer', '@prisma/client', 'pg-boss', 'pg', 'archiver'],
  experimental: { serverActions: { bodySizeLimit: '12mb' } },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
