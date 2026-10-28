# web-tests

The port's vitest suite — the store-name seam, the Shopware connection seam, /api/health, the store-domain helper and the revalidation route (its bearer check and its tags)

The test suite for **web**. It deploys nothing: its lane installs, builds and runs the tests.

|              |                      |
| ------------ | -------------------- |
| Type         | `turbo-package`      |
| Source       | `tests/web`          |
| Package      | `@app/web-tests`     |
| Environments | `dev`: `quick-check` |

## Depends on

- (none)

## Depended on by

- (none)
