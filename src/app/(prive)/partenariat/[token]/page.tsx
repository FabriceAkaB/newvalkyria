import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/container";
import { getOfferByToken, type PartnershipOption } from "@/lib/partnership-offers";
import { formatMoney } from "@/lib/private-programs";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Proposition de partenariat 2027 | New Valkyria" },
  robots: { index: false, follow: false, nocache: true },
  openGraph: { title: "Proposition de partenariat 2027 | New Valkyria", siteName: "New Valkyria", images: [{ url: "/og/garcons.jpg", width: 1200, height: 628 }] }
};

const SLOT_LABEL: Record<string, string> = {
  titre: "poitrine, au centre avant",
  majeur: "haut du dos, sous le col",
  signature: "bas du dos, sous le numéro",
  "manche-gauche": "manche gauche",
  "manche-droite": "manche droite"
};

function fmtDate(iso: string | null) {
  return iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" }) : null;
}

/** Page privée d'une proposition personnalisée : les options, ce qu'elles comprennent, et un bouton de paiement par option. */
export default async function PartnershipOfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const offer = await getOfferByToken(token);
  if (!offer) notFound();

  const slotKeys = offer.options.map((o) => o.slot_key).filter(Boolean) as string[];
  const { data: slots } = slotKeys.length
    ? await (getSupabaseAdminClient() as any).from("sponsor_slots_2027").select("slot_key, status").in("slot_key", slotKeys)
    : { data: [] };
  const slotAvailable = (key: string) => (slots ?? []).find((s: any) => s.slot_key === key)?.status === "available";

  const packages = offer.options.filter((o) => !o.slot_key);
  const jersey = offer.options.filter((o) => o.slot_key);
  const anyPaid = offer.options.some((o) => o.status === "paid");
  const respondBy = fmtDate(offer.respond_by);
  const payUrl = (o: PartnershipOption) => (o.payment_link_url ? `${o.payment_link_url}?prefilled_email=${encodeURIComponent(offer.contact_email)}` : null);

  const card: React.CSSProperties = { background: "#100e17", border: "1px solid #251f30", borderRadius: "14px", padding: "1.2rem 1.2rem 1.1rem", display: "flex", flexDirection: "column" };

  return (
    <>
      <section className="insc-hero se-hero">
        <Container>
          <div className="insc-hero-inner" style={{ textAlign: "center" }}>
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Saison 2027 · Proposition personnalisée</p>
            <h1 className="insc-hero-title">New Valkyria × {offer.company_name}</h1>
            {offer.intro && <p className="insc-hero-sub">{offer.intro}</p>}
          </div>
        </Container>
      </section>

      <section className="section-band">
        <Container className="max-w-3xl">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.6rem", marginBottom: "1.5rem" }}>
            {[["100+", "joueuses"], ["300+", "adultes rejoints"], ["9-13 ans", "5 groupes"], ["4 villes", "Rive-Nord"]].map(([n, l]) => (
              <div key={l} style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", textAlign: "center", padding: "0.8rem 0.4rem" }}>
                <p style={{ fontSize: "1.3rem", fontWeight: 800, color: "#c4a4e4", margin: 0 }}>{n}</p>
                <p style={{ fontSize: "0.72rem", color: "#9d9da0", margin: 0 }}>{l}</p>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff", margin: "0 0 0.3rem" }}>Choisissez votre option</h2>
          <p style={{ fontSize: "0.85rem", color: "#9d9da0", margin: "0 0 1rem" }}>
            Quand vous savez ce que vous voulez, cliquez sur le bouton de l&apos;option : le paiement est sécurisé (Stripe) et une facture vous est envoyée automatiquement.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            {packages.map((o) => {
              const url = payUrl(o);
              return (
                <div key={o.id} style={{ ...card, borderColor: o.status === "paid" ? "#2f5a3b" : "#3a2f4d" }}>
                  <p style={{ fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#c4a4e4", fontWeight: 700, margin: 0 }}>{o.label}</p>
                  <p style={{ fontSize: "1.7rem", fontWeight: 800, color: "#fff", margin: "0.2rem 0 0.4rem" }}>{o.price_cents != null ? formatMoney(o.price_cents) : "Tarif à convenir"}</p>
                  {o.tagline && <p style={{ fontSize: "0.82rem", color: "#e5e4ea", fontWeight: 600, margin: "0 0 0.6rem" }}>{o.tagline}</p>}
                  <ul style={{ margin: "0 0 1rem", paddingLeft: "1.1rem", color: "#c3c2c8", fontSize: "0.84rem", lineHeight: 1.6, flex: 1 }}>
                    {o.benefits.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                  {o.status === "paid" ? (
                    <p style={{ margin: 0, color: "#8fce9f", fontWeight: 700 }}>✓ Option confirmée — merci !</p>
                  ) : o.status === "closed" || anyPaid ? (
                    <p style={{ margin: 0, color: "#6d6b71", fontSize: "0.82rem" }}>Option non retenue.</p>
                  ) : url ? (
                    <a href={url} className="nv27-btn-primary" style={{ display: "block", textAlign: "center", padding: "0.75rem", textDecoration: "none" }}>
                      Choisir cette option — {formatMoney(o.price_cents ?? 0)}
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>

          {jersey.map((o) => {
            const available = o.status === "paid" || (o.status === "open" && slotAvailable(o.slot_key!));
            const url = payUrl(o);
            return (
              <div key={o.id} style={{ ...card, marginBottom: "1.5rem", borderStyle: "dashed" }}>
                <p style={{ fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#78a8f0", fontWeight: 700, margin: 0 }}>En option · {o.label}</p>
                <p style={{ fontSize: "0.9rem", color: "#e5e4ea", margin: "0.3rem 0 0.5rem" }}>
                  Votre logo sur la {SLOT_LABEL[o.slot_key!] ?? o.slot_key} de tous les chandails de l&apos;académie.
                  {o.catalog_price_cents ? <span style={{ color: "#9d9da0" }}> Tarif catalogue : {formatMoney(o.catalog_price_cents)}.</span> : null}
                </p>
                {o.status === "paid" ? (
                  <p style={{ margin: 0, color: "#8fce9f", fontWeight: 700 }}>✓ Emplacement confirmé — merci !</p>
                ) : !available ? (
                  <p style={{ margin: 0, color: "#ffb464", fontSize: "0.85rem" }}>Cet emplacement n&apos;est malheureusement plus disponible.</p>
                ) : url && o.price_cents != null ? (
                  <a href={url} className="nv27-btn-primary" style={{ display: "block", textAlign: "center", padding: "0.7rem", textDecoration: "none" }}>
                    Réserver l&apos;emplacement — {formatMoney(o.price_cents)}
                  </a>
                ) : (
                  <p style={{ margin: 0, color: "#c3c2c8", fontSize: "0.85rem" }}>
                    Encore disponible — tarif à convenir ensemble. Un seul emplacement par entreprise : écrivez-nous ou appelez-nous pour le réserver.
                  </p>
                )}
              </div>
            );
          })}

          {respondBy && !anyPaid && (
            <p style={{ fontSize: "0.88rem", color: "#e5e4ea", margin: "0 0 0.8rem" }}>
              <strong>Prochaine étape :</strong> merci de nous revenir d&apos;ici le {respondBy} pour nous dire si vous souhaitez aller de l&apos;avant, et avec quelle option.
            </p>
          )}
          {offer.terms_note && <p style={{ fontSize: "0.74rem", color: "#6d6b71", lineHeight: 1.5, margin: "0 0 1.2rem" }}>{offer.terms_note}</p>}

          <div style={{ ...card, flexDirection: "row", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <p style={{ margin: 0, color: "#fff", fontWeight: 700 }}>Jean-Paul « Boidi »</p>
              <p style={{ margin: 0, color: "#9d9da0", fontSize: "0.8rem" }}>Responsable des partenariats</p>
            </div>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#c3c2c8" }}>
              <a href="tel:5146883600" style={{ color: "#c4a4e4" }}>514 688-3600</a> · <a href="mailto:info@newvalkyria.com" style={{ color: "#c4a4e4" }}>info@newvalkyria.com</a>
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
