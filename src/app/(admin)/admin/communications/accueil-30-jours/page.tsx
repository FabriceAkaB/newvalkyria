import { CalendarClock, Mail } from "lucide-react";

import { Onboarding30DaysPanel } from "@/components/onboarding-30-days-panel";
import { requireAdmin } from "@/lib/admin-auth";
import { addDays, frenchDay, frenchTime, onboardingEmail, onboardingSchedule, ONBOARDING_STEPS, torontoDate, type OnboardingFamily } from "@/lib/onboarding-30-days";
import { getOnboardingCounts, getOnboardingSettings, scheduleOnboardingForNewFamilies } from "@/lib/onboarding-30-days-repo";

export const metadata = { title: "Accueil des 30 premiers jours — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const TZ = "America/Toronto";
const when = (iso: string) => new Date(iso).toLocaleString("fr-CA", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ });

/** Famille d'exemple pour l'aperçu : 1re séance le lundi qui suit dans 5 jours ou plus. */
function exampleFamily(now: Date): OnboardingFamily {
  let date = addDays(torontoDate(now.getTime()), 5);
  while (new Date(`${date}T12:00:00Z`).getUTCDay() !== 1) date = addDays(date, 1);
  return {
    key: "exemple",
    email: "parent@exemple.com",
    parentName: "Marie Tremblay",
    children: ["Emma"],
    programs: ["Team Valkyria"],
    paidAt: now.toISOString(),
    registrationIds: [],
    firstSession: { date, start: "19:30", end: "20:55", location: "Sainte-Thérèse", source: "horaire" }
  };
}

