import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // Tailwind CSS is small: inlining it removes a render-blocking request for first-time visitors.
    inlineCss: true,
  },
  // The School was called Classroom: keep every old link and emailed sign-in link working.
  async redirects() {
    return [
      { source: "/l/session-001-three-headaches", destination: "/l/session-001-top-3-headaches", permanent: true },
      { source: "/classroom", destination: "/school", permanent: true },
      { source: "/classroom/:path*", destination: "/school/:path*", permanent: true },
      { source: "/admin/classroom", destination: "/admin/school", permanent: true },
      { source: "/admin/classroom/:path*", destination: "/admin/school/:path*", permanent: true },
      { source: "/admin/preview/classroom/:path*", destination: "/admin/preview/school/:path*", permanent: true },
      { source: "/api/classroom/:path*", destination: "/api/school/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // Brand files never change under the same name: cache them for a year.
        source: "/brand/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
