/** Structure de l'Académie et recrutement (Mandalart P8.2.05, P8.2.06, P8.3.06 ; AU23) : calculs purs,
 *  sans accès à la base, partagés par la page serveur et le scénario « croissance » (composant client).
 *  Testés dans structure-core.test.ts.
 *
 *  Règles de JP pour le plan de recrutement :
 *  - 1 éducateur pour 10 joueuses ;
 *  - au moins 1 éducateur par groupe qui pratique en même temps ;
 *  - jamais moins de 2 adultes par séance (règle de deux, sport sécuritaire). */

/* ── Jours ─────────────────────────────────────────────────── */

export type Weekday = "lundi" | "mardi" | "mercredi" | "jeudi" | "vendredi" | "samedi" | "dimanche";
export const WEEKDAYS: Weekday[] = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
export const WEEKDAY_LABEL: Record<Weekday, string> = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
  samedi: "Samedi",
  dimanche: "Dimanche"
};
export const WEEKDAY_SHORT: Record<Weekday, string> = { lundi: "Lun", mardi: "Mar", mercredi: "Mer", jeudi: "Jeu", vendredi: "Ven", samedi: "Sam", dimanche: "Dim" };
const BY_JS_DAY: Weekday[] = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** Texte sans accents, en minuscules, ponctuation remplacée par des espaces. */
export const norm = (s: string | null | undefined) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const titleCase = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .map((w) => w.split("-").map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p)).join("-"))
    .join(" ");

/** « Jean-Paul Aka Boidi (JP) » → « JP » ; « Maeva Desjardins » → « Maeva ». */
export function shortName(name: string): string {
  const nick = name.match(/\(([^)]+)\)/)?.[1]?.trim();
  return nick || name.trim().split(/\s+/)[0] || name;
}

export function weekdayOfIso(iso: string): Weekday {
  return BY_JS_DAY[new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay()];
}

export function weekdayFromLabel(label: string | null | undefined): Weekday | null {
  const n = norm(label);
  return WEEKDAYS.find((d) => d === n) ?? null;
}

export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso.slice(0, 10)}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 86400000);

/** « 18:30 » ou « 18:30:00 » → minutes depuis minuit. */
export const toMinutes = (hhmm: string) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const hhmm = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : "");
/** « 18:30 » → « 18 h 30 », « 18:00 » → « 18 h ». */
export const timeLabel = (t: string) => {
  const [h, m] = hhmm(t).split(":");
  return m && m !== "00" ? `${Number(h)} h ${m}` : `${Number(h)} h`;
};
export const hoursLabel = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
};

/* ── Statuts ───────────────────────────────────────────────── */

export type Employment = "temps_plein" | "temps_partiel" | "sur_appel" | "benevole" | "consultant";
export const EMPLOYMENTS: Employment[] = ["temps_plein", "temps_partiel", "sur_appel", "benevole", "consultant"];
export const EMPLOYMENT_LABEL: Record<Employment, string> = {
  temps_plein: "Temps plein",
  temps_partiel: "Temps partiel",
  sur_appel: "Sur appel",
  benevole: "Bénévole",
  consultant: "Consultant"
};

export type Team = "direction" | "terrain" | "soutien" | "a_venir";
export const TEAMS: Team[] = ["direction", "terrain", "soutien", "a_venir"];
export const TEAM_LABEL: Record<Team, string> = { direction: "Direction", terrain: "Éducateurs", soutien: "Soutien et consultants", a_venir: "Postes à venir" };

export type NeedStatus = "a_ouvrir" | "affiche" | "entrevues" | "comble" | "annule";
export const NEED_STATUSES: NeedStatus[] = ["a_ouvrir", "affiche", "entrevues", "comble", "annule"];
export const NEED_STATUS_LABEL: Record<NeedStatus, string> = { a_ouvrir: "À ouvrir", affiche: "Annonce publiée", entrevues: "En entrevues", comble: "Comblé", annule: "Annulé" };
export const isOpenNeed = (s: NeedStatus) => s !== "comble" && s !== "annule";

