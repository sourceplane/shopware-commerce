import { isShopwareConfigured } from "lib/shopware/connection";

// Shown while this build has no Shopware store (lib/shopware/connection.ts):
// a one-line note on every page, and on the home page the steps to connect
// one. Every page still renders — the readers answer empty — so a fresh
// deploy is a working, empty storefront that says why it is empty.
export function ConnectStoreBanner() {
  if (isShopwareConfigured()) return null;
  return (
    <div
      role="note"
      data-connect-store
      className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
    >
      No Shopware store is connected yet: the catalogue is empty until one is.
    </div>
  );
}

export function ConnectStore() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-16 text-neutral-700 dark:text-neutral-300">
      <h1 className="mb-4 text-3xl font-bold text-black dark:text-white">
        Connect your Shopware store
      </h1>
      <p className="mb-4">
        This storefront reads its catalogue, its pages and its cart from a Shopware 6 Store API.
        None is connected to this deploy yet.
      </p>
      <ol className="mb-4 list-decimal space-y-2 pl-6">
        <li>
          In your Shopware Administration, open the Storefront or Headless sales channel and copy
          its API access key.
        </li>
        <li>
          Store the shop&apos;s domain and that key for this environment as the Orun secrets{" "}
          <code>SHOPWARE_STORE_DOMAIN</code> and <code>SHOPWARE_ACCESS_TOKEN</code>.
        </li>
        <li>Redeploy the storefront. The next build reads them and the catalogue appears.</li>
      </ol>
      <p>The repository&apos;s README, &ldquo;Connecting Shopware&rdquo;, has the details.</p>
    </section>
  );
}
