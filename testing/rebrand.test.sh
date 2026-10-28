#!/usr/bin/env bash
# THE REBRAND WRITES EACH VALUE ONCE, AND WHAT IT WROTE STAYS WRITTEN.
#
# Drives the real tooling/rebrand/rebrand.mjs over one-file trees and compares
# the file. Each case is a shape this baseline's identity actually takes in the
# tree — the repository link, the store-name seam, the worker name in the
# component and the wrangler config (and the Worker's self-reference binding),
# the R2 bucket names and the terraform `repo` they are built from, the
# placeholder domain, a secret ref — and the survival cases run through three
# passes, so a value an earlier rebrand wrote (a re-run phase re-runs the
# rebrand over everything placed) comes out of every later one unchanged.
#
# Two cases pin what makes a shipped file spell this baseline's slug and its
# code form only where they ARE the identity: the slug in prose IS the slug to
# the rename, and the Pascal form anywhere is residue. The storefront's own
# word, `Shopware`, is not this identity: one case pins that no rule touches it.
#
# The identity is PINNED (fixtures/baseline-identity.shopware-commerce.json) rather
# than read from .baseline/identity.json: what this tests is the engine, and
# its fixtures spell the identity out literally.
#
# Needs: node, git. No network.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
rebrand="$here/../tooling/rebrand/rebrand.mjs"
identity="$here/fixtures/baseline-identity.shopware-commerce.json"

fail=0
# check NAME VALUES-JSON FILE CONTENT WANT [PASSES]
check() {
  local name="$1" values="$2" file="$3" content="$4" want="$5" passes="${6:-1}"
  local tmp got out i
  tmp="$(mktemp -d)"
  git -C "$tmp" init -q
  mkdir -p "$tmp/$(dirname "$file")" "$tmp/.rebrand"
  printf '%s\n' "$content" > "$tmp/$file"
  printf '%s\n' "$values" > "$tmp/.rebrand/values.json"
  for ((i = 1; i <= passes; i++)); do
    git -C "$tmp" add -A
    if ! out="$(cd "$tmp" && node "$rebrand" --baseline-identity "$identity" --values .rebrand/values.json --allow-dirty 2>&1)"; then
      echo "   ✕  $name: rebrand pass $i failed:" >&2
      printf '%s\n' "$out" | sed 's/^/        /' >&2
      fail=1
      rm -rf "$tmp"
      return
    fi
  done
  got="$(cat "$tmp/$file")"
  rm -rf "$tmp"
  if [ "$got" = "$want" ]; then
    echo "   ok  $name"
  else
    echo "   ✕  $name:" >&2
    echo "        got:  $got" >&2
    echo "        want: $want" >&2
    fail=1
  fi
}

acme='{"reponame":"acme-shop","productname":"Acme Shop","productdomain":"shop.acme.dev","githuborg":"acme-inc","subdomain":"acme","orunWorkspace":"ws_79BDXAZQ"}'

echo "── rebrand: the store's own identity"
check "the repository link names the product's owner and repository" \
  "$acme" README.md \
  'The source is [github.com/sourceplane/shopware-commerce](https://github.com/sourceplane/shopware-commerce).' \
  'The source is [github.com/acme-inc/acme-shop](https://github.com/acme-inc/acme-shop).'
check "the store-name seam takes the product's name" \
  "$acme" apps/web/app/site.ts 'export const SITE_NAME = "Next.js Shopware Starter";' \
  'export const SITE_NAME = "Acme Shop";'
check "…and stays a valid string for a name with an apostrophe and an ampersand" \
  '{"reponame":"sams-shop","productname":"Sam'"'"'s Tees & Mugs","productdomain":"sam.dev"}' \
  apps/web/app/site.ts 'export const SITE_NAME = "Next.js Shopware Starter";' \
  'export const SITE_NAME = "Sam'"'"'s Tees & Mugs";'
check "the worker name is re-prefixed" \
  "$acme" apps/web/component.yaml 'workerName: shopware-commerce-web' \
  'workerName: acme-shop-web'
check "the wrangler config's worker name, the environment token kept" \
  "$acme" apps/web/wrangler.template.jsonc '  "name": "shopware-commerce-web-__ENV__",' \
  '  "name": "acme-shop-web-__ENV__",'
check "the Worker's self-reference binding names the same Worker" \
  "$acme" apps/web/wrangler.jsonc \
  '    { "binding": "WORKER_SELF_REFERENCE", "service": "shopware-commerce-web-stage" },' \
  '    { "binding": "WORKER_SELF_REFERENCE", "service": "acme-shop-web-stage" },'
check "the environment URLs: worker name and subdomain" \
  "$acme" intent.yaml '    url: https://shopware-commerce-web-stage.your-workers-subdomain.workers.dev' \
  '    url: https://acme-shop-web-stage.acme.workers.dev'
check "the R2 root's terraform repo — every bucket name is built on it" \
  "$acme" infra/terraform/cloudflare-r2/terraform/main.tf '  default = "shopware-commerce"' \
  '  default = "acme-shop"'
