import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  pageExtensions: isProduction
    ? ['js', 'jsx', 'ts', 'tsx']
    : ['dev.js', 'dev.jsx', 'dev.ts', 'dev.tsx', 'js', 'jsx', 'ts', 'tsx'],
  turbopack: {
    root: rootDir,
  },
};

export default nextConfig;
