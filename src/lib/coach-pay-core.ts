/** Paie des éducateurs, suite (JP, 25 nov. 2026, d'après ses éducateurs). Règles pures, testées.
 *  1. Une séance où l'éducateur n'était pas là (absent ou annulé dans MonClubSportif, ou « Je n'étais pas là ») est
 *     ENLEVÉE de sa paie : plus de ligne à 0 $ dans Ma paie, le chèque ou l'admin de paie. L'assignation reste en base
 *     (Suivi des éducateurs, historique) ; une séance déjà payée reste toujours visible.
 *  2. La banque d'heures : ce qui est compté pour la paie en cours, pour la prochaine paie, le total accumulé
 *     et ce qui est à venir d'après les pratiques assignées.
 *  3. Le courriel de confirmation : un par pratique dont le rapport est fini, avec les heures entrées dans la paie ;
 *     la dernière pratique du jour annonce aussi l'heure de rapport des coachs (remplace « rapports du jour complets »). */

import type { PayLine } from "@/lib/coach-pay";
import { DEFAULT_PAY_SCHEDULE, nextPayPeriod, periodFor, type PayPeriod, type PaySchedule } from "@/lib/pay-periods";

/* ── 1. Séances enlevées de la paie ─────────────────────────────────── */

/** Statuts d'assignation où l'éducateur n'a pas travaillé : rien à payer, rien à montrer. */
export const REMOVED_FROM_PAY = ["absent", "cancelled", "replaced"];

/** La séance compte-t-elle dans la paie (affichée et calculée) ? Une séance déjà payée reste, quoi qu'il arrive. */
export function countsInPay(a: { attendance: string; paid?: boolean | null }): boolean {
  return Boolean(a.paid) || !REMOVED_FROM_PAY.includes(a.attendance);
}

/* ── 2. Banque d'heures ─────────────────────────────────────────────── */

export interface BankBucket {
  /** Compté : présence confirmée (et rapport fini pour l'heure de rapport). */
  earnedHours: number;
  earnedCents: number;
  /** Retenu : présence ou rapport à faire. */
  heldHours: number;
  heldCents: number;
  /** Prévu : pratiques assignées pas encore faites. */
  plannedHours: number;
  plannedCents: number;
  /** Tout (compté + retenu + prévu). */
  totalHours: number;
  totalCents: number;
}