check "the per-environment terraform repo parameter" \
  "$acme" intent.yaml '        repo: shopware-commerce' \
  '        repo: acme-shop'
check "a fixture's bucket name follows the same rule" \
  "$acme" apps/web/wiring.fixture.json '    "r2_bucket_name": "stg-shopware-commerce-stage"' \
  '    "r2_bucket_name": "stg-acme-shop-stage"'
check "the placeholder domain is the product's domain, not a renamed slug" \
  "$acme" intent.yaml '      BASE_DOMAIN: shopware-commerce.example.com' \
  '      BASE_DOMAIN: shop.acme.dev'
check "no domain given: the reserved placeholder, for an owner to replace later" \
  '{"reponame":"acme-shop","productname":"Acme Shop","githuborg":"acme-inc","subdomain":"acme"}' \
  intent.yaml '      BASE_DOMAIN: shopware-commerce.example.com' \
  '      BASE_DOMAIN: acme-shop.example.com'
check "an empty domain is no domain" \
  '{"reponame":"acme-shop","productname":"Acme Shop","productdomain":""}' \
  intent.yaml '      BASE_DOMAIN: shopware-commerce.example.com' \
  '      BASE_DOMAIN: acme-shop.example.com'
check "the repo slug" \
  "$acme" package.json '  "name": "shopware-commerce",' \
  '  "name": "acme-shop",'
check "a wiring secret ref names the product's workspace and project" \
  "$acme" apps/web/component.yaml \
  '    WIRING_CLOUDFLARE_R2_STAGE: "secret://shopware-commerce/shopware-commerce/stage/WIRING_CLOUDFLARE_R2"' \
  '    WIRING_CLOUDFLARE_R2_STAGE: "secret://ws_79BDXAZQ/acme-shop/stage/WIRING_CLOUDFLARE_R2"'
check "the R2 root's templated token ref too" \
  "$acme" infra/terraform/cloudflare-r2/component.yaml \
  '    CLOUDFLARE_API_TOKEN: "secret://shopware-commerce/shopware-commerce/{{ .environment }}/CLOUDFLARE_R2_TOKEN"' \
  '    CLOUDFLARE_API_TOKEN: "secret://ws_79BDXAZQ/acme-shop/{{ .environment }}/CLOUDFLARE_R2_TOKEN"'
check "org-owned identity is not renamed" \
  "$acme" intent.yaml 'apiVersion: sourceplane.io/v1 # mail ops@sourceplane.ai' \
  'apiVersion: sourceplane.io/v1 # mail ops@sourceplane.ai'
check "without githuborg the repository link keeps the baseline's owner" \
  '{"reponame":"acme-shop","productname":"Acme Shop","productdomain":"shop.acme.dev"}' \
  README.md 'https://github.com/sourceplane/shopware-commerce' \
  'https://github.com/sourceplane/acme-shop'
check "THE HAZARD: in prose the rename takes the slug for the slug" \
  "$acme" apps/web/README.md 'the shopware-commerce storefront' \
  'the acme-shop storefront'
check "the storefront's own word is not this identity: Shopware's names are left alone" \
  "$acme" apps/web/lib/shopware/api.ts \
  'const KEY = process.env.SHOPWARE_ACCESS_TOKEN; // @shopware/api-client, Shopware AG' \
  'const KEY = process.env.SHOPWARE_ACCESS_TOKEN; // @shopware/api-client, Shopware AG'

echo "── rebrand: a written value is not rewritten, in any later pass"
contains='{"reponame":"shopware-commerce-2","productname":"Next.js Shopware Starter 2","productdomain":"shopware-commerce.example.com.au","githuborg":"sourceplane","subdomain":"your-workers-subdomain-2"}'
check "a repo slug containing the baseline's slug survives three passes" \
  "$contains" package.json '  "name": "shopware-commerce",' \
  '  "name": "shopware-commerce-2",' 3
check "a worker name built on it survives three passes" \
  "$contains" apps/web/component.yaml 'workerName: shopware-commerce-web' \
  'workerName: shopware-commerce-2-web' 3
check "a bucket name built on it survives three passes" \
  "$contains" apps/web/wiring.fixture.json '"r2_bucket_name": "prod-shopware-commerce-prod"' \
  '"r2_bucket_name": "prod-shopware-commerce-2-prod"' 3
check "a domain containing the baseline's domain survives three passes" \
  "$contains" intent.yaml 'BASE_DOMAIN: shopware-commerce.example.com' \
  'BASE_DOMAIN: shopware-commerce.example.com.au' 3
check "a subdomain containing the placeholder survives three passes" \
  "$contains" apps/web/component.yaml 'workersDevSubdomain: your-workers-subdomain' \
  'workersDevSubdomain: your-workers-subdomain-2' 3
