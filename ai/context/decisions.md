# shopware-commerce — decisions

The choices that shape this repository, one line each, with where the full
reasoning lives. Superseded decisions stay listed, marked, so the history
reads in order.

| # | Decision | Why | Source |
|---|---|---|---|
| 1 | OpenNext on Workers + Static Assets, the commerce baseline's shape | The starter is a Next.js App Router app: server components, server actions, route handlers and `next/og` run in the Worker | `specs/epics/shopware-commerce/design.md` §2 |
| 2 | The incremental cache in R2, the tag cache (sharded) and the revalidation queue in Durable Objects | The commerce baseline's proven shape: no database to provision or seed; tag revalidation needs strong consistency | design.md §3 |
| 3 | `experimental.useCache`, not `cacheComponents` | A Cache Components page answers 500 then hangs under the adapter (opennextjs-cloudflare#1450), the reference port's choice. Every `"use cache"` read, `cacheLife` and `cacheTag` is kept | design.md §4, risk SW-C |
| 4 | Next.js 16.3.8, not upstream's 16.2.6 | @opennextjs/cloudflare 1.20.11 accepts `>=16.3.8` on Next 16, and 16.4.x fails every request on it | risk SW-D |
| 5 | The store's settings inlined at build (`next.config.ts` `env`): domain, access key, API type, SEO URLs, the origin, the company name | On Workers `process.env` at request time holds only the Worker's vars and secrets; upstream read them at request time on Vercel | design.md §5 |
| 6 | No store, no calls: one connection seam (`lib/shopware/connection.ts`); unconnected, the client refuses to be made, every reader answers empty, every page carries the note, `/` says "Connect your Shopware store" | A baseline goes live with no key the platform cannot broker; the starter's cart and pages are typed on Shopware's own schemas, so a bundled catalogue would fake the Store API in the Worker | design.md §6 |
| 7 | Shopware's demo shop is documented, not defaulted | Upstream's `.env.example` names it as sample values, not as a fallback in code; a fresh product showing a stranger's catalogue is not a connect state | design.md §6 |
| 8 | The domain and key are OPTIONAL build secrets (`optionalSecretEnv`); the revalidation secret is an Orun secret kept out of the build (`env -u`) and put on the Worker by the deploy (`tooling/wire/worker-secrets.mjs`) | The build inlines the store's settings; the secret is read per request and must not be in the bundle | design.md §6 |
| 9 | A working revalidation route: bearer `SHOPWARE_REVALIDATION_SECRET`, constant-time compare, tags `collections` and `products` | Upstream's route was a stub ("never tested"); without it a cached catalogue only changes when its `hours` lifetime ends | design.md §7 |
| 10 | One store-name seam (`SITE_NAME`, `app/site.ts`); the title, footer and Open Graph image read it; the footer's source link is `SOURCE_URL` | The rename rewrites one line; upstream read `SITE_NAME` from the environment | risk SW-H |
| 11 | Each environment builds for its own origin: `NEXT_PUBLIC_SITE_URL` = `SITE_URL` or the workers.dev URL | The sitemap, robots.txt and Open Graph URLs need an absolute origin; upstream read Vercel's | design.md §5 |
| 12 | Images unoptimized | Workers has no Next.js image optimizer, and the owner's media host is not known at build | risk SW-E |
| 13 | The e2e connects a stand-in Store API (`testing/lib/fake-shopware.mjs`) that checks the access key and answers the storefront's calls from a three-product catalogue | Offline and deterministic; the real shop is the owner's | design.md §8 |
| 14 | Upstream's Playwright suite carried in `apps/web/e2e-tests`, run by hand against a connected deployment; upstream's check (`oxlint` + `oxfmt --check`) is `@app/web`'s `test` | Nothing of upstream's tests is dropped; its workflow ran on Vercel's deployment events, which a Workers deploy does not send | risk SW-L |
| 15 | stack-tectonic 0.19.0, `ci.yml` as the commerce baseline's, no `checks.yml`, the domain not asked, the subdomain from the Cloudflare connection | The commerce baseline's settled shape | `intent.yaml`, `blueprint.yaml` |
