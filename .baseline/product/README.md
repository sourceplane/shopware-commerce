# shopware-commerce

A Shopware 6 storefront — a home page with a featured grid and a carousel,
the shop's categories with sorting and filters, search, product pages with
variants, a cart, CMS pages and a sitemap — on **Cloudflare Workers + Static
Assets** through [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare),
built from [Shopware's Next.js starter](https://github.com/shopwareLabs/nextjs-shopware-starter)
(MIT — `apps/web/license.md`). Every read from your shop's Store API is
cached with `"use cache"` in an **R2 bucket** that Terraform provisions per
environment; the tag cache and the revalidation queue are **Durable Objects**
the Worker itself exports, and a bearer-checked route drops the cache when
your catalogue changes.

It is live from its first deploy, before any Shopware store is connected:
every page answers, the catalogue is empty, and `/` says **"Connect your
Shopware store"**. Once you give the build your shop's domain and its sales
channel's access key, it sells your products.

## Live deployment

<!-- 02-docs:begin -->
Not recorded yet. The bootstrap's last phase writes the live URLs, the
workspace, whether a Shopware store is connected and the secrets the store
uses into [ai/context/deployment.md](ai/context/deployment.md); how the store
deploys and how to operate it is in
[ai/context/operations.md](ai/context/operations.md).
<!-- 02-docs:end -->

## What is here

| Surface | Where |
|---|---|
| The storefront's routes: `/` (the grid and the carousel), `/search` and `/search/<category>`, `/product/<seo-url>`, `/cms/<page>`; `/api/revalidate`, `/api/health`; the sitemap and the Open Graph images | `apps/web/app` |
| The store's name and its source link | `apps/web/app/site.ts` (`SITE_NAME`, `SOURCE_URL`) |
| Whether a Shopware store is connected, and what the storefront says until one is | `apps/web/lib/shopware/connection.ts`, `apps/web/components/connect-store.tsx` |
| The Store API client, its cached reads and their tags, the transforms to the page's types, the revalidation route's logic | `apps/web/lib/shopware` |
| The Store API's types, generated from Shopware's schema (`pnpm --filter @app/web generate-types` against your shop) | `apps/web/api-types`, `apps/web/shopware.d.ts` |
| Workers build, cache bindings and deploy contract | `apps/web/next.config.ts`, `open-next.config.ts`, `wrangler.template.jsonc` + `wiring.fixture.json` (→ `wrangler.jsonc`), `component.yaml` |
| The R2 bucket (stage, prod) | `infra/terraform/cloudflare-r2` |
| Tests | `tests/web` (vitest); upstream's own check (`pnpm --filter @app/web test`: its lint and format check); upstream's Playwright suite, `apps/web/e2e-tests`, for a deployment connected to a shop (below) |

## Getting started

```bash
pnpm install
pnpm run wire:fixture   # render apps/web/wrangler.jsonc from the offline fixture
pnpm typecheck
pnpm lint
pnpm test
pnpm build              # next build + opennextjs-cloudflare build → apps/web/.open-next
```

None of these needs a store: with none the build is the "connect your
Shopware store" storefront. To work against yours, copy
`apps/web/.env.example` to `apps/web/.env.local`, set
`SHOPWARE_STORE_DOMAIN` and `SHOPWARE_ACCESS_TOKEN`, then:

```bash
pnpm --filter @app/web dev        # http://localhost:3000, Next's dev server
pnpm --filter @app/web preview    # wrangler dev over the built Worker, a local R2 bucket and local Durable Objects
```

Upstream's Playwright suite browses a deployed storefront connected to
Shopware's demo shop — the home page, a category's paging and sorting, a
product added to the cart, the footer's CMS pages:

```bash
cd apps/web/e2e-tests && pnpm install && pnpm exec playwright install chromium firefox
BASE_E2E_URL=https://shopware-commerce-web-stage.your-workers-subdomain.workers.dev pnpm test:e2e
```

Its CMS-page check expects upstream's demo title ("Defective Product | Next.js
Commerce with Shopware Composable Frontends"), so against your own store name
that one check fails until you change it.

## Connecting Shopware

1. **A Shopware 6 shop** with a Storefront or Headless sales channel. You need
   the shop's domain (`shop.example.com`; with no scheme it is `https://`)
   and the sales channel's **API access key** (Administration → Sales
   Channels → your channel → API access). Turn on the channel's SEO URLs, as
   the starter expects (`SHOPWARE_USE_SEO_URLS` is `true`). To try the
   storefront first, Shopware's own demo shop works:
   `demo-frontends.shopware.store` with the public access key in the
   starter's [`.env.example`](https://github.com/shopwareLabs/nextjs-shopware-starter/blob/main/.env.example).