check "a store name containing the baseline's name survives three passes" \
  "$contains" apps/web/app/site.ts 'export const SITE_NAME = "Next.js Shopware Starter";' \
  'export const SITE_NAME = "Next.js Shopware Starter 2";' 3
prefixed='{"reponame":"acme-shopware-commerce","productname":"Sam'"'"'s Tees & Mugs","productdomain":"shop.acme.dev","githuborg":"acme-inc","subdomain":"acme","orunWorkspace":"ws_79BDXAZQ"}'
check "a slug that ENDS in the baseline's slug survives three passes (the e2e fixture's)" \
  "$prefixed" apps/web/wrangler.jsonc '"service": "shopware-commerce-web-stage"' \
  '"service": "acme-shopware-commerce-web-stage"' 3
check "…and so does its bucket name" \
  "$prefixed" apps/web/wiring.fixture.json '"r2_bucket_name": "stg-shopware-commerce-stage"' \
  '"r2_bucket_name": "stg-acme-shopware-commerce-stage"' 3
check "…and, with no domain, its placeholder (which ends in the baseline's domain)" \
  '{"reponame":"acme-shopware-commerce","productname":"Sam'"'"'s Tees & Mugs","githuborg":"acme-inc","subdomain":"acme"}' \
  intent.yaml '      BASE_DOMAIN: shopware-commerce.example.com' \
  '      BASE_DOMAIN: acme-shopware-commerce.example.com' 3

# --verify runs in every phase. Without the product's values it cannot tell
# the product's own identity from a leftover; with them it can. A real
# leftover must fail it either way.
verify() { # NAME VALUES FILE CONTENT WANT(pass|fail) [--values]
  local name="$1" values="$2" file="$3" content="$4" want="$5" withvalues="${6:-}" tmp got
  tmp="$(mktemp -d)"
  git -C "$tmp" init -q
  mkdir -p "$tmp/$(dirname "$file")" "$tmp/.rebrand"
  printf '%s\n' "$content" > "$tmp/$file"
  printf '%s\n' "$values" > "$tmp/.rebrand/values.json"
  git -C "$tmp" add -A
  if (cd "$tmp" && node "$rebrand" --baseline-identity "$identity" --verify ${withvalues:+--values .rebrand/values.json} >/dev/null 2>&1); then got=pass; else got=fail; fi
  rm -rf "$tmp"
  if [ "$got" = "$want" ]; then echo "   ok  $name"; else echo "   ✕  $name: --verify ${got}ed, want $want" >&2; fail=1; fi
}
echo "── rebrand --verify: the product's own identity is not residue"
verify "given the values, a slug containing the baseline's passes" \
  "$contains" package.json '"name": "shopware-commerce-2"' pass --values
verify "without them it cannot know, and fails" \
  "$contains" package.json '"name": "shopware-commerce-2"' fail
verify "given the values, a real leftover still fails" \
  "$acme" package.json '"name": "shopware-commerce"' fail --values
verify "a leftover worker name fails" \
  "$acme" apps/web/wrangler.jsonc '"name": "shopware-commerce-web-stage",' fail --values
verify "a leftover bucket name fails" \
  "$acme" apps/web/wiring.fixture.json '"r2_bucket_name": "stg-shopware-commerce-stage"' fail --values
verify "THE HAZARD: the Pascal form anywhere fails (no rule renames it — so nothing may spell it)" \
  "$acme" apps/web/components/banner.tsx 'export function ShopwareCommerceBanner() {}' fail --values
verify "a clean product passes" \
  "$acme" package.json '"name": "acme-shop"' pass --values
verify "a product whose own name carries the Pascal form passes, given the values" \
  '{"reponame":"acme-shop","productname":"ShopwareCommerce Outlet","productdomain":"shop.acme.dev"}' \
  apps/web/app/site.ts 'export const SITE_NAME = "ShopwareCommerce Outlet";' pass --values
verify "the storefront's own word is not residue" \
  "$acme" apps/web/lib/shopware/helpers.ts 'const domain = process.env.SHOPWARE_STORE_DOMAIN; // Shopware' pass --values

echo "── rebrand: a residue it cannot rename fails the rebrand itself"
tmp="$(mktemp -d)"; git -C "$tmp" init -q; mkdir -p "$tmp/.rebrand" "$tmp/apps/web"
printf '%s\n' "$acme" > "$tmp/.rebrand/values.json"
printf 'const x = "SHOPWARE_COMMERCE_TOKEN"\n' > "$tmp/apps/web/x.ts"
git -C "$tmp" add -A
if (cd "$tmp" && node "$rebrand" --baseline-identity "$identity" --values .rebrand/values.json --allow-dirty >/dev/null 2>&1); then
  echo "   ✕  an unrenamable env-var prefix passed the rebrand" >&2; fail=1
else
  echo "   ok  an unrenamable env-var prefix fails the rebrand, naming the file"
fi
rm -rf "$tmp"

[ "$fail" -eq 0 ] || exit 1
echo "rebrand.test.sh: ok"
