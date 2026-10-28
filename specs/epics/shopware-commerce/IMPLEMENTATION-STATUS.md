# shopware-commerce — implementation status

| Milestone | State | Landed |
|---|---|---|
| SW0 — the spec | ✅ | SW-1 |
| SW1 — the storefront on Workers | ✅ | SW-2 |
| SW2 — a baseline | ✅ | SW-3, tagged `baseline-v1` |

## Departures from the upstream template

Everything not listed here is shopwareLabs/nextjs-shopware-starter as it is
at `7066aa7`.

| # | What | Why |
|---|---|---|
| 1 | The app lives in `apps/web` of a pnpm workspace (`@app/web`); the lockfile is resolved for the workspace from upstream's ranges; `@types/node` 25.2.3 → 22.13.10; `husky` and its `prepare` script removed | The workspace's shape; the runners are Node 22 |
| 2 | `next` 16.2.6 → 16.3.8 | @opennextjs/cloudflare 1.20.11 accepts `>=16.3.8` on 16.x, and 16.4.x fails every request on it |
| 3 | `cacheComponents` off; `experimental.useCache: true` (`inlineCss` kept) | A Cache Components page hangs on workerd under @opennextjs/cloudflare 1.20 (opennextjs-cloudflare#1450); every `"use cache"` read, lifetime and tag is kept |
| 4 | `output: "standalone"`, `outputFileTracingRoot` at the workspace root, `images.unoptimized` (upstream: AVIF/WebP from `cdn.shopware.store`), `initOpenNextCloudflareForDev()`; `open-next.config.ts` (R2 + DO caches), `wrangler.template.jsonc`, `wiring.fixture.json`, `cloudflare-env.d.ts`, `@opennextjs/cloudflare` and `wrangler` added | OpenNext's build and bindings; the owner's media host is unknown at build |
| 5 | `next.config.ts` `env` inlines `SHOPWARE_STORE_DOMAIN`, `SHOPWARE_ACCESS_TOKEN`, `SHOPWARE_API_TYPE`, `SHOPWARE_USE_SEO_URLS`, `NEXT_PUBLIC_SITE_URL` and `COMPANY_NAME` | A Worker's `process.env` holds only its vars and secrets |
| 6 | `lib/shopware/connection.ts` (`isShopwareConfigured`, `ShopwareNotConnected`); `getApiClient` throws it when unconnected, and the fifteen catch blocks in `lib/shopware/api.ts`, `lib/shopware/index.ts` and `components/cart/actions.ts` answer as before without logging it; `components/connect-store.tsx`: the note in the layout, the "Connect your Shopware store" panel on `/` | A product deploys before its owner connects a shop; upstream failed every call without one |
| 7 | `app/sitemap.ts` lists `/` alone when unconnected and no longer calls `validateEnvironmentVariables` | It reads the environment by computed name, which the build does not inline, and threw |
| 8 | `revalidate()` (a stub: "never tested") replaced by the bearer-checked route: `SHOPWARE_REVALIDATION_SECRET`, SHA-256 constant-time compare, tags `collections` and `products`, 503 / 401 / 400 | A cached catalogue changes when the shop does, not only when its lifetime ends |
| 9 | `app/site.ts`: `SITE_NAME = "Next.js Shopware Starter"` (upstream's fallback) and `SOURCE_URL`; the title, the footer and the Open Graph image read `SITE_NAME`; the footer's source link is `SOURCE_URL` (upstream: `github.com/shopware/frontends`) | One rename seam; upstream read `SITE_NAME` from the environment and titled pages `%s \| undefined` without it |
| 10 | `lib/utils.ts` `baseUrl` from `NEXT_PUBLIC_SITE_URL` (upstream: `VERCEL_PROJECT_PRODUCTION_URL`) | Each environment's own origin |
| 11 | `lib/shopware/helpers.ts` `getStoreDomain` trims, drops a trailing slash and keeps an explicit `http://` (upstream prefixed `https://` onto it) | A domain written with its scheme, or a local shop, works |
| 12 | The Open Graph image reads its font from `public/fonts/Inter-Bold.ttf` (moved from `fonts/`) and the logo from `public/logo-next.svg`, from the file system or the Worker's `ASSETS`; it draws the logo as a data-URI `<img>`; the collection image awaits its optional `params` | `next/image` (the logo component) throws inside Satori on the server; a Worker has no project file system; Next 16's `params` is a Promise, absent at that path |
| 13 | `app/api/health/route.ts` | The deploy's smoke and the record's probe |
| 14 | `test` is upstream's check (`pnpm lint && pnpm format:check`) without `husky`; `preview`, `typecheck`, `wire:fixture` added; `.gitignore` extended with `.open-next`, `.wrangler`, `.turbo`, `.dev.vars`; `.prettierignore` for the two wrangler files | The Worker build and its generated config |
| 15 | `README.md` replaced by the app's own; `.env.example` says what is optional and where each value lives on Workers, without upstream's demo values | Settings are Orun secrets, never committed |
| 16 | Not carried: `.github/` (the Playwright workflow on Vercel's `deployment_status`), `.husky`, `.vscode`, `pnpm-lock.yaml` | Vercel- and editor-specific; the lockfile is the workspace's. The Playwright suite itself is carried (`e2e-tests/`) |

## Verified

- Spike: Cache Components off + `useCache` on Next 16.3.8, R2 + DO caches,
  under `wrangler dev` against the stand-in Store API: every route 200 with
  no hang; a second visit read only the shopper's cart; a store change stayed
  cached until the bearer revalidated `products`, which re-read the products
  and none of the collections.
- `pnpm typecheck`, `lint`, `test` (upstream's check; the port's 17) and
  `build` green with no store; the Worker is 10961.93 KiB raw, 2536.06 KiB
  gzipped.
- Unconnected: every page 200 with the note, `/` asks for a shop,
  `/api/health` `{"ok":true,"connected":false}`, `POST /api/revalidate` 503,
  the sitemap lists `/` alone, the Open Graph image is a PNG.
