import { CLUB_ID } from "@/lib/club";
import { listPractices } from "@/lib/practices-repo";
import { PROGRAMS } from "@/lib/season-2027";
import {
  addDays,
  buildPeople,
  certState,
  currentCerts,
  dayLabelShort,
  daysBetween,
  hhmm,
  mergeBlocks,
  recruitsNeeded,
  recruitsNeededFull,
  samePerson,
  sessionsCoverage,
  shortName,
  teamByDay,
  titleCase,
  toMinutes,
  uncoveredMinutesPerWeek,
  weekdayFromLabel,
  weekdayOfIso,
  weeklyPlan,
  WEEKDAYS,
  type Block,
  type BlockIn,
  type ContractIn,
  type DayPlan,
  type Employment,
  type NeedStatus,
  type Person,
  type SessionCoverage,
  type Stage,
  type StaffCert,
  type StaffIn,
  type Team,
  type Weekday
} from "@/lib/structure-core";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Structure de l'Académie et recrutement (Mandalart P8.2.05, P8.2.06, P8.3.06 ; AU23) : lecture des
 *  fiches entraîneurs, certifications, contrats, groupes réels et arbitres (sans rien recopier),
 *  écriture seulement dans staff_members, recruitment_needs et recruitment_candidates.
 *  Données RH : réservé à l'administrateur (pas la gérante). Les calculs sont dans structure-core.ts. */

function db() {
  return getSupabaseAdminClient() as any;
}

/** Demande impossible (fiche introuvable, candidature pas refusée…) : réponse 400, pas une panne. */
export class StructureInputError extends Error {}

