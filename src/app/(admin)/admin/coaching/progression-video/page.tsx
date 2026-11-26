import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { ProgressCell } from "@/components/admin-progress-videos";
import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { CHECKPOINTS, checkpointWindow, currentCheckpoint } from "@/lib/progress-videos";
import { getProgressBoard } from "@/lib/progress-videos-repo";

export const metadata = { title: "Vidéos de progression — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

const fr = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", timeZone: "UTC" });

/** « Qui reste à filmer ? » Chaque fille filmée à quelques moments de la saison (petites : début, mi-saison, fin ;
 *  2015 et plus vieilles : mi-saison et fin). Les familles voient les vidéos de leur fille dans leur espace
 *  (Progression), avec un avant / après. */
export default async function ProgressVideosPage() {
  await requireAdmin({ roles: ["admin", "gerante"] });
  const { season, rows } = await getProgressBoard();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const now = season ? currentCheckpoint(season, today) : "mi";
  const due = rows.filter((r) => r.checkpoints.includes(now));
  const missing = due.filter((r) => !r.videos.some((v) => v.checkpoint === now)).length;
  const groups = [...new Set(rows.map((r) => r.group))];
  const win = season ? checkpointWindow(season, now) : null;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · progression en vidéo</p>
            <h1 className="mda-h1">{due.length ? `${missing} fille${missing > 1 ? "s" : ""} à filmer pour la ${CHECKPOINTS.find((c) => c.key === now)!.label.toLowerCase()}` : "Aucune fille à filmer"}</h1>
            <p className="mda-lead">
              Un court extrait (environ 30 secondes) de chaque fille, toujours le même exercice, à chaque moment de la saison : début, mi-saison et fin pour les petites (2016 et plus jeunes), mi-saison et fin pour les 2015 et plus vieilles. La famille le voit dans son espace (Progression), et à la fin, l&apos;avant / après.
              {win ? ` En ce moment : du ${fr(win.from)} au ${fr(win.to)}.` : ""} Toutes les vidéos d&apos;une fille, peu importe la date : clic sur son nom. Les capsules de chaque pratique : <Link href="/admin/coaching/progression-video/demandes">Demandes de vidéos du jour</Link>.
            </p>
          </header>
          {groups.map((g) => {
            const list = rows.filter((r) => r.group === g);
            const cps = list[0]?.checkpoints ?? [];
            return (
              <section key={g} className="mda-card-flush">
                <div className="mda-card-head">
                  <h2 className="mda-h2" style={{ textTransform: "none" }}>Nées en {g}</h2>
                  <Pill>{list.length} filles</Pill>
                </div>
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
                          <td style={{ fontWeight: 600 }}><Link href={`/admin/coaching/progression-video/joueuse/${r.registrationId}`} style={{ color: "var(--adm-text)" }}>{r.name}</Link></td>
                          {cps.map((c) => (
                            <ProgressCell key={c} registrationId={r.registrationId} name={r.name} checkpoint={c} current={c === now} videos={r.videos.filter((v) => v.checkpoint === c).map((v) => ({ id: v.id, checkpoint: v.checkpoint, title: v.title, note: v.note }))} />
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
