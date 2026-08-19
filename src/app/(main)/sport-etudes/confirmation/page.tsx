import { Container } from "@/components/container";
import { getEnrollmentsForRegistration, getRegistrationById } from "@/lib/sport-etudes-repo";

export const metadata = { title: "Confirmation — Sport-Études | New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

function formatSessionDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
}

export default async function SportEtudesConfirmationPage({ searchParams }: { searchParams: Promise<{ registrationId?: string; session_id?: string }> }) {
  const { registrationId } = await searchParams;

  const registration = registrationId ? await getRegistrationById(registrationId) : null;
  const enrollments = registration ? await getEnrollmentsForRegistration(registration.id) : [];

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
              {registration.player_first_name} {registration.player_last_name} — Programme technique de préparation aux évaluations du Sport-Études
              {registration.option_chosen === "diagnostic_only" ? " (séance diagnostique gratuite)" : " (programme complet)"}
            </p>

            {enrollments.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{ fontSize: "0.72rem", color: "#9f85ba", textTransform: "uppercase", marginBottom: "0.4rem" }}>Séances</p>
                {enrollments
                  .sort((a, b) => a.session.display_order - b.session.display_order)
                  .map((e) => (
                    <p key={e.id} style={{ fontSize: "0.82rem", color: "#c3c2c8", margin: "0.2rem 0" }}>
                      {formatSessionDate(e.session.session_date)}
                      {e.session.start_time && !e.session.is_time_tbd ? ` · ${e.session.start_time.slice(0, 5)}–${e.session.end_time?.slice(0, 5) ?? ""}` : " · heure à confirmer"}
                      {" · "}
                      {e.session.location}
                    </p>
                  ))}
              </div>
            )}

            <p style={{ fontSize: "0.82rem", color: "#c3c2c8", marginBottom: "0.3rem" }}>
              Prix : {registration.option_chosen === "full_program" ? "315,95 $" : "Gratuit"}
              {" · "}
              Statut du paiement : {registration.status === "paid" ? "Payé" : registration.status === "pending" ? "En attente" : registration.status}
            </p>

            <p style={{ fontSize: "0.82rem", color: "#9f85ba", marginTop: "1.5rem" }}>
              {registration.whatsapp_info
                ? registration.whatsapp_info
                : "Un groupe WhatsApp sera créé afin de faciliter les échanges entre les parents, les joueurs et l'équipe responsable du programme. Les informations concernant le groupe seront transmises aux familles inscrites."}
            </p>
          </>
        )}
      </Container>
    </section>
  );
}
