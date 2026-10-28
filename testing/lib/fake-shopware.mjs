#!/usr/bin/env node
// A stand-in Shopware 6 Store API, for testing a CONNECTED storefront offline.
//
//   node fake-shopware.mjs --port <n> --key <sw-access-key>
//
// It answers the thirteen Store API operations the storefront invokes
// (apps/web/lib/shopware/api.ts and components/cart/actions.ts) over a small,
// fixed catalogue shaped as Shopware answers them: the main navigation
// (Clothing, Summer BBQ), the two hidden categories the home page's grid and
// carousel read (`Summer-BBQ/Hidden-Category`,
// `Summer-BBQ/Hidden-Carousel-Category`), the footer navigation with one CMS
// page (`About-us`), three products with SEO URLs, search, cross-selling, the
// context and a cart keyed by `sw-context-token`. Every request must carry
// the sales channel's access key (`sw-access-key`); without it the answer is
// Shopware's 401.
//
// Control (for the e2e's cache assertions):
//   GET  /__calls   → {"<operation>": <reads>, …} since the last reset
//   POST /__reset   → zero the counts
//   POST /__bump    → every product name says the next version ("v2", …), so
//                     a page that still says "v1" was served from a cache
//   GET  /media/*   → a tiny SVG, for every image URL it hands out
import { createServer } from "node:http";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const port = Number(arg("port") ?? 4020);
const key = arg("key") ?? "";
if (!key) {
  console.error("usage: fake-shopware.mjs --port <n> --key <sw-access-key>");
  process.exit(2);
}
const origin = `http://127.0.0.1:${port}`;

let version = 1;
let calls = {};
const carts = new Map();
const NOW = "2026-10-01T00:00:00.000+00:00";

const seo = (id, path, routeName) => ({
  id: `seo-${id}`,
  foreignKey: id,
  seoPathInfo: path,
  routeName,
  pathInfo: `/${routeName}/${id}`,
  isCanonical: true,
  isDeleted: false,
  createdAt: NOW,
  updatedAt: NOW,
});

const PRODUCTS = [
  { id: "prod-shirt", slug: "Sample-Shirt/SW-1001", base: "Sample Shirt", price: 25 },
  { id: "prod-mug", slug: "Sample-Mug/SW-1002", base: "Sample Mug", price: 12 },
  { id: "prod-tote", slug: "Sample-Tote/SW-1003", base: "Sample Tote", price: 18 },
];

