import { Container } from "@/components/container";
import { getBookingsByIds } from "@/lib/match-slots-repo";
import { formatMoney } from "@/lib/private-programs";

export const metadata = { title: "Confirmation — New Valkyria", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function MatchConfirmationPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const list = (ids ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 2);
  const bookings = list.length ? await getBookingsByIds(list) : [];
  const paid = bookings.length > 0 && bookings.every((b) => b.status === "paid");

  return (
    <section className="section-band">
      <Container className="max-w-2xl">
        {bookings.length === 0 ? (
          <p style={{ color: "#c3c2c8" }}>Merci ! Votre réservation est en cours de traitement — vous recevrez une confirmation par courriel.</p>
        ) : (
          <>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff", marginBottom: "0.6rem" }}>{paid ? "✓ Réservation confirmée" : "Paiement en cours de vérification…"}</h1>
            <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem", fontSize: "0.85rem", color: "#c3c2c8" }}>
              <p style={{ margin: "0 0 0.5rem", color: "#fff", fontWeight: 700 }}>{bookings[0].org_name} — {bookings[0].team_label}</p>
              {bookings.map((b) => (
                <p key={b.id} style={{ margin: "0 0 0.25rem" }}>
                  {new Date(b.slot.slot_date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {b.slot.start_time} – {b.slot.end_time}
                </p>
              ))}
              <p style={{ margin: "0.6rem 0 0" }}>Montant : {formatMoney(bookings.reduce((n, b) => n + b.price_cents, 0))}</p>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#9d9da0", marginTop: "1rem" }}>Une confirmation vous est envoyée par courriel.</p>
          </>
        )}
      </Container>
    </section>
  );
}
