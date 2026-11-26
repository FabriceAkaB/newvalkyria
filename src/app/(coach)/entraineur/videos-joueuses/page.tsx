import { ProgressCell } from "@/components/admin-progress-videos";
import { CoachTopbar } from "@/components/coach-topbar";
import { requireCoach } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";
import { CHECKPOINTS, checkpointWindow, currentCheckpoint } from "@/lib/progress-videos";
import { getProgressBoard } from "@/lib/progress-videos-repo";

export const metadata = { title: "Vidéos des joueuses — Espace Technique" };
export const dynamic = "force-dynamic";

const fr = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", timeZone: "UTC" });

/** L'espace du vidéaste (JP, 19 nov. 2026) : chaque joueuse avec sa photo pour la reconnaître, et le dépôt de sa
 *  vidéo de progression le jour même. La famille la voit dans son espace (Progression). */
export default async function VideographerPage() {
  const coachId = await requireCoach();
  const coach = await getCoach(coachId);
  const allowed = Boolean(coach?.is_videographer);
  const { season, rows } = allowed ? await getProgressBoard({ withPhotos: true }) : { season: null, rows: [] };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const now = season ? currentCheckpoint(season, today) : "mi";
  const win = season ? checkpointWindow(season, now) : null;
  const due = rows.filter((r) => r.checkpoints.includes(now));
  const missing = due.filter((r) => !r.videos.some((v) => v.checkpoint === now)).length;
  const groups = [...new Set(rows.map((r) => r.group))];

  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="admin-section coach-page coach-page--wide">
          <p className="coach-eyebrow">Vidéos des joueuses</p>
          {!allowed ? (
            <>
              <h1 className="coach-title coach-title--xl">Réservé au vidéaste</h1>
              <p className="coach-sub">Cette page sert à déposer les vidéos de progression des joueuses. Demande à JP si tu dois y avoir accès.</p>
            </>
          ) : (
            <>
              <h1 className="coach-title coach-title--xl">{missing} joueuse{missing > 1 ? "s" : ""} à filmer · {CHECKPOINTS.find((c) => c.key === now)!.label.toLowerCase()}</h1>
              <p className="coach-sub">
                Un court extrait (environ 30 secondes, toujours le même exercice, même angle) de chaque fille. Dépose-le le jour même : la photo t&apos;aide à la reconnaître. Les petites (2016 et après) : début, mi-saison et fin ; les 2015 et plus vieilles : mi-saison et fin.
                {win ? ` En ce moment : du ${fr(win.from)} au ${fr(win.to)}.` : ""} Quoi filmer d&apos;autre à chaque pratique : le <a href="/entraineur/guide-tournage">guide de tournage</a>.
              </p>
              <a href="/entraineur/videos-joueuses/demandes" className="coach-card" style={{ marginTop: 16, display: "block", textDecoration: "none", color: "var(--adm-text)" }}>
                <span className="coach-card__label">Demandes de vidéos du jour</span>
                <span style={{ display: "block", fontWeight: 600, marginTop: 4 }}>Les filles de la pratique d&apos;aujourd&apos;hui : dépose leurs capsules ou marque-les absentes</span>
              </a>
              {groups.map((g) => {
                const list = rows.filter((r) => r.group === g);
                const cps = list[0]?.checkpoints ?? [];
                return (
                  <section key={g} className="coach-card" style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
                    <p className="coach-card__label" style={{ padding: "14px 16px 0" }}>Nées en {g} · {list.length} joueuses</p>
                    <div className="admin-table-wrap" style={{ margin: 0, border: 0 }}>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Joueuse</th>
                            {cps.map((c) => <th key={c}>{CHECKPOINTS.find((x) => x.key === c)!.label}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((r) => (
                            <tr key={r.registrationId}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <span style={{ width: 44, height: 44, borderRadius: 999, overflow: "hidden", flex: "0 0 auto", display: "grid", placeItems: "center", background: "var(--adm-accent-soft)", color: "var(--adm-accent)", fontWeight: 700 }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    {r.photoUrl ? <img src={r.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : r.name.charAt(0)}
                                  </span>
                                  <a href={`/entraineur/videos-joueuses/joueuse/${r.registrationId}`} style={{ fontWeight: 600, color: "var(--adm-text)" }}>{r.name}</a>
                                </div>
                              </td>
                              {cps.map((c) => (
                                <ProgressCell key={c} endpoint="/api/coach/progression-video" registrationId={r.registrationId} name={r.name} checkpoint={c} current={c === now} videos={r.videos.filter((v) => v.checkpoint === c).map((v) => ({ id: v.id, checkpoint: v.checkpoint, title: v.title, note: v.note }))} />
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </>
          )}
        </div>
      </div>
    </>
  );
}
