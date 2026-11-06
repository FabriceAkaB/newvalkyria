import { randomBytes } from "node:crypto";

import { CLUB_ID } from "@/lib/club";
import { OWNER_NOTIFY_EMAIL } from "@/lib/email";
import { env } from "@/lib/env";
import { getResendClient, isEmailConfigured } from "@/lib/resend";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Arbitres de nos matchs (plages de match_slots, à Terrebonne). Chaque match a ses postes
 *  d'arbitre (2 par défaut, 50 $ chacun). L'arbitre réserve un poste avec son lien personnel ;
 *  la réservation crée une dépense « à payer » dans Revenus (paiement par virement après le match),
 *  et le bilan de chaque match compare ce que l'adversaire a payé aux coûts (terrain, arbitres,
 *  éducateurs). Règle de JP : un match doit au moins faire ses frais. */

function db() {
  return getSupabaseAdminClient() as any;
}

export const SEASON_KEY = "automne-hiver-2026";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

export interface Referee {
  id: string;
  token: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  level: string | null;
  interac_email: string | null;
  notes: string | null;
  status: "en_attente" | "actif" | "inactif";
  created_at: string;
}

export interface Assignment {
  id: string;
  match_slot_id: string;
  role: "arbitre" | "centre" | "assistant";
  fee_cents: number;
  status: "ouvert" | "reserve" | "annule";
  referee_id: string | null;
  reserved_at: string | null;
  expense_id: string | null;
  paid_at: string | null;
  paid_note: string | null;
  /** Prénom de la personne pour qui JP garde ce poste (les autres arbitres ne le voient pas). */
  held_for?: string | null;
}

const nameKey = (s: string | null | undefined) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Ce poste ouvert peut-il être pris par cet arbitre ? (gardé pour quelqu'un d'autre : non) */
export function canTake(a: Pick<Assignment, "status" | "held_for">, referee: Pick<Referee, "first_name"> | null): boolean {
  if (a.status !== "ouvert") return false;
  if (!a.held_for) return true;
  return Boolean(referee) && nameKey(referee!.first_name).split(/[\s-]+/)[0] === nameKey(a.held_for).split(/[\s-]+/)[0];
}

export interface MatchRow {
  id: string;
  date: string;
  start: string;
  end: string | null;
  location: string;
  field: string | null;
  format: string | null;
  /** Double plage : 2 matchs de suite (l'arbitre qui fait les deux touche 2 × le tarif). */
  doubleGroup?: string | null;
  ourTeam: string | null;
  opponent: string | null;
  /** Logo du club adverse (ajouté dans l'admin), s'il y en a un. */
  opponentLogo?: string | null;
  bookingStatus: string | null;
  /** Encaissé (dépôt payé en ligne + solde s'il a été payé). */
  revenueCents: number;
  /** Solde que l'adversaire doit encore payer (ex. sur place). */
  balanceDueCents: number;
  refereesNeeded: number;
  refereeFeeCents: number;
  fieldCostCents: number;
  coachCostCents: number;
  assignments: (Assignment & { referee: Pick<Referee, "id" | "first_name" | "last_name" | "email" | "phone" | "interac_email"> | null })[];
}

export const newRefereeToken = () => randomBytes(15).toString("base64url");

export async function listReferees(): Promise<Referee[]> {
  const { data, error } = await db().from("referees").select("*").eq("club_id", CLUB_ID).order("status").order("first_name");
  if (error) throw error;
  return data ?? [];
}

export async function getRefereeByToken(token: string): Promise<Referee | null> {
  const { data } = await db().from("referees").select("*").eq("token", token).eq("club_id", CLUB_ID).maybeSingle();
  return data ?? null;
}

export async function addReferee(input: { firstName: string; lastName: string; email: string; phone?: string | null; level?: string | null; interacEmail?: string | null; status?: Referee["status"] }): Promise<Referee> {
  const { data, error } = await db()
    .from("referees")
    .insert({
      club_id: CLUB_ID,
      token: newRefereeToken(),
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone ?? null,
      level: input.level ?? null,
      interac_email: input.interacEmail?.trim().toLowerCase() || null,
      status: input.status ?? "actif"
    })
    .select("*")
    .single();
  if (error) throw new Error(error.code === "23505" ? "Cet arbitre est déjà inscrit (même courriel)." : error.message);
  return data;
}

