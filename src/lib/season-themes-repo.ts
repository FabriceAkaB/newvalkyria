import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export interface SeasonTheme {
  id: string;
  season_id: string;
  week_start_date: string;
  theme: string;
  notes: string | null;
  created_at: string;
}

export async function getSeasonThemes(seasonId: string): Promise<SeasonTheme[]> {
  const { data, error } = await db().from("season_themes").select("*").eq("season_id", seasonId).order("week_start_date");
  if (error) throw new Error(error.message);
  return (data ?? []) as SeasonTheme[];
}

export async function setSeasonTheme(input: { seasonId: string; weekStartDate: string; theme: string; notes: string | null }): Promise<void> {
  const { error } = await db()
    .from("season_themes")
    .upsert(
      { season_id: input.seasonId, week_start_date: input.weekStartDate, theme: input.theme, notes: input.notes },
      { onConflict: "season_id,week_start_date" }
    );
  if (error) throw new Error(error.message);
}

export async function deleteSeasonTheme(id: string): Promise<void> {
  const { error } = await db().from("season_themes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Lundi de la semaine ISO contenant cette date — clé utilisée pour
 *  retrouver le thème "de la semaine" depuis une date quelconque. */
export function mondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function getThemeForDate(seasonId: string, date: Date): Promise<SeasonTheme | null> {
  const weekStart = mondayOfWeek(date);
  const { data, error } = await db().from("season_themes").select("*").eq("season_id", seasonId).eq("week_start_date", weekStart).maybeSingle();
  if (error) throw new Error(error.message);
  return data as SeasonTheme | null;
}
