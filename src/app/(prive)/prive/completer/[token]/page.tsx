import type { Metadata } from "next";

import { CompleteRegistrationForm } from "@/components/complete-registration-form";
import { Container } from "@/components/container";
import { programEmailLabel } from "@/lib/email";
import { getCompletionByToken } from "@/lib/registration-completions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compléter l'inscription | New Valkyria",
  robots: { index: false, follow: false, nocache: true },
  openGraph: { title: "New Valkyria", images: [{ url: "/og/garcons.jpg", width: 1200, height: 628 }] }
};

export default async function CompleteRegistrationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const completion = await getCompletionByToken(token);

  const wrap = (children: React.ReactNode) => (
    <section className="section-band">
      <Container className="max-w-2xl">{children}</Container>
    </section>
  );

  if (!completion || completion.status === "cancelled") {
    return wrap(
      <>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff" }}>Ce lien n&apos;est pas valide</h1>
        <p style={{ color: "#c3c2c8" }}>Écrivez-nous à info@newvalkyria.com et nous vous renverrons le formulaire.</p>
      </>
    );
  }

  if (completion.status === "completed") {
    return wrap(
      <>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff" }}>✓ Inscription déjà confirmée</h1>
        <p style={{ color: "#c3c2c8" }}>Le formulaire a déjà été rempli. Nous vous enverrons les détails des pratiques. Questions : info@newvalkyria.com</p>
      </>
    );
  }

  return wrap(
    <CompleteRegistrationForm
      token={token}
      programLabel={programEmailLabel(completion.program_slug)}
      amountCents={completion.amount_cents}
      defaultParentName={completion.parent_name ?? ""}
      parentEmail={completion.parent_email}
      defaultCity={completion.parent_city ?? ""}
    />
  );
}