export async function updateReferee(id: string, patch: Partial<Pick<Referee, "status" | "phone" | "level" | "interac_email" | "notes">>): Promise<void> {
  const { error } = await db().from("referees").update(patch).eq("id", id).eq("club_id", CLUB_ID);
  if (error) throw error;
}

/** Nos matchs (plages actives), avec l'adversaire, ce qu'il a payé, les postes d'arbitre et les coûts. */
export async function listMatches(opts: { from?: string; to?: string } = {}): Promise<MatchRow[]> {
  // Plages en vente, plus celles masquées mais payées par un lien direct (un match qui aura lieu).
  const { data: paidRows } = await db().from("match_slot_bookings").select("slot_id").eq("status", "paid");
  const paidIds = Array.from(new Set(((paidRows ?? []) as any[]).map((r) => r.slot_id))).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  let q = db().from("match_slots").select("*").order("slot_date").order("start_time");
  q = paidIds.length ? q.or(`active.eq.true,id.in.(${paidIds.join(",")})`) : q.eq("active", true);
  if (opts.from) q = q.gte("slot_date", opts.from);
  if (opts.to) q = q.lte("slot_date", opts.to);
  const { data: slots, error } = await q;
  if (error) throw error;
  const ids = (slots ?? []).map((s: any) => s.id);
  if (!ids.length) return [];
  const [{ data: bookings }, { data: assigns }, { data: refs }] = await Promise.all([
    db().from("match_slot_bookings").select("slot_id, org_name, org_key, team_label, status, price_cents, balance_due_cents, balance_paid_at").in("slot_id", ids).neq("status", "cancelled"),
    db().from("referee_assignments").select("*").in("match_slot_id", ids).neq("status", "annule").order("created_at"),
    db().from("referees").select("id, first_name, last_name, email, phone, interac_email").eq("club_id", CLUB_ID)
  ]);
  const keys = Array.from(new Set(((bookings ?? []) as any[]).map((b) => b.org_key).filter(Boolean)));
  const { data: logoRows } = keys.length ? await db().from("match_team_profiles").select("org_key, logo_url").in("org_key", keys).not("logo_url", "is", null) : { data: [] };
  const logoOf = new Map(((logoRows ?? []) as any[]).map((r) => [r.org_key, r.logo_url]));
  return (slots ?? []).map((s: any) => {
    const b = (bookings ?? []).find((x: any) => x.slot_id === s.id && x.status === "paid") ?? (bookings ?? []).find((x: any) => x.slot_id === s.id);
    const revenue = b && b.status === "paid" ? (b.price_cents ?? 0) + (b.balance_paid_at ? b.balance_due_cents ?? 0 : 0) : 0;
    const balanceDue = b && b.status === "paid" && !b.balance_paid_at ? b.balance_due_cents ?? 0 : 0;
    return {
      id: s.id,
      date: String(s.slot_date).slice(0, 10),
      start: String(s.start_time).slice(0, 5),
      end: s.end_time ? String(s.end_time).slice(0, 5) : null,
      location: s.location,
      field: s.field_label,
      format: s.match_format,
      doubleGroup: s.double_group ?? null,
      ourTeam: s.opponent,
      opponent: b ? [b.org_name, b.team_label].filter(Boolean).join(" · ") : null,
      opponentLogo: b ? logoOf.get(b.org_key) ?? null : null,
      bookingStatus: b?.status ?? null,
      revenueCents: revenue,
      balanceDueCents: balanceDue,
      refereesNeeded: s.referees_needed ?? 1,
      refereeFeeCents: s.referee_fee_cents ?? 5000,
      fieldCostCents: s.field_cost_cents ?? 18650,
      coachCostCents: s.coach_cost_cents ?? 4000,
      assignments: (assigns ?? [])
        .filter((a: any) => a.match_slot_id === s.id)
        .map((a: any) => ({ ...a, referee: (refs ?? []).find((r: any) => r.id === a.referee_id) ?? null }))
    };
  });
}

