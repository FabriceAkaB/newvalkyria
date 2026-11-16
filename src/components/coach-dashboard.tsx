import Link from "next/link";

import { EntityDocuments } from "@/components/admin-entity-documents";
import { CoachTopbar } from "@/components/coach-topbar";
import { computeHours, formatHoursMinutes } from "@/lib/coach-payroll";

export interface DashboardActivity {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  category: string | null;
  activityType: string;
  title: string | null;
  otherCoaches: string[];
  expectedCount: number;
  trialCount: number;
  /** Plan de séance préparé : nombre de blocs et minutes. */
  blocks: number;
  minutes: number;
  theme: string | null;
  /** Prise de connaissance : « a-lire » (diapos ou exercices pas encore confirmés), « lue », ou rien à lire. */
  read?: "a-lire" | "lue" | null;
}

export interface ToComplete {
  activity: DashboardActivity;
  missing: string[];
}

export interface CoachFeedback {
  date: string;
  total: number | null;
  strengths: string | null;
  toImprove: string | null;
  nextFocus: string | null;
  videoUrl: string | null;
}

interface Props {
  coachName: string;
  today: DashboardActivity[];
  upcoming: DashboardActivity[];
  toComplete: ToComplete[];
  /** Dernier retour publié par JP après une séance observée (P1.4.03). */
  lastFeedback: CoachFeedback | null;
  /** Pour « Mes relevés de paie » (documents d'employé de l'entraîneur, lecture seule). */
  coachId?: string;
  /** Pratiques du jour de l'Académie, pour toute l'équipe (même sans y être assignée). */
  teamToday?: { id: string; startTime: string; endTime: string; title: string; location: string | null; mine: boolean; blocks: number; theme?: string | null }[];
}

function FeedbackCard({ f }: { f: CoachFeedback }) {
  return (
    <div className="coach-card">
      <p className="coach-card__label">
        Mon dernier retour de JP · <span style={{ textTransform: "capitalize" }}>{dayLabel(f.date)}</span>
        {f.total !== null ? ` · ${f.total}/10` : ""}
      </p>
      {f.nextFocus && <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--adm-text)" }}>Mon focus ce mois-ci : {f.nextFocus}</p>}
      <dl className="coach-feedback">
        {f.strengths && <div><dt>Points forts</dt><dd>{f.strengths}</dd></div>}
        {f.toImprove && <div><dt>À améliorer</dt><dd>{f.toImprove}</dd></div>}
      </dl>
      {f.videoUrl && <a href={f.videoUrl} target="_blank" rel="noreferrer" className="coach-secondary" style={{ marginTop: 12 }}>Revoir la vidéo ↗</a>}
    </div>
  );
}

const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("fr-CA", opts);
const titleOf = (a: DashboardActivity) => a.title || (a.category ? `${a.activityType} ${a.category}` : a.activityType);

function TodayHero({ activity }: { activity: DashboardActivity }) {
  return (
    <Link href={`/entraineur/activites/${activity.id}`} className="coach-hero">
      <p className="coach-hero__time">
        {activity.startTime}–{activity.endTime} · {formatHoursMinutes(computeHours(activity.startTime, activity.endTime))}
      </p>
      <p className="coach-hero__title">{titleOf(activity)}</p>
      {activity.theme && <p className="coach-hero__theme">Thème : {activity.theme}</p>}
      <div className="coach-hero__meta">
        {activity.location && <span>{activity.location}</span>}
        <span>{activity.expectedCount} joueuse{activity.expectedCount > 1 ? "s" : ""}{activity.trialCount > 0 && ` + ${activity.trialCount} essai${activity.trialCount > 1 ? "s" : ""}`}</span>
        {activity.otherCoaches.length > 0 && <span>Avec {activity.otherCoaches.join(", ")}</span>}
        <span>{activity.blocks > 0 ? `Plan prêt · ${activity.blocks} bloc${activity.blocks > 1 ? "s" : ""}, ${activity.minutes} min` : "Plan pas encore prêt"}</span>
      </div>
      <span className="coach-hero__cta">{activity.read === "a-lire" ? "📖 Lire la pratique et confirmer" : activity.read === "lue" ? "✓ Pratique lue · la revoir" : "Voir la pratique du jour"}</span>
    </Link>
  );
}

function ActivityRow({ activity, right, warning }: { activity: DashboardActivity; right?: React.ReactNode; warning?: string }) {
  return (
    <Link href={`/entraineur/activites/${activity.id}`} className="coach-row">
      <div style={{ minWidth: 0 }}>
        <p className="coach-row__title">{titleOf(activity)}</p>
        <p className="coach-row__meta">
          <span style={{ textTransform: "capitalize" }}>{dayLabel(activity.date, { weekday: "short", day: "numeric", month: "short" })}</span> · {activity.startTime}
          {activity.location && ` · ${activity.location}`}
        </p>
        {warning && <p className="coach-row__meta" style={{ color: "var(--adm-warn)" }}>{warning}</p>}
      </div>
      {right}
    </Link>
  );
}

