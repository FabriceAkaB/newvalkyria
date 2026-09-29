import { Container } from "@/components/container";
import { getProgram, getRegistrationById, type SessionProgramSlug } from "@/lib/session-programs-repo";

export const metadata = { title: "Confirmation — New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function ProgrammeConfirmationPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ registrationId?: string; session_id?: string }>;
}) {
  const { slug } = await params;
  const { registrationId } = await searchParams;

  const [program, registration] = await Promise.all([
    getProgram(slug as SessionProgramSlug),
    registrationId ? getRegistrationById(registrationId) : Promise.resolve(null)
  ]);

  return (
    <section className="section-band">
      <Container className="max-w-2xl">
        {!registration ? (
          <p style={{ fontSize: "0.9rem", color: "#c3c2c8" }}>
            Merci ! Votre inscription est en cours de traitement — vous recevrez une confirmation par courriel sous peu.
          </p>
        ) : (
          <>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>
              ✓ Inscription {registration.status === "paid" || registration.status === "confirmed" ? "confirmée" : "reçue"}
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#c3c2c8", marginBottom: "1.5rem" }}>
              {registration.player_first_name} {registration.player_last_name} — {program?.name ?? "Programme"}
            </p>
            <p style={{ fontSize: "0.82rem", color: "#c3c2c8", marginBottom: "0.3rem" }}>
              Prix : {registration.price_cents != null ? `${(registration.price_cents / 100).toFixed(2)} $` : "—"}
              {" · "}
              Statut du paiement : {registration.status === "paid" ? "Payé" : registration.status === "pending" ? "En attente" : registration.status}
            </p>
          </>
        )}
      </Container>
    </section>
  );
}