const emailDoc = (html: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:16px;background:#ffffff">${html}</body></html>`;

/** P4.2.03 + P4.1.01 : la séquence d'accueil d'une nouvelle famille (5 courriels sur 30 jours), son interrupteur
 *  (mode assistant par défaut) et ce qu'elle programmerait maintenant. */
export default async function Onboarding30DaysPage() {
  await requireAdmin({ roles: ["admin", "gerante"] });
  const now = new Date();
  const [settings, counts, report] = await Promise.all([getOnboardingSettings(), getOnboardingCounts(), scheduleOnboardingForNewFamilies({ dryRun: true, now })]);
  const sample = exampleFamily(now);
  const sampleTimes = new Map(onboardingSchedule(sample, now).map((s) => [s.step, s.sendAt]));
  const totalPending = counts.reduce((n, c) => n + c.pending, 0);
  const totalSent = counts.reduce((n, c) => n + c.sent, 0);

  return (
    <div className="admin-content">
      <div className="admin-section mda">
        <header>
          <p className="mda-eyebrow">Communications · nouvelles familles</p>
          <h1 className="mda-h1">Accueil des 30 premiers jours</h1>
          <p className="mda-lead">
            Pour qu&apos;aucune nouvelle famille ne se sente perdue : 5 courriels programmés dès le paiement, de la bienvenue au petit sondage du 30e jour. Une famille déjà inscrite à une saison précédente ou à un autre programme ne les reçoit pas.
          </p>
        </header>

        <Onboarding30DaysPanel active={settings.active} videoUrl={settings.videoUrl} />

        <div className="admin-stats" style={{ marginTop: 16 }}>
          <div className="admin-stat-card">
            <p className="mda-muted" style={{ margin: 0, fontSize: "0.75rem" }}>Nouvelles familles (24 h)</p>
            <p style={{ margin: "4px 0 0", fontSize: "1.5rem", fontWeight: 600, color: "var(--adm-text)" }}>{report.newFamilies}</p>
          </div>
          <div className="admin-stat-card">
            <p className="mda-muted" style={{ margin: 0, fontSize: "0.75rem" }}>Déjà connues (24 h)</p>
            <p style={{ margin: "4px 0 0", fontSize: "1.5rem", fontWeight: 600, color: "var(--adm-text)" }}>{report.notNew}</p>
          </div>
          <div className="admin-stat-card">
            <p className="mda-muted" style={{ margin: 0, fontSize: "0.75rem" }}>Courriels en attente</p>
            <p style={{ margin: "4px 0 0", fontSize: "1.5rem", fontWeight: 600, color: "var(--adm-text)" }}>{totalPending}</p>
          </div>
          <div className="admin-stat-card">
            <p className="mda-muted" style={{ margin: 0, fontSize: "0.75rem" }}>Courriels partis</p>
            <p style={{ margin: "4px 0 0", fontSize: "1.5rem", fontWeight: 600, color: "var(--adm-text)" }}>{totalSent}</p>
          </div>
        </div>

        <h2 className="mda-h" style={{ marginTop: 28 }}>{settings.active ? "Programmé à la prochaine vérification" : "Ce qui serait programmé maintenant"}</h2>
        {report.families.length ? (
          <div style={{ display: "grid", gap: 12 }}>
            {report.families.map((f) => (
              <section key={`${f.parentName}|${f.paidAt}`} className="mda-card" style={{ display: "grid", gap: 6 }}>
                <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>
                  {f.children.join(", ") || "Enfant"} <span style={{ fontWeight: 400, color: "var(--adm-text-2)" }}>· {f.parentName ?? "Parent"} · {f.programs.join(", ")}</span>
                </p>
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--adm-text-2)" }}>
                  1re séance :{" "}
                  {f.firstSession ? `${frenchDay(f.firstSession.date)}, ${frenchTime(f.firstSession.start)}${f.firstSession.location ? `, ${f.firstSession.location}` : ""} (${f.firstSession.source === "monclubsportif" ? "MonClubSportif" : "horaire du site"})` : "inconnue (pas de rappel ni de « comment ça s'est passé »)"}
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.8125rem", color: "var(--adm-text-2)" }}>
                  {f.steps.map((s) => (
                    <li key={s.step}>
                      {ONBOARDING_STEPS.find((x) => x.step === s.step)?.label} : {when(s.sendAt)}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="mda-muted">Aucune nouvelle famille payée dans les dernières 24 heures sans sa séquence.</p>
        )}

        <h2 className="mda-h" style={{ marginTop: 28 }}>Les 5 courriels</h2>
        <p className="mda-muted" style={{ marginTop: 0 }}>
          Aperçu pour une famille d&apos;exemple (Emma, Team Valkyria, 1re séance le {frenchDay(sample.firstSession!.date)} à 19 h 30). Les jours 14 et 30 se comptent depuis la 1re séance quand elle vient après le paiement. Aucun courriel ne part la nuit.
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {ONBOARDING_STEPS.map((s, i) => {
            const mail = onboardingEmail(s.step, sample, settings.videoUrl);
            const c = counts.find((x) => x.step === s.step);
            const at = sampleTimes.get(s.step);
            return (
              <section key={s.step} className="mda-card" style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <p className="mda-muted" style={{ margin: 0, fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <CalendarClock size={14} aria-hidden /> {i + 1}. {s.when}
                      {at ? ` · exemple : ${when(at)}` : ""}
                    </p>
                    <p style={{ margin: "2px 0 0", fontWeight: 600, color: "var(--adm-text)" }}>{s.label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.8125rem", color: "var(--adm-text-2)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Mail size={14} aria-hidden /> {mail.subject}
                    </p>
                  </div>
                  {c && (c.pending || c.sent || c.failed) ? (
                    <span className="mda-pill" data-tone={c.failed ? "bad" : "info"}>
                      {c.pending} en attente · {c.sent} partis{c.failed ? ` · ${c.failed} en échec` : ""}
                    </span>
                  ) : null}
                </div>
                <details>
                  <summary style={{ cursor: "pointer", fontSize: "0.8125rem", color: "var(--adm-accent)" }}>Voir le courriel</summary>
                  <iframe
                    title={`Aperçu du courriel : ${s.label}`}
                    srcDoc={emailDoc(mail.html)}
                    sandbox=""
                    style={{ width: "100%", height: 520, marginTop: 8, border: "1px solid var(--adm-line)", borderRadius: 8 }}
                  />
                </details>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
