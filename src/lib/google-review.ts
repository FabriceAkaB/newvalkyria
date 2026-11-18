import { CLUB_ID } from "@/lib/club";
import { scheduleEmails } from "@/lib/scheduled-emails";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Avis Google automatique (Mandalart P3.8.09, JP 18 nov. 2026) : une famille qui donne 9 ou 10 sur 10 à la question de
 *  recommandation d'un sondage reçoit, 2 heures plus tard, un court courriel avec le lien pour laisser un avis Google.
 *  Éteint tant que le lien de la fiche n'est pas enregistré (app_settings « google_review_url ») ; une seule demande par
 *  courriel, jamais deux. Le courriel passe par les envois programmés (visibles et annulables). */

export const REVIEW_MIN_SCORE = 9;
export const REVIEW_CAMPAIGN = "Avis Google";

export function shouldAskReview(score: number | null, url: string | null, alreadyAsked: boolean): boolean {
  return score !== null && score >= REVIEW_MIN_SCORE && !!url && /^https:\/\//.test(url) && !alreadyAsked;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function reviewEmail(parentName: string | null, playerNames: string | null, url: string) {
  const first = String(parentName ?? "").trim().split(/\s+/)[0];
  const who = playerNames ? ` avec ${playerNames.split(",")[0].trim().split(/\s+/)[0]}` : "";
  const subject = "Merci ! Un petit coup de main pour New Valkyria ?";
  const text = `Bonjour${first ? ` ${first}` : ""},\n\nMerci pour votre belle note dans notre sondage : ça fait chaud au cœur de toute l'équipe.\n\nSi vous avez 30 secondes, un avis Google nous aide énormément à faire connaître l'académie à d'autres familles :\n${url}\n\nMerci encore de faire partie de l'aventure${who}!\n\nL'équipe New Valkyria`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1730;line-height:1.6;max-width:620px"><p>Bonjour${first ? ` ${esc(first)}` : ""},</p><p>Merci pour votre belle note dans notre sondage : ça fait chaud au cœur de toute l'équipe.</p><p>Si vous avez 30 secondes, un avis Google nous aide énormément à faire connaître l'académie à d'autres familles :</p><p><a href="${url}" style="display:inline-block;background:#5b2a86;color:#fff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:bold">Laisser un avis Google</a></p><p>Merci encore de faire partie de l'aventure${esc(who)}!</p><p>L'équipe New Valkyria</p></div>`;
  return { subject, text, html };
}

/** Appelé après chaque réponse de sondage ; ne bloque jamais la réponse de la famille. */
export async function maybeAskGoogleReview(input: { email: string | null; parentName: string | null; playerNames: string | null; score: number | null }): Promise<boolean> {
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!email || input.score === null || input.score < REVIEW_MIN_SCORE) return false;
  const db = getSupabaseAdminClient() as any;
  const { data: setting } = await db.from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", "google_review_url").maybeSingle();
  const url = typeof setting?.value === "string" ? setting.value : (setting?.value?.url ?? null);
  const { count } = await db.from("scheduled_emails").select("id", { count: "exact", head: true }).eq("campaign", REVIEW_CAMPAIGN).ilike("to_email", email).neq("status", "annule");
  if (!shouldAskReview(input.score, url, (count ?? 0) > 0)) return false;
  const mail = reviewEmail(input.parentName, input.playerNames, url);
  await scheduleEmails([{ sendAt: new Date(Date.now() + 2 * 3_600_000).toISOString(), to: email, subject: mail.subject, html: mail.html, text: mail.text, campaign: REVIEW_CAMPAIGN, parentName: input.parentName, playerName: input.playerNames }]);
  return true;
}
