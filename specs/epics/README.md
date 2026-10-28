# Epics

Orun-style work programs. Each epic is a folder carrying `epic.yaml` (the
declaration the platform reads: slug, key prefix, milestones with exit
criteria and task keys) beside its doc set. The pull request that adds the
folder is the adoption; the merge creates the epic in the workspace.

| Epic | Cluster | Status | What it is |
|------|---------|--------|------------|
| [`shopware-commerce/`](./shopware-commerce/) | **SW** | ✅ Shipped (`baseline-v1`); live bootstrap pending | Shopware's Next.js starter (a Next.js Commerce fork on Shopware 6's Store API) on Cloudflare Workers, its Store API reads cached in R2 and revalidated by a bearer-checked route — and an Orun baseline that instantiates it in one landing, live before a store is connected (SW2) |

As-built ≠ intent: what shipped lives in each epic's `IMPLEMENTATION-STATUS.md`.
