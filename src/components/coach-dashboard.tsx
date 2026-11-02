import Link from "next/link";

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
}

export interface ToComplete {
  activity: DashboardActivity;
  missing: string[];
}

interface Props {
  coachName: string;
  today: DashboardActivity[];
  upcoming: DashboardActivity[];
  toComplete: ToComplete[];
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
      <span className="coach-hero__cta">Voir la pratique du jour</span>
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

export function CoachDashboard({ coachName, today, upcoming, toComplete }: Props) {
  const next = upcoming[0];
  return (
    <>
      <CoachTopbar coachName={coachName} />
      <div className="admin-content">
        <div className="coach-page">
          <h1 className="coach-title">Bonjour {coachName.split(" ")[0]}</h1>
          <p className="coach-sub" style={{ textTransform: "capitalize" }}>{dayLabel(new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" }))}</p>

          {toComplete.length > 0 && (
            <section style={{ marginTop: 24 }}>
              <h2 className="coach-h2">À compléter ({toComplete.length})</h2>
              <p className="coach-muted" style={{ margin: "-6px 0 12px" }}>Tes heures comptent pour la paie quand ta présence et ton rapport sont faits.</p>
              <div className="coach-list">
                {toComplete.map((t) => (
                  <ActivityRow key={t.activity.id} activity={t.activity} warning={`À faire : ${t.missing.join(", ")}`} right={<span className="coach-pill" data-tone="warn">Compléter</span>} />
                ))}
              </div>
            </section>
          )}

          <section style={{ marginTop: 24 }}>
            <h2 className="coach-h2">Aujourd&apos;hui</h2>
            {today.length === 0 ? (
              <div className="coach-card">
                <p style={{ margin: 0, color: "var(--adm-text)" }}>Pas d&apos;activité aujourd&apos;hui.</p>
                {next && <p className="coach-sub">Prochaine : <span style={{ textTransform: "capitalize" }}>{dayLabel(next.date)}</span> à {next.startTime}.</p>}
              </div>
            ) : (
              <div className="coach-list">{today.map((a) => <TodayHero key={a.id} activity={a} />)}</div>
            )}
          </section>

          <section style={{ marginTop: 24 }}>
            <h2 className="coach-h2">À venir</h2>
            {upcoming.length === 0 ? (
              <p className="coach-muted">Aucune activité à venir.</p>
            ) : (
              <div className="coach-list">
                {upcoming.slice(0, 10).map((a) => (
                  <ActivityRow key={a.id} activity={a} right={<span className="coach-pill" data-tone={a.blocks > 0 ? "good" : "info"}>{a.blocks > 0 ? "Plan prêt" : "Plan à venir"}</span>} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
