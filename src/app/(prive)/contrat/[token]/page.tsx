import type { Metadata } from "next";

import { Container } from "@/components/container";
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

  const wrap = (children: React.ReactNode) => (
    <section className="section-band">
      <Container className="max-w-2xl">{children}</Container>
    </section>
  );

  if (!contract || contract.status === "cancelled") {
    return wrap(
      <>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff" }}>Ce lien n&apos;est pas valide</h1>
        <p style={{ color: "#c3c2c8" }}>Écrivez-nous à info@newvalkyria.com et nous vous renverrons votre contrat.</p>
      </>
    );
  }

  if (contract.status === "signed") {
    return wrap(
      <>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff" }}>✓ Contrat déjà signé</h1>
        <p style={{ color: "#c3c2c8" }}>Votre contrat a été signé. Une copie vous a été envoyée par courriel.</p>
        <a className="nv27-btn-primary" href={`/api/contrat/${token}?fichier=copie`} target="_blank" rel="noreferrer" style={{ display: "inline-block", padding: "0.7rem 1.2rem", marginTop: "0.6rem" }}>
          Voir ma copie signée
        </a>
      </>
    );
  }

  const [firstName, ...rest] = contract.employee_name.split(" ");
  return wrap(
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
