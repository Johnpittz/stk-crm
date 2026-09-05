/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdf2json"],
  // Headers de segurança movidos para middleware.ts (reduz Edge Requests em assets estáticos)
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
