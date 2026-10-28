# shopware-commerce — operating contract (for humans and agents)

This is the standing guide to how this store is deployed and operated.
Instance facts (live URLs, workspace, whether a Shopware store is connected,
the secrets it uses) live in [deployment.md](deployment.md), rendered from
probed reality by the bootstrap's `02-docs` phase; this file is the contract
that stays true between deployments. It is written to give an agent with
repository read access enough context to reason about and operate the store
without any other source.

## What this system is

A Shopware storefront on Cloudflare, expressed as an Orun component-native
desired-state repo. Shopware itself — the catalogue, categories, carts,
customers, checkout and orders — is the owner's shop (Shopware's own cloud or
their own install), reached over its Store API with a sales channel's access
key; nothing here runs Shopware.

- **`infra/terraform/cloudflare-r2`** — one R2 bucket per deployed
  environment (`stage`, `prod`), applied by Terraform: the storefront's
  Next.js incremental cache. After each apply it publishes a wiring document
  — `{r2_bucket_name}` — as the Orun secret `WIRING_CLOUDFLARE_R2` on that
  environment.
- **`apps/web`** — the storefront: Shopware's Next.js starter built by
  `@opennextjs/cloudflare` into one Worker plus Static Assets. Every route
  renders per request from cached Store API reads: each read in
  `lib/shopware/index.ts` is a `"use cache"` function with `cacheLife("hours")`
  and one of two tags — `collections` (navigation, categories, CMS pages,
  the home grid and carousel) or `products` (products, listings, search,
  cross-selling). The shopper's cart is never cached. The Worker binds the
  bucket (`NEXT_INC_CACHE_R2_BUCKET`) and exports two Durable Objects: the
  tag cache and the revalidation queue.
- **`tests/web`** — the store-name seam, the connection seam, `/api/health`,
  the store-domain helper and the revalidation route (vitest). It does not
  run in a lane: the `dev` lane of `tests/web` installs it and checks its
  structure, so run `pnpm typecheck`, `pnpm lint` and `pnpm test` before you
  push.
- **`tooling/*`** — shared TypeScript and ESLint configuration, the wrangler
  renderer that turns `wrangler.template.jsonc` plus a wiring document into
  `wrangler.jsonc`, and the step that puts the revalidation secret on the
  Worker after its build.

Environments: **`stage`** and **`prod`** are deployed; **`dev` is
verify-only by design** — lanes build and dry-deploy, nothing deploys, and
no bucket exists for it (its build renders the committed fixture).

The Worker is about 2.5 MiB gzipped, inside Workers Free's 3 MiB.

## Identity and tenancy

Every remote operation runs against ONE Orun workspace, declared in
`intent.yaml` under `execution.state.workspace` — committed, enforced, and
what CI uses. Do not remove it; headless credentials depend on it. If it
reads `ws_SET_ME`, the bootstrap had no workspace to write: set the real one
before anything else.

## How deployment works

