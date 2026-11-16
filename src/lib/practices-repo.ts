import { venueOf, type Venue } from "@/lib/practice-venue";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Pratiques préparées d'avance (Mandalart P1.3.18, automatisation AU21).
 *  Les pratiques attendues viennent de l'horaire réel : créneaux hebdomadaires de la saison filles
 *  (time_slot_templates), dates des programmes garçons et privés (session_program_dates), et toute
 *  activité entrée dans Équipe → Entraînements (dont les pratiques de JP hors Académie).
 *  Une pratique est « prête » quand son activité a un plan de séance (au moins un bloc) ou sa pratique déposée
 *  (diapos en PDF, document « Pratique » de l'activité, page Pratiques → Toute la saison).
 *  Couleur d'une pratique pas prête selon le temps qui reste (règle de JP) :
 *  vert = encore 8 à 14 jours, jaune = 4 à 7 jours, rouge = 3 jours ou moins. */

function db() {
  return getSupabaseAdminClient() as any;
}

const TZ = "America/Toronto";
export const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
const DAY_INDEX: Record<string, number> = { Dimanche: 0, Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6 };

/** Pas de séances de la saison filles pendant les Fêtes ; fin de saison le 18 avril 2027. */
export const SEASON = { start: "2026-09-01", end: "2027-04-18", breaks: [["2026-12-20", "2027-01-02"]] as [string, string][] };
const inBreak = (d: string) => d < SEASON.start || d > SEASON.end || SEASON.breaks.some(([a, b]) => d >= a && d <= b);

export type Readiness = "prete" | "rouge" | "jaune" | "vert" | "plus-tard" | "passee";

export const READINESS_LABEL: Record<Readiness, string> = {
  prete: "Prête",
  rouge: "Rouge : 3 jours ou moins",
  jaune: "Jaune : 1 semaine",
  vert: "Vert : 2 semaines",
  "plus-tard": "Plus tard",
  passee: "Passée"
};

export interface Practice {
  key: string;
  date: string;
  start: string;
  end: string | null;
  group: string;
  location: string;
  source: "saison" | "programme" | "activite";
  organization: string | null;
  activityId: string | null;
  activityType: string;
  blocks: number;
  /** Diapos de la pratique déposées (documents « Pratique » de l'activité). */
  deposited: number;
  /** Gymnase double, deux tiers du gymnase ou synthétique à 7 (practice-venue.ts). */
  venue: Venue;
  theme: string | null;
  /** Jours d'avance avec lesquels le plan a été prêt (premier bloc créé). */
  preparedDaysAhead: number | null;
  readiness: Readiness;
  daysLeft: number;
}

export function readinessOf(daysLeft: number, ready: boolean): Readiness {
  if (daysLeft < 0) return "passee";
  if (ready) return "prete";
  if (daysLeft <= 3) return "rouge";
  if (daysLeft <= 7) return "jaune";
  if (daysLeft <= 14) return "vert";
  return "plus-tard";
}

const hhmm = (t: unknown) => (t ? String(t).slice(0, 5) : "");
const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

export async function listPractices(opts: { from?: string; to?: string } = {}): Promise<Practice[]> {
  const today = todayIso();
  const from = opts.from ?? addDays(today, -7);
  const to = opts.to ?? addDays(today, 28);
  const [{ data: templates }, { data: tplCats }, { data: tplProgs }, { data: programs }, { data: progDates }, { data: acts }, { data: themes }] = await Promise.all([
    db().from("time_slot_templates").select("id, day, start_time, end_time, location").eq("active", true),
    db().from("time_slot_template_categories").select("time_slot_template_id, category_id"),
    db().from("time_slot_template_programs").select("time_slot_template_id, program:programs(name)"),
    db().from("session_programs").select("slug, name, published, active"),
    db().from("session_program_dates").select("program_slug, session_date, start_time, end_time, location").gte("session_date", from).lte("session_date", to),
    db().from("coach_activities").select("id, activity_date, start_time, end_time, location, category, activity_type, title, organization").gte("activity_date", from).lte("activity_date", to),
    db().from("season_themes").select("week_start_date, theme").gte("week_start_date", addDays(from, -7)).lte("week_start_date", to)
  ]);
  // MonClubSportif fait foi pour le lieu et l'heure de fin d'une pratique de la saison (JP, 16 nov. 2026) :
  // l'événement de l'équipe MCS qui porte cette plage, le même jour, à 15 minutes près.
  const [{ data: mcsTeams }, { data: mcsEvents }] = await Promise.all([
    db().from("mcs_teams").select("id, name, slot_ids").eq("active", true),
    db().from("mcs_events").select("team_id, event_date, start_time, end_time, location, title, type").gte("event_date", from).lte("event_date", to)
  ]).catch(() => [{ data: [] }, { data: [] }] as any);
  const mcsFor = (templateId: string, date: string, start: string) => {
    const teamIds = ((mcsTeams ?? []) as any[]).filter((t) => (t.slot_ids ?? []).includes(templateId)).map((t) => t.id);
    if (!teamIds.length) return null;
    return ((mcsEvents ?? []) as any[]).find((e) => teamIds.includes(e.team_id) && String(e.event_date).slice(0, 10) === date && e.type !== "Match" && !/annul/i.test(String(e.title ?? "")) && Math.abs(minutes(hhmm(e.start_time) || "0:0") - minutes(start)) <= 15) ?? null;
  };
  const actIds = (acts ?? []).map((a: any) => a.id);
  const [{ data: blocks }, { data: decks }] = actIds.length
    ? await Promise.all([
        db().from("activity_session_blocks").select("activity_id, created_at").in("activity_id", actIds),
        db().from("documents").select("entity_id, uploaded_at").eq("entity_type", "coach_activity").eq("category", "Pratique").in("entity_id", actIds)
      ])
    : [{ data: [] }, { data: [] }];

  const themeFor = (d: string) => {
    const ws = (themes ?? []).filter((t: any) => String(t.week_start_date).slice(0, 10) <= d).sort((a: any, b: any) => String(b.week_start_date).localeCompare(String(a.week_start_date)))[0];
    return ws && daysBetween(String(ws.week_start_date).slice(0, 10), d) < 7 ? ws.theme : null;
  };

  // 1) Pratiques attendues selon l'horaire
  const expected: Omit<Practice, "activityId" | "blocks" | "deposited" | "venue" | "preparedDaysAhead" | "readiness" | "daysLeft" | "theme" | "activityType">[] = [];
  for (const t of templates ?? []) {
    const cats = (tplCats ?? []).filter((c: any) => c.time_slot_template_id === t.id).map((c: any) => c.category_id);
    const progs = (tplProgs ?? []).filter((p: any) => p.time_slot_template_id === t.id).map((p: any) => p.program?.name ?? "");
    const advancedOnly = progs.length > 0 && progs.every((n: string) => /avancé/i.test(n));
    // Le nom du groupe vient de l'équipe MonClubSportif qui porte la plage (« Lundi 2016-2017 AV » → « Filles 2016-2017 avancé »).
    const team = ((mcsTeams ?? []) as any[]).find((x) => (x.slot_ids ?? []).includes(t.id));
    const teamYears = team ? String(team.name).match(/\d{4}(?:-\d{4})?/)?.[0] : null;
    const group = teamYears
      ? `Filles ${teamYears}${/\bAV\b|avancé/i.test(team.name) ? " avancé" : ""}`
      : `Filles ${cats.join(", ") || "—"}${advancedOnly ? " avancé" : ""}`;
    const dow = DAY_INDEX[t.day];
    if (dow === undefined) continue;
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (new Date(`${d}T12:00:00Z`).getUTCDay() !== dow || inBreak(d)) continue;
      const mcs = mcsFor(t.id, d, hhmm(t.start_time));
      expected.push({ key: `tpl-${t.id}-${d}`, date: d, start: hhmm(t.start_time), end: (mcs?.end_time ? hhmm(mcs.end_time) : hhmm(t.end_time)) || null, group, location: mcs?.location || t.location, source: "saison", organization: null });
    }
  }
  const progName = new Map<string, string>((programs ?? []).filter((p: any) => p.published && p.active).map((p: any) => [p.slug, p.name] as [string, string]));
  for (const d of progDates ?? []) {
    const name = progName.get(d.program_slug);
    if (!name) continue;
    const date = String(d.session_date).slice(0, 10);
    expected.push({ key: `prog-${d.program_slug}-${date}-${hhmm(d.start_time)}`, date, start: hhmm(d.start_time), end: hhmm(d.end_time) || null, group: name, location: d.location, source: "programme", organization: null });
  }

  // 2) Rapprochement avec les activités entrées (même date, début à 15 minutes près, même groupe si possible)
  const used = new Set<string>();
  const blocksOf = (id: string) => (blocks ?? []).filter((b: any) => b.activity_id === id);
  const toPractice = (e: (typeof expected)[number], a: any | null): Practice => {
    const bl = a ? blocksOf(a.id) : [];
    const dk = a ? (decks ?? []).filter((d: any) => d.entity_id === a.id) : [];
    const first = [...bl.map((b: any) => String(b.created_at).slice(0, 10)), ...dk.map((d: any) => String(d.uploaded_at).slice(0, 10))].sort()[0] ?? null;
    const daysLeft = daysBetween(today, e.date);
    return {
      ...e,
      activityId: a?.id ?? null,
      activityType: a?.activity_type ?? "Pratique",
      blocks: bl.length,
      deposited: dk.length,
      venue: venueOf(e),
      theme: themeFor(e.date),
      preparedDaysAhead: first ? daysBetween(first, e.date) : null,
      readiness: readinessOf(daysLeft, bl.length > 0 || dk.length > 0),
      daysLeft
    };
  };
  const out: Practice[] = [];
  for (const e of expected) {
    const candidates = (acts ?? []).filter((a: any) => !used.has(a.id) && !a.organization && String(a.activity_date).slice(0, 10) === e.date && Math.abs(minutes(hhmm(a.start_time) || "0:0") - minutes(e.start)) <= 15);
    const groupWord = e.group.match(/\d{4}/)?.[0];
    const a = candidates.find((c: any) => groupWord && String(c.category ?? c.title ?? "").includes(groupWord)) ?? candidates[0] ?? null;
    if (a) used.add(a.id);
    out.push(toPractice(e, a));
  }
  // 2 b) Deux groupes au même gymnase à la même heure = une seule pratique : le groupe sans activité prend celle de son
  //      jumeau (même plan, mêmes diapos, mêmes éducateurs), sinon il reste « à préparer » alors que la pratique est prête.
  for (const p of out) {
    if (p.activityId || p.source !== "saison") continue;
    const twin = out.find((q) => q !== p && q.activityId && q.source === "saison" && q.date === p.date && q.location === p.location && Math.abs(minutes(q.start) - minutes(p.start)) <= 15);
    if (twin) Object.assign(p, { activityId: twin.activityId, activityType: twin.activityType, blocks: twin.blocks, deposited: twin.deposited, preparedDaysAhead: twin.preparedDaysAhead, readiness: twin.readiness });
  }
  // 3) Activités entrées qui ne correspondent à aucun créneau (pratiques hors Académie, dimanche, tournois…)
  for (const a of acts ?? []) {
    if (used.has(a.id)) continue;
    const e = {
      key: `act-${a.id}`,
      date: String(a.activity_date).slice(0, 10),
      start: hhmm(a.start_time),
      end: hhmm(a.end_time) || null,
      group: a.title || a.category || a.activity_type,
      location: a.location ?? "",
      source: "activite" as const,
      organization: a.organization ?? null
    };
    out.push(toPractice(e, a));
  }
  return out.sort((x, y) => x.date.localeCompare(y.date) || x.start.localeCompare(y.start));
}

