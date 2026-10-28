# shopware-commerce — open risks

What is not yet proven or not yet decided. The full write-up of every risk,
including the accepted and resolved ones, is
`specs/epics/shopware-commerce/risks-and-open-questions.md`; this page lists only what
is still live, so it should be short.

| ID | Risk | State | What closes it |
|---|---|---|---|
| SW-A | No live bootstrap yet: the repository created and linked, the two tokens minted, a real `terraform apply`, a real `wrangler deploy` with the R2 and Durable Object bindings and the revalidation secret, the probes, and a real Shopware shop connected | OPEN | One bootstrap from a tag against a workspace, then Shopware's demo shop connected and upstream's Playwright suite run against it |
| SW-B | Size headroom: the Worker is 2.48 MiB gzipped, half a MiB under Workers Free's 3 MiB | WATCH | `wrangler deploy --dry-run` in `apps/web` after a build prints the gzipped size; over 3 MiB, a Free account refuses the deploy |
| SW-C | Cache Components off until @opennextjs/cloudflare runs them on workerd | ACCEPTED | An npm release with a fix for opennextjs-cloudflare#1450 |
| SW-I | The cart's "Proceed to Checkout" links to Shopware's demo frontend, as upstream's does | OPEN — the owner's, stated in the README ("Checkout") | The owner points `checkoutUrl` at their shop's checkout |

Accepted, and worth knowing before you change them: SW-D (Next pinned to
16.3.8 with the adapter), SW-E (images unoptimized), SW-F (the first request
after a revalidation may be stale), SW-G (the stand-in is not a shop), SW-H
(the store-name seam; gated), SW-J (two coarse tags), SW-K (the access key
is in the Worker's bundle), SW-L (upstream's Playwright suite runs by hand).