export type Stage = "annonce" | "candidat" | "entrevue" | "antecedents" | "formation" | "contrat" | "refuse";
/** Étapes du recrutement, dans l'ordre (« refusé » est à part). */
export const PIPELINE: Stage[] = ["annonce", "candidat", "entrevue", "antecedents", "formation", "contrat"];
export const STAGES: Stage[] = [...PIPELINE, "refuse"];
export const STAGE_LABEL: Record<Stage, string> = {
  annonce: "Annonce",
  candidat: "Candidat",
  entrevue: "Entrevue",
  antecedents: "Antécédents",
  formation: "Formation",
  contrat: "Contrat signé",
  refuse: "Refusé"
};
export const STAGE_HINT: Record<Stage, string> = {
  annonce: "Personne approchée ou annonce vue, pas encore de candidature.",
  candidat: "Candidature reçue : la lire et appeler.",
  entrevue: "Entrevue à faire ou faite.",
  antecedents: "Vérification des antécédents judiciaires en cours.",
  formation: "Sport sécuritaire et formation Valkyria.",
  contrat: "Créer sa fiche entraîneur (portail, paie) et préciser ses jours.",
  refuse: "Candidature fermée."
};
export function nextStage(s: Stage): Stage | null {
  const i = PIPELINE.indexOf(s);
  return i >= 0 && i < PIPELINE.length - 1 ? PIPELINE[i + 1] : null;
}

/* ── Certifications ────────────────────────────────────────── */

export type CertKind = "antecedents" | "sport_securitaire" | "licence" | "premiers_soins" | "autre";
export const CERT_KIND_LABEL: Record<CertKind, string> = {
  antecedents: "Antécédents judiciaires",
  sport_securitaire: "Sport sécuritaire",
  licence: "Licence d'entraîneur",
  premiers_soins: "Premiers soins",
  autre: "Autre"
};
/** Obligatoires pour toute personne sur le terrain avec des enfants. */
export const REQUIRED_ON_FIELD: CertKind[] = ["antecedents", "sport_securitaire"];
export const CERT_WARN_DAYS = 60;

export function certKind(name: string): CertKind {
  const n = norm(name);
  if (/antecedent|judiciaire|\bvaj\b|casier|background|policiere/.test(n)) return "antecedents";
  if (/securitaire|safe ?sport|respect (et|in|and) (le )?sport|maltraitance|abus/.test(n)) return "sport_securitaire";
  if (/premiers? soins|secourisme|first aid|\brcr\b|\bdea\b/.test(n)) return "premiers_soins";
  if (/licen[cs]e|\bpnce\b|\bnccp\b|\bccp\b|\buefa\b|\bcsa\b|\bentraineur [abc]\b|\b(licence|niveau) [abc]\b/.test(n)) return "licence";
  return "autre";
}

/** Une certification renouvelée s'ajoute en nouvelle ligne (la fiche entraîneur ne modifie pas une ligne) :
 *  pour un même type (antécédents, sport sécuritaire, premiers soins) ou un même nom (licence, autre),
 *  seule celle qui expire le plus tard compte ; sans date d'expiration = n'expire pas. L'ancienne ne sonne plus. */
const certGroup = (name: string) => {
  const k = certKind(name);
  return k === "licence" || k === "autre" ? `${k}:${norm(name)}` : k;
};
export function currentCerts<T extends { name: string; expiresOn: string | null }>(certs: T[]): T[] {
  const best = new Map<string, T>();
  for (const c of certs) {
    const g = certGroup(c.name);
    const prev = best.get(g);
    if (!prev || (c.expiresOn ?? "9999-12-31") > (prev.expiresOn ?? "9999-12-31")) best.set(g, c);
  }
  return certs.filter((c) => best.get(certGroup(c.name)) === c);
}

export type CertState = "expiree" | "bientot" | "valide" | "sans_date";
export function certState(expiresOn: string | null | undefined, today: string, warnDays = CERT_WARN_DAYS): CertState {
  if (!expiresOn) return "sans_date";
  const d = expiresOn.slice(0, 10);
  if (d < today) return "expiree";
  if (daysBetween(today, d) <= warnDays) return "bientot";
  return "valide";
}

/* ── Contrats d'embauche (résumé lisible) ──────────────────── */

export interface SummaryLine {
  label: string;
  value: string;
}

export function contractField(summary: SummaryLine[] | null | undefined, label: string): string | null {
  const want = norm(label);
  const line = (summary ?? []).find((l) => norm(l.label) === want || norm(l.label).startsWith(want));
  return line?.value ?? null;
}

export function employmentFromText(text: string | null | undefined): Employment | null {
  const n = norm(text);
  if (!n) return null;
  if (/sur appel/.test(n)) return "sur_appel";
  if (/temps partiel/.test(n)) return "temps_partiel";
  if (/temps plein/.test(n)) return "temps_plein";
  if (/benevole/.test(n)) return "benevole";
  if (/consultant|pigiste|travailleur autonome/.test(n)) return "consultant";
  return null;
}

