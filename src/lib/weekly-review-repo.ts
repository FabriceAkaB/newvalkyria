import { CLUB_ID } from "@/lib/club";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { isComplete, type ReviewKey, type WeeklyReview } from "@/lib/weekly-review";

/** Bilans de la semaine de JP (table weekly_reviews), rangés par club. */

function db() {
  return getSupabaseAdminClient() as any;
}

const toReview = (r: any): WeeklyReview => ({
  weekStart: String(r.week_start).slice(0, 10),
  wentWell: r.went_well,
  doDifferently: r.do_differently,
  nextPriority: r.next_priority,
  answeredAt: r.answered_at
});

export async function getReviews(limit = 30): Promise<WeeklyReview[]> {
  const { data, error } = await db().from("weekly_reviews").select("*").eq("club_id", CLUB_ID).order("week_start", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map(toReview);
}

export async function getReview(weekStart: string): Promise<WeeklyReview | null> {
  const { data } = await db().from("weekly_reviews").select("*").eq("club_id", CLUB_ID).eq("week_start", weekStart).maybeSingle();
  return data ? toReview(data) : null;
}

export async function saveReview(weekStart: string, answers: Record<ReviewKey, string | null>): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db()
    .from("weekly_reviews")
    .upsert(
      {
        club_id: CLUB_ID,
        week_start: weekStart,
        went_well: answers.wentWell,
        do_differently: answers.doDifferently,
        next_priority: answers.nextPriority,
        answered_at: isComplete(answers) ? now : null,
        updated_at: now
      },
      { onConflict: "club_id,week_start" }
    );
  if (error) throw new Error(error.message);
}
