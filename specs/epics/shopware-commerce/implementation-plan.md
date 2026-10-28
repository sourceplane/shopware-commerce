# shopware-commerce — implementation plan

| Milestone | Lands | Done when |
|---|---|---|
| SW0 — the spec | the repository born (intent, CI, tooling, spec index), this doc set, SW-1…SW-3 | on main |
| SW1 — the storefront on Workers | `apps/web` (upstream at `7066aa7` plus the departures in IMPLEMENTATION-STATUS), `infra/terraform/cloudflare-r2`, `tests/web` | typecheck, lint, upstream's check, tests/web and build green with no store; served unconnected and connected under `wrangler dev` |
| SW2 — a baseline | `blueprint.yaml`, `repo-blueprint.yaml`, `.baseline/`, the rename engine and bootstrap helpers, the record renderer, the context pack, `testing/` with the stand-in Store API, `baseline.yml`, `tag.yml` | Baseline CI green; `baseline-v1` tagged |

Order inside SW1: the spike (Cache Components off, `useCache`, the R2/DO
caches, a cached read reused and revalidated under `wrangler dev`); the
build-time settings; the unconnected seam; the revalidation route; the Open
Graph images on workerd; the workspace; the tests.
