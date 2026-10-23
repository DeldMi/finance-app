/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
      '/*': ['./src/generated/finance-client/**/*'],
  },
};

export default nextConfig;
