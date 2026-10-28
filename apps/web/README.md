# apps/web — the storefront

Shopware's Next.js starter (MIT, `license.md`) — a fork of Vercel's Next.js
Commerce on Shopware 6's Store API — on Cloudflare Workers + Static Assets:
server components over the Store API, a server-action cart kept in your
shop, `"use cache"` reads revalidated by tag. The starter's pages and
components are kept; what this app adds is the Workers build, the cache
bindings, a storefront that says how to connect a shop while none is, a
bearer-checked revalidation route and `/api/health`.

- `app/` — the routes: home, `/search`, `/search/<category>`,
  `/product/<seo-url>`, `/cms/<page>` (the `(cms)/[...cms]` catch-all), the
  Open Graph images,
  `robots.txt`, `sitemap.xml`, `/api/revalidate` and `/api/health`
- `app/site.ts` — the store's name and the repository its footer links to
- `lib/shopware/` — the Store API client (`@shopware/api-client`), its cached
  readers and their tags, the transforms to the page's types, and the
  revalidation route's logic; `connection.ts` says whether a shop is
  connected, and while none is every reader answers empty without a call
- `api-types/`, `shopware.d.ts` — the Store API's types
  (`pnpm generate-types` regenerates them from your shop)
- `components/` — cart (server actions, modal), navbar, grid, carousel,
  product gallery and variants, the connect-store note
- `e2e-tests/` — upstream's Playwright suite, run by hand against a deployed
  storefront connected to a shop (`BASE_E2E_URL=https://<host> pnpm test:e2e`
  inside it); upstream ran it on Vercel's deployment events

```bash
pnpm dev        # next dev on http://localhost:3000
pnpm build      # next build + opennextjs-cloudflare build → .open-next/
pnpm test       # upstream's check: oxlint and the oxfmt format check
pnpm preview    # wrangler dev over the built Worker: a local R2 bucket, local Durable Objects
```

The cache's bucket is not hand-written. `wrangler.template.jsonc` names it as
a wiring token; `wrangler.jsonc` is that template rendered from
`wiring.fixture.json` (placeholder names, for local work and verification),
and every deploy renders it again from the name the `cloudflare-r2` Terraform
root published for the environment (`component.yaml`'s `buildCommand`).

## Store backend

| `SHOPWARE_STORE_DOMAIN` + `SHOPWARE_ACCESS_TOKEN` | catalogue, menus, pages                                                            | cart                                            |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| unset (a fresh deploy)                            | empty; `/` says "Connect your Shopware store" and every page carries the note      | none                                            |
| set (read by the build)                           | the Store API, cached in R2 (`"use cache"`), revalidated through `/api/revalidate` | the shop's own cart (`sw-context-token` cookie) |

Connecting a shop is two Orun secrets and a redeploy, and revalidation a
third — the repository's README, "Connecting Shopware".