const placeOf = (l: string | null) => (l ? l.split(/\s[–-]\s|\(/)[0].trim() : null);
const hm = (t: string) => t.replace(":", " h ").replace(" h 00", " h");

/** Une pratique du jour : l'heure en grand, le groupe, le lieu, le thème, et on l'ouvre. */
function TodayCard({ p }: { p: NonNullable<Props["teamToday"]>[number] }) {
  return (
    <Link href={`/entraineur/activites/${p.id}`} className="coach-tcard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <p className="coach-tcard__time">
          {hm(p.startTime)} <span className="coach-tcard__end">à {hm(p.endTime)}</span>
        </p>
        {p.mine ? <span className="coach-pill" data-tone="info">Ma pratique</span> : null}
      </div>
      <div>
        <p className="coach-tcard__title">{p.title}</p>
        {placeOf(p.location) ? <p className="coach-tcard__place">{placeOf(p.location)}</p> : null}
      </div>
      {p.theme ? <p className="coach-tcard__theme">{p.theme}</p> : null}
      <p className="coach-tcard__cta">{p.blocks > 0 ? `Ouvrir la pratique · ${p.blocks} exercices` : "Ouvrir la pratique"} →</p>
    </Link>
  );
}

export function CoachDashboard({ coachName, today, upcoming, toComplete, lastFeedback, coachId, teamToday = [] }: Props) {
  const next = upcoming[0];
  // Aujourd'hui : les pratiques de l'Académie (toute l'équipe) et mes autres activités du jour.
  const cards = [
    ...teamToday,
    ...today.filter((a) => !teamToday.some((t) => t.id === a.id)).map((a) => ({ id: a.id, startTime: a.startTime, endTime: a.endTime, title: titleOf(a), location: a.location, mine: true, blocks: a.blocks, theme: a.theme }))
  ].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  return (
    <>
      <CoachTopbar coachName={coachName} />
      <div className="admin-content">
        <div className="coach-page coach-page--wide">
          <header>
            <p className="coach-eyebrow">{dayLabel(date)}</p>
            <h1 className="coach-title coach-title--xl">Bonjour {coachName.split(" ")[0]}</h1>
          </header>

          <section style={{ marginTop: 28 }}>
            <h2 className="coach-h2">Aujourd&apos;hui</h2>
            {cards.length ? (
              <div className="coach-today">
                {cards.map((p) => (
                  <TodayCard key={p.id} p={p} />
                ))}
              </div>
            ) : (
              <div className="coach-card">
                <p style={{ margin: 0, color: "var(--adm-text)", fontWeight: 600 }}>Pas de pratique aujourd&apos;hui.</p>
                {next ? (
                  <p className="coach-sub">
                    Prochaine : <span style={{ textTransform: "capitalize" }}>{dayLabel(next.date)}</span> à {hm(next.startTime)}.
                  </p>
                ) : null}
              </div>
            )}
          </section>

          <div className="coach-cols">
            <section>
              <h2 className="coach-h2">À venir</h2>
              {upcoming.length === 0 ? (
                <p className="coach-muted">Aucune activité à venir.</p>
              ) : (
                <div className="coach-list">
                  {upcoming.slice(0, 8).map((a) => (
                    <ActivityRow
                      key={a.id}
                      activity={a}
                      right={
                        a.read === "a-lire" ? (
                          <span className="coach-pill" data-tone="warn">À lire</span>
                        ) : a.read === "lue" ? (
                          <span className="coach-pill" data-tone="good">Lue</span>
                        ) : a.blocks > 0 ? (
                          <span className="coach-pill" data-tone="good">Prête</span>
                        ) : null
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
              {toComplete.length > 0 && (
                <details className="coach-fold">
                  <summary>
                    <span>
                      <strong>{toComplete.length} rapport{toComplete.length > 1 ? "s" : ""} à compléter</strong>
                      <small>Tes heures comptent quand ta présence et ton rapport sont faits.</small>
                    </span>
                    <span className="coach-pill" data-tone="warn">Voir</span>
                  </summary>
                  <div className="coach-list" style={{ marginTop: 12 }}>
                    {toComplete.map((t) => (
                      <ActivityRow key={t.activity.id} activity={t.activity} warning={`À faire : ${t.missing.join(", ")}`} />
                    ))}
                  </div>
                </details>
              )}
              {lastFeedback && <FeedbackCard f={lastFeedback} />}
              {coachId && (
                <details className="coach-fold">
                  <summary>
                    <span>
                      <strong>Mes relevés de paie</strong>
                      <small>Ta présence dans MonClubSportif sert de punch pour la paie.</small>
                    </span>
                    <span className="coach-pill">Ouvrir</span>
                  </summary>
                  <div style={{ marginTop: 12 }}>
                    <EntityDocuments entityType="coach" entityId={coachId} apiBase="/api/coach/documents" readOnly />
                  </div>
                </details>
              )}
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