/** Bilan d'un match : ce que l'adversaire paie (encaissé + solde attendu) − terrain − arbitres − éducateurs.
 *  Arbitres : les postes réservés à leur prix, plus les postes encore à combler au prix du match. */
export function matchFinance(m: MatchRow) {
  const reserved = m.assignments.filter((a) => a.status === "reserve");
  const refereeCents = reserved.reduce((s, a) => s + a.fee_cents, 0) + Math.max(0, m.refereesNeeded - reserved.length) * m.refereeFeeCents;
  const revenueCents = m.revenueCents + m.balanceDueCents;
  const before = revenueCents - m.fieldCostCents - refereeCents;
  return { revenueCents, balanceDueCents: m.balanceDueCents, fieldCents: m.fieldCostCents, refereeCents, coachCents: m.coachCostCents, beforeCoachesCents: before, netCents: before - m.coachCostCents };
}

export async function updateMatchCosts(slotId: string, patch: { referees_needed?: number; referee_fee_cents?: number; field_cost_cents?: number; coach_cost_cents?: number }) {
  const { error } = await db().from("match_slots").update(patch).eq("id", slotId);
  if (error) throw error;
}

/** Ouvre les postes d'arbitre d'un match (jusqu'au nombre voulu). */
export async function openPositions(slotId: string): Promise<number> {
  const { data: slot } = await db().from("match_slots").select("referees_needed, referee_fee_cents").eq("id", slotId).single();
  const { data: existing } = await db().from("referee_assignments").select("id").eq("match_slot_id", slotId).neq("status", "annule");
  const missing = Math.max(0, (slot?.referees_needed ?? 1) - (existing?.length ?? 0));
  if (missing) {
    const rows = Array.from({ length: missing }, () => ({ club_id: CLUB_ID, match_slot_id: slotId, fee_cents: slot?.referee_fee_cents ?? 5000, role: "arbitre", status: "ouvert" }));
    const { error } = await db().from("referee_assignments").insert(rows);
    if (error) throw error;
  }
  return missing;
}

/** Ouvre les postes de tous les matchs vendus à venir qui n'en ont pas assez (une plage non vendue n'a pas de match). */
export async function openAllUpcoming(): Promise<number> {
  const matches = (await listMatches({ from: today() })).filter((m) => m.bookingStatus === "paid");
  let n = 0;
  for (const m of matches) n += await openPositions(m.id);
  return n;
}

export async function cancelAssignment(assignmentId: string): Promise<void> {
  const { data: a } = await db().from("referee_assignments").select("*").eq("id", assignmentId).single();
  if (!a) throw new Error("Poste introuvable");
  if (a.expense_id && !a.paid_at) await db().from("revenue_expenses").delete().eq("id", a.expense_id);
  await db().from("referee_assignments").update({ status: "annule" }).eq("id", assignmentId);
}

/** Libère un poste réservé (l'arbitre ne vient plus) : il redevient ouvert. */
export async function releaseAssignment(assignmentId: string): Promise<void> {
  const { data: a } = await db().from("referee_assignments").select("*").eq("id", assignmentId).single();
  if (!a) throw new Error("Poste introuvable");
  if (a.paid_at) throw new Error("Ce poste est déjà payé.");
  if (a.expense_id) await db().from("revenue_expenses").delete().eq("id", a.expense_id);
  await db().from("referee_assignments").update({ status: "ouvert", referee_id: null, reserved_at: null, expense_id: null }).eq("id", assignmentId);
}

