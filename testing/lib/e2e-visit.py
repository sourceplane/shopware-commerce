#!/usr/bin/env python3
"""What a visitor does to the served Worker — testing/e2e.test.sh's stages 3 and 4.

    e2e-visit.py born      <url> <values.json>
    e2e-visit.py connected <url> <values.json>    (E2E_API, E2E_BEARER)

`born` is a fresh product, no Shopware store: `/` says "Connect your Shopware
store" under the product's name; every storefront page answers (empty, with
the connect note), never a 500; `/api/health` says not connected;
revalidation is off (503); the Open Graph image draws; the sitemap lists the
home page alone.

`connected` is the same product built with the stand-in Store API
(testing/lib/fake-shopware.mjs) as its store: the home grid, the carousel,
search, a category, a product and a CMS page render from it; a second visit
reads the catalogue not at all (every read is a `"use cache"` entry in the
local R2 bucket — only the shopper's own cart is read per visit); a change in
the store does not show until the bearer-checked revalidation route drops the
`products` tag, and then only products are read again; a missing or wrong
bearer is refused and drops nothing.
"""
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

mode, base, values = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
name = values["productname"]
# Upstream's store name: residue in a product named anything else.
UPSTREAM_NAME = "Next.js Shopware Starter"
renamed = name != UPSTREAM_NAME
problems = []


def bad(m):
    problems.append(m)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


opener = urllib.request.build_opener(NoRedirect)


def request(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=dict(headers or {}), method=method)
    try:
        r = opener.open(req, timeout=90)
    except urllib.error.HTTPError as e:
        r = e
    return r.status, r.headers, r.read()


def get(path, headers=None):
    s, h, b = request(base + path, headers=headers)
    return s, h, b.decode("utf-8", "replace")


def text(page):
    return html.unescape(page)


def title_of(page):
    m = re.search(r"<title>(.*?)</title>", page, re.S)
    return html.unescape(m.group(1)) if m else None


def done(summary):
    if problems:
        for p in problems:
            print(f"  ✕ {p}", file=sys.stderr)
        sys.exit(1)
    for line in summary:
        print(f"   {line}")
    sys.exit(0)


def check_og():
    status, h, body = request(base + "/opengraph-image")
    if status != 200 or (h.get("content-type") or "") != "image/png" or not body.startswith(b"\x89PNG"):
        bad(f"/opengraph-image answered {status} {h.get('content-type')}, not a PNG")


# ── a fresh product: no Shopware store ───────────────────────────────────
if mode == "born":
    status, _, page = get("/")
    if status != 200:
        bad(f"/ answered {status}, not 200")
    if "Connect your Shopware store" not in text(page):
        bad("/ does not say \"Connect your Shopware store\"")
    if "data-connect-store" not in page:
        bad("/ carries no connect-store note")
    if title_of(page) != name:
        bad(f"/'s <title> is {title_of(page)!r}, not the store's name {name!r}")
    if renamed and UPSTREAM_NAME in text(page):
        bad(f"/ still names the store {UPSTREAM_NAME!r}")
    for path in ("/search", "/search?q=shirt", "/search/Clothing", "/product/a-shirt", "/cms/About-us"):
        status, _, page = get(path)
        if status != 200 or "data-connect-store" not in page:
            note = "with" if "data-connect-store" in page else "without"
            bad(f"{path} answered {status} {note} the connect note")
    status, _, body = get("/api/health")
    if status != 200 or json.loads(body or "{}") != {"ok": True, "connected": False}:
        bad(f"/api/health answered {status} {body[:80]!r}, not ok and not connected")
    status, _, body = request(base + "/api/revalidate", data=b"", method="POST",
                              headers={"authorization": "Bearer anything"})
    if status != 503:
        bad(f"POST /api/revalidate answered {status} with no secret configured, not 503")
    status, _, body = get("/sitemap.xml")
    locs = re.findall(r"<loc>(.*?)</loc>", body)
    if status != 200 or len(locs) != 1:
        bad(f"/sitemap.xml answered {status} with {len(locs)} location(s), not the home page alone")
    check_og()
    status, h, _ = request(base + "/favicon.ico")
    if status != 200:
        bad(f"/favicon.ico answered {status}")
    done([
        "/ asks for a Shopware store under the product's name; search, a category, a product and a page",
        "answer empty with the connect note; /api/health says not connected; revalidation is off (503);",
        "the sitemap lists the home page alone; the Open Graph image draws; never a 500",
    ])

