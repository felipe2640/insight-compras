/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Otimização de saída e compilação para Vercel
  poweredByHeader: false,
};

export default nextConfig;
