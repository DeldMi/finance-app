/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingIncludes: {
      '/*': ['./src/generated/finance-client/**/*'],
    },
  },
};

export default nextConfig;
