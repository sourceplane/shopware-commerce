import type { ReadonlyURLSearchParams } from "next/navigation";

// The site's public origin: the environment's SITE_URL or its workers.dev
// URL, fixed per build (component.yaml's buildCommand); `next dev` falls back
// to localhost. Upstream read Vercel's production URL.
export const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const createUrl = (pathname: string, params: URLSearchParams | ReadonlyURLSearchParams) => {
  const paramsString = params.toString();
  const queryString = `${paramsString.length ? "?" : ""}${paramsString}`;

  return `${pathname}${queryString}`;
};

export const ensureStartsWith = (stringToCheck: string, startsWith: string) =>
  stringToCheck.startsWith(startsWith) ? stringToCheck : `${startsWith}${stringToCheck}`;

export const validateEnvironmentVariables = () => {
  const requiredEnvironmentVariables = ["SHOPWARE_STORE_DOMAIN", "SHOPWARE_ACCESS_TOKEN"];
  const missingEnvironmentVariables = [] as string[];

  for (const envVar of requiredEnvironmentVariables) {
    if (!process.env[envVar]) {
      missingEnvironmentVariables.push(envVar);
    }
  }

  if (missingEnvironmentVariables.length) {
    throw new Error(
      `The following environment variables are missing. Your site will not work without them.\n\n${missingEnvironmentVariables.join(
        "\n",
      )}\n`,
    );
  }

  if (
    process.env.SHOPWARE_STORE_DOMAIN?.includes("[") ||
    process.env.SHOPWARE_STORE_DOMAIN?.includes("]")
  ) {
    throw new Error(
      "Your `SHOPWARE_STORE_DOMAIN` environment variable includes brackets (ie. `[` and / or `]`). Your site will not work with them there. Please remove them.",
    );
  }
};
