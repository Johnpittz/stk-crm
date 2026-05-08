/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/prospeccao",
        destination: "/leads",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
