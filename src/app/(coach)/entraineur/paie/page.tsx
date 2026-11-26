import Link from "next/link";

import { CoachTopbar } from "@/components/coach-topbar";
import { PayBankTiles } from "@/components/pay-bank";
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
  const [coach, { period, lines, summary: s, bank }] = await Promise.all([getCoach(coachId), getCoachPay(coachId, today, offset)]);
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

          {!offset ? <PayBankTiles bank={bank} /> : null}

          <p className="coach-card__label" style={{ margin: "20px 0 0" }}>Le détail de cette paie</p>
          <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
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
          <div className="coach-card" style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <p className="coach-card__label" style={{ margin: 0 }}>Comment tes heures sont payées</p>

            <div>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>1. Les heures sur le terrain (tout le monde)</p>
              <ul className="coach-sub" style={{ margin: "6px 0 0", paddingLeft: 20, display: "grid", gap: 4 }}>
                <li>Le temps de la pratique, de l&apos;heure de début à l&apos;heure de fin (ex. 18 h 00 à 19 h 25 = 1 h 25).</li>
                <li>Payées dès que tu es « présent » dans MonClubSportif : c&apos;est ton punch. Le site le lit chaque soir.</li>
                <li>Absent dans MonClubSportif (ou « Je n&apos;étais pas là ») : la pratique est enlevée de ta paie.</li>
                <li>Chaque rapport fini t&apos;envoie un courriel de confirmation avec les heures entrées dans ta paie.</li>
              </ul>
            </div>

            <div>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>2. L&apos;heure de rapport, hors terrain (coachs seulement)</p>
              <ul className="coach-sub" style={{ margin: "6px 0 0", paddingLeft: 20, display: "grid", gap: 4 }}>
                <li><strong>1 heure de plus par jour de pratique</strong>, payée au complet, même si tu prends 15 minutes.</li>
                <li><strong>Une seule par jour</strong> : deux pratiques le même soir = 1 heure de rapport, pas 2.</li>
                <li>Elle s&apos;ajoute toute seule à ta paie quand les rapports de toutes tes pratiques du jour sont finis.</li>
                <li>Rapport pas fini = tu es payé pour tes heures de terrain seulement ; l&apos;heure reste « Retenu », avec ce qui manque écrit à côté.</li>
                <li>Les assistants n&apos;ont pas d&apos;heure de rapport : ils aident aux présences, au sondage et aux évaluations.</li>
              </ul>
            </div>

            <div>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>3. Ce qu&apos;un rapport fini contient, pour chaque pratique de filles</p>
              <ul className="coach-sub" style={{ margin: "6px 0 0", paddingLeft: 20, display: "grid", gap: 4 }}>
                <li><strong>Présences des joueuses</strong> : chaque fille présente ou absente (MonClubSportif le fait souvent pour toi).</li>
                <li><strong>Évaluation de chaque fille présente</strong> : 3 notes de 1 à 5, chaque geste du ball mastery de 1 à 10, et une observation d&apos;au moins {NOTE_MIN_WORDS} mots (comment elle était aujourd&apos;hui, comment elle progresse, un exemple vu à la pratique). En bas de {NOTE_MIN_WORDS} mots, elle n&apos;est pas acceptée.</li>
                <li><strong>Sondage du jour</strong> : plaisir et fatigue de chaque fille présente (sur la borne ou dans ton portail).</li>
                <li><strong>Ton retour</strong> : 2 choses qui ont bien marché et 2 à améliorer, {DEBRIEF_POINT_MIN_WORDS} mots ou plus chacune.</li>
              </ul>
            </div>

            <div>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>4. Quand le faire</p>
              <ul className="coach-sub" style={{ margin: "6px 0 0", paddingLeft: 20, display: "grid", gap: 4 }}>
                <li><strong>Avant</strong> : lire la pratique la veille et confirmer « J&apos;ai pris connaissance de la pratique ».</li>
                <li><strong>Dans l&apos;heure après</strong> : noter chaque exercice sur 10, surtout à quel point il a fait ressortir le thème (un courriel te le rappelle).</li>
                <li><strong>Le soir même</strong> : évaluations, sondage et retour, pendant que c&apos;est frais.</li>
                <li><strong>24 h après</strong> : une relance part si quelque chose manque.</li>
              </ul>
            </div>

            <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--adm-surface-2)" }}>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>Exemple</p>
              <p className="coach-sub" style={{ margin: "4px 0 0" }}>
                Lundi, tu coaches 18 h 00 à 19 h 25 et 19 h 30 à 20 h 55 : 2 h 50 de terrain, payées dès ta présence. Tes deux rapports sont finis le soir même : + 1 h de rapport, donc 3 h 50 payées pour la journée.
              </p>
            </div>

            <p className="coach-muted" style={{ fontSize: "0.8rem", margin: 0 }}>Règle en place depuis le 19 novembre 2026 (pour la paie du 27 novembre, l&apos;heure de rapport des pratiques du 8 au 18 novembre est déjà comptée).</p>
          </div>
        </div>
      </div>
    </>
  );
}
