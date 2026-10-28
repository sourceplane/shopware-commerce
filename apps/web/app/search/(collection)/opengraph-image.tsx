import OpengraphImage from "components/opengraph-image";
import { getCollection } from "lib/shopware";

export const dynamic = "force-dynamic";

// Next 16 hands an Open Graph route its params as a promise (and none at
// /search itself); upstream read `params.collection` off the object and
// answered 500.
export default async function Image(props: { params?: Promise<{ collection?: string[] }> }) {
  const params = (await props.params) ?? {};
  const collectionPath = params.collection
    ? Array.isArray(params.collection)
      ? params.collection.join("/")
      : ""
    : "";
  const collection = collectionPath !== "" ? await getCollection(collectionPath) : null;
  const title = collection?.seo?.title || collection?.title || "";

  return await OpengraphImage({ title });
}
