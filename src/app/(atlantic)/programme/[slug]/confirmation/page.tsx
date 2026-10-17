import type { Metadata } from "next";

import { Container } from "@/components/container";
import { formatMoney } from "@/lib/private-programs";
import { getPrivateProgram, getPrivateRegistrationById } from "@/lib/private-programs-repo";

export const metadata: Metadata = {
  title: { absolute: "Confirmation | FC Atlantic" },
  robots: { index: false, follow: false },
  openGraph: { title: "FC Atlantic", siteName: "FC Atlantic", images: [{ url: "/og/fc-atlantic.jpg", width: 1200, height: 630 }] }
};
export const dynamic = "force-dynamic";

export default async function AtlanticConfirmationPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ registrationId?: string }> }) {
  const { slug } = await params;
  const { registrationId } = await searchParams;
  const [program, registration] = await Promise.all([getPrivateProgram(slug), registrationId ? getPrivateRegistrationById(registrationId) : Promise.resolve(null)]);
  const paid = registration?.status === "paid" || registration?.status === "confirmed";

  return (
    <section className="section-band">
      <Container className="max-w-2xl">
        {!registration ? (
          <p style={{ fontSize: "0.9rem", color: "#c3c2c8" }}>Merci ! Votre inscription est en cours de traitement — vous recevrez une confirmation par courriel sous peu.</p>
        ) : (
          <>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>
              {registration.status === "waitlist" ? "✓ Vous êtes sur la liste d'attente" : paid ? "✓ Inscription confirmée" : "Paiement en cours de vérification…"}
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#c3c2c8", marginBottom: "1rem" }}>
              {registration.player_first_name} — {program?.name ?? "Programme"}
            </p>
            {registration.status !== "waitlist" && (
              <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem", fontSize: "0.85rem", color: "#c3c2c8" }}>
                <p style={{ margin: "0 0 0.25rem" }}>Prix du programme : {formatMoney(registration.list_price_cents ?? 0)}</p>
                {registration.installment_fee_cents > 0 && <p style={{ margin: "0 0 0.25rem" }}>Frais — paiement en 2 versements : + {formatMoney(registration.installment_fee_cents)}</p>}
                <p style={{ margin: "0.4rem 0 0", fontWeight: 700, color: "#fff" }}>Total : {formatMoney(registration.total_due_cents ?? 0)}</p>
              </div>
            )}
            <p style={{ fontSize: "0.82rem", color: "#9d9da0", marginTop: "1rem" }}>Un courriel de confirmation vous a été envoyé. Au plaisir de vous voir sur le terrain !</p>
          </>
        )}
      </Container>
    </section>
  );
}