1. Merge (or push) to `main`.
2. CI (`.github/workflows/ci.yml`) runs `orun plan --changed` — only
   components whose files changed are planned — then runs each planned lane
   with `orun run --remote-state`, authenticated by GitHub OIDC (the
   exchange resolves this repository's linked workspace server-side).
3. **The bucket before the Worker.** `cloudflare-r2` applies for the
   environment and publishes `WIRING_CLOUDFLARE_R2`. `apps/web` declares an
   enforced `dependsOn` on it for pushes to `main`, so its deploy starts only
   after that apply — and a job resolves its secrets when it starts, so the
   document is there.
4. `apps/web` renders `wrangler.jsonc` from that document (the real bucket
   name) and builds once per environment: `NEXT_PUBLIC_SITE_URL` is the
   environment's `SITE_URL` (intent.yaml) or its workers.dev URL, and the
   shop is the environment's `SHOPWARE_STORE_DOMAIN` and
   `SHOPWARE_ACCESS_TOKEN` secrets, when set — inlined by the build. The
   build runs without `SHOPWARE_REVALIDATION_SECRET`; once it is done,
   `tooling/wire/worker-secrets.mjs` puts that secret (when set) on
   `shopware-commerce-web-<env>`. `wrangler deploy` ships the Worker (the
   Durable Objects are created by the config's migration on the first
   deploy), and a smoke test fetches `/` and `/api/health`, which only the
   Worker answers.
5. `prod` deploys after `stage` has converged on the same commit
   (`environments.prod.promotion` in intent.yaml).
6. **The convergence run is the deployment.** A green run means every
   planned lane applied. Failed lanes are retried with
   `gh run rerun --failed`, which resumes the same execution.

On a pull request nothing applies or deploys: the R2 root plans, the
storefront builds and dry-deploys, and the edges in step 3 are advisory.

Caveats that matter:

- A push that touches no component files plans zero lanes — that run is
  green and deployed nothing. Never treat "latest run green" as "store
  converged"; probe the URLs instead.
- A change to `intent.yaml`'s `environments` maps to no component and
  redeploys nothing on its own. Land it with a change under `apps/web`.
- Setting or changing any `SHOPWARE_*` secret deploys nothing: the domain
  and the key are read when the storefront builds, and the revalidation
  secret is put on the Worker by its deploy. Redeploy it (below).
- `wrangler.jsonc` is generated. Edit `wrangler.template.jsonc`, run
  `pnpm run wire:fixture` and commit both; the deploy renders its own
  config from the template, so a stale committed render misleads local work.

## The store

- **No Shopware store connected** (no `SHOPWARE_STORE_DOMAIN` or no
  `SHOPWARE_ACCESS_TOKEN` for the environment): the storefront calls
  nothing; every page answers 200 with an empty catalogue and the note "No
  Shopware store is connected yet"; `/` says "Connect your Shopware store"
  and how; the sitemap lists `/` alone; `/api/health` answers
  `{"ok":true,"connected":false}`.
- **Connected**: the header is the shop's main navigation, the footer its
  footer navigation (its entries open as CMS pages under `/cms/`), the home
  page shows the categories `Summer-BBQ/Hidden-Category` (grid) and
  `Summer-BBQ/Hidden-Carousel-Category` (carousel), and categories, search
  and products use the sales channel's SEO URLs. The cart is the shop's (the
  `sw-context-token` cookie). There is no checkout of the storefront's own,
  as in Shopware's starter: the cart's checkout links to Shopware's
  guidance. `/api/health` answers `{"ok":true,"connected":true}`.
- **Revalidation**: `POST /api/revalidate` with `Authorization: Bearer
  <SHOPWARE_REVALIDATION_SECRET>` revalidates `?tag=products`,
  `?tag=collections`, or both with no `tag`, in the Durable Object tag
  cache; the next request is served the old entry while a fresh one is read
  (stale-while-revalidate), and the one after shows the change. A missing or
  wrong bearer is refused (401); an unknown tag is refused (400); with no
  secret set the route answers 503 and entries expire after their `hours`
  lifetime.

## Secrets model

- **Brokered provider secrets**: `CLOUDFLARE_API_TOKEN` (the
  `workers-deploy` scope: Workers Scripts and KV Storage write) deploys the
  Worker; `CLOUDFLARE_R2_TOKEN` (the `r2-data` scope: R2 Storage write) is
  what the R2 root's Terraform authenticates with, because the deploy token
  carries no R2; `CLOUDFLARE_ACCOUNT_ID` is the connection fact both bind.
  Minted per run from the workspace's Cloudflare connection — no long-lived
  values at rest, nothing to rotate by hand.
- **Wiring**: `WIRING_CLOUDFLARE_R2` on `stage` and `prod`, written by the R2
  root's apply (lease-published), read by the Worker's build as
  `WIRING_CLOUDFLARE_R2_<ENV>`. It holds the bucket name, not a credential.
- **The store**: `SHOPWARE_STORE_DOMAIN` and `SHOPWARE_ACCESS_TOKEN` per
  environment, Orun secrets the owner sets (`orun secrets set … --env
  <env>`), optional — read by the build and inlined. The access key is the
  sales channel's Store API key: it reads what the channel publishes and
  acts on a shopper's own cart, nothing of the shop's administration.
- **Revalidation**: `SHOPWARE_REVALIDATION_SECRET` per environment, an Orun
  secret the owner sets, optional. The build never sees it (`env -u`); the
  deploy hands it to `wrangler secret put` on `shopware-commerce-web-<env>`.
- Inspect by NAME only: `orun secrets list --org <ws> --project` and
  `--env stage|prod`; `wrangler secret list --name shopware-commerce-web-<env>`.
  No tooling in this repository prints a secret value, and no document in
  `ai/context/` may contain one.

## Verifying the system

```bash
# the storefront on each environment (also recorded, probed, in deployment.md);
# /api/health says whether a Shopware store is connected
curl -s https://shopware-commerce-web-stage.your-workers-subdomain.workers.dev/api/health
curl -s -o /dev/null -w '%{http_code}\n' https://shopware-commerce-web-prod.your-workers-subdomain.workers.dev/

# the wiring and the store the deploys read, and workspace readiness
orun secrets list --org <ws> --env stage && orun secrets list --org <ws> --env prod
orun integrations list --org <ws> --json && orun cloud check --org <ws>
```

## Common operations

| task | how |
|---|---|
| change the storefront | edit `apps/web` (its name: `apps/web/app/site.ts`), merge |
| connect a Shopware store | the README's "Connecting Shopware": `SHOPWARE_STORE_DOMAIN` and `SHOPWARE_ACCESS_TOKEN` per environment, then redeploy the storefront |
| let the shop revalidate | `SHOPWARE_REVALIDATION_SECRET` per environment, redeploy, and have the shop (Flow Builder's webhook action, an app, a job) call `/api/revalidate` with the bearer when products or categories change |
| revalidate by hand | `curl -X POST -H "Authorization: Bearer <SHOPWARE_REVALIDATION_SECRET>" "https://<host>/api/revalidate?tag=products"` (no `tag`: both) |
| change the home page's categories | the SEO paths in `apps/web/components/grid/three-items.tsx` and `apps/web/components/carousel.tsx` |
| refresh the Store API's types | `pnpm --filter @app/web generate-types` against your shop (`api-gen.config.json`), then `pnpm typecheck`; merge |
| deploy a change | merge to `main`; watch the run; failed lanes → `gh run rerun --failed` |
| deploy by hand | Orunbase's Deploy button, or `gh workflow run ci.yml --ref main -f environment=<env> [-f component=<a,b>]` — the named components (blank: every one) run in that environment as a merge runs them; started off `main` it is refused |
| redeploy without a change | edit the last line of `apps/web/component.yaml` (`# orun: redeploy <reason> <stamp>`) and merge — it is a deploy trigger, nothing reads it |
| empty the data cache | `POST /api/revalidate` with the bearer and no `tag`, or delete the bucket's `incremental-cache/` objects |
| add a binding (D1, KV, another bucket) | a Terraform root under `infra/terraform/` that publishes `WIRING_<ROOT>`, a token in `wrangler.template.jsonc`, its fixture entry, the root in the build's `--components`, the `WIRING_<ROOT>_<ENV>` secretEnv and an enforced `dependsOn` on it in `apps/web/component.yaml` |
| serve a custom domain | attach it to the Worker in Cloudflare and set `SITE_URL` for the environment in `intent.yaml` (README, "Custom domain"), then replace the placeholder `shopware-commerce.example.com` in `intent.yaml`'s `BASE_DOMAIN` with it |
| add a runtime secret | an Orun secret for the build (`optionalSecretEnv` in `apps/web/component.yaml`); for one the Worker reads at request time, also `env -u` it from the build and add a `--secret` to the `worker-secrets.mjs` step |
| headless credentials | `ORUN_TOKEN` (workspace-scoped) + `GITHUB_TOKEN` |

The deployment record is the bootstrap's `02-docs` phase. Re-running it (the
Orun console's Retry on that phase, or `orun new … --phase 02-docs`)
re-probes the URLs and re-renders [deployment.md](deployment.md); it is
idempotent.

## Evolution

Structural changes follow the same contract that deployed the store: add a
component under `apps/`, `infra/` or `packages/` with a `component.yaml`,
land it as a pull request, and the convergence run applies it. When
@opennextjs/cloudflare runs Cache Components on workerd, turning them back on
(`cacheComponents: true` in place of `experimental.useCache`) restores
upstream's setting; the `"use cache"` reads need no change.