/** « 40,00 $ de l'heure » → 4000 ; « 25 $/h » → 2500. */
export function rateCentsFromText(text: string | null | undefined): number | null {
  const m = String(text ?? "").replace(/ /g, " ").match(/(\d+(?:[ ,.]\d{1,2})?)\s*\$/);
  if (!m) return null;
  const v = Number(m[1].replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) ? Math.round(v * 100) : null;
}

/** Jours de la semaine nommés dans un texte (« Dimanche, mercredi et jeudi; lundi à compter de janvier »).
 *  Un jour annoncé pour plus tard (« à compter de », « à partir de », « dès ») n'est pas compté. */
export function daysFromText(text: string | null | undefined): Weekday[] {
  const found = new Set<Weekday>();
  for (const part of String(text ?? "").split(/[;.]/)) {
    const n = norm(part);
    if (/\b(a compter|a partir|des (le |janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre))/.test(n)) continue;
    for (const d of WEEKDAYS) if (new RegExp(`\\b${d}s?\\b`).test(n)) found.add(d);
  }
  return WEEKDAYS.filter((d) => found.has(d));
}

/** « Entraîneuse adjointe — saison 2026-2027 » → « Entraîneuse adjointe ». */
export const roleFromContractTitle = (title: string | null | undefined) => String(title ?? "").split(/\s+[—–-]\s+/)[0].trim();

/* ── Même personne ? (fiche entraîneur, contrat, fiche Structure) ── */

/** Les surnoms entre parenthèses ne comptent pas : « Jean-Paul Aka Boidi (JP) » = « Jean-Paul Aka Boidi ». */
const withoutNick = (s: string | null | undefined) => String(s ?? "").replace(/\([^)]*\)/g, " ");

export function samePerson(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = norm(withoutNick(a)).split(" ").filter(Boolean);
  const tb = norm(withoutNick(b)).split(" ").filter(Boolean);
  if (!ta.length || !tb.length) return false;
  const [fa, fb] = [ta[0], tb[0]];
  const firstOk = fa === fb || (Math.min(fa.length, fb.length) >= 3 && (fa.startsWith(fb) || fb.startsWith(fa)));
  if (!firstOk) return false;
  if (ta.length < 2 || tb.length < 2) return true;
  const [la, lb] = [ta[ta.length - 1], tb[tb.length - 1]];
  const k = Math.min(5, la.length, lb.length);
  return la.slice(0, k) === lb.slice(0, k);
}

/* ── Personnes ─────────────────────────────────────────────── */

export interface CoachIn {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  role: string | null;
  default_hourly_rate_cents: number | null;
  hired_on: string | null;
}
export interface CertIn {
  id: string;
  coach_id: string;
  name: string;
  issued_date: string | null;
  expiry_date: string | null;
}
export interface TypeRateIn {
  coach_id: string;
  activity_type: string;
  hourly_rate_cents: number;
}
export interface ContractIn {
  id: string;
  employee_name: string;
  title: string;
  status: "sent" | "signed" | "cancelled" | string;
  summary: SummaryLine[] | null;
  signed_at: string | null;
  created_at: string;
  email: string | null;
  phone: string | null;
}
export interface StaffCert {
  name: string;
  issued_on?: string | null;
  expires_on?: string | null;
}
export interface StaffIn {
  id: string;
  full_name: string;
  role: string;
  team: Team;
  employment: Employment | null;
  email: string | null;
  phone: string | null;
  diplomas: string | null;
  certifications: StaffCert[] | null;
  started_on: string | null;
  notes: string | null;
  coach_id: string | null;
  on_field: boolean;
  available_days: string[] | null;
  hourly_rate_cents: number | null;
  active: boolean;
  sort_order: number;
}
export interface AssignmentIn {
  coach_id: string;
  date: string;
  minutes: number;
  /** Activité hors Académie (organization renseignée : CF Montréal, St-Gabriel…). */
  outside?: boolean;
}

