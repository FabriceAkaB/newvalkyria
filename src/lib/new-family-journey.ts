import { CLUB_ID } from "@/lib/club";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { syncRefTask } from "@/lib/team-tasks-repo";

/** Les 30 premiers jours d'une nouvelle famille (Mandalart P4.2.03, stade 3 d'Alex Hormozi : qu'aucune nouvelle
 *  famille ne se sente perdue), en mode assistant : au 7e jour, une tâche « appeler la famille » ; chaque semaine,
 *  une tâche qui regroupe les familles rendues à 30 jours pour leur mini-sondage. Le jour 0 (bienvenue), le rappel
 *  de la 1re pratique (MonClubSportif) et la première victoire (championnes, points) existent déjà.
 *  Lancé chaque jour par le cron « pratiques ». */

function db() {
  return getSupabaseAdminClient() as any;
}

const shift = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Semaine ISO (AAAA-Sss) d'une date, pour regrouper les mini-sondages. */
export function isoWeek(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-S${String(week).padStart(2, "0")}`;
}

async function exists(ref: string): Promise<boolean> {
  const { data } = await db().from("team_tasks").select("id").eq("club_id", CLUB_ID).eq("ref", ref).limit(1);
  return Boolean(data?.length);
}

export async function syncNewFamilyJourney(today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" })): Promise<{ calls: number; surveys: number }> {
  const { data: season } = await db().from("seasons").select("id").eq("is_active", true).maybeSingle();
  const { data: regs } = await db()
    .from("registrations")
    .select("id, player_first_name, player_last_name, parent_name, parent_phone, parent_email, category_id, created_at")
    .eq("season_id", season?.id ?? "automne-hiver-2026")
    .eq("status", "paid")
    .eq("is_trial", false)
    .gte("created_at", `${shift(today, -37)}T00:00:00`);
  let calls = 0;
  const thirty: string[] = [];
  // Une famille = un courriel de parent (deux sœurs, un seul appel).
  const families = new Map<string, { names: string[]; day: string; r: any }>();
  for (const r of (regs ?? []) as any[]) {
    const day = String(r.created_at).slice(0, 10);
    const name = `${String(r.player_first_name ?? "").trim()} ${String(r.player_last_name ?? "").trim()}`.trim();
    if (day <= shift(today, -7) && day >= shift(today, -10)) {
      const key = String(r.parent_email ?? r.id).toLowerCase();
      const f = families.get(key) ?? { names: [], day, r };
      if (!f.names.includes(name)) f.names.push(name);
      families.set(key, f);
    }
    if (day <= shift(today, -30) && day >= shift(today, -37) && !thirty.includes(name)) thirty.push(name);
  }
  for (const [key, f] of families) {
    const ref = `appel-j7:${key}`;
    if (await exists(ref)) continue;
    const who = f.names.length > 1 ? `${f.names.slice(0, -1).join(", ")} et ${f.names[f.names.length - 1]}` : f.names[0];
    await syncRefTask(ref, {
      title: `Appeler la famille de ${who} : « Comment se passent les premiers jours ? »`,
      details: `Nouvelle famille inscrite le ${f.day}${f.r.category_id ? ` (filles ${f.r.category_id})` : ""}. ${f.r.parent_name ?? "Parent"}${f.r.parent_phone ? ` · ${f.r.parent_phone}` : ""}${f.r.parent_email ? ` · ${f.r.parent_email}` : ""}. Noter la réponse dans Relances et suivi ; un souci = protocole des plaintes. (Mandalart P4.2.03)`,
      due: today
    });
    calls++;
  }
  let surveys = 0;
  if (thirty.length) {
    const ref = `sondage-j30:${isoWeek(today)}`;
    if (!(await exists(ref))) {
      await syncRefTask(ref, {
        title: `Mini-sondage des 30 jours à envoyer à ${thirty.length} nouvelle${thirty.length > 1 ? "s" : ""} famille${thirty.length > 1 ? "s" : ""}`,
        details: `Rendues à 30 jours : ${thirty.sort((a, b) => a.localeCompare(b, "fr")).join(", ")}. Sondages → nouveau sondage court (accueil, ce qui manque, recommandation sur 10), puis l'envoyer à ces familles. (Mandalart P4.2.03)`,
        due: shift(today, 3)
      });
      surveys++;
    }
  }
  return { calls, surveys };
}