2. **Give the build your shop**, once per deployed environment. The build
   reads both values (they are fixed per deploy), so they are this
   repository's Orun secrets, and stage and prod can each name their own shop:

   ```bash
   orun secrets set SHOPWARE_STORE_DOMAIN --env stage   # prompts for the value
   orun secrets set SHOPWARE_ACCESS_TOKEN --env stage
   orun secrets set SHOPWARE_STORE_DOMAIN --env prod
   orun secrets set SHOPWARE_ACCESS_TOKEN --env prod
   ```

   Then **redeploy the storefront**: a secret is read when the storefront
   builds, and setting one builds nothing. Use **Deploy by hand** below, or
   change the stamp on the last line of `apps/web/component.yaml`
   (`# orun: redeploy …`) and merge. From that deploy on the catalogue is
   your shop's.
3. **The home page** shows the products of two categories, as Shopware's
   starter does: `Summer-BBQ/Hidden-Category` (the grid) and
   `Summer-BBQ/Hidden-Carousel-Category` (the carousel) — Shopware's demo
   shop has both. Create categories at those SEO paths in your shop, or
   change the paths in `apps/web/components/grid/three-items.tsx` and
   `apps/web/components/carousel.tsx`. The header is the shop's main
   navigation and the footer its footer navigation; footer entries open as
   CMS pages under `/cms/`.
4. **Let your shop revalidate the cache** (recommended). Every Store API read
   is cached at the edge for hours; a call to the revalidation route makes a
   change show on the next request instead. Set a long random secret for each
   environment:

   ```bash
   orun secrets set SHOPWARE_REVALIDATION_SECRET --env stage
   orun secrets set SHOPWARE_REVALIDATION_SECRET --env prod
   ```

   and redeploy: the deploy hands it to the Worker as a secret (the build
   never sees it). Then have your shop — Shopware's Flow Builder **Call
   webhook** action, an app, or a job of your own — `POST` to
   `https://shopware-commerce-web-prod.your-workers-subdomain.workers.dev/api/revalidate`
   with `Authorization: Bearer <SHOPWARE_REVALIDATION_SECRET>` when products
   or categories change. `?tag=products` or `?tag=collections` drops one of
   the two; with neither, both are dropped. Until the secret is set the route
   answers 503 to everyone.

## Checkout

As in Shopware's starter, the cart is your shop's (`sw-context-token`, kept
in a cookie) and the storefront has no checkout of its own: the cart says
"Checkout not included", and its **Proceed to Checkout** button links to
Shopware's demo frontend, as upstream's does. Point it at your shop's own
checkout (`checkoutUrl` in `apps/web/lib/shopware/transform.ts`) before you
sell, or build a headless checkout on the Store API's checkout routes.

## How the cache is wired

