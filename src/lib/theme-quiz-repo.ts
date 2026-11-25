import { cleanCategory } from "@/lib/coach-portal-repo";
import { getActivity } from "@/lib/coaches-repo";
import { academyPractices, together } from "@/lib/practice-survey-repo";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { getSeasonThemes, mondayOfWeek } from "@/lib/season-themes-repo";
import { buildThemeQuiz, isThemeCorrect, themeForGroup, type ThemeQuiz } from "@/lib/theme-quiz-core";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** « Qu'est-ce qu'on a travaillé aujourd'hui ? » sur la borne (JP, 25 nov. 2026). Le bon thème = le thème de la
 *  semaine du groupe (season_themes, celui de sa catégorie s'il existe) ; les faux choix = d'autres thèmes du plan. */

function db() {
  return getSupabaseAdminClient() as any;
}

/** Les 3 choix de la pratique, ou null si elle n'a pas de thème (la question n'est pas posée). */
export async function getThemeQuiz(activityId: string): Promise<ThemeQuiz | null> {
  const activity = await getActivity(activityId);
  if (!activity) return null;
  const date = String(activity.activity_date).slice(0, 10);
  const [themes, sameDay] = await Promise.all([getSeasonThemes(SEASON_DB_ID), academyPractices(date, date).catch(() => [])]);
  const week = mondayOfWeek(new Date(`${date}T12:00:00`));
  const current = themes.find((t) => String(t.week_start_date).slice(0, 10) === week);
  if (!current) return null;
  const me = sameDay.find((p) => p.activityId === activityId);
  const mates = me ? sameDay.filter((q) => q.key !== me.key && together(me, q)) : [];
  return buildThemeQuiz({
    correct: themeForGroup(current, cleanCategory(activity.category)),
    block: current.block_label ?? null,
    pool: themes
      .filter((t) => t.id !== current.id && !t.test_week)
      .flatMap((t) => [t.theme, ...Object.values(t.by_category ?? {})].map((text) => ({ text: String(text ?? ""), block: t.block_label ?? null }))),
    seed: activityId,
    avoid: mates.map((q) => themeForGroup(current, cleanCategory(q.group))).filter((x): x is string => Boolean(x))
  });
}

/** Garde le choix de la fille, le bon thème à ce moment-là, les choix proposés et si c'est correct. */
export async function saveThemeAnswer(activityId: string, registrationId: string, answer: string, quiz: ThemeQuiz): Promise<void> {
  const { error } = await db()
    .from("activity_player_attendance")
    .update({ theme_answer: answer, theme_expected: quiz.correct, theme_choices: quiz.choices, theme_correct: isThemeCorrect(answer, quiz.correct) })
    .eq("activity_id", activityId)
    .eq("registration_id", registrationId);
  if (error) throw new Error(error.message);
}
