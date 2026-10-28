import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// lib/shopware/connection.ts and the guard in getApiClient: a build with no
// store (every fresh product) answers every reader empty without a single
// request leaving the Worker, and says nothing alarming in its logs.

vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

const KEYS = ["SHOPWARE_STORE_DOMAIN", "SHOPWARE_ACCESS_TOKEN", "SHOPWARE_USE_SEO_URLS"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

beforeEach(() => {
  vi.resetModules();
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("isShopwareConfigured", () => {
  it("needs both the domain and the access key", async () => {
    const { isShopwareConfigured } = await import("lib/shopware/connection");
    expect(isShopwareConfigured()).toBe(false);
    process.env.SHOPWARE_STORE_DOMAIN = "https://shop.example.invalid";
    expect(isShopwareConfigured()).toBe(false);
    process.env.SHOPWARE_ACCESS_TOKEN = "  ";
    expect(isShopwareConfigured()).toBe(false);
    process.env.SHOPWARE_ACCESS_TOKEN = "SWSCTESTKEY";
    expect(isShopwareConfigured()).toBe(true);
  });

  it("refuses a domain written with brackets (upstream's own check)", async () => {
    const { isShopwareConfigured } = await import("lib/shopware/connection");
    process.env.SHOPWARE_STORE_DOMAIN = "[https://shop.example.invalid]";
    process.env.SHOPWARE_ACCESS_TOKEN = "SWSCTESTKEY";
    expect(isShopwareConfigured()).toBe(false);
  });
});

describe("with no store connected", () => {
  it("getApiClient refuses before any request", async () => {
    const { getApiClient } = await import("lib/shopware/api");
    const { ShopwareNotConnected } = await import("lib/shopware/connection");
    expect(() => getApiClient()).toThrow(ShopwareNotConnected);
  });

  it("every reader answers empty, fetches nothing and logs nothing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const shop = await import("lib/shopware");

    expect(await shop.getMenu({ type: "main-navigation" })).toEqual([]);
    expect(await shop.getMenu({ type: "footer-navigation", depth: 2 })).toEqual([]);
    expect(await shop.getCollectionProducts({ collection: "main-navigation" })).toEqual({
      products: [],
      total: 0,
      limit: 0,
    });
    expect(await shop.getSearchCollectionProducts({ query: "shirt" })).toEqual([]);
    expect(await shop.getProduct("some-product")).toBeUndefined();
    expect(await shop.getPage("about")).toBeUndefined();
    expect(await shop.getProductSeoUrls()).toEqual([]);
    expect(await shop.getCart()).toBeUndefined();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });
});

describe("with a store connected", () => {
  it("getApiClient talks to that store's Store API with its access key", async () => {
    process.env.SHOPWARE_STORE_DOMAIN = "shop.example.invalid";
    process.env.SHOPWARE_ACCESS_TOKEN = "SWSCTESTKEY";
    const seen: { url: string; key: string | null }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const req = new Request(input as RequestInfo, init);
      seen.push({ url: req.url, key: req.headers.get("sw-access-key") });
      return new Response(JSON.stringify({ elements: [] }), {
        headers: { "content-type": "application/json" },
      });
    });
    const { getApiClient } = await import("lib/shopware/api");
    await getApiClient().invoke("readContext get /context", {});
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toBe("https://shop.example.invalid/store-api/context");
    expect(seen[0]!.key).toBe("SWSCTESTKEY");
  });
});