export interface CertView {
  name: string;
  kind: CertKind;
  issuedOn: string | null;
  expiresOn: string | null;
  state: CertState;
  source: "portail" | "fiche";
}
export interface Flag {
  tone: "bad" | "warn" | "info";
  text: string;
}
export interface Person {
  key: string;
  name: string;
  role: string;
  team: Team;
  employment: Employment | null;
  employmentFrom: "fiche" | "contrat" | null;
  email: string | null;
  phone: string | null;
  diplomas: string | null;
  startedOn: string | null;
  notes: string | null;
  coachId: string | null;
  staffId: string | null;
  contract: { id: string; title: string; status: string; signedAt: string | null; createdAt: string } | null;
  rateCents: number | null;
  rateFrom: "fiche" | "contrat" | "portail" | null;
  portalRateCents: number | null;
  certifications: CertView[];
  staffCerts: StaffCert[];
  onField: boolean;
  availableDays: Weekday[];
  /** « portail » : jours tirés de ses assignations des 30 prochains jours (aucun jour inscrit ailleurs). */
  daysFrom: "fiche" | "contrat" | "portail" | null;
  /** Séances de l'Académie des 30 prochains jours (assignations du portail) ; outside = activités hors Académie. */
  next30: { count: number; minutes: number; next: string | null; outside: number };
  assignedDays: Weekday[];
  active: boolean;
  sortOrder: number;
  flags: Flag[];
}

export interface PeopleInput {
  coaches: CoachIn[];
  certs: CertIn[];
  typeRates: TypeRateIn[];
  contracts: ContractIn[];
  staff: StaffIn[];
  assignments: AssignmentIn[];
}

/** « 1er janv. », avec l'année si ce n'est pas l'année en cours (« 1er janv. 2029 »). */
export const dayLabelShort = (iso: string, today?: string) => {
  const months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const year = today && Number(today.slice(0, 4)) !== y ? ` ${y}` : "";
  return `${d === 1 ? "1er" : d} ${months[m - 1]}${year}`;
};
const dollars = (c: number) => `${(c / 100).toLocaleString("fr-CA", { maximumFractionDigits: 2 })} $`;

