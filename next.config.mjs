/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Served at theperpetualhive.com/ConfigLift via a reverse-proxy rewrite
  // from the root site — basePath makes every internal route and asset
  // link (/_next/static/...) resolve under that prefix so the proxy can
  // forward them 1:1 without rewriting response bodies.
  basePath: "/ConfigLift",
};

export default nextConfig;
