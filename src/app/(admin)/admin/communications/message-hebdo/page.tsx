import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { WeeklyMessageToggle } from "@/components/weekly-message-toggle";
import { requireAdmin } from "@/lib/admin-auth";
import { longDay } from "@/lib/weekly-parent-message";
import { buildWeeklyMessages, getWeeklySettings } from "@/lib/weekly-parent-message-repo";

export const metadata = { title: "Message de la semaine — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Le message de la semaine aux parents (P4.5.01, P1.7.06) : aperçu du courriel de cette semaine pour une famille
 *  au choix, et l'interrupteur Actif / Inactif. Rien n'est envoyé depuis cette page. */
export default async function WeeklyMessagePage({ searchParams }: { searchParams: Promise<{ famille?: string }> }) {
  await requireAdmin({ roles: ["admin", "gerante"] });
  const sp = await searchParams;
  const [settings, build] = await Promise.all([getWeeklySettings(), buildWeeklyMessages()]);
  const msgs = build.messages;
  const fallback = msgs.find((m) => m.hasPhoto) ?? msgs.find((m) => m.kids.length > 1) ?? msgs[0];
  const chosen = msgs.find((m) => m.to === sp.famille) ?? fallback ?? null;
  const withPhoto = msgs.filter((m) => m.hasPhoto).length;
  const withChallenge = msgs.filter((m) => m.hasChallenge).length;
  const when = `${settings.jour} à ${settings.heure} h`;
  const label = (m: (typeof msgs)[number]) => `${m.parentName ?? m.to} · ${m.kids.join(", ")}`;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Messages aux familles · chaque {when}</p>
            <h1 className="mda-h1">Le message de la semaine</h1>
            <p className="mda-lead">
              Un courriel par famille (deux sœurs = un seul courriel) : le thème de la semaine du groupe de chaque fille, une photo des championnes seulement si sa fille était à cette pratique et que chaque fille de la photo a
              l&apos;autorisation photo, et le défi maison du Valkyria Lab. Christine reçoit sa propre copie quand il part.
            </p>
          </header>

          <section className="mda-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>Envoi automatique</p>
                <p style={{ margin: "2px 0 0", color: "var(--adm-text-3)", fontSize: "0.85rem" }}>
                  {settings.actif ? `Part chaque ${when}, une fois par semaine.` : "Éteint : rien ne part tant qu'il n'est pas activé."}
                  {settings.dernierEnvoi ? ` Dernier envoi : semaine du ${longDay(settings.dernierEnvoi)}.` : ""}
                </p>
              </div>
              <WeeklyMessageToggle initial={settings.actif} when={when} />
            </div>
          </section>

          <section className="mda-cols-3">
            <div className="mda-card">
              <p className="mda-num">{msgs.length}</p>
              <p className="mda-label">
                Courriel{msgs.length > 1 ? "s" : ""} prêt{msgs.length > 1 ? "s" : ""} · semaine du {longDay(build.weekStart)}
                {build.skipped ? ` · ${build.skipped} famille${build.skipped > 1 ? "s" : ""} sans rien à dire` : ""}
              </p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{withPhoto}</p>
              <p className="mda-label">Avec une photo des championnes</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{withChallenge}</p>
              <p className="mda-label">{withChallenge ? "Avec le défi maison" : "Défi maison : publiez la routine du mois du Valkyria Lab"}</p>
            </div>
          </section>

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Aperçu</h2>
              {msgs.length ? (
                <form method="get" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label htmlFor="famille" style={{ color: "var(--adm-text-3)", fontSize: "0.85rem" }}>
                    Famille
                  </label>
                  <select id="famille" name="famille" defaultValue={chosen?.to} className="admin-input" style={{ maxWidth: 320 }}>
                    {msgs.map((m) => (
                      <option key={m.to} value={m.to}>
                        {label(m)}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="admin-btn-ghost">
                    Voir
                  </button>
                </form>
              ) : null}
            </div>
            {chosen ? (
              <div style={{ padding: "16px 20px", display: "grid", gap: 12 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Pill tone={chosen.hasTheme ? "good" : undefined}>{chosen.hasTheme ? "Thème" : "Pas de thème"}</Pill>
                  <Pill tone={chosen.hasPhoto ? "good" : undefined}>{chosen.hasPhoto ? "Photo des championnes" : "Pas de photo"}</Pill>
                  <Pill tone={chosen.hasChallenge ? "good" : undefined}>{chosen.hasChallenge ? "Défi maison" : "Pas de défi"}</Pill>
                </div>
                <p style={{ margin: 0, color: "var(--adm-text-2)", fontSize: "0.9rem" }}>
                  <strong style={{ color: "var(--adm-text)" }}>Objet :</strong> {chosen.subject}
                </p>
                {/* Le courriel tel que la famille le reçoit (fond blanc du courriel) ; la signature d'Annie s'ajoute à l'envoi. */}
                <iframe
                  title="Aperçu du courriel"
                  srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;padding:20px;background:#fff">${chosen.html}</body></html>`}
                  sandbox=""
                  style={{ width: "100%", height: 640, border: "1px solid var(--adm-line)", borderRadius: "var(--adm-radius)", background: "var(--adm-surface)" }}
                />
              </div>
            ) : (
              <p className="mda-muted" style={{ padding: "16px 20px", margin: 0 }}>
                Aucun courriel cette semaine : ajoutez le thème de la semaine (Coaching) ou publiez la routine du mois du Valkyria Lab.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