/** Réunit fiches entraîneurs, contrats et fiches Structure en une seule liste de personnes, sans doublon. */
export function buildPeople(input: PeopleInput, today: string): Person[] {
  const people: Person[] = [];
  const blank = (key: string, name: string): Person => ({
    key,
    name,
    role: "",
    team: "terrain",
    employment: null,
    employmentFrom: null,
    email: null,
    phone: null,
    diplomas: null,
    startedOn: null,
    notes: null,
    coachId: null,
    staffId: null,
    contract: null,
    rateCents: null,
    rateFrom: null,
    portalRateCents: null,
    certifications: [],
    staffCerts: [],
    onField: true,
    availableDays: [],
    daysFrom: null,
    next30: { count: 0, minutes: 0, next: null, outside: 0 },
    assignedDays: [],
    active: true,
    sortOrder: 100,
    flags: []
  });

  // 1) Fiches entraîneurs (portail, paie, certifications)
  for (const c of input.coaches) {
    const p = blank(`coach:${c.id}`, titleCase(`${c.first_name} ${c.last_name}`));
    p.coachId = c.id;
    p.role = c.role || "Éducateur";
    p.email = c.email;
    p.phone = c.phone;
    p.startedOn = c.hired_on;
    p.active = c.status === "active";
    const practiceRate = input.typeRates.find((r) => r.coach_id === c.id && norm(r.activity_type) === "pratique")?.hourly_rate_cents;
    p.portalRateCents = practiceRate ?? (c.default_hourly_rate_cents && c.default_hourly_rate_cents > 0 ? c.default_hourly_rate_cents : null);
    p.certifications = input.certs
      .filter((k) => k.coach_id === c.id)
      .map((k) => ({ name: k.name, kind: certKind(k.name), issuedOn: k.issued_date, expiresOn: k.expiry_date, state: certState(k.expiry_date, today), source: "portail" as const }));
    const all = input.assignments.filter((a) => a.coach_id === c.id);
    const mine = all.filter((a) => !a.outside).sort((a, b) => a.date.localeCompare(b.date));
    p.next30 = { count: mine.length, minutes: mine.reduce((s, a) => s + a.minutes, 0), next: mine[0]?.date ?? null, outside: all.length - mine.length };
    p.assignedDays = WEEKDAYS.filter((d) => mine.some((a) => weekdayOfIso(a.date) === d));
    people.push(p);
  }

  // 2) Contrats d'embauche (le plus récent par personne ; les contrats annulés ne créent personne)
  const contracts = [...input.contracts].sort((a, b) => Number(a.status === "cancelled") - Number(b.status === "cancelled") || b.created_at.localeCompare(a.created_at));
  for (const k of contracts) {
    let p = people.find((x) => (x.coachId || x.key.startsWith("contract:")) && samePerson(x.name, k.employee_name));
    if (!p) {
      if (k.status === "cancelled") continue;
      p = blank(`contract:${k.id}`, titleCase(k.employee_name));
      people.push(p);
    }
    if (p.contract) continue; // un contrat plus récent est déjà rattaché
    p.contract = { id: k.id, title: k.title, status: k.status, signedAt: k.signed_at, createdAt: k.created_at };
    if (k.employee_name.trim().split(/\s+/).length >= 2) p.name = titleCase(k.employee_name);
    const role = roleFromContractTitle(k.title);
    if (role) p.role = role;
    const emp = employmentFromText(contractField(k.summary, "Poste"));
    if (emp) {
      p.employment = emp;
      p.employmentFrom = "contrat";
    }
    const rate = rateCentsFromText(contractField(k.summary, "Taux horaire"));
    if (rate !== null) {
      p.rateCents = rate;
      p.rateFrom = "contrat";
    }
    const days = daysFromText(contractField(k.summary, "Présence"));
    if (days.length) {
      p.availableDays = days;
      p.daysFrom = "contrat";
    }
    p.email = p.email ?? k.email;
    p.phone = p.phone ?? k.phone;
  }

  // 3) Fiches Structure : complètent une personne existante ou ajoutent quelqu'un (direction, soutien, postes à venir)
  for (const s of [...input.staff].sort((a, b) => a.sort_order - b.sort_order)) {
    // Fiche reliée à une fiche entraîneur, sinon même nom qu'une fiche entraîneur ou un contrat pas encore relié
    // (ex. JP : fiche Direction + fiche entraîneur « Jean-Paul Aka Boidi » = une seule personne).
    let p =
      (s.coach_id ? people.find((x) => x.coachId === s.coach_id) : undefined) ??
      people.find((x) => !x.staffId && !x.key.startsWith("staff:") && samePerson(x.name, s.full_name));
    if (!p) {
      p = blank(`staff:${s.id}`, s.full_name);
      people.push(p);
    }
    p.staffId = s.id;
    p.name = s.full_name || p.name;
    p.role = s.role || p.role;
    p.team = s.team;
    if (s.employment) {
      p.employment = s.employment;
      p.employmentFrom = "fiche";
    }
    p.email = s.email || p.email;
    p.phone = s.phone || p.phone;
    p.diplomas = s.diplomas;
    p.startedOn = s.started_on || p.startedOn;
    p.notes = s.notes;
    p.onField = s.on_field;
    p.active = s.active && p.active;
    p.sortOrder = s.sort_order;
    const days = (s.available_days ?? []).filter((d): d is Weekday => (WEEKDAYS as string[]).includes(d));
    if (days.length) {
      p.availableDays = WEEKDAYS.filter((d) => days.includes(d));
      p.daysFrom = "fiche";
    }
    if (s.hourly_rate_cents !== null && s.hourly_rate_cents !== undefined) {
      p.rateCents = s.hourly_rate_cents;
      p.rateFrom = "fiche";
    }
    p.staffCerts = (s.certifications ?? []).filter((c) => c && c.name);
    if (!p.coachId) {
      p.certifications = p.staffCerts.map((c) => ({ name: c.name, kind: certKind(c.name), issuedOn: c.issued_on ?? null, expiresOn: c.expires_on ?? null, state: certState(c.expires_on ?? null, today), source: "fiche" as const }));
    }
  }

  for (const p of people) {
    if (!p.availableDays.length && p.assignedDays.length) {
      p.availableDays = p.assignedDays;
      p.daysFrom = "portail";
    }
    if (p.rateCents === null && p.portalRateCents !== null) {
      p.rateCents = p.portalRateCents;
      p.rateFrom = "portail";
    }
    p.certifications = currentCerts(p.certifications).sort((a, b) => (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999"));
    p.flags = personFlags(p, today);
  }
  const teamOrder = (t: Team) => TEAMS.indexOf(t);
  return people.sort((a, b) => teamOrder(a.team) - teamOrder(b.team) || Number(b.active) - Number(a.active) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"));
}

/** Ce qui demande une action de JP pour une personne. */
export function personFlags(p: Person, today?: string): Flag[] {
  if (!p.active || p.team === "a_venir") return [];
  const flags: Flag[] = [];
  for (const c of p.certifications) {
    if (c.state === "expiree") flags.push({ tone: "bad", text: `${c.name} expirée depuis le ${dayLabelShort(c.expiresOn!, today)}` });
    else if (c.state === "bientot") flags.push({ tone: "warn", text: `${c.name} expire le ${dayLabelShort(c.expiresOn!, today)}` });
  }
  if (p.onField) {
    for (const kind of REQUIRED_ON_FIELD) {
      if (!p.certifications.some((c) => c.kind === kind)) {
        flags.push({ tone: kind === "antecedents" ? "bad" : "warn", text: `${CERT_KIND_LABEL[kind]} : aucune preuve au dossier` });
      }
    }
  }
  if (p.contract && p.contract.status === "sent") flags.push({ tone: "warn", text: "Contrat envoyé, pas encore signé" });
  if (p.team === "terrain" && !p.coachId) flags.push({ tone: "info", text: "Pas de fiche entraîneur : impossible de l'assigner ou de la payer dans le portail" });
  if (p.rateFrom !== "portail" && p.rateCents !== null && p.portalRateCents !== null && p.rateCents !== p.portalRateCents) {
    flags.push({ tone: "warn", text: `Taux du portail (${dollars(p.portalRateCents)}/h) différent du ${p.rateFrom === "contrat" ? "contrat" : "taux de la fiche"} (${dollars(p.rateCents)}/h)` });
  }
  if (p.onField && !p.availableDays.length && p.employment !== "sur_appel") flags.push({ tone: "info", text: "Jours sur le terrain à préciser" });
  return flags;
}

/* ── Besoins en éducateurs ─────────────────────────────────── */

export const RULES = { playersPerEducator: 10, minAdults: 2, arrivalMinutes: 30 } as const;
export type Rules = { playersPerEducator: number; minAdults: number; arrivalMinutes: number };

export interface GroupIn {
  label: string;
  players: number;
  capacity: number | null;
}
export interface BlockIn {
  day: Weekday;
  start: string;
  end: string;
  location: string;
  source: "filles" | "programme";
  groups: GroupIn[];
  until?: string | null;
}
export interface Block extends BlockIn {
  key: string;
  players: number;
  capacity: number;
  need: number;
  needFull: number;
}

/** Adultes requis pour des groupes qui pratiquent en même temps au même endroit. */
export function adultsNeeded(groups: { players: number }[], rules: Rules = RULES): number {
  const active = groups.filter((g) => g.players > 0);
  const total = active.reduce((s, g) => s + g.players, 0);
  if (total <= 0) return 0;
  return Math.max(rules.minAdults, Math.ceil(total / rules.playersPerEducator), active.length);
}

export const blockKey = (b: { day: Weekday; start: string; end: string; location: string }) => `${b.day}|${hhmm(b.start)}|${hhmm(b.end)}|${norm(b.location)}`;

/** Réunit les groupes d'un même jour, même heure, même endroit en une seule séance. */
export function mergeBlocks(blocks: BlockIn[], rules: Rules = RULES): Block[] {
  const map = new Map<string, BlockIn>();
  for (const b of blocks) {
    const key = blockKey(b);
    const prev = map.get(key);
    if (prev) {
      prev.groups = [...prev.groups, ...b.groups];
      if (b.source === "filles") prev.source = "filles";
      if (b.until && (!prev.until || b.until > prev.until)) prev.until = b.until;
    } else map.set(key, { ...b, start: hhmm(b.start), end: hhmm(b.end), groups: [...b.groups] });
  }
  return [...map.entries()]
    .map(([key, b]) => {
      const players = b.groups.reduce((s, g) => s + g.players, 0);
      const capacity = b.groups.reduce((s, g) => s + (g.capacity ?? g.players), 0);
      return {
        ...b,
        key,
        players,
        capacity,
        need: adultsNeeded(b.groups, rules),
        needFull: adultsNeeded(b.groups.map((g) => ({ players: Math.max(g.players, g.capacity ?? 0) })), rules)
      };
    })
    .sort((a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day) || a.start.localeCompare(b.start) || a.location.localeCompare(b.location));
}

/** Adultes requis en même temps dans une journée : les séances qui se chevauchent (endroits différents) s'additionnent. */
export function peakNeed(blocks: { start: string; end: string; need: number }[]): number {
  let peak = 0;
  for (const b of blocks) {
    const t = toMinutes(b.start);
    const sum = blocks.filter((x) => toMinutes(x.start) <= t && toMinutes(x.end) > t).reduce((s, x) => s + x.need, 0);
    peak = Math.max(peak, sum);
  }
  return peak;
}

export interface TeamMember {
  name: string;
  onField: boolean;
  active: boolean;
  employment: Employment | null;
  availableDays: Weekday[];
}
export interface DayPlan {
  day: Weekday;
  blocks: Block[];
  need: number;
  needFull: number;
  team: string[];
  onCall: string[];
  gap: number;
  gapFull: number;
  /** De l'arrivée (30 min avant la 1re séance) à la fin de la dernière séance. */
  spanMinutes: number;
}

export function weeklyPlan(blocks: Block[], people: TeamMember[], rules: Rules = RULES): DayPlan[] {
  const field = people.filter((p) => p.active && p.onField);
  return WEEKDAYS.map((day) => {
    const mine = blocks.filter((b) => b.day === day && b.need + b.needFull > 0);
    const need = peakNeed(mine.map((b) => ({ start: b.start, end: b.end, need: b.need })));
    const needFull = peakNeed(mine.map((b) => ({ start: b.start, end: b.end, need: b.needFull })));
    const team = field.filter((p) => p.availableDays.includes(day)).map((p) => p.name);
    const onCall = field.filter((p) => !p.availableDays.includes(day) && p.employment === "sur_appel" && !p.availableDays.length).map((p) => p.name);
    const withPlayers = mine.filter((b) => b.need > 0);
    const spanMinutes = withPlayers.length
      ? Math.max(...withPlayers.map((b) => toMinutes(b.end))) - Math.min(...withPlayers.map((b) => toMinutes(b.start))) + rules.arrivalMinutes
      : 0;
    return { day, blocks: blocks.filter((b) => b.day === day), need, needFull, team, onCall, gap: Math.max(0, need - team.length), gapFull: Math.max(0, needFull - team.length), spanMinutes };
  }).filter((d) => d.blocks.length > 0);
}

/** Personnes à recruter au minimum : le pire jour (une recrue peut couvrir plusieurs jours). */
export const recruitsNeeded = (days: { gap: number }[]) => days.reduce((m, d) => Math.max(m, d.gap), 0);
export const recruitsNeededFull = (days: { gapFull: number }[]) => days.reduce((m, d) => Math.max(m, d.gapFull), 0);
/** Heures par semaine que l'équipe actuelle ne couvre pas. */
export const uncoveredMinutesPerWeek = (days: DayPlan[]) => days.reduce((s, d) => s + d.gap * d.spanMinutes, 0);

/* ── Séances des 30 prochains jours : adultes prévus ───────── */

export interface SessionIn {
  date: string;
  start: string;
  end: string;
  location: string;
  coachIds: string[];
}
export interface SessionCoverage {
  date: string;
  start: string;
  end: string;
  location: string;
  groups: string;
  need: number;
  /** Éducateurs assignés dans le portail (Entraînements). */
  assigned: number;
  /** Adultes prévus : assignés + équipe qui travaille ce jour-là (contrat, fiche), sans compter deux fois. */
  expected: number;
}

/** Compare, séance par séance, les adultes prévus aux adultes requis. plannedByDay : clés des personnes prévues
 *  chaque jour (id de fiche entraîneur si elle existe, pour ne pas compter deux fois une personne aussi assignée). */
export function sessionsCoverage(sessions: SessionIn[], blocks: Block[], plannedByDay: Partial<Record<Weekday, string[]>>): SessionCoverage[] {
  const grouped = new Map<string, SessionIn>();
  for (const s of sessions) {
    const k = `${s.date}|${hhmm(s.start)}|${norm(s.location)}`;
    const prev = grouped.get(k);
    if (prev) prev.coachIds = [...new Set([...prev.coachIds, ...s.coachIds])];
    else grouped.set(k, { ...s, coachIds: [...new Set(s.coachIds)] });
  }
  const out: SessionCoverage[] = [];
  for (const s of grouped.values()) {
    const day = weekdayOfIso(s.date);
    const block = blocks.find((b) => b.day === day && b.start === hhmm(s.start) && norm(b.location) === norm(s.location));
    if (!block || block.need === 0) continue;
    const expected = new Set([...s.coachIds, ...(plannedByDay[day] ?? [])]).size;
    out.push({
      date: s.date.slice(0, 10),
      start: hhmm(s.start),
      end: hhmm(s.end) || block.end,
      location: s.location,
      groups: block.groups.filter((g) => g.players > 0).map((g) => g.label).join(" + "),
      need: block.need,
      assigned: s.coachIds.length,
      expected
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}
export const isCovered = (s: SessionCoverage) => s.expected >= s.need;

/** Jours où il manque du monde, pour décrire le poste à combler (« lundi, samedi »). */
export const shortDays = (days: DayPlan[], full = false) => days.filter((d) => (full ? d.gapFull : d.gap) > 0).map((d) => d.day);

/** Échéance proposée pour un poste à combler : le 15 du mois prochain (règle d'anticipation : réglé un mois avant le lancement suivant). */
export function nextRecruitDue(today: string): string {
  const [y, m] = today.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-15`;
}

/* ── Scénario « croissance » ───────────────────────────────── */

export interface ScenarioIn {
  groups: number;
  playersPerGroup: number;
  day: Weekday;
  /** true = tous les nouveaux groupes en même temps (un seul gymnase) ; false = l'un après l'autre. */
  together: boolean;
  practices: number;
  sessionMinutes: number;
  hourlyRateCents: number;
  pricePerPlayerCents: number;
  fieldCostPerHourCents: number;
}
export interface ScenarioOut {
  players: number;
  blocks: number;
  adultsPerBlock: number;
  dayNeedBefore: number;
  dayNeedAfter: number;
  teamThatDay: number;
  recruitsBefore: number;
  recruitsAfter: number;
  extraRecruits: number;
  educatorHoursPerWeek: number;
  payrollCents: number;
  fieldCents: number;
  revenueCents: number;
  marginCents: number;
}

/** Équipe sur le terrain prévue chaque jour (même les jours sans séance aujourd'hui). */
export function teamByDay(people: TeamMember[]): Record<Weekday, number> {
  const field = people.filter((p) => p.active && p.onField);
  return Object.fromEntries(WEEKDAYS.map((d) => [d, field.filter((p) => p.availableDays.includes(d)).length])) as Record<Weekday, number>;
}

/** Les nouveaux groupes sont placés hors des heures des séances existantes de ce jour-là. */
export function runScenario(days: DayPlan[], team: Partial<Record<Weekday, number>>, s: ScenarioIn, rules: Rules = RULES): ScenarioOut {
  const groups = Math.max(0, Math.floor(s.groups));
  const ppg = Math.max(0, Math.floor(s.playersPerGroup));
  const players = groups * ppg;
  const blocks = groups === 0 || ppg === 0 ? 0 : s.together ? 1 : groups;
  const adultsPerBlock = blocks === 0 ? 0 : s.together ? adultsNeeded(Array.from({ length: groups }, () => ({ players: ppg })), rules) : adultsNeeded([{ players: ppg }], rules);
  const today = days.find((d) => d.day === s.day);
  const dayNeedBefore = today?.need ?? 0;
  const dayNeedAfter = Math.max(dayNeedBefore, adultsPerBlock);
  const teamThatDay = team[s.day] ?? 0;
  const recruitsBefore = recruitsNeeded(days);
  const afterGaps = days.map((d) => (d.day === s.day ? Math.max(0, dayNeedAfter - teamThatDay) : d.gap));
  if (!today) afterGaps.push(Math.max(0, dayNeedAfter - teamThatDay));
  const recruitsAfter = afterGaps.reduce((m, g) => Math.max(m, g), 0);
  const paidHours = (s.sessionMinutes + rules.arrivalMinutes) / 60;
  const educatorHoursPerWeek = blocks * adultsPerBlock * paidHours;
  const payrollCents = Math.round(educatorHoursPerWeek * s.hourlyRateCents * s.practices);
  const fieldCents = Math.round(blocks * (s.sessionMinutes / 60) * s.fieldCostPerHourCents * s.practices);
  const revenueCents = Math.round(players * s.pricePerPlayerCents);
  return {
    players,
    blocks,
    adultsPerBlock,
    dayNeedBefore,
    dayNeedAfter,
    teamThatDay,
    recruitsBefore,
    recruitsAfter,
    extraRecruits: Math.max(0, recruitsAfter - recruitsBefore),
    educatorHoursPerWeek,
    payrollCents,
    fieldCents,
    revenueCents,
    marginCents: revenueCents - payrollCents - fieldCents
  };
}

/** Règle d'anticipation de JP : le recrutement doit être réglé le 15 du mois précédant le lancement. */
export function recruitDueFor(startMonth: string): string {
  const [y, m] = startMonth.split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${String(pm).padStart(2, "0")}-15`;
}
