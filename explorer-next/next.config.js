/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Environment variables
  env: {
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:foobar@localhost:5432/postgres',
    POSTGREST_URL: process.env.POSTGREST_URL || 'http://localhost:3000',
    CHAIN_RPC_URL: process.env.CHAIN_RPC_URL || 'http://localhost:9090',
    CHAIN_ID: process.env.CHAIN_ID || 'manifest-1',
  },

  // API rewrites for PostgREST
  async rewrites() {
    return [
      {
        source: '/api/db/:path*',
        destination: `${process.env.POSTGREST_URL || 'http://localhost:3000'}/:path*`,
      },
    ]
  },

  // Headers for CORS
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ]
  },
}

module.exports = nextConfig