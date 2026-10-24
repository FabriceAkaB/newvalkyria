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
    return wrap(
      <>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#1d1730" }}>✓ Contrat déjà signé</h1>
        <p style={{ color: "#5d566b" }}>Votre contrat a été signé. Une copie vous a été envoyée par courriel.</p>
        <a href={`/api/contrat/${token}?fichier=copie`} target="_blank" rel="noreferrer" style={{ display: "inline-block", padding: "0.8rem 1.2rem", marginTop: "0.6rem", background: "#5b2a86", color: "#fff", borderRadius: 12, fontWeight: 700, textDecoration: "none" }}>
          Voir ma copie signée
        </a>
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