The Worker binds the bucket as `NEXT_INC_CACHE_R2_BUCKET` (every `"use cache"`
entry), and two Durable Objects: `NEXT_TAG_CACHE_DO_SHARDED` (which tags were
revalidated, and when) and `NEXT_CACHE_DO_QUEUE` (background revalidation of
stale entries, through the Worker's own `WORKER_SELF_REFERENCE` binding). The
bucket's name is never hand-written: `apps/web/wrangler.template.jsonc` names
it as a wiring token, and `wrangler.jsonc` is that template rendered — from
`wiring.fixture.json` for local work and verification, and on every deploy
from the document the `cloudflare-r2` Terraform root publishes after its
apply (`WIRING_CLOUDFLARE_R2`, per environment). Edit the template, then
`pnpm run wire:fixture` and commit the render with the template. The Durable
Objects need no root: the migration in the config creates them on the first
deploy.

## How it deploys

Merges to `main` converge through [Orun](https://github.com/sourceplane/orun):
`.github/workflows/ci.yml` plans the changed components and runs each lane
against the workspace in `intent.yaml`. The R2 bucket applies first, then the
storefront builds for that environment — its bucket, its origin, and its
Shopware shop if one is set — and deploys, to `stage`, then to `prod` once
stage has converged on the same commit; `dev` only verifies. The Worker is
`shopware-commerce-web-<env>` on your account's workers.dev subdomain, and
every deploy is smoke-tested over HTTP: the home page must answer, and so
must `/api/health`, which only the Worker can. A pull request runs the same
pipeline's verify lanes, with nothing applied or deployed: the R2 bucket
planned for stage and prod, and the storefront built and dry-deployed for
each environment. They do not run the tests or the linter — run those before
you push (Getting started, above). (A push to `main` applies, builds and
deploys.)

The pipeline holds one credential, GitHub's own `GITHUB_TOKEN`. The Cloudflare
tokens and account id are brokered per run from the workspace's Cloudflare
connection — one to deploy the Worker, one with R2 access for the bucket's
apply — and the bucket names, your shop's settings and the revalidation
secret travel as Orun secrets; nothing provider-shaped is stored in the
repository or in GitHub.

**Deploy by hand.** Orunbase's **Deploy** button on a component, or **Run
workflow** on the CI workflow in GitHub's Actions tab (on `main`), runs
`ci.yml` for the environment and components you pick, and each one deploys
exactly as a merge would deploy it. Leave the component blank to redeploy
every component in that environment, with nothing changed: after setting your
shop's settings, say. A component with nothing to run in that environment (a
test suite in `prod`) is left out with a notice.

## How it maps to Vercel

| Vercel | Here |
|---|---|
| Next.js hosting (SSR, server actions, route handlers, `next/og`) | One Cloudflare Worker (`.open-next/worker.js`) + Static Assets (`ASSETS`) |
| Cache Components: `"use cache"` with `cacheLife` and `cacheTag` | `"use cache"`, its lifetimes and its tags kept (`experimental.useCache`); routes render per request (below) |
| Data Cache entries | The R2 bucket bound as `NEXT_INC_CACHE_R2_BUCKET` |
| `revalidateTag` | A sharded Durable Object tag cache consulted on every cache read |
| Stale-while-revalidate | A Durable Object queue that re-renders stale entries through the Worker |
| Image Optimization (`/_next/image`) | Off (`images.unoptimized`): images come from your shop's media URLs |
| `SHOPWARE_STORE_DOMAIN`, `SHOPWARE_ACCESS_TOKEN` | Orun secrets (above); the "connect your Shopware store" storefront until set |
| `SHOPWARE_REVALIDATION_SECRET` | An Orun secret the deploy puts on the Worker; the route refuses until it is set |
| `VERCEL_PROJECT_PRODUCTION_URL` (the sitemap's and robots.txt's origin) | Each environment's `SITE_URL` (intent.yaml), else its workers.dev URL — set by the build |
| `SITE_NAME` | `apps/web/app/site.ts` |
| Deploy on push | Orun applies the bucket and deploys `shopware-commerce-web-{stage,prod}` on merge to `main` (`apps/web/component.yaml`) |

Cache Components are off: `@opennextjs/cloudflare` 1.20 cannot run Next.js
16's Cache Components on workerd yet (a Cache Components page answers 500 and
then hangs), so the storefront keeps every `"use cache"` read, its lifetime
and its tags through `experimental.useCache`, and renders each route at
request time from those cached reads.

## Custom domain

The store answers on workers.dev from its first deploy. To serve it on your
own domain:

1. Add the domain to the Cloudflare account the store deploys into, and attach
   it to the Worker (dashboard → Workers & Pages →
   `shopware-commerce-web-prod` → Settings → Domains & Routes → Add →
   Custom domain).
2. Set the environment's public origin in `intent.yaml`, so the next deploy
   builds the store's sitemap, robots.txt and Open Graph URLs for it (until
   then they use the workers.dev URL):

   ```yaml
   environments:
     prod:
       env:
         SITE_URL: https://shop.example.com
   ```

   The store was born with the reserved placeholder
   `shopware-commerce.example.com` where its domain goes: `BASE_DOMAIN` under
   each environment in `intent.yaml`. Replace it with your domain in the same
   change, and land it with a change under `apps/web` so the merge rebuilds
   the store. Point your shop's revalidation call at the new domain too.

## Licence

The storefront is Shopware's Next.js starter, under the MIT licence
(`apps/web/license.md`).
