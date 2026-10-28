# shopware-commerce — design

## 1. The storefront

Shopware's Next.js starter (shopwareLabs/nextjs-shopware-starter `7066aa7`):
a fork of Vercel's Next.js Commerce, Next.js 16.2 App Router with Cache
Components on. Routes: the home page (a three-item grid and a carousel, each
one category's products), `/search` and `/search/<category>` with sorting
and filters, `/product/<seo-url>` with variants, CMS pages under `/cms/`,
Open Graph images (`next/og`), the sitemap and robots.txt. Every Store API
call goes through `@shopware/api-client` 1.4 (`lib/shopware/api.ts`), and
every read in `lib/shopware/index.ts` is a `"use cache"` function with
`cacheLife("hours")` and the tag `collections` or `products`. The cart is
the shop's, kept by its `sw-context-token` in a cookie and changed by server
actions. Upstream has no checkout of its own and its revalidation route is a
stub; it reads every setting from the environment at request time.

## 2. Vercel → Cloudflare

| Vercel | Here |
|---|---|
| Next.js hosting | `@opennextjs/cloudflare` 1.20.11: one Worker (`.open-next/worker.js`) + Static Assets |
| Data Cache | R2 (`NEXT_INC_CACHE_R2_BUCKET`), a bucket per environment from `infra/terraform/cloudflare-r2` |
| Tag revalidation | the sharded Durable Object tag cache (`NEXT_TAG_CACHE_DO_SHARDED`) |
| Stale-while-revalidate | the Durable Object queue (`NEXT_CACHE_DO_QUEUE`) through `WORKER_SELF_REFERENCE` |
| Image Optimization | off — the shop's media is served as the shop sends it |
| Env vars | the domain and access key as optional build secrets, inlined; the revalidation secret as a Worker secret the deploy sets |
| `VERCEL_PROJECT_PRODUCTION_URL` | `NEXT_PUBLIC_SITE_URL`: the environment's `SITE_URL`, else its workers.dev URL |

## 3. The cache

The commerce baseline's shape, unchanged: R2 incremental cache, sharded
Durable Object tag cache (base shard size 12), Durable Object queue —
`open-next.config.ts`, the bindings and the `migrations` in
`wrangler.template.jsonc`. No database to provision or seed, and strongly
consistent per tag shard.

## 4. Cache Components off, `"use cache"` kept

On workerd through the adapter a Cache Components page answers 500 and then
hangs (opennextjs-cloudflare#1450) — the reference port's finding and its
choice. So `cacheComponents` is off and `experimental.useCache` keeps every
`"use cache"` read with its lifetime and tags; routes render per request
from cached reads. Measured under `wrangler dev` against the stand-in: a
second visit reads the catalogue not at all, and revalidating `products`
re-reads the products and nothing of the collections. Next is 16.3.8, the
lowest 16.x the adapter's peer range accepts; 16.4.x fails every request on
it.

## 5. Build-time settings

On Vercel the starter reads `SHOPWARE_STORE_DOMAIN`, `SHOPWARE_ACCESS_TOKEN`,
`SHOPWARE_API_TYPE`, `SHOPWARE_USE_SEO_URLS`, `COMPANY_NAME` and the origin
from `process.env` per request. A Worker's `process.env` holds only its vars
and secrets, so `next.config.ts` `env` inlines those six at build — the
deploy builds once per environment with that environment's values. Only a
literal `process.env.NAME` is replaced, so upstream's
`validateEnvironmentVariables` (a read by computed name) no longer runs in
the sitemap; the connection seam does its job. The values reach the server
bundle only: no client component reads them.

## 6. Before a store, and after

A baseline goes live with no key the platform cannot broker. The starter's
pages and cart are typed on Shopware's own schemas, so a bundled catalogue
would fake the Store API inside the Worker. Upstream's `.env.example` names
Shopware's demo shop as sample values, not as a fallback in code, so the
demo is documented (the README's "Connecting Shopware") and not defaulted.
Instead the starter's unconfigured state is made explicit:
`lib/shopware/connection.ts` says whether the build had a domain and a key;
unconnected, `getApiClient` throws `ShopwareNotConnected`, which every
reader's existing catch turns into an empty answer without logging it;
every page carries the note "No Shopware store is connected yet", `/` says
"Connect your Shopware store" and how, and the sitemap lists `/` alone.
`/api/health` reports the connection for the smoke and the record. The
owner sets the two Orun secrets and redeploys.

## 7. Revalidation

Upstream's `/api/revalidate` answered "never tested". The port's route takes
`POST` with `Authorization: Bearer <SHOPWARE_REVALIDATION_SECRET>`, compares
SHA-256 digests in constant time, and calls `revalidateTag(tag, "seconds")`
for `?tag=products`, `?tag=collections`, or both; the cart's tag is not
accepted. With no secret it answers 503, a missing or wrong bearer 401, an
unknown tag 400. The secret is an Orun secret: the build runs without it
(`env -u`), so it is in no bundle, and `tooling/wire/worker-secrets.mjs` puts
it on the environment's Worker after the build, on deploy lanes only.
Shopware sends no cache webhook of its own, so the README names the shop's
ways to call it: Flow Builder's webhook action, an app, or a job.

## 8. Tests

Upstream's check (`oxlint` and `oxfmt --check`) is `@app/web`'s `test`.
`tests/web` covers the port's seams: the store name, the connection,
`/api/health`, the store-domain helper and the revalidation route's bearer
check and tags (17 tests). Upstream's Playwright suite (`e2e-tests/`) browses
a deployment connected to Shopware's demo shop; it is carried and run by
hand. The e2e serves the bootstrapped product twice: as born (the deploy's
own smoke, every page with the note, health, revalidation off, the sitemap,
the Open Graph image), then rebuilt by the stage lane's own build step with
a stand-in Store API connected (`testing/lib/fake-shopware.mjs`: it checks
the `sw-access-key`, answers the calls the storefront makes from a
three-product catalogue with categories, a footer CMS page and SEO URLs, and
counts every call) — catalogue pages, cache reuse, a change that stays
cached until the bearer revalidates `products`, a refused bearer that drops
nothing, and the revalidation secret absent from the build output.

## 9. The rename

Slug `shopware-commerce`, Pascal `ShopwareCommerce`, store name
`Next.js Shopware Starter` (the starter's own name) at the `SITE_NAME` seam
(`app/site.ts`), with `SOURCE_URL` beside it. The leak gate fails any other
spelling of the name under `app/`, `components/` or `lib/`. The storefront's
own word `Shopware` is not the identity and no rule touches it.

## 10. Alternatives rejected

- **Cache Components on, a patched adapter**: hacking around an open
  upstream bug.
- **Shopware's demo shop as the default**: a stranger's catalogue in
  somebody's store, gone when Shopware moves it, and no connect state.
- **A bundled demo catalogue**: the Store API faked inside the Worker for a
  cart that still needs a real shop.
- **The revalidation secret as a build secret**: it would be inlined into the
  Worker's bundle.
- **Upstream's revalidation stub kept**: a cached catalogue would change
  only when its lifetime ends.
