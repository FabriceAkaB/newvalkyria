import { CLUB_ID } from "@/lib/club";
import { categoryLabel, sortIdeas, statusOf, type IdeaInput, type IdeaStatus } from "@/lib/idea-box-core";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Boîte à idées : table idea_box. Règles : idea-box-core.ts. */

const db = () => getSupabaseAdminClient() as any;
const COLS = "id, source, parent_user_id, author_name, author_email, player_name, category, message, status, response, responded_at, shown_publicly, created_at";

export interface Idea {
  id: string;
  source: "site" | "espace";
  parent_user_id: string | null;
  author_name: string | null;
  author_email: string | null;
  player_name: string | null;
  category: string;
  message: string;
  status: IdeaStatus;
  response: string | null;
  responded_at: string | null;
  shown_publicly: boolean;
  created_at: string;
}

export async function addIdea(input: IdeaInput & { source: "site" | "espace"; parentUserId?: string | null }): Promise<void> {
  const { error } = await db().from("idea_box").insert({
    club_id: CLUB_ID,
    source: input.source,
    parent_user_id: input.parentUserId ?? null,
    author_name: input.authorName,
    author_email: input.authorEmail,
    player_name: input.playerName,
    category: input.category,
    message: input.message
  });
  if (error) throw error;
}

/** Résumé de la semaine (chaque lundi, cron mandalart-lundi) : seulement s'il y a eu des idées dans les 7 derniers
 *  jours. Aucune idée n'envoie de courriel sur le coup : elles attendent dans la boîte et dans « Aujourd'hui ». */
export async function sendIdeasDigest(to: string, cc?: string): Promise<number> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await db().from("idea_box").select(COLS).eq("club_id", CLUB_ID).gte("created_at", since).order("created_at");
  if (error) throw error;
  const ideas = (data ?? []) as Idea[];
  if (!ideas.length) return 0;
  const { getResendClient } = await import("@/lib/resend");
  const items = ideas
    .map((i) => `<li style="margin-bottom:10px"><strong>${categoryLabel(i.category)}</strong> · ${escapeHtml(i.author_name ?? "Anonyme")}${i.player_name ? ` (${escapeHtml(i.player_name)})` : ""} · ${i.source === "espace" ? "espace parent" : "site"}<br/>${escapeHtml(i.message)}</li>`)
    .join("");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1730;line-height:1.6;max-width:640px"><p>Bonjour,</p><p>${ideas.length} idée${ideas.length > 1 ? "s" : ""} reçue${ideas.length > 1 ? "s" : ""} dans la boîte à idées cette semaine :</p><ul>${items}</ul><p>Répondre à chacune : <a href="https://www.newvalkyria.com/admin/idees">https://www.newvalkyria.com/admin/idees</a></p></div>`;
  await getResendClient().emails.send({ to, ...(cc ? { cc } : {}), subject: `💡 Boîte à idées : ${ideas.length} idée${ideas.length > 1 ? "s" : ""} cette semaine`, html } as never);
  return ideas.length;
}

export async function listIdeas(): Promise<Idea[]> {
  const { data, error } = await db().from("idea_box").select(COLS).eq("club_id", CLUB_ID);
  if (error) throw error;
  return sortIdeas((data ?? []) as Idea[]);
}

export async function listIdeasForParent(userId: string): Promise<Idea[]> {
  const { data, error } = await db().from("idea_box").select(COLS).eq("parent_user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Idea[];
}

/** Les idées réalisées ou retenues que l'académie a choisi de montrer sur le site. */
export async function listPublicIdeas(): Promise<{ category: string; message: string; status: string; response: string | null }[]> {
  const { data, error } = await db().from("idea_box").select("category, message, status, response").eq("club_id", CLUB_ID).eq("shown_publicly", true).in("status", ["retenue", "realisee"]).order("updated_at", { ascending: false }).limit(12);
  if (error) throw error;
  return data ?? [];
}

export async function countNewIdeas(): Promise<number> {
  const { count, error } = await db().from("idea_box").select("id", { count: "exact", head: true }).eq("club_id", CLUB_ID).eq("status", "nouvelle");
  if (error) throw error;
  return count ?? 0;
}

/** Statut, réponse et affichage public ; avec notify, la réponse part aussi par courriel à l'auteur. */
export async function updateIdea(id: string, patch: { status?: IdeaStatus; response?: string | null; shownPublicly?: boolean; notify?: boolean }): Promise<{ notified: boolean }> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) row.status = patch.status;
  if (patch.response !== undefined) {
    row.response = patch.response?.trim() || null;
    row.responded_at = patch.response?.trim() ? new Date().toISOString() : null;
  }
  if (patch.shownPublicly !== undefined) row.shown_publicly = patch.shownPublicly;
  const { data, error } = await db().from("idea_box").update(row).eq("club_id", CLUB_ID).eq("id", id).select(COLS).single();
  if (error) throw error;
  const idea = data as Idea;
  if (!patch.notify || !idea.author_email || !idea.response) return { notified: false };
  const { getResendClient } = await import("@/lib/resend");
  const first = (idea.author_name ?? "").trim().split(/\s+/)[0];
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1730;line-height:1.6;max-width:620px"><p>Bonjour${first ? ` ${first}` : ""},</p><p>Merci pour votre idée envoyée dans la boîte à idées de l'académie :</p><blockquote style="margin:0 0 12px;padding:8px 12px;border-left:3px solid #5b2a86;color:#5d566b">${escapeHtml(idea.message)}</blockquote><p><strong>${statusOf(idea.status).family}</strong></p><p>${escapeHtml(idea.response).replace(/\n/g, "<br/>")}</p><p>Vous pouvez suivre vos idées dans votre espace : <a href="https://www.newvalkyria.com/compte/idees">https://www.newvalkyria.com/compte/idees</a></p><p>L'équipe New Valkyria</p></div>`;
  const res = await getResendClient().emails.send({ to: idea.author_email, subject: "Votre idée pour New Valkyria", html } as never);
  return { notified: !(res as { error: unknown }).error };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