export interface PayBank {
  current: PayPeriod & BankBucket;
  next: PayPeriod & BankBucket;
  /** Tout ce qui est compté depuis le début (payé ou pas). */
  accumulated: { hours: number; cents: number };
  /** Déjà versé (séances marquées payées). */
  paid: { hours: number; cents: number };
  /** Compté, pas encore versé. */
  owed: { hours: number; cents: number };
  /** Retenu (à faire) + prévu (assigné), toutes périodes. */
  upcoming: { hours: number; cents: number };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const sumH = (ls: PayLine[]) => round2(ls.reduce((s, l) => s + l.hours, 0));
const sumC = (ls: PayLine[]) => ls.reduce((s, l) => s + l.cents, 0);

export function bucketOf(lines: PayLine[]): BankBucket {
  const of = (st: PayLine["state"]) => lines.filter((l) => l.state === st);
  const e = of("compte");
  const h = of("retenu");
  const p = of("prevu");
  const all = [...e, ...h, ...p];
  return {
    earnedHours: sumH(e),
    earnedCents: sumC(e),
    heldHours: sumH(h),
    heldCents: sumC(h),
    plannedHours: sumH(p),
    plannedCents: sumC(p),
    totalHours: sumH(all),
    totalCents: sumC(all)
  };
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** La banque d'heures d'un éducateur à partir de toutes ses lignes de paie (toutes périodes, « absent » exclu). */
export function payBank(lines: PayLine[], today: string, s: PaySchedule = DEFAULT_PAY_SCHEDULE): PayBank {
  const kept = lines.filter((l) => l.state !== "absent");
  const cur = nextPayPeriod(today, s);
  const nxt = periodFor(addDays(cur.payDate, s.everyDays), s);
  const inP = (p: PayPeriod) => kept.filter((l) => l.date >= p.from && l.date <= p.to);
  const earned = kept.filter((l) => l.state === "compte");
  const paid = earned.filter((l) => l.paid);
  const owed = earned.filter((l) => !l.paid);
  const upcoming = kept.filter((l) => l.state === "retenu" || l.state === "prevu");
  return {
    current: { ...cur, ...bucketOf(inP(cur)) },
    next: { ...nxt, ...bucketOf(inP(nxt)) },
    accumulated: { hours: sumH(earned), cents: sumC(earned) },
    paid: { hours: sumH(paid), cents: sumC(paid) },
    owed: { hours: sumH(owed), cents: sumC(owed) },
    upcoming: { hours: sumH(upcoming), cents: sumC(upcoming) }
  };
}

/* ── 3. Courriel de confirmation du rapport ─────────────────────────── */

/** Les confirmations partent pour les pratiques à partir de cette date (pas d'envoi en lot sur les jours d'avant). */
export const PRACTICE_CONFIRM_START = "2026-11-25";

/** La part de l'éducateur dans le rapport d'une pratique est finie : rapport complet (présences, évaluations, sondage)
 *  et, pour un coach qui a une heure de rapport, son retour 2 + 2. L'assistant suit le rapport de la pratique. */
export function coachPartDone(report: { required: boolean; complete: boolean; debriefDone?: string[] } | null | undefined, coachId: string, hasReportHour: boolean): boolean {
  if (!report?.required || !report.complete) return false;
  return !hasReportHour || (report.debriefDone ?? []).includes(coachId);
}

export interface ConfirmedPractice {
  date: string;
  start: string;
  end: string;
  label: string;
  /** Heures de terrain et montant de cette pratique. */
  hours: number;
  cents: number;
  /** Présence confirmée dans MonClubSportif (sinon les heures attendent la lecture du soir). */
  counted: boolean;
}

export interface ConfirmEmailInput {
  firstName: string;
  practices: ConfirmedPractice[];
  /** Heure de rapport des coachs gagnée aujourd'hui (tous les rapports du jour finis), sinon null. */
  reportHour: { hours: number; cents: number; counted: boolean } | null;
  /** Pratiques du même jour dont le rapport reste à finir (coachs : pour gagner l'heure de rapport). */
  pendingToday: number;
  /** Coach qui a une heure de rapport. */
  hasReportHour: boolean;
  /** Paie où ces heures entrent, et la banque de cette paie après l'enregistrement. */
  payDate: string;
  bank: { hours: number; cents: number } | null;
  siteUrl: string;
}

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const dayFr = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  const n = d.getUTCDate();
  return `${DAYS[d.getUTCDay()]} ${n === 1 ? "1er" : n} ${MONTHS[d.getUTCMonth()]}`;
};
export const hoursFr = (h: number) => {
  const m = Math.round(h * 60);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${hh} h ${String(mm).padStart(2, "0")}` : `${hh} h`;
};
export const moneyFr = (c: number) => `${(c / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const timeFr = (t: string) => t.replace(":", " h ");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Texte du courriel de confirmation (un envoi peut regrouper plusieurs pratiques du même jour). */
export function practiceConfirmEmail(i: ConfirmEmailInput): { subject: string; html: string; text: string } {
  const day = i.practices[0]?.date ?? "";
  const counted = i.practices.filter((p) => p.counted);
  const addedHours = counted.reduce((s, p) => s + p.hours, 0) + (i.reportHour?.counted ? i.reportHour.hours : 0);
  const allHours = i.practices.reduce((s, p) => s + p.hours, 0) + (i.reportHour?.hours ?? 0);
  const n = i.practices.length;
  const subject = `${n > 1 ? `${n} rapports enregistrés` : "Rapport enregistré"} : ${dayFr(day)} · ${hoursFr(allHours)} dans ta paie`;

  const lines: string[] = [];
  lines.push(`Bonjour ${i.firstName},`);
  lines.push(
    n > 1
      ? `Tes rapports du ${dayFr(day)} sont bien enregistrés. Voici les heures qui entrent dans ta paie :`
      : `Ton rapport du ${dayFr(day)} est bien enregistré. Voici les heures qui entrent dans ta paie :`
  );
  const items = i.practices.map(
    (p) => `${timeFr(p.start)} à ${timeFr(p.end)} · ${p.label} : ${hoursFr(p.hours)} de terrain (${moneyFr(p.cents)})${p.counted ? "" : ", comptées dès que ta présence est confirmée dans MonClubSportif (le site la lit chaque soir)"}`
  );
  if (i.reportHour) items.push(`Heure de rapport du jour : ${hoursFr(i.reportHour.hours)} (${moneyFr(i.reportHour.cents)})${i.reportHour.counted ? "" : ", comptée dès que ta présence est confirmée"}`);
  const after: string[] = [];
  if (i.reportHour) after.push("Tous tes rapports de la journée sont finis : ton heure de rapport est ajoutée à ta banque d'heures.");
  else if (i.hasReportHour && i.pendingToday > 0)
    after.push(`Encore ${i.pendingToday} rapport${i.pendingToday > 1 ? "s" : ""} à finir aujourd'hui pour gagner ton heure de rapport du jour.`);
  after.push(
    addedHours > 0
      ? `En tout, ${hoursFr(addedHours)} de plus pour ta paie du ${dayFr(i.payDate)}${i.bank ? ` : ta banque pour cette paie est rendue à ${hoursFr(i.bank.hours)} (${moneyFr(i.bank.cents)})` : ""}.`
      : `Ces heures entreront dans ta paie du ${dayFr(i.payDate)} dès que ta présence est confirmée.`
  );
  after.push("Merci pour ton travail auprès des filles !");

  const text = [...lines, ...items.map((t) => `- ${t}`), ...after, `Ma paie : ${i.siteUrl}/entraineur/paie`, "L'équipe New Valkyria"].join("\n\n");
  const p = (t: string) => `<p style="margin:0 0 12px">${esc(t)}</p>`;
  const html = `<div style="font-family:-apple-system,Arial,sans-serif;font-size:15px;color:#161419;line-height:1.55;max-width:600px">${lines.map(p).join("")}<ul style="padding-left:18px;margin:0 0 12px">${items
    .map((t) => `<li style="margin-bottom:6px">${esc(t)}</li>`)
    .join("")}</ul>${after.map(p).join("")}<p style="margin:20px 0"><a href="${i.siteUrl}/entraineur/paie" style="background:#7c4dff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">Voir ma paie</a></p><p style="margin:0">L'équipe New Valkyria</p></div>`;
  return { subject, html, text };
}