const DAY = 86400000;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** Réservation d'un poste par l'arbitre (premier arrivé). Crée la dépense « à payer » dans Revenus. */
export async function reservePosition(token: string, assignmentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const referee = await getRefereeByToken(token);
  if (!referee || referee.status !== "actif") return { ok: false, error: "Lien inactif. Écrivez-nous à info@newvalkyria.com." };
  const { data: a } = await db().from("referee_assignments").select("*").eq("id", assignmentId).single();
  if (!a || a.status !== "ouvert") return { ok: false, error: "Ce poste vient d'être pris. Choisissez-en un autre." };
  if (!canTake(a, referee)) return { ok: false, error: "Ce poste est déjà gardé pour un autre arbitre." };
  const { data: mine } = await db().from("referee_assignments").select("id").eq("match_slot_id", a.match_slot_id).eq("referee_id", referee.id).neq("status", "annule");
  if (mine?.length) return { ok: false, error: "Vous êtes déjà inscrit à ce match." };
  const { data: updated } = await db()
    .from("referee_assignments")
    .update({ status: "reserve", referee_id: referee.id, reserved_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .eq("status", "ouvert")
    .select("*");
  if (!updated?.length) return { ok: false, error: "Ce poste vient d'être pris. Choisissez-en un autre." };
  const [match] = await listMatches({}).then((ms) => ms.filter((m) => m.id === a.match_slot_id));
  if (match) {
    const { data: exp } = await db()
      .from("revenue_expenses")
      .insert({
        season_key: SEASON_KEY,
        category: "Salaires / Contractants",
        label: `Arbitre — ${referee.first_name} ${referee.last_name} — match du ${match.date}`,
        amount_cents: a.fee_cents,
        expense_date: match.date,
        is_recurring: false,
        recurrence_end_date: null,
        tax_rate: 0,
        paid_with: "Compte bancaire",
        status: "due",
        due_date: addDays(match.date, 2)
      })
      .select("id")
      .single();
    if (exp?.id) await db().from("referee_assignments").update({ expense_id: exp.id }).eq("id", assignmentId);
    await sendReservationEmails(referee, match, a.fee_cents).catch((err) => console.error("Referee reservation email failed", err));
  }
  return { ok: true };
}

/** L'arbitre se retire (au moins 48 h avant le match). */
export async function withdrawPosition(token: string, assignmentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const referee = await getRefereeByToken(token);
  if (!referee) return { ok: false, error: "Lien introuvable." };
  const { data: a } = await db().from("referee_assignments").select("*, slot:match_slots(slot_date, start_time)").eq("id", assignmentId).single();
  if (!a || a.referee_id !== referee.id || a.status !== "reserve") return { ok: false, error: "Réservation introuvable." };
  const start = Date.parse(`${String(a.slot.slot_date).slice(0, 10)}T${String(a.slot.start_time).slice(0, 5)}:00-05:00`);
  if (start - Date.now() < 48 * 3600000) return { ok: false, error: "Moins de 48 h avant le match : appelez-nous pour vous retirer." };
  await releaseAssignment(assignmentId);
  if (isEmailConfigured()) {
    await getResendClient()
      .emails.send({ from: env.resendFrom, to: OWNER_NOTIFY_EMAIL, subject: `Arbitre retiré : ${referee.first_name} ${referee.last_name} — match du ${String(a.slot.slot_date).slice(0, 10)}`, html: `<p>${referee.first_name} ${referee.last_name} s'est retiré du match du ${String(a.slot.slot_date).slice(0, 10)} à ${String(a.slot.start_time).slice(0, 5)}. Le poste est de nouveau ouvert.</p>` })
      .catch(() => null);
  }
  return { ok: true };
}

/** Paiement de l'arbitre fait (virement) : la dépense passe à « payée ». */
export async function markPaid(assignmentId: string, note: string | null): Promise<void> {
  const { data: a } = await db().from("referee_assignments").select("*").eq("id", assignmentId).single();
  if (!a || a.status !== "reserve") throw new Error("Poste non réservé");
  const now = new Date().toISOString();
  await db().from("referee_assignments").update({ paid_at: now, paid_note: note }).eq("id", assignmentId);
  if (a.expense_id) await db().from("revenue_expenses").update({ status: "paid", expense_date: today() }).eq("id", a.expense_id);
}

// ── Courriels ──

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export function dateLong(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate() === 1 ? "1er" : d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
const money = (c: number) => `${(c / 100).toLocaleString("fr-CA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} $`;
export const refereeLink = (token: string) => `${env.publicSiteUrl}/arbitres/${token}`;

function arrival(start: string) {
  const [h, m] = start.split(":").map(Number);
  const t = h * 60 + m - 30;
  return `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, "0")}`;
}

async function sendReservationEmails(referee: Referee, match: MatchRow, feeCents: number) {
  if (!isEmailConfigured()) return;
  const resend = getResendClient();
  const when = `${dateLong(match.date)} à ${match.start.replace(":", " h ")}`;
  await resend.emails.send({
    from: env.resendFrom,
    to: referee.email,
    subject: `Confirmé : arbitre du match du ${dateLong(match.date)}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#161419;max-width:600px">
        <p>Bonjour ${esc(referee.first_name)},</p>
        <p>Merci ! Vous êtes confirmé comme arbitre de ce match :</p>
        <ul>
          <li><strong>Quand :</strong> ${esc(when)}${match.end ? ` (fin vers ${match.end.replace(":", " h ")})` : ""}</li>
          <li><strong>Arrivée :</strong> ${arrival(match.start)} (30 minutes avant)</li>
          <li><strong>Où :</strong> ${esc(match.location)}${match.field ? ` — ${esc(match.field)}` : ""}</li>
          <li><strong>Match :</strong> ${esc(match.ourTeam ?? "New Valkyria")}${match.opponent ? ` contre ${esc(match.opponent)}` : ""}${match.format ? ` · ${esc(match.format)}` : ""}</li>
          <li><strong>Paiement :</strong> ${money(feeCents)}, par virement Interac dans les 2 jours suivant le match${referee.interac_email ? ` (à ${esc(referee.interac_email)})` : ""}.</li>
        </ul>
        <p>Un empêchement ? Retirez-vous au moins 48 heures avant, avec votre lien : <a href="${refereeLink(referee.token)}">${refereeLink(referee.token)}</a>. Après ce délai, appelez-nous.</p>
      </div>`
  });
  await resend.emails.send({
    from: env.resendFrom,
    to: OWNER_NOTIFY_EMAIL,
    subject: `Arbitre réservé : ${referee.first_name} ${referee.last_name} — ${dateLong(match.date)} ${match.start}`,
    html: `<p><strong>${esc(referee.first_name)} ${esc(referee.last_name)}</strong> arbitrera le match du ${esc(when)} (${esc(match.opponent ?? "adversaire à confirmer")}). ${money(feeCents)} à payer après le match (ajouté aux dépenses à payer).</p><p><a href="${env.publicSiteUrl}/admin/arbitres">Voir les arbitres</a></p>`
  });
}

/** Envoie la liste des matchs ouverts aux arbitres actifs (chacun avec son lien). */
export async function sendOpenMatchesEmail(refereeIds?: string[]): Promise<{ sent: number; openPositions: number }> {
  if (!isEmailConfigured()) throw new Error("Courriel non configuré");
  const free = (a: Assignment) => a.status === "ouvert" && !a.held_for;
  const matches = (await listMatches({ from: today() })).filter((m) => m.assignments.some(free));
  const open = matches.reduce((s, m) => s + m.assignments.filter(free).length, 0);
  if (!open) return { sent: 0, openPositions: 0 };
  let refs = (await listReferees()).filter((r) => r.status === "actif");
  if (refereeIds) refs = refs.filter((r) => refereeIds.includes(r.id));
  const resend = getResendClient();
  const list = matches
    .map((m) => `<li><strong>${esc(dateLong(m.date))}, ${m.start.replace(":", " h ")}</strong> — ${esc(m.field ?? m.location)}${m.opponent ? ` · ${esc(m.opponent)}` : ""} · ${m.assignments.filter(free).length} poste(s) à ${money(m.refereeFeeCents)}</li>`)
    .join("");
  let sent = 0;
  for (const r of refs) {
    await resend.emails.send({
      from: env.resendFrom,
      to: r.email,
      subject: `Matchs à arbitrer — New Valkyria (${open} poste${open > 1 ? "s" : ""} ouvert${open > 1 ? "s" : ""})`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#161419;max-width:600px">
          <p>Bonjour ${esc(r.first_name)},</p>
          <p>Voici nos prochains matchs qui ont besoin d'un arbitre (${money(matches[0].refereeFeeCents)} par match, payé par virement Interac dans les 2 jours) :</p>
          <ul>${list}</ul>
          <p style="margin:24px 0"><a href="${refereeLink(r.token)}" style="background:#7c4dff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">Réserver mes matchs</a></p>
          <p style="color:#555;font-size:14px">Premier arrivé, premier servi. Ce lien est personnel.</p>
        </div>`
    });
    sent++;
  }
  return { sent, openPositions: open };
}

/** Lien personnel envoyé à un arbitre approuvé. */
export async function sendWelcomeEmail(referee: Referee) {
  if (!isEmailConfigured()) return;
  await getResendClient().emails.send({
    from: env.resendFrom,
    to: referee.email,
    subject: "Arbitre New Valkyria : votre lien pour réserver des matchs",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#161419;max-width:600px">
        <p>Bonjour ${esc(referee.first_name)},</p>
        <p>Bienvenue dans notre liste d'arbitres ! Avec ce lien personnel, vous voyez nos matchs qui ont besoin d'un arbitre et vous réservez ceux qui vous conviennent. Vous recevez la confirmation avec l'adresse et l'heure d'arrivée.</p>
        <p style="margin:24px 0"><a href="${refereeLink(referee.token)}" style="background:#7c4dff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">Voir les matchs</a></p>
        <p style="color:#555;font-size:14px">Paiement par virement Interac dans les 2 jours suivant chaque match.</p>
      </div>`
  });
}

/** Arbitres à payer (match passé, poste réservé, pas encore payé) — pour Aujourd'hui. */
export async function getRefereesToPay(): Promise<{ id: string; name: string; date: string; feeCents: number; interac: string | null }[]> {
  const matches = await listMatches({ to: today() });
  return matches.flatMap((m) =>
    m.assignments
      .filter((a) => a.status === "reserve" && !a.paid_at && m.date < today())
      .map((a) => ({ id: a.id, name: a.referee ? `${a.referee.first_name} ${a.referee.last_name}` : "Arbitre", date: m.date, feeCents: a.fee_cents, interac: a.referee?.interac_email ?? a.referee?.email ?? null }))
  );
}

/** Invitation automatique des arbitres (demande de JP, 4 nov. 2026) : chaque jour, les postes des matchs vendus sont
 *  ouverts ; s'il reste un poste libre pour un match dans les 14 prochains jours, tous les arbitres actifs reçoivent
 *  la liste des matchs ouverts (au plus une fois tous les 3 jours, pour ne pas les inonder). */
export async function autoInviteReferees(nowMs = Date.now()): Promise<{ opened: number; sent: number; openSoon: number; skipped?: string }> {
  const opened = await openAllUpcoming();
  const soon = new Date(nowMs + 14 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const matches = (await listMatches({ from: today(), to: soon })).filter((m) => m.bookingStatus === "paid");
  const openSoon = matches.reduce((s, m) => s + m.assignments.filter((a) => a.status === "ouvert" && !a.held_for).length, 0);
  if (!openSoon) return { opened, sent: 0, openSoon };
  const { data: last } = await db().from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", "arbitres_derniere_invitation").maybeSingle();
  if (last?.value && nowMs - Date.parse(last.value) < 3 * 86_400_000) return { opened, sent: 0, openSoon, skipped: "invitation déjà envoyée il y a moins de 3 jours" };
  const { sent } = await sendOpenMatchesEmail();
  await db().from("app_settings").upsert({ club_id: CLUB_ID, key: "arbitres_derniere_invitation", value: new Date(nowMs).toISOString(), updated_at: new Date(nowMs).toISOString() }, { onConflict: "club_id,key" });
  return { opened, sent, openSoon };
}

/** Un arbitre a perdu son lien personnel : on le lui renvoie par courriel (rien n'est dit si le courriel est inconnu). */
export async function sendRefereeLink(email: string): Promise<void> {
  const { data } = await db().from("referees").select("*").eq("club_id", CLUB_ID).ilike("email", email.trim().replace(/[%_\\]/g, "\\$&")).limit(1);
  const referee = (data ?? [])[0] as Referee | undefined;
  if (!referee || referee.status !== "actif" || !isEmailConfigured()) return;
  await getResendClient().emails.send({
    from: env.resendFrom,
    to: referee.email,
    subject: "Votre lien d'arbitre New Valkyria",
    html: `<p>Bonjour ${esc(referee.first_name)},</p><p>Voici votre lien personnel pour réserver les matchs à arbitrer (premier arrivé, premier servi) :</p><p><a href="${refereeLink(referee.token)}">${refereeLink(referee.token)}</a></p><p>Gardez-le : il vous sert à chaque fois.</p>`
  });
}
