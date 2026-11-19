import Link from "next/link";

import { CoachTopbar } from "@/components/coach-topbar";
import { requireCoach } from "@/lib/coach-auth";
import { getCoachPay } from "@/lib/coach-pay-repo";
import { getCoach } from "@/lib/coaches-repo";
import { DEBRIEF_POINT_MIN_WORDS, NOTE_MIN_WORDS } from "@/lib/coach-report";

export const metadata = { title: "Ma paie — Espace Technique" };
export const dynamic = "force-dynamic";

const money = (c: number) => `${(c / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const hrs = (h: number) => `${h.toLocaleString("fr-CA", { maximumFractionDigits: 2 })} h`;
const day = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { ...o, timeZone: "UTC" });
const STATE = {
  compte: { t: "Compté", c: "var(--adm-good)" },
  retenu: { t: "Retenu", c: "var(--adm-warn)" },
  prevu: { t: "Prévu", c: "var(--adm-text-3)" },
  absent: { t: "Absent", c: "var(--adm-text-3)" }
} as const;

/** « Combien j'ai déjà gagné, et combien je vais recevoir ? » (JP, 18 nov. 2026) : la période de paie en cours, en
 *  agenda (où j'étais, combien chaque bloc), avec le net après retenues et la date de la paie. */
export default async function CoachPayPage({ searchParams }: { searchParams: Promise<{ avant?: string }> }) {
  const coachId = await requireCoach();
  const offset = Math.min(Math.max(Number((await searchParams).avant ?? 0) || 0, 0), 12);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const [coach, { period, lines, summary: s }] = await Promise.all([getCoach(coachId), getCoachPay(coachId, today, offset)]);
  const days = [...new Set(lines.map((l) => l.date))];
  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="admin-section coach-page">
          <p className="coach-eyebrow">
            Ma paie · du {day(period.from, { day: "numeric", month: "long" })} au {day(period.to, { day: "numeric", month: "long" })}
          </p>
          <h1 className="coach-title coach-title--xl">
            {money(s.netCents)} <span style={{ fontSize: "0.5em", fontWeight: 500, color: "var(--adm-text-3)" }}>dans ta poche le {day(period.payDate, { weekday: "long", day: "numeric", month: "long" })}</span>
          </h1>
          <p className="coach-sub">
            {hrs(s.hoursEarned)} comptées ({money(s.earnedCents)})
            {s.deductions.length ? ` · retenues : ${s.deductions.map((d) => `${d.label} ${money(d.cents)}`).join(", ")}` : " · aucune retenue"}
            {s.heldCents ? ` · ${money(s.heldCents)} en attente (présence ou rapport à faire)` : ""}
            {s.plannedCents ? ` · ${money(s.plannedCents)} prévus d'ici la fin de la période` : ""}.
            {s.heldCents || s.plannedCents ? ` Si tout est fait : ${money(s.netIfAllCents)}.` : ""}
          </p>

          <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
            {days.map((d) => (
              <div key={d} className="coach-card" style={{ padding: "12px 16px" }}>
                <p className="coach-card__label" style={{ marginBottom: 6 }}>{day(d, { weekday: "long", day: "numeric", month: "long" })}</p>
                {lines.filter((l) => l.date === d).map((l, i) => (
                  <Link key={`${l.activityId}-${i}`} href={`/entraineur/activites/${l.activityId}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", textDecoration: "none", color: "inherit", borderTop: i ? "1px solid var(--adm-line)" : "none" }}>
                    <span>
                      <strong>{l.start}–{l.end}</strong> · {l.label}
                      {l.why ? <span style={{ display: "block", fontSize: "0.78rem", color: "var(--adm-warn)" }}>{l.why} : touche pour le faire</span> : null}
                    </span>
                    <span style={{ textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                      {hrs(l.hours)} · {money(l.cents)}
                      <span style={{ display: "block", fontSize: "0.75rem", color: STATE[l.state].c }}>{STATE[l.state].t}</span>
                    </span>
                  </Link>
                ))}
              </div>
            ))}
            {!days.length ? <p className="coach-muted">Aucune activité dans cette période.</p> : null}
          </div>

          <p style={{ marginTop: 16, display: "flex", gap: 16 }}>
            <Link href={`/entraineur/paie?avant=${offset + 1}`}>← Période d&apos;avant</Link>
            {offset ? <Link href={offset > 1 ? `/entraineur/paie?avant=${offset - 1}` : "/entraineur/paie"}>Période suivante →</Link> : null}
          </p>
          <div className="coach-card" style={{ marginTop: 16 }}>
            <p className="coach-card__label">Comment une pratique est payée</p>
            <ol style={{ margin: "4px 0 0", paddingLeft: 20, display: "grid", gap: 8, color: "var(--adm-text)" }}>
              <li><strong>Tes heures de terrain</strong> : payées dès que tu es « présent » dans MonClubSportif (c&apos;est ton punch).</li>
              <li>
                <strong>L&apos;heure de rapport (coachs seulement) : 1 heure de plus par jour de pratique</strong>, une seule même s&apos;il y a deux pratiques ce jour-là, payée au complet. Elle s&apos;ajoute toute seule à ta paie quand tes rapports du jour sont finis ; sinon, tu es payé pour tes heures de terrain seulement. Le rapport fini, pour chaque pratique de filles :
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, display: "grid", gap: 4 }}>
                  <li>les présences de toutes les joueuses ;</li>
                  <li>l&apos;évaluation de chaque fille présente : 3 notes de 1 à 5, chaque geste du ball mastery de 1 à 10, et une observation d&apos;au moins {NOTE_MIN_WORDS} mots (comment elle était aujourd&apos;hui, comment elle progresse, un exemple vu à la pratique) ; en bas de {NOTE_MIN_WORDS} mots, elle n&apos;est pas acceptée ;</li>
                  <li>le sondage du jour de chaque fille présente (plaisir et fatigue) ;</li>
                  <li>ton retour : 2 choses qui ont bien marché et 2 à améliorer, {DEBRIEF_POINT_MIN_WORDS} mots ou plus chacune.</li>
                </ul>
              </li>
              <li><strong>Assistants</strong> : payés pour leurs heures de terrain ; ils aident au rapport, l&apos;heure de rapport va aux coachs.</li>
            </ol>
            <p className="coach-muted" style={{ fontSize: "0.8rem", margin: "10px 0 0" }}>Règle en place à partir du 19 novembre 2026 (pour la paie du 27 novembre, l&apos;heure de rapport des pratiques du 8 au 18 novembre est déjà comptée). Ce qui manque est écrit à côté de chaque heure retenue et dans l&apos;étape « Après » de la pratique.</p>
          </div>
        </div>
      </div>
    </>
  );
}
