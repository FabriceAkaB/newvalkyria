import { Container } from "@/components/container";
import { getClubLogos } from "@/lib/club-logos";
import { getBookingsByIds } from "@/lib/match-slots-repo";
import { MATCH_FORMAT } from "@/lib/match-slots-core";
import { formatMoney } from "@/lib/private-programs";

export const metadata = { title: "Votre match — New Valkyria", robots: { index: false, follow: false } };

const arrival = (start: string) => {
  const [h, m] = start.split(":").map(Number);
  const t = h * 60 + m - 30;
  return `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, "0")}`;
};
export const dynamic = "force-dynamic";

export default async function MatchConfirmationPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const list = (ids ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 2);
  const bookings = list.length ? await getBookingsByIds(list) : [];
  const paid = bookings.length > 0 && bookings.every((b) => b.status === "paid");
  const clubLogo = bookings.length ? (await getClubLogos()).get(bookings[0].org_key) ?? null : null;

  return (
    <section className="section-band">
      <Container className="max-w-2xl">
        {bookings.length === 0 ? (
          <p style={{ color: "#c3c2c8" }}>Merci ! Votre réservation est en cours de traitement — vous recevrez une confirmation par courriel.</p>
        ) : (
          <>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff", marginBottom: "0.6rem" }}>{paid ? "✓ Réservation confirmée" : "Paiement en cours de vérification…"}</h1>
            <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem", fontSize: "0.85rem", color: "#c3c2c8" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", margin: "0 0 0.7rem" }}>
                {clubLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={clubLogo} alt="" width={48} height={48} style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 10, background: "#fff" }} />
                ) : null}
                <span style={{ color: "#9d9da0", fontWeight: 700 }}>contre</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="New Valkyria" width={48} height={48} style={{ width: 48, height: 48, objectFit: "contain" }} />
              </div>
              <p style={{ margin: "0 0 0.5rem", color: "#fff", fontWeight: 700 }}>{bookings[0].org_name} — {bookings[0].team_label}</p>
              {bookings.map((b) => (
                <p key={b.id} style={{ margin: "0 0 0.25rem" }}>
                  {new Date(b.slot.slot_date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {b.slot.start_time} – {b.slot.end_time}
                  {b.slot.double_group ? " · double cédule" : ""}
                  {` · ${b.slot.match_format || MATCH_FORMAT}`}
                  {b.slot.opponent ? ` · contre ${b.slot.opponent}` : ""}
                </p>
              ))}
              <p style={{ margin: "0.6rem 0 0" }}>
                <span style={{ color: "#9d9da0" }}>Lieu :</span> {bookings[0].slot.field_label ? `${bookings[0].slot.field_label} · ` : ""}{bookings[0].slot.location}
                <br />
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bookings[0].slot.location.replace(/\s+—\s+terrain voisin$/, ""))}`} target="_blank" rel="noreferrer" style={{ color: "#c4a4e4", fontWeight: 700 }}>
                  Itinéraire →
                </a>
              </p>
              <p style={{ margin: "0.4rem 0 0" }}>
                <span style={{ color: "#9d9da0" }}>Arrivée :</span> {arrival(String(bookings[0].slot.start_time).slice(0, 5))}, 30 minutes avant le match · arbitres fournis par New Valkyria
              </p>
              {bookings.some((b) => b.balance_due_cents > 0) ? (
                <>
                  <p style={{ margin: "0.6rem 0 0" }}>Acompte payé : {formatMoney(bookings.reduce((n, b) => n + b.price_cents, 0))}</p>
                  <p style={{ margin: "0.2rem 0 0" }}>Solde à payer le jour du match : <strong style={{ color: "#fff" }}>{formatMoney(bookings.reduce((n, b) => n + b.balance_due_cents, 0))}</strong></p>
                </>
              ) : (
                <p style={{ margin: "0.6rem 0 0" }}>Montant payé : <strong style={{ color: "#fff" }}>{formatMoney(bookings.reduce((n, b) => n + b.price_cents, 0))}</strong> · rien à payer sur place</p>
              )}
            </div>
            <p style={{ fontSize: "0.82rem", color: "#9d9da0", marginTop: "1rem" }}>Une confirmation vous est envoyée par courriel.</p>
          </>
        )}
      </Container>
    </section>
  );
}