async function rows<T = any>(query: PromiseLike<{ data: T[] | null; error?: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

const TZ = "America/Toronto";
export const todayLocal = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const iso = (d: unknown) => (d ? String(d).slice(0, 10) : null);
/** Horodatage (timestamptz, en UTC) → jour à Montréal : un contrat signé à 22 h n'est pas daté du lendemain. */
const localDay = (ts: unknown) => (ts ? new Date(String(ts)).toLocaleDateString("en-CA", { timeZone: TZ }) : null);
/** « École Chambéry (gym / futsal) – 100, rue de Bellevue, Blainville » → « École Chambéry (gym / futsal) ». */
export const shortPlace = (loc: string | null | undefined) => String(loc ?? "").split(/\s+[–—]\s+/)[0].trim();

/** Programme de la saison filles dont les inscriptions vivent dans `registrations` plutôt que dans session_program_registrations. */
const SEASON_PROGRAM_OF_SESSION: Record<string, string> = { "privilege-valkyria": "PV" };

/* ── Types ─────────────────────────────────────────────────── */

export interface RecruitmentNeed {
  id: string;
  position: string;
  employment: Employment;
  headcount: number;
  dueOn: string | null;
  status: NeedStatus;
  season: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Candidate {
  id: string;
  needId: string | null;
  position: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  stage: Stage;
  stageDates: Partial<Record<Stage, string>>;
  interviewOn: string | null;
  notes: string | null;
  /** Jour d'ajout au suivi (heure de Montréal). */
  createdOn: string;
  updatedAt: string;
}

export interface StructureData {
  today: string;
  seasonId: string;
  seasonLabel: string;
  people: Person[];
  referees: { active: number; pending: number; names: { name: string; level: string | null; phone: string | null }[] };
  blocks: Block[];
  plan: DayPlan[];
  teamByDay: Record<Weekday, number>;
  recruits: number;
  recruitsFull: number;
  uncoveredMinutes: number;
  sessions30: SessionCoverage[];
  needs: RecruitmentNeed[];
  candidates: Candidate[];
  /** Joueuses et joueurs inscrits (payés) dans les séances de la semaine, et séances avec du monde. */
  players: number;
  weeklySessions: number;
  /** Valeurs réelles proposées par défaut dans le scénario « croissance ». */
  defaults: { hourlyRateCents: number; pricePerPlayerCents: number; priceLabel: string; fieldCostPerHourCents: number; fieldNote: string; sessionMinutes: number; practices: number };
}

/* ── Lecture ───────────────────────────────────────────────── */

async function loadPeopleInputs(today: string) {
  const to = addDays(today, 30);
  const [coaches, certs, typeRates, contracts, staff, activities] = await Promise.all([
    rows(db().from("coaches").select("id, first_name, last_name, email, phone, status, role, default_hourly_rate_cents, hired_on")),
    rows(db().from("coach_certifications").select("id, coach_id, name, issued_date, expiry_date")),
    rows(db().from("coach_type_rates").select("coach_id, activity_type, hourly_rate_cents")),
    // Loi 25 : du formulaire d'embauche, seulement le courriel et le cellulaire (jamais la date de naissance,
    // l'adresse, les contacts d'urgence, le NAS ni les documents).
    rows(
      db()
        .from("employee_contracts")
        .select("id, employee_name, employee_email, title, status, summary, signed_at, created_at, contract_email:employee_data->>email, contract_mobile:employee_data->>mobile")
    ),
    rows(db().from("staff_members").select("*").eq("club_id", CLUB_ID)),
    rows(db().from("coach_activities").select("id, activity_date, start_time, end_time, location, organization").gte("activity_date", today).lte("activity_date", to))
  ]);
  const actIds = activities.map((a: any) => a.id);
  const assignments = actIds.length ? await rows(db().from("coach_assignments").select("activity_id, coach_id, status, arrival_time, departure_time").in("activity_id", actIds)) : [];
  const actById = new Map<string, any>(activities.map((a: any) => [a.id, a]));
  const contractIns: ContractIn[] = contracts.map((k: any) => ({
    id: k.id,
    employee_name: k.employee_name ?? "",
    title: k.title ?? "",
    status: k.status,
    summary: Array.isArray(k.summary) ? k.summary : null,
    signed_at: localDay(k.signed_at),
    created_at: String(k.created_at),
    email: k.employee_email || k.contract_email || null,
    phone: k.contract_mobile || null
  }));
  const staffIns: StaffIn[] = staff.map((s: any) => ({
    ...s,
    started_on: iso(s.started_on),
    certifications: Array.isArray(s.certifications) ? s.certifications : [],
    available_days: s.available_days ?? []
  }));
  const minutesOf = (a: any, act: any) => {
    const start = hhmm(a.arrival_time) || hhmm(act.start_time);
    const end = hhmm(a.departure_time) || hhmm(act.end_time);
    return start && end ? Math.max(0, toMinutes(end) - toMinutes(start)) : 0;
  };
  const live = assignments.filter((a: any) => a.status !== "absent" && actById.has(a.activity_id));
  return {
    input: {
      coaches: coaches.map((c: any) => ({ ...c, hired_on: iso(c.hired_on) })),
      certs: certs.map((c: any) => ({ ...c, issued_date: iso(c.issued_date), expiry_date: iso(c.expiry_date) })),
      typeRates,
      contracts: contractIns,
      staff: staffIns,
      assignments: live.map((a: any) => {
        const act = actById.get(a.activity_id);
        return { coach_id: a.coach_id, date: iso(act.activity_date)!, minutes: minutesOf(a, act), outside: !!act.organization };
      })
    },
    coachIdsByActivity: live.reduce((m: Map<string, string[]>, a: any) => m.set(a.activity_id, [...(m.get(a.activity_id) ?? []), a.coach_id]), new Map<string, string[]>())
  };
}

/** Séances hebdomadaires réelles : créneaux filles de la saison active (inscrites payées) et programmes à dates (garçons, privés).
 *  players = joueuses et joueurs inscrits, chacun compté une fois (un programme de 2 soirs par semaine n'est pas compté deux fois). */
async function loadBlocks(today: string, seasonId: string): Promise<{ blocks: BlockIn[]; players: number }> {
  const [templates, tplCats, regs, programs, progDates, progRegs] = await Promise.all([
    rows(db().from("time_slot_templates").select("id, day, start_time, end_time, location, max_places, advanced_only").eq("season_id", seasonId).eq("active", true)),
    rows(db().from("time_slot_template_categories").select("time_slot_template_id, category_id")),
    rows(db().from("registrations").select("time_slot_template_id, program_id, status, is_trial, is_half_season, half_season_ends_on").eq("season_id", seasonId).eq("status", "paid")),
    rows(db().from("session_programs").select("slug, name, max_capacity, active, published").eq("active", true)),
    rows(db().from("session_program_dates").select("program_slug, session_date, start_time, end_time, location").gte("session_date", today)),
    rows(db().from("session_program_registrations").select("program_slug, status").eq("status", "paid"))
  ]);
  const seasonPlayers = regs.filter((r: any) => !r.is_trial && !(r.is_half_season && r.half_season_ends_on && iso(r.half_season_ends_on)! < today));
  const blocks: BlockIn[] = [];
  let total = 0;
  for (const t of templates) {
    const day = weekdayFromLabel(t.day);
    if (!day) continue;
    const cats = tplCats.filter((c: any) => c.time_slot_template_id === t.id).map((c: any) => c.category_id).sort();
    const n = seasonPlayers.filter((r: any) => r.time_slot_template_id === t.id).length;
    total += n;
    blocks.push({
      day,
      start: hhmm(t.start_time),
      end: hhmm(t.end_time),
      location: t.location ?? "",
      source: "filles",
      groups: [{ label: `Filles ${cats.join(", ") || "—"}${t.advanced_only ? " avancé" : ""}`, players: n, capacity: t.max_places ?? null }]
    });
  }
  for (const p of programs) {
    const dates = progDates.filter((d: any) => d.program_slug === p.slug);
    if (!dates.length) continue;
    const seasonCode = SEASON_PROGRAM_OF_SESSION[p.slug];
    const players = progRegs.filter((r: any) => r.program_slug === p.slug).length + (seasonCode ? seasonPlayers.filter((r: any) => r.program_id === seasonCode).length : 0);
    // Un programme retiré du site (non publié) ne compte que s'il a encore des inscrits payés.
    if (!p.published && players === 0) continue;
    total += players;
    // Une séance par jour de la semaine : l'horaire de la prochaine date (un programme dont l'heure change
    // en cours de route ne compte pas deux fois), jusqu'à sa dernière date ce jour-là.
    const byDay = new Map<Weekday, BlockIn>();
    for (const d of [...dates].sort((a: any, b: any) => String(a.session_date).localeCompare(String(b.session_date)) || hhmm(a.start_time).localeCompare(hhmm(b.start_time)))) {
      const date = iso(d.session_date)!;
      const day = weekdayOfIso(date);
      const prev = byDay.get(day);
      if (prev) prev.until = date;
      else byDay.set(day, { day, start: hhmm(d.start_time), end: hhmm(d.end_time), location: d.location ?? "", source: "programme", groups: [{ label: p.name, players, capacity: p.max_capacity ?? null }], until: date });
    }
    blocks.push(...byDay.values());
  }
  return { blocks, players: total };
}

function mapNeed(n: any): RecruitmentNeed {
  return { id: n.id, position: n.position, employment: n.employment, headcount: n.headcount, dueOn: iso(n.due_on), status: n.status, season: n.season, notes: n.notes, createdAt: String(n.created_at) };
}
function mapCandidate(c: any): Candidate {
  return {
    id: c.id,
    needId: c.need_id,
    position: c.position,
    fullName: c.full_name,
    email: c.email,
    phone: c.phone,
    stage: c.stage,
    stageDates: c.stage_dates ?? {},
    interviewOn: iso(c.interview_on),
    notes: c.notes,
    createdOn: localDay(c.created_at) ?? "",
    updatedAt: String(c.updated_at)
  };
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

export async function getStructure(): Promise<StructureData> {
  const today = todayLocal();
  const seasons = await rows(db().from("seasons").select("id, label, is_active"));
  const season = seasons.find((s: any) => s.is_active) ?? seasons[0] ?? { id: "automne-hiver-2026", label: "Saison en cours" };
  const [{ input, coachIdsByActivity }, { blocks: blockIns, players }, referees, needs, candidates, rentals, practices] = await Promise.all([
    loadPeopleInputs(today),
    loadBlocks(today, season.id),
    rows(db().from("referees").select("first_name, last_name, level, phone, status").eq("club_id", CLUB_ID)),
    rows(db().from("recruitment_needs").select("*").eq("club_id", CLUB_ID).order("due_on", { ascending: true, nullsFirst: false })),
    rows(db().from("recruitment_candidates").select("*").eq("club_id", CLUB_ID).order("updated_at", { ascending: false })),
    rows(db().from("venue_rentals").select("season_key, hours, total_cents, tax_included")),
    listPractices({ from: today, to: addDays(today, 30) }).catch(() => [])
  ]);

  const people = buildPeople(input, today);
  const blocks = mergeBlocks(blockIns);
  const members = people.map((p) => ({ name: shortName(p.name), onField: p.onField, active: p.active, employment: p.employment, availableDays: p.availableDays }));
  const plan = weeklyPlan(blocks, members);
  const team = teamByDay(members);

  // Équipe prévue chaque jour (contrat, fiche ou assignations) : clé = fiche entraîneur si elle existe,
  // pour qu'une personne prévue ET assignée dans le portail ne compte qu'une fois.
  const plannedByDay = Object.fromEntries(
    WEEKDAYS.map((d) => [d, people.filter((p) => p.active && p.onField && p.availableDays.includes(d)).map((p) => p.coachId ?? p.key)])
  ) as Record<Weekday, string[]>;
  const sessions30 = sessionsCoverage(
    practices
      .filter((p) => p.daysLeft >= 0 && p.source !== "activite" && !p.organization)
      .map((p) => ({ date: p.date, start: p.start, end: p.end ?? p.start, location: p.location, coachIds: p.activityId ? (coachIdsByActivity.get(p.activityId) ?? []) : [] })),
    blocks,
    plannedByDay
  );

  // Valeurs réelles par défaut du scénario
  const rates = people.filter((p) => p.active && p.team === "terrain" && p.rateCents).map((p) => p.rateCents!);
  const hourlyRateCents = rates.length ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length) : 3000;
  const fieldRates = rentals
    .filter((r: any) => r.season_key === season.id && Number(r.hours) > 0 && !r.tax_included)
    .map((r: any) => Math.round(Number(r.total_cents) / Number(r.hours)));
  const fieldCostPerHourCents = median(fieldRates) ?? 3500;
  const durations = blocks.filter((b) => b.need > 0).map((b) => toMinutes(b.end) - toMinutes(b.start));
  const sessionMinutes = median(durations) ?? 85;

  return {
    today,
    seasonId: season.id,
    seasonLabel: season.label,
    people,
    referees: {
      active: referees.filter((r: any) => r.status === "actif").length,
      pending: referees.filter((r: any) => r.status === "en_attente").length,
      names: referees
        .filter((r: any) => r.status === "actif")
        .map((r: any) => ({ name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(), level: r.level ?? null, phone: r.phone ?? null }))
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "fr"))
    },
    players,
    weeklySessions: blocks.filter((b) => b.need > 0).length,
    blocks,
    plan,
    teamByDay: team,
    recruits: recruitsNeeded(plan),
    recruitsFull: recruitsNeededFull(plan),
    uncoveredMinutes: uncoveredMinutesPerWeek(plan),
    sessions30,
    needs: needs.map(mapNeed),
    candidates: candidates.map(mapCandidate),
    defaults: {
      hourlyRateCents,
      pricePerPlayerCents: Math.round(PROGRAMS.TVD.price * 100),
      priceLabel: `${PROGRAMS.TVD.name} (${PROGRAMS.TVD.priceLabel} avant taxes, ${PROGRAMS.TVD.tech} pratiques)`,
      fieldCostPerHourCents,
      fieldNote: fieldRates.length ? `médiane des contrats de gymnase de la saison (${fieldRates.length})` : "valeur par défaut",
      sessionMinutes,
      practices: Number(PROGRAMS.TVD.tech) || 10
    }
  };
}

/* ── « Aujourd'hui » : certifications qui expirent dans 30 jours (ou déjà expirées) ── */

export interface CertificationAlert {
  name: string;
  certification: string;
  expiresOn: string;
  /** « 20 nov. », avec l'année si ce n'est pas l'année en cours. */
  expiresLabel: string;
  expired: boolean;
  daysLeft: number;
  href: string;
}

/** Même règle que la page : une certification renouvelée (nouvelle ligne plus récente) remplace l'ancienne ;
 *  une fiche Structure reliée (ou du même nom) qu'une fiche entraîneur prend les certifications du portail. */
export async function getExpiringCertifications(withinDays = 30): Promise<CertificationAlert[]> {
  const today = todayLocal();
  const [certs, coaches, staff] = await Promise.all([
    rows(db().from("coach_certifications").select("coach_id, name, expiry_date")),
    rows(db().from("coaches").select("id, first_name, last_name, status")),
    rows(db().from("staff_members").select("full_name, coach_id, team, certifications, active").eq("club_id", CLUB_ID).eq("active", true))
  ]);
  const out: CertificationAlert[] = [];
  const push = (name: string, list: { name: string; expiresOn: string | null }[], href: string) => {
    for (const c of currentCerts(list)) {
      if (!c.expiresOn) continue;
      const st = certState(c.expiresOn, today, withinDays);
      if (st !== "expiree" && st !== "bientot") continue;
      out.push({ name, certification: c.name, expiresOn: c.expiresOn, expiresLabel: dayLabelShort(c.expiresOn, today), expired: st === "expiree", daysLeft: daysBetween(today, c.expiresOn), href });
    }
  };
  for (const coach of coaches) {
    if (coach.status !== "active") continue;
    const staffName = staff.find((s: any) => s.coach_id === coach.id)?.full_name;
    const list = certs.filter((c: any) => c.coach_id === coach.id && c.name).map((c: any) => ({ name: String(c.name), expiresOn: iso(c.expiry_date) }));
    push(staffName ?? titleCase(`${coach.first_name ?? ""} ${coach.last_name ?? ""}`), list, `/admin/entraineurs/${coach.id}`);
  }
  for (const s of staff) {
    if (s.coach_id || s.team === "a_venir") continue;
    if (coaches.some((c: any) => samePerson(`${c.first_name ?? ""} ${c.last_name ?? ""}`, s.full_name))) continue;
    const list = ((Array.isArray(s.certifications) ? s.certifications : []) as StaffCert[]).filter((c) => c?.name).map((c) => ({ name: c.name, expiresOn: iso(c.expires_on) }));
    push(s.full_name, list, "/admin/structure#a-regler");
  }
  return out.sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
}

/* ── Écriture ──────────────────────────────────────────────── */

export interface StaffInput {
  id?: string | null;
  coachId?: string | null;
  fullName: string;
  role: string;
  team: Team;
  employment: Employment | null;
  email: string | null;
  phone: string | null;
  diplomas: string | null;
  certifications: { name: string; issuedOn?: string | null; expiresOn?: string | null }[];
  startedOn: string | null;
  notes: string | null;
  onField: boolean;
  availableDays: Weekday[];
  hourlyRateCents: number | null;
  sortOrder?: number | null;
}

export async function saveStaff(input: StaffInput): Promise<{ id: string; before: any | null }> {
  const row = {
    club_id: CLUB_ID,
    full_name: input.fullName.trim(),
    role: input.role.trim(),
    team: input.team,
    employment: input.employment,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    diplomas: input.diplomas?.trim() || null,
    certifications: input.certifications.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), issued_on: c.issuedOn || null, expires_on: c.expiresOn || null })),
    started_on: input.startedOn || null,
    notes: input.notes?.trim() || null,
    coach_id: input.coachId || null,
    on_field: input.onField,
    available_days: WEEKDAYS.filter((d) => input.availableDays.includes(d)),
    hourly_rate_cents: input.hourlyRateCents,
    updated_at: new Date().toISOString(),
    ...(input.sortOrder !== undefined && input.sortOrder !== null ? { sort_order: input.sortOrder } : {})
  };
  let existing: any = null;
  if (input.id) existing = (await rows(db().from("staff_members").select("*").eq("club_id", CLUB_ID).eq("id", input.id)))[0] ?? null;
  else if (input.coachId) existing = (await rows(db().from("staff_members").select("*").eq("club_id", CLUB_ID).eq("coach_id", input.coachId)))[0] ?? null;
  if (input.id && !existing) throw new StructureInputError("Fiche introuvable.");
  if (existing) {
    const { error } = await db().from("staff_members").update(row).eq("id", existing.id).eq("club_id", CLUB_ID);
    if (error) throw new Error(error.message);
    return { id: existing.id, before: existing };
  }
  const { data, error } = await db().from("staff_members").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, before: null };
}

