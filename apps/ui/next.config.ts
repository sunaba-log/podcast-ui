import type { NextConfig } from "next";

const firebaseAuthHelperDomain =
  process.env.FIREBASE_AUTH_HELPER_DOMAIN ??
  (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ? `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`
    : undefined);

const nextConfig: NextConfig = {
  // Cloud Run 用コンテナで動かすため、self-contained な出力にする
  output: "standalone",
  async rewrites() {
    if (!firebaseAuthHelperDomain) return [];
    return [
      {
        source: "/__/auth/:path*",
        destination: `https://${firebaseAuthHelperDomain}/__/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