# ── the same product, with a store connected ─────────────────────────────
api = os.environ["E2E_API"]
bearer = os.environ["E2E_BEARER"]


def api_call(path, method="GET"):
    s, _, b = request(api + path, data=b"" if method == "POST" else None, method=method)
    return json.loads(b or b"{}")


def catalogue_reads():
    return {op: n for op, n in api_call("/__calls").items() if op not in ("readCart", "readContext")}


PRODUCT = "/product/Sample-Shirt/SW-1001"
ROUTES = (
    ("/", ("Sample Shirt v1", "Sample Mug v1", "Sample Tote v1")),
    ("/search", ("Sample Shirt v1",)),
    ("/search?q=mug", ("Sample Mug v1",)),
    ("/search/Clothing", ("Sample Tote v1",)),
    (PRODUCT, ("Sample Shirt v1", "Add To Cart")),
    ("/cms/About-us", ("About this sample store",)),
)

status, _, body = get("/api/health")
if json.loads(body or "{}") != {"ok": True, "connected": True}:
    bad(f"/api/health answered {status} {body[:80]!r}, not connected")

# The first visit fills the cache (the deploy's smoke already visited `/`).
for path, must in ROUTES:
    status, _, page = get(path)
    if status != 200:
        bad(f"{path} answered {status}")
        continue
    if "data-connect-store" in page:
        bad(f"{path} still says no store is connected")
    for m in must:
        if m not in text(page):
            bad(f"{path} does not show {m!r}")
if renamed:
    status, _, page = get("/")
    if title_of(page) != name:
        bad(f"/'s <title> is {title_of(page)!r}, not the store's name {name!r}")

# The second visit: every catalogue read is a cache hit.
api_call("/__reset", "POST")
for path, _ in ROUTES:
    get(path)
second = catalogue_reads()
if second:
    bad(f"a second visit read the store again: {second}")

# A change in the store is not shown until the tag is revalidated.
api_call("/__bump", "POST")
api_call("/__reset", "POST")
_, _, page = get(PRODUCT)
if "Sample Shirt v1" not in text(page):
    bad("the product page showed the store's change before any revalidation")
if catalogue_reads():
    bad(f"the stale product page read the store: {catalogue_reads()}")

for headers in ({}, {"authorization": "Bearer wrong"}, {"authorization": bearer}):
    status, _, body = request(base + "/api/revalidate?tag=products", data=b"", method="POST", headers=headers)
    if status != 401:
        bad(f"POST /api/revalidate with {headers or 'no credential'} answered {status}, not 401")
_, _, page = get(PRODUCT)
if "Sample Shirt v1" not in text(page):
    bad("a refused revalidation dropped the cache")

status, _, body = request(base + "/api/revalidate?tag=products", data=b"", method="POST",
                          headers={"authorization": f"Bearer {bearer}"})
if status != 200 or json.loads(body or "{}").get("tags") != ["products"]:
    bad(f"POST /api/revalidate with the bearer answered {status} {body[:120]!r}")
api_call("/__reset", "POST")
# stale-while-revalidate: the first visit may still be served the old entry
# while the new one is fetched; within a few visits it is the new one.
fresh = False
for _ in range(10):
    _, _, page = get(PRODUCT)
    if "Sample Shirt v2" in text(page):
        fresh = True
        break
    time.sleep(1)
if not fresh:
    bad("the product page never showed the store's change after revalidation")
reread = catalogue_reads()
if not reread.get("readProduct"):
    bad(f"revalidation did not read the product again: {reread}")
if reread.get("readNavigation") or reread.get("readCategory"):
    bad(f"revalidating `products` re-read the collections too: {reread}")

check_og()
status, _, body = get("/sitemap.xml")
locs = re.findall(r"<loc>(.*?)</loc>", body)
if status != 200 or not any("/product/Sample-Shirt/SW-1001" in loc for loc in locs):
    bad(f"/sitemap.xml answered {status} without the store's products ({len(locs)} locations)")

done([
    "the home grid, the carousel, search, a category, a product and a CMS page render from the store;",
    "a second visit reads the catalogue not at all; a change in the store waits for the bearer-checked",
    "revalidation, which re-reads the products alone; a missing or wrong bearer drops nothing",
])
