import { Container } from "@/components/container";
import { formatMoney } from "@/lib/private-programs";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getRentalById } from "@/lib/terrain-rentals-repo";

export const metadata = { title: "Confirmation — New Valkyria", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function RentalConfirmationPage({ searchParams }: { searchParams: Promise<{ rentalId?: string }> }) {
  const { rentalId } = await searchParams;
  const rental = rentalId ? await getRentalById(rentalId) : null;
  const { data: terrain } = rental ? await (getSupabaseAdminClient() as any).from("terrains").select("name, address").eq("id", rental.terrain_id).maybeSingle() : { data: null };

  return (
    <section className="section-band">
      <Container className="max-w-2xl">
        {!rental ? (
          <p style={{ color: "#c3c2c8" }}>Merci ! Votre réservation est en cours de traitement — vous recevrez une confirmation par courriel.</p>
        ) : (
          <>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>
              {rental.status === "paid" ? "✓ Réservation confirmée" : rental.status === "cancelled" ? "Réservation annulée" : "Paiement en cours de vérification…"}
            </h1>
            <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem", fontSize: "0.85rem", color: "#c3c2c8" }}>
              <p style={{ margin: "0 0 0.25rem" }}><strong style={{ color: "#fff" }}>{terrain?.name ?? "Terrain"}</strong>{terrain?.address ? ` — ${terrain.address}` : ""}</p>
              <p style={{ margin: "0 0 0.25rem" }}>{new Date(rental.rental_date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {rental.start_time} – {rental.end_time}</p>
              <p style={{ margin: 0 }}>Montant : {formatMoney(rental.price_cents)}</p>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#9d9da0", marginTop: "1rem" }}>Une confirmation vous est envoyée par courriel.</p>
          </>
        )}
      </Container>
    </section>
  );
}
