import { ScheduledEmailCancel } from "@/components/scheduled-email-cancel";
import { requireAdmin } from "@/lib/admin-auth";
import { CLUB_ID } from "@/lib/club";
import { CRON_JOBS } from "@/lib/cron-jobs";
import { listScheduledCampaigns, type ScheduledCampaign } from "@/lib/scheduled-emails";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const metadata = { title: "Messages et tâches programmés — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const TZ = "America/Toronto";
const when = (iso: string) => new Date(iso).toLocaleString("fr-CA", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: TZ });
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const CHANNEL = { email: "Courriel", mcs: "MonClubSportif" } as const;

function Campaign({ c, pending }: { c: ScheduledCampaign; pending: boolean }) {
  return (
    <section className="mda-card" style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <p className="mda-muted" style={{ margin: 0, fontSize: "0.75rem" }}>
            {CHANNEL[c.channel]} · {when(c.sendAt)}
          </p>
          <p style={{ margin: "2px 0 0", fontWeight: 600, color: "var(--adm-text)" }}>{c.campaign}</p>
          <p style={{ margin: "2px 0 0", fontSize: "0.8125rem", color: "var(--adm-text-2)" }}>
            {c.count} {c.channel === "mcs" ? "publication" : "courriel"}
            {c.count > 1 ? "s" : ""}
            {c.failed ? <span style={{ color: "var(--adm-bad)" }}> · {c.failed} en échec</span> : null}
            {!pending && c.status === "annule" ? " · annulé" : ""}
          </p>
        </div>
        {pending ? <ScheduledEmailCancel campaign={c.campaign} /> : <span className="mda-pill" data-tone={c.failed ? "bad" : c.status === "annule" ? undefined : "good"}>{c.failed ? "À vérifier" : c.status === "annule" ? "Annulé" : "Parti"}</span>}
      </div>
      <details>
        <summary style={{ cursor: "pointer", fontSize: "0.8125rem", color: "var(--adm-accent)" }}>Voir le message et les destinataires</summary>
        <p style={{ margin: "8px 0 4px", fontWeight: 600, fontSize: "0.8125rem" }}>{c.subject}</p>
        <p style={{ margin: 0, whiteSpace: "pre-line", fontSize: "0.8125rem", color: "var(--adm-text-2)", lineHeight: 1.55 }}>{c.preview.slice(0, 1500)}</p>
        <p className="mda-muted" style={{ margin: "8px 0 0", fontSize: "0.75rem" }}>Pour : {c.who.join(" · ")}</p>
      </details>
    </section>
  );
}

/** « Qu'est-ce qui va partir tout seul, et qu'est-ce que j'ai à faire plus tard ? » (JP, 18 nov. 2026) : les messages
 *  programmés (courriel ou MonClubSportif) avec leur texte et qui les reçoit, ce qui est parti ces 14 derniers jours,
 *  les tâches à venir et les automatisations qui tournent seules. */
export default async function ScheduledPage() {
  await requireAdmin({ roles: ["admin"] });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const db = getSupabaseAdminClient() as any;
  const [{ upcoming, recent }, { data: tasks }] = await Promise.all([
    listScheduledCampaigns(),
    db.from("team_tasks").select("id, title, due, assignee").eq("club_id", CLUB_ID).in("status", ["a_faire", "en_cours"]).gte("due", today).order("due").limit(80)
  ]);
  const byDay = new Map<string, any[]>();
  for (const t of (tasks ?? []) as any[]) {
    const d = String(t.due).slice(0, 10);
    byDay.set(d, [...(byDay.get(d) ?? []), t]);
  }
  return (
    <div className="admin-content">
      <div className="admin-section mda">
        <header>
          <p className="mda-eyebrow">Communications · tout ce qui est programmé</p>
          <h1 className="mda-h1">{upcoming.length ? `${upcoming.length} envoi${upcoming.length > 1 ? "s" : ""} programmé${upcoming.length > 1 ? "s" : ""}` : "Aucun envoi programmé"}</h1>
          <p className="mda-lead">Les messages qui partiront tout seuls (courriel ou MonClubSportif), avec leur texte et qui les reçoit ; un envoi s&apos;annule jusqu&apos;à son heure. Plus bas : ce qui est parti, tes tâches à venir et les automatisations du site.</p>
        </header>

        <div style={{ display: "grid", gap: 12 }}>
          {upcoming.map((c) => (
            <Campaign key={`${c.campaign}|${c.channel}`} c={c} pending />
          ))}
          {!upcoming.length ? <p className="mda-muted">Rien n&apos;est programmé pour l&apos;instant.</p> : null}
        </div>

        {recent.length ? (
          <>
            <h2 className="mda-h" style={{ marginTop: 28 }}>Partis ces 14 derniers jours</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {recent.map((c) => (
                <Campaign key={`r|${c.campaign}|${c.channel}|${c.sendAt}`} c={c} pending={false} />
              ))}
            </div>
          </>
        ) : null}

        <h2 className="mda-h" style={{ marginTop: 28 }}>Tâches à venir</h2>
        <section className="mda-card-flush">
          <table className="admin-table">
            <tbody>
              {[...byDay.entries()].map(([d, list]) =>
                list.map((t, i) => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: "nowrap", color: "var(--adm-text-3)", width: 120 }}>{i === 0 ? day(d) : ""}</td>
                    <td style={{ fontSize: "0.8125rem" }}>{t.title}</td>
                    <td style={{ fontSize: "0.75rem", color: "var(--adm-text-3)", whiteSpace: "nowrap" }}>{t.assignee}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {!byDay.size ? <p className="mda-muted" style={{ padding: "16px 20px", margin: 0 }}>Aucune tâche à venir.</p> : null}
        </section>

        <h2 className="mda-h" style={{ marginTop: 28 }}>Automatisations qui tournent seules</h2>
        <section className="mda-card">
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: "0.8125rem", color: "var(--adm-text-2)" }}>
            {Object.values(CRON_JOBS).map((j) => (
              <li key={j.label}>{j.label}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
