# shopware-commerce — where this repository stands

The entry page for anyone (or any agent) picking this repository up. It is
this repository's own state and does not ship to a storefront built from it;
the two pages that do are [operations.md](operations.md) and
[deployment.md](deployment.md).

## What it is

Shopware's Next.js starter (shopwareLabs/nextjs-shopware-starter — a fork of
Vercel's Next.js Commerce on Shopware 6's Store API) on Cloudflare Workers +
Static Assets through `@opennextjs/cloudflare`, its Next.js cache in an R2
bucket and two Durable Objects the Worker exports, packaged as an Orun
baseline: `orun new --blueprint repo-blueprint.yaml` builds a new storefront
in its own repository and takes it to live on stage and prod in one landing
(`01-product`) — the R2 bucket applied before the Worker that binds it —
then records what went live (`02-docs`). With no Shopware store connected
every page answers with an empty catalogue and `/` says "Connect your
Shopware store"; the owner connects a shop by setting its domain and access
key as Orun secrets and redeploying. The Worker is about 2.5 MiB gzipped, so
Workers Free is enough.

## Release

| | |
|---|---|
| Latest tag | `baseline-v1` (SW2) |
| Proven live | No. Everything short of the platform is proven offline in Baseline CI — the storefront built and served as born, then connected to a stand-in Store API, its cache reused and revalidated through the bearer-checked route. The tokens minted, a real R2 apply, a real `wrangler deploy`, the probes and a real Shopware shop are still to come (risk SW-A) |

## Where to read

| Question | Page |
|---|---|
| What shipped, and every departure from upstream | `specs/epics/shopware-commerce/IMPLEMENTATION-STATUS.md` |
| Why it is built this way | [decisions.md](decisions.md), then `specs/epics/shopware-commerce/design.md` |
| What could still go wrong | [open-risks.md](open-risks.md), then `specs/epics/shopware-commerce/risks-and-open-questions.md` |
| How to instantiate it | `BOOTSTRAP.md`, `docs/phases/` |
| What each component is | `apps/web/docs/`, `infra/terraform/cloudflare-r2/docs/`, `tests/web/docs/` (generated; `python3 tooling/catalog/gen-component-docs.py`) |

## Next

1. Bootstrap one storefront from `baseline-v1` and record its timings;
   connect Shopware's demo shop to it once, call the revalidation route, and
   run upstream's Playwright suite (`apps/web/e2e-tests`) against it. That
   closes SW-A.
2. When an npm release of @opennextjs/cloudflare runs Cache Components on
   workerd (opennextjs-cloudflare#1450), turn them back on (SW-C).
