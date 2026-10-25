import type { Metadata } from "next";

import { SpecialOfferPay } from "@/components/special-offer-pay";
import { fullGroupsForOffer, getOfferByToken, isOfferExpired } from "@/lib/special-offers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Offre spéciale | New Valkyria",
  robots: { index: false, follow: false, nocache: true }
};

const money = (cents: number) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
const card: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: "1.4rem 1.3rem", border: "1px solid #e6e0ee", marginTop: "1rem" };

export default async function SpecialOfferPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ merci?: string }> }) {
  const { token } = await params;
  const { merci } = await searchParams;
  const offer = await getOfferByToken(token);

  if (!offer) {
    return (
      <div style={card}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Offre introuvable</h1>
        <p style={{ color: "#5d566b" }}>Écrivez-nous à info@newvalkyria.com.</p>
      </div>
    );
  }

  if (offer.paid_at || merci) {
    return (
      <div style={card}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>✓ Merci, c&apos;est confirmé !</h1>
        <p style={{ color: "#5d566b", lineHeight: 1.6 }}>
          {offer.registrations.map((r) => r.playerName).join(" et ")} {offer.registrations.length > 1 ? "sont inscrites" : "est inscrite"}. Vous recevrez un courriel de confirmation avec les détails des pratiques.
        </p>
      </div>
    );
  }

  const expired = isOfferExpired(offer);
  const fullGroups = expired ? [] : await fullGroupsForOffer(offer);
  const deadline = new Date(offer.expires_at).toLocaleString("fr-CA", { timeZone: "America/Toronto", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

  return (
    <>
      <p style={{ fontSize: "0.8rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "#5b2a86", fontWeight: 700, margin: "0 0 0.4rem" }}>Offre spéciale</p>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 0.3rem", color: "#1d1730" }}>{offer.title}</h1>
      {offer.parent_name && <p style={{ color: "#5d566b", margin: 0 }}>Pour {offer.parent_name}</p>}

      <div style={card}>
        {offer.description && <p style={{ margin: "0 0 1rem", lineHeight: 1.6 }}>{offer.description}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
          {offer.registrations.map((r) => (
            <div key={r.registrationId} style={{ border: "1px solid #e6e0ee", borderRadius: 12, padding: ".8rem 1rem", background: "#fbf9ff" }}>
              <strong>{r.playerName}</strong>
              <div style={{ color: "#5d566b", fontSize: ".92rem" }}>{r.groupLabel}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "1.2rem", flexWrap: "wrap", gap: ".5rem" }}>
          <span style={{ color: "#5d566b" }}>Total à payer</span>
          <span>
            {offer.regular_amount_cents ? <s style={{ color: "#9a93a8", marginRight: ".6rem" }}>{money(offer.regular_amount_cents)}</s> : null}
            <strong style={{ fontSize: "1.6rem", color: "#1d1730" }}>{money(offer.amount_cents)}</strong>
          </span>
        </div>
      </div>

      <div style={card}>
        {fullGroups.length > 0 && !expired ? (
          <>
            <p style={{ fontWeight: 800, fontSize: "1.1rem", margin: 0 }}>Ce groupe est maintenant complet</p>
            <p style={{ color: "#5d566b", lineHeight: 1.6 }}>Les dernières places ont été prises. Écrivez-nous à info@newvalkyria.com : nous vous proposerons une autre option.</p>
          </>
        ) : expired ? (
          <>
            <p style={{ fontWeight: 800, fontSize: "1.1rem", margin: 0 }}>Cette offre est expirée</p>
            <p style={{ color: "#5d566b", lineHeight: 1.6 }}>Elle était valide jusqu&apos;au {deadline}. Écrivez-nous à info@newvalkyria.com si vous souhaitez tout de même inscrire vos filles.</p>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 1rem", color: "#6b4b00", background: "#fff6e5", border: "1px solid #f0c878", borderRadius: 10, padding: ".7rem .9rem" }}>
              ⏳ Offre valide jusqu&apos;au <strong>{deadline}</strong>.
            </p>
            <SpecialOfferPay token={offer.token} label={`Confirmer et payer ${money(offer.amount_cents)}`} />
            <p style={{ color: "#6b6478", fontSize: ".85rem", textAlign: "center", marginTop: ".7rem" }}>Paiement sécurisé par Stripe · Garantie 100 % satisfait ou remboursé</p>
          </>
        )}
      </div>
    </>
  );
}
