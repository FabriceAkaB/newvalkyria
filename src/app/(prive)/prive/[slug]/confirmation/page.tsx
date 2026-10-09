import { Container } from "@/components/container";
import { formatMoney } from "@/lib/private-programs";
import { getPrivateProgram, getPrivateRegistrationById } from "@/lib/private-programs-repo";

export const metadata = {
  title: "Confirmation — New Valkyria",
  robots: { index: false, follow: false },
  openGraph: { title: "New Valkyria", images: [{ url: "/og/garcons.jpg", width: 1200, height: 628 }] }
};
export const dynamic = "force-dynamic";

export default async function PrivateConfirmationPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ registrationId?: string }>;
}) {
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
                {registration.referral_discount_cents > 0 && <p style={{ margin: "0 0 0.25rem", color: "#8fce9f" }}>Rabais de référencement : − {formatMoney(registration.referral_discount_cents)}</p>}
                {registration.credit_applied_cents > 0 && <p style={{ margin: "0 0 0.25rem", color: "#8fce9f" }}>Crédit familial : − {formatMoney(registration.credit_applied_cents)}</p>}
                {registration.installment_fee_cents > 0 && <p style={{ margin: "0 0 0.25rem" }}>Supplément 2 versements : + {formatMoney(registration.installment_fee_cents)}</p>}
                <p style={{ margin: "0.4rem 0 0", fontWeight: 700, color: "#fff" }}>Total : {formatMoney(registration.total_due_cents ?? 0)}</p>
              </div>
            )}
            <p style={{ fontSize: "0.82rem", color: "#9d9da0", marginTop: "1rem" }}>Un courriel de confirmation détaillé vous a été envoyé. Merci de votre confiance !</p>
            <p style={{ fontSize: "0.82rem", marginTop: "0.5rem" }}>
              <a href="/compte/recommandations" style={{ color: "#c4a4e4" }}>Mes recommandations</a> — partagez le programme et obtenez une récompense.
            </p>
          </>
        )}
      </Container>
    </section>
  );
}