/** Crée l'activité d'une pratique attendue (pour y ajouter son plan de séance) et retourne son id. */
export async function createActivityFor(input: { date: string; start: string; end: string | null; location: string; group: string; organization?: string | null; type?: string }): Promise<string> {
  const { data, error } = await db()
    .from("coach_activities")
    .insert({
      activity_date: input.date,
      start_time: input.start,
      end_time: input.end,
      location: input.location,
      category: input.group.replace(/^Filles /, ""),
      activity_type: input.type ?? "Pratique",
      title: input.group,
      organization: input.organization ?? null
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export function summarize(practices: Practice[]) {
  const upcoming = practices.filter((p) => p.daysLeft >= 0);
  const count = (r: Readiness) => upcoming.filter((p) => p.readiness === r).length;
  const past = practices.filter((p) => p.daysLeft < 0 && p.blocks > 0 && p.preparedDaysAhead !== null);
  return {
    rouge: count("rouge"),
    jaune: count("jaune"),
    vert: count("vert"),
    prete: count("prete"),
    plusTard: count("plus-tard"),
    preparedTwoWeeks: past.filter((p) => (p.preparedDaysAhead ?? 0) >= 14).length,
    preparedPast: past.length
  };
}

/** Les années principales d'un groupe (« Filles 2014-2013, 2015 » → 2014, 2015). */
const groupYears = (g: string) => [...g.matchAll(/(\d{4})(?:-\d{4})?/g)].map((m) => Number(m[1]));

/** Deux groupes au même gymnase à la même heure = une seule pratique, comme dans MonClubSportif (JP, 16 nov. 2026) :
 *  une seule ligne « Filles 2014-2015 » pour l'affichage (Pratiques, Aujourd'hui, rappels). La synchro MCS garde les plages. */
export function mergeSameSlot(list: Practice[]): Practice[] {
  const out: Practice[] = [];
  const rank: Record<Readiness, number> = { prete: 0, passee: 1, "plus-tard": 2, vert: 3, jaune: 4, rouge: 5 };
  for (const p of list) {
    const twin = p.source === "saison" ? out.find((q) => q.source === "saison" && q.date === p.date && q.location === p.location && Math.abs(minutes(q.start) - minutes(p.start)) <= 15) : undefined;
    if (!twin) {
      out.push({ ...p });
      continue;
    }
    const years = [...groupYears(twin.group), ...groupYears(p.group)];
    const advanced = /avancé/.test(twin.group) && /avancé/.test(p.group);
    if (years.length && twin.group !== p.group) twin.group = `Filles ${Math.min(...years)}${Math.max(...years) !== Math.min(...years) ? `-${Math.max(...years)}` : ""}${advanced ? " avancé" : ""}`;
    twin.activityId ??= p.activityId;
    twin.blocks = Math.max(twin.blocks, p.blocks);
    twin.deposited = Math.max(twin.deposited, p.deposited);
    if (rank[p.readiness] < rank[twin.readiness]) twin.readiness = p.readiness;
  }
  return out;
}
