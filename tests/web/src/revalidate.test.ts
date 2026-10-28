import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// app/api/revalidate → lib/shopware's `revalidate`. Upstream answered 200 and
// did nothing; here the caller proves itself with the Worker secret
// SHOPWARE_REVALIDATION_SECRET as a bearer, and only then are the named cache
// tags dropped. Without the secret configured, everything is refused.

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
  revalidateTag,
  updateTag: vi.fn(),
}));

const saved = process.env.SHOPWARE_REVALIDATION_SECRET;

function call(opts: { bearer?: string; auth?: string; tags?: string[] } = {}) {
  const url = new URL("https://shopware-commerce-web-stage.example.workers.dev/api/revalidate");
  for (const t of opts.tags ?? []) url.searchParams.append("tag", t);
  const headers = new Headers();
  if (opts.auth !== undefined) headers.set("authorization", opts.auth);
  else if (opts.bearer !== undefined) headers.set("authorization", `Bearer ${opts.bearer}`);
  return new NextRequest(url, { method: "POST", headers });
}

async function post(req: NextRequest) {
  const { POST } = await import("app/api/revalidate/route");
  const res = await POST(req);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  vi.resetModules();
  revalidateTag.mockReset();
  process.env.SHOPWARE_REVALIDATION_SECRET = "the-revalidation-secret";
});
afterEach(() => {
  if (saved === undefined) delete process.env.SHOPWARE_REVALIDATION_SECRET;
  else process.env.SHOPWARE_REVALIDATION_SECRET = saved;
});

describe("POST /api/revalidate", () => {
  it("is off (503) while no secret is configured, whatever is sent", async () => {
    delete process.env.SHOPWARE_REVALIDATION_SECRET;
    for (const req of [call(), call({ bearer: "" }), call({ bearer: "anything" })]) {
      const { status, body } = await post(req);
      expect(status).toBe(503);
      expect(body.revalidated).toBe(false);
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses a missing, wrong or non-bearer credential (401)", async () => {
    for (const req of [
      call(),
      call({ bearer: "wrong" }),
      call({ bearer: "the-revalidation-secret-and-more" }),
      call({ auth: "the-revalidation-secret" }),
      call({ auth: "Basic the-revalidation-secret" }),
    ]) {
      const { status, body } = await post(req);
      expect(status).toBe(401);
      expect(body.revalidated).toBe(false);
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("drops both catalogue tags when none is named", async () => {
    const { status, body } = await post(call({ bearer: "the-revalidation-secret" }));
    expect(status).toBe(200);
    expect(body.revalidated).toBe(true);
    expect(body.tags).toEqual(["collections", "products"]);
    expect(revalidateTag.mock.calls.map((c) => c[0]).sort()).toEqual(["collections", "products"]);
  });

  it("drops only the tag it is asked to", async () => {
    const { body } = await post(call({ bearer: "the-revalidation-secret", tags: ["products"] }));
    expect(body.tags).toEqual(["products"]);
    expect(revalidateTag.mock.calls.map((c) => c[0])).toEqual(["products"]);
  });

  it("refuses a tag that is not the catalogue's (400), the cart's included", async () => {
    for (const tags of [["cart"], ["products", "everything"]]) {
      const { status } = await post(call({ bearer: "the-revalidation-secret", tags }));
      expect(status).toBe(400);
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
