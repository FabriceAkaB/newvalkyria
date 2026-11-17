import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/print-button";
import { requireParentUserId } from "@/lib/parent-auth";
import { money } from "@/lib/parent-billing";
import { getFamilyBilling } from "@/lib/parent-billing-repo";
import { getParentAccount, getVerifiedParentEmail } from "@/lib/parent-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const metadata: Metadata = { title: "Reçu de paiement | New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const fr = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Reçu imprimable d'un paiement de la famille (vérifié : le paiement doit être à ce compte). L'émetteur (nom légal,
 *  adresse, NEQ) se règle dans app_settings « receipt_issuer » ; sinon les coordonnées publiques de l'académie. */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireParentUserId();
  const { id } = await params;
  const email = await getVerifiedParentEmail(userId);
  if (!email) notFound();
  const [billing, account, { data: setting }] = await Promise.all([
    getFamilyBilling(email),
    getParentAccount(userId),
    (getSupabaseAdminClient() as any).from("app_settings").select("value").eq("key", "receipt_issuer").maybeSingle()
  ]);
  const p = billing.payments.find((x) => x.id === decodeURIComponent(id));
  if (!p) notFound();
  let saved: Record<string, string> = {};
  try {
    saved = typeof setting?.value === "string" ? JSON.parse(setting.value) : (setting?.value ?? {});
  } catch {
    saved = {};
  }
  const issuer = { name: "New Valkyria", line: "Académie de soccer féminin · Laurentides, Québec", email: "info@newvalkyria.com", neq: null as string | null, ...saved };
  const ink = "#1d1730";
  return (
    <div style={{ background: "#fff", color: ink, maxWidth: 720, margin: "2rem auto", padding: "2rem", borderRadius: 12, fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", borderBottom: "2px solid #5b2a86", paddingBottom: 16 }}>
        <div>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{issuer.name}</p>
          <p style={{ margin: "4px 0 0", color: "#5d566b" }}>{issuer.line}</p>
          <p style={{ margin: "2px 0 0", color: "#5d566b" }}>{issuer.email}{issuer.neq ? ` · NEQ ${issuer.neq}` : ""}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#5b2a86" }}>REÇU DE PAIEMENT</p>
          <p style={{ margin: "4px 0 0", color: "#5d566b" }}>N° {p.id.replace(/^pi_/, "").slice(-12).toUpperCase()}</p>
          <p style={{ margin: "2px 0 0", color: "#5d566b" }}>{fr(p.date)}</p>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
        <tbody>
          <tr><td style={{ padding: "8px 0", color: "#5d566b", width: 180 }}>Reçu de</td><td style={{ padding: "8px 0", fontWeight: 600 }}>{account?.fullName || email}</td></tr>
          <tr><td style={{ padding: "8px 0", color: "#5d566b" }}>Courriel</td><td style={{ padding: "8px 0" }}>{email}</td></tr>
          {p.child ? <tr><td style={{ padding: "8px 0", color: "#5d566b" }}>Pour l&apos;enfant</td><td style={{ padding: "8px 0", fontWeight: 600 }}>{p.child}</td></tr> : null}
          <tr><td style={{ padding: "8px 0", color: "#5d566b" }}>Description</td><td style={{ padding: "8px 0" }}>{p.label}</td></tr>
          <tr><td style={{ padding: "8px 0", color: "#5d566b" }}>Date du paiement</td><td style={{ padding: "8px 0" }}>{fr(p.date)}</td></tr>
          <tr><td style={{ padding: "8px 0", color: "#5d566b" }}>Mode de paiement</td><td style={{ padding: "8px 0" }}>Carte (paiement en ligne)</td></tr>
          <tr style={{ borderTop: "1px solid #e6e0ee" }}><td style={{ padding: "12px 0", fontWeight: 700 }}>Montant payé</td><td style={{ padding: "12px 0", fontWeight: 800, fontSize: 20 }}>{money(p.amountCents)}</td></tr>
        </tbody>
      </table>
      <p style={{ color: "#5d566b", fontSize: 13, marginTop: 20 }}>Activité physique encadrée pour enfant (soccer). Conservez ce reçu pour vos dossiers et votre déclaration de revenus.</p>
      <div className="no-print" style={{ marginTop: 20 }}>
        <PrintButton />
      </div>
    </div>
  );
}
