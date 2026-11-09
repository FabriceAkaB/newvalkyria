import type { Metadata } from "next";

import { ContractSignForm } from "@/components/contract-sign-form";
import { CONTRACT_DOCUMENTS, getContractByToken } from "@/lib/employee-contracts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contrat d'embauche | New Valkyria",
  robots: { index: false, follow: false, nocache: true },
  openGraph: { title: "New Valkyria — Contrat d'embauche", images: [{ url: "/og/garcons.jpg", width: 1200, height: 628 }] }
};

export default async function ContractPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const contract = await getContractByToken(token);

  const wrap = (children: React.ReactNode) => <div style={{ background: "#fff", borderRadius: 16, padding: "1.5rem 1.3rem", border: "1px solid #e6e0ee" }}>{children}</div>;

  if (!contract || contract.status === "cancelled") {
    return wrap(
      <>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#1d1730" }}>Ce lien n&apos;est pas valide</h1>
        <p style={{ color: "#5d566b" }}>Écrivez-nous à info@newvalkyria.com et nous vous renverrons votre contrat.</p>
      </>
    );
  }

  if (contract.status === "signed") {
    // L'horaire et le calendrier de paie peuvent être corrigés après la signature (ex. vrai horaire de l'éducateur) :
    // la page montre toujours la version à jour, le PDF signé reste l'original.
    const money = (c: number) => (c / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
    const payDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    const today = new Date().toISOString().slice(0, 10);
    const cell = { padding: "0.45rem 0.4rem", borderTop: "1px solid #eee7f5", verticalAlign: "top" } as const;
    return wrap(
      <>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#1d1730" }}>✓ Contrat signé</h1>
        <p style={{ color: "#5d566b" }}>Votre contrat a été signé. Une copie vous a été envoyée par courriel.</p>
        <a href={`/api/contrat/${token}?fichier=copie`} target="_blank" rel="noreferrer" style={{ display: "inline-block", padding: "0.8rem 1.2rem", marginTop: "0.6rem", background: "#5b2a86", color: "#fff", borderRadius: 12, fontWeight: 700, textDecoration: "none" }}>
          Voir ma copie signée
        </a>
        {contract.summary?.length > 0 && (
          <>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1d1730", marginTop: "1.6rem" }}>Votre contrat aujourd&apos;hui</h2>
            <dl style={{ margin: 0 }}>
              {contract.summary.map((s) => (
                <div key={s.label} style={{ padding: "0.55rem 0", borderTop: "1px solid #eee7f5" }}>
                  <dt style={{ fontWeight: 700, color: "#5b2a86", fontSize: "0.85rem" }}>{s.label}</dt>
                  <dd style={{ margin: "0.15rem 0 0", color: "#1d1730" }}>{s.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        {contract.pay_schedule?.length > 0 && (
          <>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1d1730", marginTop: "1.4rem" }}>Mon calendrier de paie</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: "0.88rem", borderCollapse: "collapse" }}>
                <tbody>
                  {contract.pay_schedule.map((r) => (
                    <tr key={r.payDate} style={{ opacity: r.payDate < today ? 0.55 : 1 }}>
                      <td style={{ ...cell, whiteSpace: "nowrap", fontWeight: 600 }}>{payDay(r.payDate)}</td>
                      <td style={{ ...cell, color: "#6b6478" }}>
                        {r.period}
                        <br />
                        <span style={{ fontSize: "0.8rem" }}>{r.hours}</span>
                      </td>
                      <td style={{ ...cell, textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{money(r.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ color: "#6b6478", fontSize: "0.82rem", marginTop: "0.6rem" }}>Montants bruts estimés. Chaque paie suit vos présences confirmées dans MonClubSportif.</p>
          </>
        )}
      </>
    );
  }

  const [firstName, ...rest] = contract.employee_name.split(" ");
  return (
    <ContractSignForm
      token={token}
      title={contract.title}
      employeeName={contract.employee_name}
      defaultFirstName={firstName ?? ""}
      defaultLastName={rest.join(" ")}
      defaultEmail={contract.employee_email ?? ""}
      summary={contract.summary}
      schedule={contract.pay_schedule}
      documents={CONTRACT_DOCUMENTS}
    />
  );
}
