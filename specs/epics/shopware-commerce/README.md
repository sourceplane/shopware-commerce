# shopware-commerce — Shopware's Next.js starter on Cloudflare Workers

**Shopware's starter is Vercel's Next.js Commerce rebuilt on Shopware 6's
Store API, with Next.js 16's Cache Components on. The port keeps every one
of its `"use cache"` reads — their lifetimes and their tags — and moves them
onto Cloudflare: one Worker, its data cache in R2, its tag cache in Durable
Objects, and the revalidation route upstream left as a stub made to work.
Cache Components are the one thing the adapter cannot run yet. A product
built from it deploys before its owner connects a shop, and sells from
theirs once they set its domain and access key.**

| | |
|---|---|
| Status | In progress — SW1 on main: the site runs on Workers |
| Upstream | [shopwareLabs/nextjs-shopware-starter](https://github.com/shopwareLabs/nextjs-shopware-starter) (MIT, `license.md`), at `7066aa7` (2026-05-20) |
| Reference | [commerce](https://github.com/sourceplane/commerce) — the same OpenNext, R2 and Durable Object shape for a Next.js Commerce storefront on a hosted commerce API |
| Key | `SW` |

## Read in this order

1. [design.md](design.md) — the storefront, how each Vercel piece maps to
   Cloudflare, the cache, build-time settings, the unconnected store,
   revalidation, the tests, and the alternatives rejected.
2. [implementation-plan.md](implementation-plan.md) — the milestones and
   what each one lands.
3. [risks-and-open-questions.md](risks-and-open-questions.md) — what is not
   proven, and what was accepted.
4. [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) — what shipped, and
   every departure from upstream.

## Milestones

| Milestone | What it lands | Task |
|---|---|---|
| SW0 — the spec | this doc set and the three task contracts | SW-1 |
| SW1 — the storefront on Workers | `apps/web`, the R2 root, `tests/web` | SW-2 |
| SW2 — a baseline | the card, the build document, the rename, the tiers | SW-3 |
