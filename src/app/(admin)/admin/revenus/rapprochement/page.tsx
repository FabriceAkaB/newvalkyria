import Link from "next/link";

import { requireAdmin } from "@/lib/admin-auth";
import { getStripeReconciliation } from "@/lib/stripe-reconcile-repo";

export const metadata = { title: "Rapprochement Stripe — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const money = (c: number) => `${(c / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const day = (iso: string) => new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short", timeZone: "America/Toronto" });

/** « L'argent reçu dans Stripe et ce que le site a enregistré concordent-ils ? » (Mandalart P7.7.04) : chaque paiement
 *  Stripe des N derniers jours retrouvé dans le site, les paiements sans trace, les remboursements pas notés. */
export default async function ReconciliationPage({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const days = [30, 60, 90].includes(Number((await searchParams).jours)) ? Number((await searchParams).jours) : 30;
  const r = await getStripeReconciliation(days);
  if ("error" in r) {
    return (
      <div className="admin-content">
        <div className="admin-section mda">
          <h1 className="mda-h1">Rapprochement Stripe</h1>
          <p className="mda-lead">{r.error}</p>
        </div>
      </div>
    );
  }
  const unknown = r.missing.filter((m) => !m.probable.length);
  const issues = unknown.length + r.refundNotRecorded.length;
  return (
    <div className="admin-content">
      <div className="admin-section mda">
        <header>
          <p className="mda-eyebrow">
            Rapprochement Stripe · {days} derniers jours ·{" "}
            {[30, 60, 90].map((d) => (
              <Link key={d} href={`?jours=${d}`} style={{ marginRight: 8, fontWeight: d === days ? 700 : 400 }}>
                {d} j
              </Link>
            ))}
          </p>
          <h1 className="mda-h1">{issues ? `${issues} point${issues > 1 ? "s" : ""} à vérifier` : "Stripe et le site concordent"}</h1>
          <p className="mda-lead">
            {r.checked} paiements reçus dans Stripe ({money(r.totalCents)}, dont {money(r.refundedCents)} remboursés) : {r.matched} retrouvés tels quels dans le site,{" "}
            {r.missing.length - unknown.length} reconnus par le courriel du parent ou du commanditaire (payés par un lien fait à la main), {unknown.length} inconnus.
          </p>
        </header>

        {r.refundNotRecorded.length ? (
          <section className="mda-card-flush" style={{ marginTop: 16 }}>
            <div className="mda-card-head">
              <strong>Remboursés dans Stripe, encore comptés comme payés dans le site</strong>
            </div>
            <table className="admin-table">
              <tbody>
                {r.refundNotRecorded.map((m) => (
                  <tr key={m.id}>
                    <td style={{ whiteSpace: "nowrap", color: "var(--adm-text-3)" }}>{day(m.created)}</td>
                    <td style={{ fontSize: "0.8125rem" }}>{m.site.label}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      {money(m.refundedCents)} sur {money(m.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mda-muted" style={{ padding: "8px 20px 16px", margin: 0, fontSize: "0.8125rem" }}>
              Un remboursement partiel peut être normal (demi-saison, rabais). Un remboursement complet doit passer l&apos;inscription à « annulée ».
            </p>
          </section>
        ) : null}

        <section className="mda-card-flush" style={{ marginTop: 16 }}>
          <div className="mda-card-head">
            <strong>Payés dans Stripe, sans trace directe dans le site</strong>
          </div>
          {r.missing.length ? (
            <table className="admin-table">
              <tbody>
                {r.missing.map((m) => (
                  <tr key={m.id}>
                    <td style={{ whiteSpace: "nowrap", color: "var(--adm-text-3)" }}>{day(m.created)}</td>
                    <td style={{ fontSize: "0.8125rem" }}>
                      {m.email ?? "courriel inconnu"}
                      {m.description ? <span style={{ display: "block", color: "var(--adm-text-3)", fontSize: "0.75rem" }}>{m.description}</span> : null}
                    </td>
                    <td style={{ fontSize: "0.8125rem", color: m.probable.length ? "var(--adm-text-2)" : "var(--adm-bad)" }}>{m.probable.length ? `Probablement : ${m.probable.join(" / ")}` : "Inconnu : à identifier"}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{money(m.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mda-muted" style={{ padding: "16px 20px", margin: 0 }}>Tous les paiements Stripe sont dans le site.</p>
          )}
        </section>
      </div>
    </div>
  );
}
