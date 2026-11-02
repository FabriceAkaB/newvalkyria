import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { Bar } from "@/components/mandalart/ui";
import { PlayerPhotoCard } from "@/components/player-photos";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const metadata = { title: "Photo de chaque joueuse — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

const ORDER: Record<string, number> = { Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6, Dimanche: 7 };
const title = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());

/** Projet étape par étape : la photo de chaque joueuse sur son profil (présences, évaluations, bulletins).
 *  Classé par groupe, pour les prendre au début de chaque pratique, au téléphone. */
export default async function PlayerPhotosPage({ searchParams }: { searchParams: Promise<{ toutes?: string }> }) {
  await requireAdmin();
  const showAll = (await searchParams).toutes === "1";
  const db = getSupabaseAdminClient() as any;
  const { data: season } = await db.from("seasons").select("id").eq("is_active", true).maybeSingle();
  const [{ data: regs }, { data: slots }, { data: cats }, { data: boys }, { data: progs }] = await Promise.all([
    db.from("registrations").select("player_id, player_first_name, player_last_name, time_slot_template_id, category_id, players(photo_url)").eq("season_id", season?.id ?? "automne-hiver-2026").eq("status", "paid"),
    db.from("time_slot_templates").select("id, day, start_time, location").eq("active", true),
    db.from("time_slot_template_categories").select("time_slot_template_id, category_id"),
    db.from("session_program_registrations").select("player_id, player_first_name, player_last_name, program_slug, players(photo_url)").eq("status", "paid"),
    db.from("session_programs").select("slug, name, published, active")
  ]);
  type P = { id: string; name: string; photo: string | null };
  const groups = new Map<string, { label: string; order: string; players: Map<string, P> }>();
  const add = (key: string, label: string, order: string, p: P) => {
    const g = groups.get(key) ?? { label, order, players: new Map() };
    if (!g.players.has(p.id)) g.players.set(p.id, p);
    groups.set(key, g);
  };
  for (const r of regs ?? []) {
    if (!r.player_id) continue;
    const s = (slots ?? []).find((x: any) => x.id === r.time_slot_template_id);
    const c = (cats ?? []).filter((x: any) => x.time_slot_template_id === s?.id).map((x: any) => x.category_id).join(", ");
    const label = s ? `${s.day} ${String(s.start_time).slice(0, 5)} · Filles ${c || r.category_id || ""} · ${s.location}` : `Sans plage horaire · Filles ${r.category_id ?? ""}`;
    add(s ? `slot-${s.id}` : `cat-${r.category_id}`, label, s ? `${ORDER[s.day] ?? 9}-${s.start_time}` : "9", { id: r.player_id, name: title(`${r.player_first_name ?? ""} ${r.player_last_name ?? ""}`.trim()), photo: r.players?.photo_url ?? null });
  }
  const progName = new Map<string, string>((progs ?? []).filter((p: any) => p.published && p.active).map((p: any) => [p.slug as string, p.name as string] as [string, string]));
  for (const r of boys ?? []) {
    if (!r.player_id || !progName.has(r.program_slug)) continue;
    add(`prog-${r.program_slug}`, progName.get(r.program_slug)!, `8-${r.program_slug}`, { id: r.player_id, name: title(`${r.player_first_name ?? ""} ${r.player_last_name ?? ""}`.trim()), photo: r.players?.photo_url ?? null });
  }
  const list = [...groups.values()].sort((a, b) => a.order.localeCompare(b.order));
  const all = new Map<string, P>();
  for (const g of list) for (const p of g.players.values()) all.set(p.id, p);
  const done = [...all.values()].filter((p) => p.photo).length;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Projet étape par étape · profil de chaque joueuse</p>
            <h1 className="mda-h1">{done === all.size ? "Chaque joueuse a sa photo 🎉" : `${all.size - done} photo${all.size - done > 1 ? "s" : ""} à prendre`}</h1>
            <p className="mda-lead">Au début de chaque pratique, ouvrez cette page au téléphone, choisissez le groupe et touchez « Prendre la photo » pour chaque fille. La photo va sur son profil : présences, évaluations des éducateurs, bulletins.</p>
            <div style={{ marginTop: 16, maxWidth: 520 }}>
              <Bar value={all.size ? done / all.size : 0} color="var(--adm-good)" />
              <p className="mda-label">
                {done} sur {all.size} joueuses ont leur photo ·{" "}
                <Link href={showAll ? "/admin/photos" : "/admin/photos?toutes=1"} style={{ color: "var(--adm-accent)" }}>
                  {showAll ? "Voir seulement celles sans photo" : "Voir toutes les joueuses"}
                </Link>
              </p>
            </div>
          </header>
          {list.map((g) => {
            const players = [...g.players.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
            const missing = players.filter((p) => !p.photo);
            const shown = showAll ? players : missing;
            return (
              <section key={g.label} className="mda-card-flush">
                <div className="mda-card-head">
                  <h2 className="mda-h2">{g.label}</h2>
                  <span className="mda-pill" data-tone={missing.length ? "warn" : "good"}>
                    {players.length - missing.length}/{players.length} photos
                  </span>
                </div>
                {shown.length ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, padding: 16 }}>
                    {shown.map((p) => (
                      <PlayerPhotoCard key={p.id} playerId={p.id} name={p.name} photoUrl={p.photo} />
                    ))}
                  </div>
                ) : (
                  <p style={{ padding: "12px 20px", margin: 0, color: "var(--adm-good)", fontSize: "0.88rem" }}>✓ Toutes les photos de ce groupe sont prises.</p>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
