# shopware-commerce — risks and open questions

| ID | Risk | State | Notes |
|---|---|---|---|
| SW-A | Not proven live: the repository and link, the minted tokens, a real `terraform apply` and `wrangler deploy`, the revalidation secret put on a real Worker, the probes, a real Shopware shop | OPEN | Baseline CI proves everything else offline; one bootstrap with Shopware's demo shop connected closes it |
| SW-B | Size: the Worker is 2.48 MiB gzipped (10.7 MiB raw), half a MiB under Workers Free's 3 MiB | WATCH | `wrangler deploy --dry-run` after a build prints the size; a dependency upgrade could cross the line |
| SW-C | Cache Components off | ACCEPTED | opennextjs-cloudflare#1450; turning them back on needs no change to the `"use cache"` reads |
| SW-D | Next pinned to 16.3.8 (upstream 16.2.6) | ACCEPTED | The adapter's peer range starts at 16.3.8 on 16.x; 16.4.x fails every request on 1.20.11 |
| SW-E | Images unoptimized | ACCEPTED | Shopware generates thumbnails; the owner's media host is not known at build |
| SW-F | `revalidateTag(tag, "seconds")` is stale-while-revalidate | ACCEPTED | The first request after a revalidation may be served the old entry while the fresh one is read; the e2e allows ten visits |
| SW-G | The e2e's store is a stand-in: the calls the storefront makes, answered from a three-product catalogue; the cart is read but no line item is added end to end | ACCEPTED | Upstream's Playwright suite adds to a real cart; a real shop is SW-A |
| SW-H | The store's name: the rename rewrites one line and the sweep does not look for it | ACCEPTED, gated | The leak gate fails any other spelling under `app/`, `components/` and `lib/`; the placement and e2e tiers check the branded product |
| SW-I | The cart's "Proceed to Checkout" links to Shopware's demo frontend (`checkoutUrl` in `lib/shopware/transform.ts`), as upstream's does | OPEN — the owner's | Stated in the product's README ("Checkout"); the storefront has no checkout of its own, as upstream |
| SW-J | Two coarse tags: revalidating `products` drops every product entry | ACCEPTED | Upstream's own tags; a finer scheme would change every reader |
| SW-K | The sales channel's access key is inlined into the Worker's bundle | ACCEPTED | It is Shopware's public Store API key (it reads what the channel publishes and acts on a shopper's own cart); no client bundle carries it; it is an Orun secret, never committed |
| SW-L | Upstream's Playwright suite is carried but no tier runs it | ACCEPTED | It needs a live shop; its CMS-page check expects upstream's demo title, so it fails one check under any other store name (README) |
