import { describe, expect, it } from "vitest";
import { createUrl, ensureStartsWith } from "lib/utils";

// lib/utils.ts: the URL helpers the search pages and the cart use, and the
// domain normaliser lib/shopware's client is built on.

describe("createUrl", () => {
  it("appends the query string only when there are params", () => {
    expect(createUrl("/search", new URLSearchParams({ q: "shirt", sort: "price-asc" }))).toBe(
      "/search?q=shirt&sort=price-asc",
    );
    expect(createUrl("/search", new URLSearchParams())).toBe("/search");
  });
});

describe("ensureStartsWith", () => {
  it("prefixes once", () => {
    expect(ensureStartsWith("shop.example.invalid", "https://")).toBe("https://shop.example.invalid");
    expect(ensureStartsWith("https://shop.example.invalid", "https://")).toBe("https://shop.example.invalid");
  });
});
