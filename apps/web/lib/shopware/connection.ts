// Whether this build has a Shopware store to talk to.
//
// The store is the owner's to connect after the build: its Store API domain
// and its sales channel's access key are Orun secrets the build reads
// (next.config.ts `env`, so both are fixed per deploy). A fresh product has
// neither: then no request leaves the Worker for Shopware — getApiClient
// refuses with ShopwareNotConnected, which every reader in lib/shopware
// already turns into an empty answer — and the storefront says how to
// connect one (components/connect-store.tsx), never a 500.
export class ShopwareNotConnected extends Error {
  constructor() {
    super("No Shopware store is connected (SHOPWARE_STORE_DOMAIN, SHOPWARE_ACCESS_TOKEN)");
    this.name = "ShopwareNotConnected";
  }
}

export function isShopwareConfigured(): boolean {
  const domain = process.env.SHOPWARE_STORE_DOMAIN ?? "";
  const token = process.env.SHOPWARE_ACCESS_TOKEN ?? "";
  return domain.trim() !== "" && token.trim() !== "" && !/[[\]]/.test(domain);
}
