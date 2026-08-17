import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagem standalone pro Docker (chassi do Brain: [[Next.js standalone no Docker]]).
  output: "standalone",

  // Canonico e o APEX (piwdex.com.br). O cookie de sessao e host-only (__Host-/__Secure-
  // sem domain): login no www nao valeria no apex — entao www so redireciona.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.piwdex.com.br" }],
        destination: "https://piwdex.com.br/:path*",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
