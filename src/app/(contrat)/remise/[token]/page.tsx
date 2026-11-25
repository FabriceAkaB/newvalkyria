import type { Metadata } from "next";

import { ShopPickupChoice } from "@/components/shop-pickup-choice";
import { pickupWhen } from "@/lib/shop-pickup-core";
import { getPickupPage } from "@/lib/shop-pickup-repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Récupérer ma commande | New Valkyria", robots: { index: false, follow: false, nocache: true } };

const card = { background: "#fff", borderRadius: 16, padding: "1.4rem", border: "1px solid #e6e0ee", display: "grid", gap: 14 } as const;

/** Lien personnel du parent après un achat en boutique (JP, 25 nov. 2026) : la séance où il récupère son colis, et « C'est un cadeau ». */
export default async function RemisePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ merci?: string }> }) {
  const { token } = await params;
  const { merci } = await searchParams;
  const page = await getPickupPage(token);
  if (!page) {
    return (
      <div style={card}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Commande introuvable</h1>
        <p style={{ margin: 0, color: "#5d566b" }}>Écrivez-nous à info@newvalkyria.com.</p>
      </div>
    );
  }
  const { order } = page;
  const delivered = order.distribution_status === "remis";
  const chosenWhen = order.pickup_date
    ? [pickupWhen(String(order.pickup_date).slice(0, 10), order.pickup_start ?? null), order.pickup_group, order.pickup_location].filter(Boolean).join(" · ")
    : null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {merci && !delivered && (
        <div style={{ background: "#eef8f1", border: "1px solid #cfe9d8", borderRadius: 12, padding: "12px 16px", color: "#1f6b3a", fontWeight: 700 }}>
          Paiement confirmé. Merci {order.customer_name.split(" ")[0]} !
        </div>
      )}
      <div style={card}>
        <p style={{ margin: 0, fontSize: ".8rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#5b2a86", fontWeight: 700 }}>Votre commande</p>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: 0, color: "#1d1730", lineHeight: 1.25 }}>
          {delivered ? "Votre commande vous a été remise" : order.in_stock ? "Votre article sera prêt à la séance de votre choix" : "Votre commande est en préparation"}
        </h1>
        <p style={{ margin: 0, color: "#3d3650" }}>{page.items}</p>
        {delivered ? (
          <p style={{ margin: 0, color: "#5d566b" }}>Merci et bon match !</p>
        ) : order.in_stock ? (
          <ShopPickupChoice token={token} options={page.options} initialKey={page.chosenKey} initialGift={Boolean(order.is_gift)} initialWhen={chosenWhen} />
        ) : (
          <p style={{ margin: 0, color: "#5d566b" }}>Notre équipe prépare votre commande et vous contactera pour la remise.</p>
        )}
      </div>
    </div>
  );
}
