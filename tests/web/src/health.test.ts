import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// app/api/health: the deploy's smoke check. It answers ok without touching
// Shopware, and says whether this build has a store.

const KEYS = ["SHOPWARE_STORE_DOMAIN", "SHOPWARE_ACCESS_TOKEN"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

beforeEach(() => {
  vi.resetModules();
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("GET /api/health", () => {
  it("is ok and not connected on a fresh build", async () => {
    const { GET } = await import("app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, connected: false });
  });

  it("says connected once both settings are there", async () => {
    process.env.SHOPWARE_STORE_DOMAIN = "shop.example.invalid";
    process.env.SHOPWARE_ACCESS_TOKEN = "SWSCTESTKEY";
    const { GET } = await import("app/api/health/route");
    expect(await (await GET()).json()).toEqual({ ok: true, connected: true });
  });
});
