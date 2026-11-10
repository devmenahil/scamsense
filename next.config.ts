import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Step 11: server-side PDFs (certificate attachment, analysis report). react-pdf runs as a plain Node dependency.
  serverExternalPackages: ["@react-pdf/renderer"],
  // The embedded brand fonts are read from disk at runtime; make sure deployments include them.
  outputFileTracingIncludes: {
    "/api/modules/[moduleKey]/report": ["./src/assets/fonts/**/*"],
    "/api/certificates/[moduleKey]/email": ["./src/assets/fonts/**/*"],
  },
};

export default nextConfig;
