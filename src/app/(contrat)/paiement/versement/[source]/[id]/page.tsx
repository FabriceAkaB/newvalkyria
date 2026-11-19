import type { Metadata } from "next";

import { InstallmentPayButton } from "@/components/installment-pay-button";
import { checkInstallmentPayKey, type InstallmentSource } from "@/lib/installment-pay";
import { getPayableInstallment } from "@/lib/installment-pay-repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payer mon versement | New Valkyria", robots: { index: false, follow: false, nocache: true } };

const card = { background: "#fff", borderRadius: 16, padding: "1.4rem", border: "1px solid #e6e0ee" } as const;
const fmt = (c: number) => (c / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

/** Page du lien envoyé à la famille quand un versement est refusé : le montant, puis « Payer avec une carte ». */
export default async function InstallmentPayPage({ params, searchParams }: { params: Promise<{ source: string; id: string }>; searchParams: Promise<{ cle?: string; paye?: string }> }) {
  const { source, id } = await params;
  const { cle, paye } = await searchParams;
  const inst = checkInstallmentPayKey(source, id, cle) ? await getPayableInstallment(source as InstallmentSource, id) : null;
  if (!inst) {
    return (
      <div style={card}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Lien introuvable</h1>
        <p style={{ color: "#5d566b" }}>Écrivez-nous à info@newvalkyria.com, nous vous enverrons un nouveau lien.</p>
      </div>
    );
  }
  const paid = inst.status === "paid";
  return (
    <div style={{ ...card, display: "grid", gap: 14 }}>
      <p style={{ margin: 0, color: "#5d566b" }}>{inst.programName} · {inst.playerName}</p>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: 0 }}>
        {paid || paye ? "Merci, votre versement est payé" : `Versement ${inst.sequenceNo} de ${inst.installmentCount} : ${fmt(inst.amountCents)}`}
      </h1>
      {paid || paye ? (
        <p style={{ margin: 0, color: "#3d3650" }}>
          {paid ? "Tout est en ordre. Un reçu est disponible dans votre espace famille." : "Le paiement est en traitement ; vous recevrez la confirmation dans quelques minutes."}
        </p>
      ) : (
        <>
          <p style={{ margin: 0, color: "#3d3650" }}>
            Votre carte a refusé ce versement. Payez-le ici avec une autre carte (ou avec la même, une fois la situation réglée avec votre banque).
            {inst.sequenceNo < inst.installmentCount ? " Cette carte servira aussi pour les prochains versements." : ""}
          </p>
          <InstallmentPayButton source={inst.source} id={inst.id} cle={cle!} label={`Payer ${fmt(inst.amountCents)}`} />
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b6478" }}>Paiement sécurisé par Stripe. Une question ? info@newvalkyria.com</p>
        </>
      )}
    </div>
  );
}
