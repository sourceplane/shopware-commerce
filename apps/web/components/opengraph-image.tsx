import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SITE_NAME } from "app/site";
import { readFile } from "fs/promises";
import { ImageResponse } from "next/og";
import { join } from "path";

export type Props = {
  title?: string;
};

// Upstream fetches the font next to the module (`new URL(..., import.meta.url)`),
// which a Worker cannot. The font is a static asset (public/fonts), read from
// the filesystem by `next build`/`next dev` and through the ASSETS binding on
// the Worker.
async function loadFont(): Promise<ArrayBuffer> {
  try {
    const file = await readFile(join(process.cwd(), "./public/fonts/Inter-Bold.ttf"));
    return Uint8Array.from(file).buffer;
  } catch {
    const { env } = await getCloudflareContext({ async: true });
    const res = await env.ASSETS.fetch("https://assets.local/fonts/Inter-Bold.ttf");
    return res.arrayBuffer();
  }
}

// The logo, as the image itself: upstream drew LogoIcon, a `next/image`
// client component, which the Open Graph renderer cannot draw on the server
// ("Cannot access Image.toString on the server") — every Open Graph image
// answered 500. The same public/logo-next.svg is embedded as a data URI.
async function loadLogo(): Promise<string> {
  let svg: string;
  try {
    svg = await readFile(join(process.cwd(), "./public/logo-next.svg"), "utf8");
  } catch {
    const { env } = await getCloudflareContext({ async: true });
    svg = await (await env.ASSETS.fetch("https://assets.local/logo-next.svg")).text();
  }
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export default async function OpengraphImage(props?: Props): Promise<ImageResponse> {
  const title = props?.title || SITE_NAME;
  const [font, logo] = await Promise.all([loadFont(), loadLogo()]);

  return new ImageResponse(
    <div tw="flex h-full w-full flex-col items-center justify-center bg-black">
      <div tw="flex flex-none items-center justify-center border border-neutral-700 h-[160px] w-[160px] rounded-3xl">
        <img src={logo} width={64} height={58} alt="" />
      </div>
      <p tw="mt-12 text-6xl font-bold text-white">{title}</p>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Inter",
          data: font,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
