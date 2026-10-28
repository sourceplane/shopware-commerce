import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Upstream turns on `cacheComponents`. Its staged rendering cannot yet run
  // on workerd under @opennextjs/cloudflare 1.20 (opennextjs-cloudflare#1450:
  // every request hangs), so — as the commerce baseline this port follows —
  // it is off, and `experimental.useCache` keeps the `"use cache"` directives
  // lib/shopware caches every Store API read with (tagged `collections` /
  // `products`, `cacheLife("hours")`). Routes render per request; the reads
  // are served from the cache (open-next.config.ts) until they expire or
  // app/api/revalidate drops their tag.
  experimental: {
    inlineCss: true,
    useCache: true,
  },
  reactStrictMode: false,
  // The store's media is served from the owner's own Shopware host, unknown
  // until it is connected; images are served as the store sends them.
  images: {
    unoptimized: true,
  },
  // The store this build talks to, decided at build time (component.yaml's
  // buildCommand passes the environment's Orun secrets): unset, every page
  // renders without calling Shopware and says how to connect a store
  // (lib/shopware/connection.ts). The revalidation secret is NOT here: it is
  // a Worker secret, read per request.
  env: {
    SHOPWARE_STORE_DOMAIN: process.env.SHOPWARE_STORE_DOMAIN ?? "",
    SHOPWARE_ACCESS_TOKEN: process.env.SHOPWARE_ACCESS_TOKEN ?? "",
    SHOPWARE_API_TYPE: process.env.SHOPWARE_API_TYPE ?? "store-api",
    SHOPWARE_USE_SEO_URLS: process.env.SHOPWARE_USE_SEO_URLS ?? "true",
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "",
    COMPANY_NAME: process.env.COMPANY_NAME ?? "",
  },
  async redirects() {
    return [
      {
        source: "/password",
        destination: "/",
        permanent: true,
      },
    ];
  },
  // Required by @opennextjs/cloudflare, which bundles `.next/standalone/**`
  // into the Worker. Trace from the monorepo root so workspace dependencies
  // resolve from the root node_modules.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;

// `next dev` reaches the Worker's bindings (the R2 cache bucket, the cache
// Durable Objects) through a local miniflare built from wrangler.jsonc.
initOpenNextCloudflareForDev();
