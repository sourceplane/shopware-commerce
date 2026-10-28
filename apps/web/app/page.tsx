import { Carousel } from "components/carousel";
import { ConnectStore } from "components/connect-store";
import { ThreeItemGrid } from "components/grid/three-items";
import Footer from "components/layout/footer";
import { isShopwareConfigured } from "lib/shopware/connection";

export const metadata = {
  description: "High-performance ecommerce store built with Next.js and Shopware.",
  openGraph: {
    type: "website",
  },
};

export default function HomePage() {
  if (!isShopwareConfigured()) {
    return (
      <>
        <ConnectStore />
        <Footer />
      </>
    );
  }

  return (
    <>
      <ThreeItemGrid />
      <Carousel />
      <Footer />
    </>
  );
}
