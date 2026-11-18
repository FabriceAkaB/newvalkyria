import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/container";
import { EmailCheckBanner } from "@/components/email-check-banner";
import { requireParentUserId } from "@/lib/parent-auth";
import { money } from "@/lib/parent-billing";
import { getFamilyBilling } from "@/lib/parent-billing-repo";
import { getVerifiedParentEmail } from "@/lib/parent-repo";

export const metadata: Metadata = { title: "Programmes et factures | New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const fr = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Espace parent : les programmes de la famille, chaque paiement avec sa date et son reçu (impôts), les versements à venir. */
export default async function FacturesPage() {
  const userId = await requireParentUserId();
  const email = await getVerifiedParentEmail(userId);
  const billing = email ? await getFamilyBilling(email) : null;
  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="insc-hero-inner">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Espace parent</p>
          <h1 className="insc-hero-title">Programmes et factures</h1>
          <p className="insc-hero-sub">Vos programmes avec nous, chaque paiement avec sa date et son reçu à imprimer (pour vos impôts).</p>
        </div>
      </Container>
      <Container className="max-w-2xl">
        {!billing ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p className="parent-muted" style={{ margin: 0 }}>Pour protéger vos paiements, confirmez d&apos;abord votre courriel : vos programmes et vos factures apparaîtront ici.</p>
            <EmailCheckBanner />
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            <div className="parent-card">
              <h2>Vos programmes</h2>
              {billing.programs.length ? (
                billing.programs.map((p) => (
                  <div key={p.id} className="parent-row">
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div className="parent-muted" style={{ fontSize: "0.88rem" }}>
                        {p.child}
                        {p.note ? ` · ${p.note}` : ""}
                      </div>
                    </div>
                    <span className="parent-muted" style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>depuis le {fr(p.since)}</span>
                  </div>
                ))
              ) : (
                <p className="parent-muted" style={{ margin: 0 }}>Aucun programme au courriel {email}.</p>
              )}
            </div>

            {billing.upcoming.length ? (
              <div className="parent-card">
                <h2>Versements à venir</h2>
                {billing.upcoming.map((u, i) => (
                  <div key={i} className="parent-row">
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.label}</div>
                      <div className="parent-muted" style={{ fontSize: "0.88rem" }}>
                        {u.child} · {u.status === "failed" ? "le prélèvement n'a pas passé : nous vous écrirons" : `prélevé automatiquement le ${fr(u.date)}`}
                      </div>
                    </div>
                    <span className="parent-amount">{money(u.amountCents)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="parent-card">
              <h2>Paiements et reçus</h2>
              {billing.payments.length ? (
                billing.payments.map((p) => (
                  <div key={`${p.id}-${p.label}`} className="parent-row">
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.label}</div>
                      <div className="parent-muted" style={{ fontSize: "0.88rem" }}>
                        {fr(p.date)}
                        {p.child ? ` · ${p.child}` : ""}
                      </div>
                    </div>
                    <span style={{ display: "grid", justifyItems: "end", gap: 2 }}>
                      <span className="parent-amount">{money(p.amountCents)}</span>
                      <Link href={`/compte/factures/recu/${encodeURIComponent(p.id)}`} className="parent-link" style={{ fontSize: "0.85rem" }}>
                        Reçu →
                      </Link>
                    </span>
                  </div>
                ))
              ) : (
                <p className="parent-muted" style={{ margin: 0 }}>Aucun paiement en ligne trouvé.</p>
              )}
              {billing.years.length ? (
                <p className="parent-muted" style={{ margin: "0.75rem 0 0", fontSize: "0.88rem" }}>
                  Total payé : {billing.years.map((y) => `${y.year} : ${money(y.cents)}`).join(" · ")}
                </p>
              ) : null}
              <p className="parent-muted" style={{ margin: "0.75rem 0 0", fontSize: "0.82rem" }}>
                Un paiement fait autrement (chèque, virement, comptant) n&apos;apparaît pas ici : écrivez-nous à info@newvalkyria.com pour son reçu.
              </p>
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