export async function setStaffActive(id: string, active: boolean): Promise<{ name: string }> {
  const { data, error } = await db().from("staff_members").update({ active, updated_at: new Date().toISOString() }).eq("id", id).eq("club_id", CLUB_ID).select("full_name");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new StructureInputError("Fiche introuvable.");
  return { name: data[0].full_name };
}

export interface NeedInput {
  id?: string | null;
  position: string;
  employment: Employment;
  headcount: number;
  dueOn: string | null;
  status: NeedStatus;
  season: string | null;
  notes: string | null;
}

export async function saveNeed(input: NeedInput): Promise<string> {
  const row = {
    club_id: CLUB_ID,
    position: input.position.trim(),
    employment: input.employment,
    headcount: input.headcount,
    due_on: input.dueOn || null,
    status: input.status,
    season: input.season?.trim() || null,
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString()
  };
  if (input.id) {
    const { data, error } = await db().from("recruitment_needs").update(row).eq("id", input.id).eq("club_id", CLUB_ID).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new StructureInputError("Poste introuvable.");
    return input.id;
  }
  const { data, error } = await db().from("recruitment_needs").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function setNeedStatus(id: string, status: NeedStatus): Promise<void> {
  const { data, error } = await db().from("recruitment_needs").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("club_id", CLUB_ID).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new StructureInputError("Poste introuvable.");
}

export async function deleteNeed(id: string): Promise<void> {
  const { error } = await db().from("recruitment_needs").delete().eq("id", id).eq("club_id", CLUB_ID);
  if (error) throw new Error(error.message);
}

export interface CandidateInput {
  id?: string | null;
  needId: string | null;
  position: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  stage: Stage;
  interviewOn: string | null;
  notes: string | null;
}

async function getCandidateRow(id: string): Promise<any | null> {
  return (await rows(db().from("recruitment_candidates").select("*").eq("club_id", CLUB_ID).eq("id", id)))[0] ?? null;
}

export async function saveCandidate(input: CandidateInput): Promise<string> {
  const today = todayLocal();
  const before = input.id ? await getCandidateRow(input.id) : null;
  if (input.id && !before) throw new StructureInputError("Candidat introuvable.");
  if (input.needId && !(await rows(db().from("recruitment_needs").select("id").eq("club_id", CLUB_ID).eq("id", input.needId))).length) {
    throw new StructureInputError("Poste introuvable.");
  }
  const stageDates = { ...(before?.stage_dates ?? {}) };
  if (!before || before.stage !== input.stage) stageDates[input.stage] = today;
  const row = {
    club_id: CLUB_ID,
    need_id: input.needId || null,
    position: input.position.trim(),
    full_name: input.fullName.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    stage: input.stage,
    stage_dates: stageDates,
    interview_on: input.interviewOn || null,
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString()
  };
  if (before) {
    const { error } = await db().from("recruitment_candidates").update(row).eq("id", before.id).eq("club_id", CLUB_ID);
    if (error) throw new Error(error.message);
    if (input.stage === "contrat") await syncNeedFilled(row.need_id);
    return before.id;
  }
  const { data, error } = await db().from("recruitment_candidates").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  if (input.stage === "contrat") await syncNeedFilled(row.need_id);
  return data.id as string;
}

/** Un poste est comblé dès qu'autant de candidats que de places demandées ont signé leur contrat. */
async function syncNeedFilled(needId: string | null | undefined): Promise<void> {
  if (!needId) return;
  const need = (await rows(db().from("recruitment_needs").select("id, headcount, status").eq("club_id", CLUB_ID).eq("id", needId)))[0];
  if (!need || need.status === "comble" || need.status === "annule") return;
  const signed = await rows(db().from("recruitment_candidates").select("id").eq("club_id", CLUB_ID).eq("need_id", needId).eq("stage", "contrat"));
  if (signed.length >= need.headcount) await setNeedStatus(needId, "comble");
}

export async function setCandidateStage(id: string, stage: Stage): Promise<{ name: string; position: string }> {
  const before = await getCandidateRow(id);
  if (!before) throw new StructureInputError("Candidat introuvable.");
  if (before.stage !== stage) {
    const { error } = await db()
      .from("recruitment_candidates")
      .update({ stage, stage_dates: { ...(before.stage_dates ?? {}), [stage]: todayLocal() }, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("club_id", CLUB_ID);
    if (error) throw new Error(error.message);
    if (stage === "contrat") await syncNeedFilled(before.need_id);
  }
  return { name: before.full_name, position: before.position };
}

/** Loi 25 : une candidature refusée peut être effacée (on ne garde pas de renseignements personnels sans raison). */
export async function eraseCandidate(id: string): Promise<{ name: string }> {
  const before = await getCandidateRow(id);
  if (!before) throw new StructureInputError("Candidat introuvable.");
  if (before.stage !== "refuse") throw new StructureInputError("Seule une candidature refusée peut être effacée.");
  const { error } = await db().from("recruitment_candidates").delete().eq("id", id).eq("club_id", CLUB_ID);
  if (error) throw new Error(error.message);
  return { name: before.full_name };
}
