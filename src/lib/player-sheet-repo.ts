import { SHEET_FIELDS, checkSheet, cleanSheet, type SheetAnswers } from "@/lib/player-sheet";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Fiche joueuse remplie par le parent (P4.1.03). Lue par le briefing des éducateurs (getBriefing). Loi 25 : table
 *  privée, jamais renvoyée telle quelle à un autre parent ; l'accès se vérifie avant (getFamilyRegistrations). */

function db() {
  return getSupabaseAdminClient() as any;
}

const COLS = `registration_id, player_id, updated_at, ${SHEET_FIELDS.map((f) => f.key).join(", ")}`;

export interface PlayerSheet {
  registrationId: string;
  playerId: string | null;
  answers: SheetAnswers;
  updatedAt: string;
}

const toSheet = (r: any): PlayerSheet => ({
  registrationId: r.registration_id,
  playerId: r.player_id ?? null,
  answers: cleanSheet(r),
  updatedAt: r.updated_at
});

export async function getPlayerSheet(registrationId: string): Promise<PlayerSheet | null> {
  const { data, error } = await db().from("player_family_sheets").select(COLS).eq("registration_id", registrationId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toSheet(data) : null;
}

/** Le parent enregistre (ou remplace) la fiche de sa fille. Renvoie le problème, ou null. */
export async function savePlayerSheet(input: { registrationId: string; playerId: string | null; userId: string; parentName: string | null; answers: Record<string, unknown> }): Promise<string | null> {
  const answers = cleanSheet(input.answers);
  const problem = checkSheet(answers);
  if (problem) return problem;
  const { error } = await db()
    .from("player_family_sheets")
    .upsert(
      {
        registration_id: input.registrationId,
        player_id: input.playerId,
        ...answers,
        filled_by_user_id: input.userId,
        filled_by_name: input.parentName?.slice(0, 120) ?? null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "registration_id" }
    );
  if (error) throw new Error(error.message);
  return null;
}

/** Les fiches des joueuses d'un effectif, par inscription. Une fille qui a changé d'inscription (essai devenu
 *  inscription, nouvelle saison) garde la fiche remplie pour la même joueuse (players.id). */
export async function getSheetsForRegistrations(registrationIds: string[]): Promise<Map<string, SheetAnswers>> {
  const out = new Map<string, SheetAnswers>();
  if (!registrationIds.length) return out;
  const [{ data: direct, error }, { data: regs }] = await Promise.all([
    db().from("player_family_sheets").select(COLS).in("registration_id", registrationIds),
    db().from("registrations").select("id, player_id").in("id", registrationIds).not("player_id", "is", null)
  ]);
  if (error) throw new Error(error.message);
  for (const r of (direct ?? []) as any[]) out.set(r.registration_id, cleanSheet(r));
  const missing = ((regs ?? []) as any[]).filter((r) => !out.has(r.id));
  if (missing.length) {
    const { data: byPlayer } = await db()
      .from("player_family_sheets")
      .select(COLS)
      .in("player_id", [...new Set(missing.map((r) => r.player_id))])
      .order("updated_at", { ascending: false });
    for (const m of missing) {
      const s = ((byPlayer ?? []) as any[]).find((x) => x.player_id === m.player_id);
      if (s) out.set(m.id, cleanSheet(s));
    }
  }
  return out;
}
