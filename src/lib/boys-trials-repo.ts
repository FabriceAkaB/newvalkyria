import { isBirthYearEligible } from "@/lib/private-programs";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export interface TrialSession {
  dateId: string;
  date: string;
  start: string;
  end: string;
  location: string;
  taken: number;
  capacity: number;
  remaining: number;
}

export class TrialError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

/** Années de naissance admissibles d'un programme (privé : liste explicite ; Intensif : « 2015-2014 »). */
function eligibleYears(program: { eligible_birth_years: string[] | null; birth_years: string }): string[] {
  if (program.eligible_birth_years?.length) return program.eligible_birth_years;
  return program.birth_years.split("-").filter((y) => /^\d{4}$/.test(y));
}

function isTuesday(date: string): boolean {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 2;
}

/** Pratiques du MARDI à venir d'un programme garçons, avec les places d'essai restantes. */
export async function getTrialSessions(slug: string): Promise<TrialSession[]> {
  const supabase = db();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: program }, { data: dates }] = await Promise.all([
    supabase.from("session_programs").select("trial_capacity").eq("slug", slug).maybeSingle(),
    supabase.from("session_program_dates").select("*").eq("program_slug", slug).gte("session_date", today).order("session_date")
  ]);
  const capacity = program?.trial_capacity ?? 3;
  const tuesdays = (dates ?? []).filter((d: any) => isTuesday(d.session_date));
  if (tuesdays.length === 0) return [];
  const { data: trials } = await supabase.from("boys_trials").select("date_id").in("date_id", tuesdays.map((d: any) => d.id)).in("status", ["confirmed", "attended"]);
  const count = new Map<string, number>();
  for (const t of trials ?? []) count.set(t.date_id, (count.get(t.date_id) ?? 0) + 1);
  return tuesdays.map((d: any) => {
    const taken = count.get(d.id) ?? 0;
    return { dateId: d.id, date: d.session_date, start: d.start_time, end: d.end_time, location: d.location, taken, capacity, remaining: Math.max(0, capacity - taken) };
  });
}

export interface CreateTrialInput {
  slug: string;
  dateId: string;
  playerFirstName: string;
  playerLastName: string;
  birthYear: number;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  notes: string | null;
}

export async function createTrial(input: CreateTrialInput) {
  const supabase = db();
  const { data: program } = await supabase.from("session_programs").select("slug, name, active, eligible_birth_years, birth_years, gender").eq("slug", input.slug).maybeSingle();
  if (!program || !program.active) throw new TrialError("Programme introuvable.", 404);
  if (program.gender === "filles") throw new TrialError("Les essais du mardi sont offerts aux programmes garçons.", 409);

  const years = eligibleYears(program);
  if (!isBirthYearEligible(input.birthYear, years)) {
    throw new TrialError(`Ce programme est réservé aux garçons nés en ${years.join(" et ")}.`);
  }

  const sessions = await getTrialSessions(input.slug);
  const session = sessions.find((s) => s.dateId === input.dateId);
  if (!session) throw new TrialError("Cette pratique n'est pas offerte pour un essai (mardis à venir seulement).");
  if (session.remaining <= 0) throw new TrialError("Les places d'essai de cette pratique sont complètes.");

  const { data, error } = await supabase
    .from("boys_trials")
    .insert({
      program_slug: input.slug,
      date_id: input.dateId,
      trial_date: session.date,
      player_first_name: input.playerFirstName,
      player_last_name: input.playerLastName,
      birth_year: input.birthYear,
      parent_name: input.parentName,
      parent_email: input.parentEmail,
      parent_phone: input.parentPhone,
      notes: input.notes
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new TrialError("Ce joueur a déjà un essai gratuit dans ce programme.");
    throw new Error(error.message);
  }

  // Course sur la dernière place d'essai : on revérifie après insertion (ordre d'arrivée).
  const { data: all } = await supabase.from("boys_trials").select("id").eq("date_id", input.dateId).in("status", ["confirmed", "attended"]).order("created_at").order("id");
  const position = (all ?? []).findIndex((t: any) => t.id === data.id);
  if (position === -1 || position >= session.capacity) {
    await supabase.from("boys_trials").update({ status: "cancelled" }).eq("id", data.id);
    throw new TrialError("Les places d'essai de cette pratique viennent d'être complétées.");
  }

  return { trial: data, session, programName: program.name as string };
}

export async function getAllTrials() {
  const { data, error } = await db().from("boys_trials").select("*, program:session_programs(name)").order("trial_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as any[];
}