function product(p) {
  const name = `${p.base} v${version}`;
  const media = {
    id: `media-${p.id}`,
    url: `${origin}/media/${p.id}.svg`,
    alt: name,
    translated: { alt: name },
    metaData: { width: 800, height: 800 },
  };
  return {
    id: p.id,
    parentId: null,
    productNumber: p.slug.split("/")[1],
    name,
    available: true,
    availableStock: 10,
    description: `<p>${name}, a sample product.</p>`,
    metaDescription: `${name}, a sample product.`,
    translated: {
      name,
      description: `<p>${name}, a sample product.</p>`,
      metaDescription: `${name}, a sample product.`,
      metaTitle: name,
    },
    calculatedPrice: { unitPrice: p.price, totalPrice: p.price, quantity: 1 },
    calculatedCheapestPrice: { unitPrice: p.price, totalPrice: p.price, quantity: 1 },
    cover: { id: `pm-${p.id}`, media },
    media: [{ id: `pm-${p.id}`, media }],
    seoUrls: [seo(p.id, p.slug, "frontend.detail.page")],
    options: [],
    children: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function category(id, name, path, extra = {}) {
  return {
    id,
    name,
    type: "page",
    visible: true,
    childCount: 0,
    description: `${name}.`,
    translated: { name, metaTitle: name, metaDescription: `${name}.` },
    seoUrls: [seo(id, path, "frontend.navigation.page")],
    children: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...extra,
  };
}

const CATEGORIES = {
  "cat-clothing": category("cat-clothing", "Clothing", "Clothing/"),
  "cat-bbq": category("cat-bbq", "Summer BBQ", "Summer-BBQ/"),
  "cat-hidden": category("cat-hidden", "Hidden Category", "Summer-BBQ/Hidden-Category/"),
  "cat-carousel": category("cat-carousel", "Hidden Carousel Category", "Summer-BBQ/Hidden-Carousel-Category/"),
  "cat-about": category("cat-about", "About us", "About-us/", {
    cmsPage: {
      id: "cms-about",
      sections: [
        {
          blocks: [
            {
              slots: [
                {
                  type: "text",
                  slot: "content",
                  fieldConfig: { content: "<p>About this sample store.</p>" },
                  config: { content: { source: "static", value: "<p>About this sample store.</p>" } },
                  data: { content: "<p>About this sample store.</p>" },
                  translated: { config: { content: { value: "<p>About this sample store.</p>" } } },
                },
              ],
            },
          ],
        },
      ],
    },
  }),
};
const MEMBERS = {
  "cat-clothing": PRODUCTS,
  "cat-bbq": PRODUCTS,
  "cat-hidden": PRODUCTS,
  "cat-carousel": PRODUCTS,
};
const MAIN_NAV = ["cat-clothing", "cat-bbq"];
const FOOTER_NAV = [
  category("cat-info", "Information", "Information/", {
    childCount: 1,
    children: [CATEGORIES["cat-about"]],
  }),
];
const ALL_SEO = [
  ...Object.values(CATEGORIES).map((c) => c.seoUrls[0]),
  ...PRODUCTS.map((p) => seo(p.id, p.slug, "frontend.detail.page")),
];

// The values a criteria filter asks for, at any depth (`equals` and `multi`).
function equalsValues(filter, field) {
  const out = [];
  for (const f of filter ?? []) {
    if (f.type === "equals" && f.field === field) out.push(f.value);
    if (f.type === "equalsAny" && f.field === field) out.push(...[].concat(f.value));
    if (f.queries) out.push(...equalsValues(f.queries, field));
  }
  return out;
}

const listing = (items, body) => ({
  apiAlias: "product_listing",
  elements: items,
  total: items.length,
  limit: body?.limit ?? 15,
  page: body?.p ?? body?.page ?? 1,
  aggregations: {},
  sorting: null,
  availableSortings: [],
});

function cartFor(token) {
  if (!carts.has(token)) carts.set(token, { token, lineItems: [] });
  const cart = carts.get(token);
  const total = cart.lineItems.reduce((n, li) => n + li.price.totalPrice, 0);
  return {
    apiAlias: "cart",
    token: cart.token,
    name: "sales-channel",
    errors: {},
    lineItems: cart.lineItems,
    price: {
      netPrice: total,
      totalPrice: total,
      positionPrice: total,
      rawTotal: total,
      calculatedTaxes: [],
      taxStatus: "gross",
    },
  };
}

function lineItem(p, quantity) {
  const pr = product(p);
  return {
    id: p.id,
    referencedId: p.id,
    type: "product",
    label: pr.name,
    quantity,
    good: true,
    removable: true,
    stackable: true,
    cover: pr.cover.media,
    payload: { productNumber: pr.productNumber, options: [] },
    price: { unitPrice: p.price, totalPrice: p.price * quantity, quantity, calculatedTaxes: [] },
    seoUrls: pr.seoUrls,
  };
}

function route(method, path, body, token) {
  const count = (op) => (calls[op] = (calls[op] ?? 0) + 1);
  let m;
  if (method === "POST" && (m = path.match(/^\/navigation\/([^/]+)\/([^/]+)$/))) {
    count("readNavigation");
    return m[1] === "footer-navigation" ? FOOTER_NAV : MAIN_NAV.map((id) => CATEGORIES[id]);
  }
  if (method === "POST" && (m = path.match(/^\/category\/([^/]+)$/))) {
    count("readCategory");
    return CATEGORIES[m[1]] ?? [404, { errors: [{ status: "404", code: "CONTENT__CATEGORY_NOT_FOUND" }] }];
  }
  if (method === "POST" && path === "/category") {
    count("readCategoryList");
    const ids = equalsValues(body?.filter, "id").concat(equalsValues(body?.filter, "parentId"));
    const found = ids.map((id) => CATEGORIES[id]).filter(Boolean);
    return { elements: found, total: found.length };
  }
  if (method === "POST" && path === "/product") {
    count("readProduct");
    const ids = equalsValues(body?.filter, "id");
    const items = PRODUCTS.filter((p) => ids.length === 0 || ids.includes(p.id)).map(product);
    return { elements: items, total: items.length };
  }
  if (method === "POST" && (m = path.match(/^\/product-listing\/([^/]+)$/))) {
    count("readProductListing");
    return listing((MEMBERS[m[1]] ?? []).map(product), body);
  }
  if (method === "POST" && path === "/search") {
    count("searchPage");
    const term = String(body?.term ?? body?.search ?? "").toLowerCase();
    return listing(PRODUCTS.map(product).filter((p) => !term || p.name.toLowerCase().includes(term)), body);
  }
  if (method === "POST" && path === "/seo-url") {
    count("readSeoUrl");
    const paths = equalsValues(body?.filter, "seoPathInfo");
    const routes = equalsValues(body?.filter, "routeName");
    const found = ALL_SEO.filter(
      (s) => (paths.length && paths.includes(s.seoPathInfo)) || (routes.length && routes.includes(s.routeName)),
    );
    return { elements: found.slice(0, body?.limit ?? 100), total: found.length };
  }
  if (method === "POST" && (m = path.match(/^\/product\/([^/]+)\/cross-selling$/))) {
    count("readProductCrossSellings");
    return [];
  }
  if (method === "GET" && path === "/context") {
    count("readContext");
    return { token: token || "ctx-new", apiAlias: "sales_channel_context" };
  }
  if (method === "GET" && path === "/checkout/cart") {
    count("readCart");
    return cartFor(token || `ctx-${carts.size + 1}`);
  }
  if (method === "POST" && path === "/checkout/cart/line-item") {
    count("addLineItem");
    const cart = carts.get(token) ?? (carts.set(token, { token, lineItems: [] }), carts.get(token));
    for (const it of body?.items ?? []) {
      const p = PRODUCTS.find((x) => x.id === it.id || x.id === it.referencedId);
      if (!p) continue;
      const i = cart.lineItems.findIndex((li) => li.id === p.id);
      const q = Number(it.quantity ?? 1);
      if (i >= 0) cart.lineItems[i] = lineItem(p, q);
      else cart.lineItems.push(lineItem(p, q));
    }
    return cartFor(token);
  }
  if (method === "PATCH" && path === "/checkout/cart/line-item") {
    count("updateLineItem");
    const cart = carts.get(token);
    for (const it of body?.items ?? []) {
      const p = PRODUCTS.find((x) => x.id === it.id);
      const i = cart?.lineItems.findIndex((li) => li.id === it.id) ?? -1;
      if (p && i >= 0) cart.lineItems[i] = lineItem(p, Number(it.quantity));
    }
    return cartFor(token);
  }
  if (method === "POST" && path === "/checkout/cart/line-item/delete") {
    count("removeLineItem");
    const cart = carts.get(token);
    if (cart) cart.lineItems = cart.lineItems.filter((li) => !(body?.ids ?? []).includes(li.id));
    return cartFor(token);
  }
  return [404, { errors: [{ status: "404", code: "FRAMEWORK__ROUTE_NOT_FOUND", detail: `${method} ${path}` }] }];
}

createServer((req, res) => {
  const url = new URL(req.url, origin);
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const send = (status, obj, headers = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(JSON.stringify(obj));
    };
    if (url.pathname === "/__calls") return send(200, calls);
    if (url.pathname === "/__reset" && req.method === "POST") return ((calls = {}), send(200, { ok: true }));
    if (url.pathname === "/__bump" && req.method === "POST") return send(200, { version: ++version });
    if (url.pathname.startsWith("/media/")) {
      res.writeHead(200, { "content-type": "image/svg+xml" });
      return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#888"/></svg>');
    }
    if (!url.pathname.startsWith("/store-api/")) return send(404, { errors: [{ status: "404" }] });
    if (req.headers["sw-access-key"] !== key) {
      return send(401, { errors: [{ status: "401", code: "FRAMEWORK__API_SALES_CHANNEL_ACCESS_KEY_NOT_FOUND" }] });
    }
    let body;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      return send(400, { errors: [{ status: "400", code: "FRAMEWORK__INVALID_JSON" }] });
    }
    const token = req.headers["sw-context-token"] || "";
    const out = route(req.method, url.pathname.slice("/store-api".length), body, token);
    if (Array.isArray(out) && typeof out[0] === "number") return send(out[0], out[1]);
    const ctx = out && typeof out === "object" && "token" in out ? out.token : token || "ctx-new";
    return send(200, out, { "sw-context-token": ctx });
  });
}).listen(port, "127.0.0.1", () => console.log(`fake-shopware on ${origin}`));
