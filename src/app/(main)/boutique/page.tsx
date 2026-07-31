import type { Metadata } from "next";

import { BoutiqueContent } from "@/components/boutique-content";
import { getProducts } from "@/lib/shop-repo";

export const metadata: Metadata = {
  title: "Boutique | New Valkyria",
  description: "Vêtements et accessoires New Valkyria — commandez en ligne.",
  alternates: { canonical: "/boutique" }
};
export const dynamic = "force-dynamic";

export default async function BoutiquePage() {
  const products = await getProducts(false);
  return <BoutiqueContent initialProducts={products} />;
}
