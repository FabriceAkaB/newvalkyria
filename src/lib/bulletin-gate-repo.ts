import { createHash, randomBytes } from "node:crypto";

import { GATE_INTRO, GATE_QUESTIONS, gateKey, gateTitle, hasEarlyAccess, isGoogleReviewUrl } from "@/lib/bulletin-gate";
import { periodRange, seasonDates, type BulletinPeriod } from "@/lib/bulletin-report";
import { CLUB_ID } from "@/lib/club";
import { REVIEW_CAMPAIGN } from "@/lib/google-review";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Survey, SurveyInvite, SurveyResponse } from "@/lib/surveys-repo";

/** Le sondage avant le bulletin (P4.8.18, P3.8.19). Règles : bulletin-gate.ts. Le sondage est un vrai sondage de
 *  Voix des familles (`surveys`), un par saison et par bulletin, à l'identifiant fixe (`gateSurveyId`). */

function db() {
  return getSupabaseAdminClient() as any;
}

const EARLY_KEY = "bulletin_apercu_courriels";
export const GOOGLE_LINK_TASK = "avis-google:lien";

async function readSetting(key: string): Promise<string | null> {
  const { data } = await db().from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", key).maybeSingle();
  return typeof data?.value === "string" ? data.value : null;
}

function parseJson(v: string | null): unknown {
  try {
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

/** Ce compte voit-il les bulletins avant leur date de remise (comptes de test) ? */
export async function getEarlyAccess(email: string | null | undefined): Promise<boolean> {
  return hasEarlyAccess(email, parseJson(await readSetting(EARLY_KEY)));
}

/** La saison en cours (`seasons.is_active`) : un seul sondage par bulletin pour toute la saison. */
export async function activeSeasonId(): Promise<string> {
  const { data } = await db().from("seasons").select("id").eq("is_active", true).maybeSingle();
  return data?.id ?? "automne-hiver-2026";
}

export async function getGoogleReviewUrl(): Promise<string | null> {
  const v = (await readSetting("google_review_url"))?.trim() ?? "";
  return isGoogleReviewUrl(v) ? v : null;
}

/** L'identifiant du sondage d'une saison et d'un bulletin, toujours le même (dérivé de la clé) : deux parents qui ouvrent
 *  le bulletin au même instant ne peuvent pas créer deux sondages (la 2e création tombe sur la clé primaire). */
export function gateSurveyId(seasonId: string, period: BulletinPeriod): string {
  const h = createHash("sha1").update(`nv-bulletin-gate:${CLUB_ID}:${gateKey(seasonId, period)}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Le sondage d'une saison et d'un bulletin. `create` : le crée (questions de bulletin-gate.ts) s'il n'existe pas. */
export async function getGateSurvey(seasonId: string, period: BulletinPeriod, opts: { create?: boolean } = {}): Promise<Survey | null> {
  const id = gateSurveyId(seasonId, period);
  const read = async () => ((await db().from("surveys").select("*").eq("id", id).eq("club_id", CLUB_ID).maybeSingle()).data as Survey | null) ?? null;
  const found = await read();
  if (found || !opts.create) return found;
  const season = seasonDates(seasonId);
  // La ligne revient de l'insertion : une 2e lecture identique serait servie de la mémoire du rendu (fetch mémorisé par Next).
  const { data: created, error } = await db()
    .from("surveys")
    .insert({
      id,
      club_id: CLUB_ID,
      kind: "bulletin",
      title: gateTitle(period, season.label),
      intro: GATE_INTRO,
      questions: GATE_QUESTIONS,
      status: "envoye",
      sent_at: `${periodRange(seasonId, period, season.start).to}T13:00:00Z`,
      audience_label: "Chaque parent, avant d'ouvrir le bulletin de sa fille (espace famille)",
      auto_reminders: false
    })
    .select("*")
    .maybeSingle();
  if (created) return created as Survey;
  if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
  // Créé au même instant par un autre parent : relu avec une autre requête (pas celle mémorisée plus haut).
  const { data: other } = await db().from("surveys").select("id, club_id, kind, title, intro, questions, status, audience_label, project_label, closes_on, created_at, sent_at").eq("id", id).maybeSingle();
  return (other as Survey | null) ?? null;
}

export interface GateForParent {
  survey: Survey;
  invite: SurveyInvite;
  response: (SurveyResponse & { google_clicked_at?: string | null }) | null;
}

/** L'invitation de ce parent (une par courriel et par sondage, créée la première fois qu'il ouvre le bulletin) et sa réponse. */
export async function getGateForParent(input: { seasonId: string; period: BulletinPeriod; email: string; parentName: string | null; playerNames: string[] }): Promise<GateForParent | null> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return null;
  const survey = await getGateSurvey(input.seasonId, input.period, { create: true });
  if (!survey) return null;
  const find = async () => {
    const { data } = await db().from("survey_invites").select("*").eq("survey_id", survey.id).ilike("parent_email", email).limit(1).maybeSingle();
    return (data as SurveyInvite | null) ?? null;
  };
  let invite = await find();
  if (!invite) {
    const { data: created, error } = await db().from("survey_invites").insert({
      survey_id: survey.id,
      token: randomBytes(12).toString("base64url"),
      parent_email: email,
      parent_name: input.parentName || null,
      player_names: input.playerNames.join(", ") || null,
      segment: "Espace famille",
      sent_at: new Date().toISOString()
    }).select("*").maybeSingle();
    if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
    invite = (created as SurveyInvite | null) ?? ((await db().from("survey_invites").select("id, survey_id, token, parent_email, parent_name, player_names, segment, sent_at, reminder_count, last_reminded_at, opened_at, responded_at").eq("survey_id", survey.id).eq("parent_email", email).maybeSingle()).data as SurveyInvite | null);
    if (!invite) return null;
  }
  const { data: response } = await db().from("survey_responses").select("*").eq("invite_id", invite.id).maybeSingle();
  return { survey, invite, response: response ?? null };
}

/** Le parent a cliqué « Laisser cet avis sur Google » : noté dans sa réponse, et le courriel d'avis Google programmé
 *  2 h après sa réponse (google-review.ts) est annulé, pour ne pas lui redemander ce qu'il vient de faire. */
export async function markGateGoogleClick(responseId: string, email: string): Promise<void> {
  await db().from("survey_responses").update({ google_clicked_at: new Date().toISOString() }).eq("id", responseId).is("google_clicked_at", null);
  await db().from("scheduled_emails").update({ status: "annule" }).eq("club_id", CLUB_ID).eq("campaign", REVIEW_CAMPAIGN).eq("status", "en_attente").ilike("to_email", email.trim().toLowerCase());
}

/** Tâche de JP tant que le lien d'avis de la fiche Google manque (le bouton reste caché sans lui) ; cochée toute seule
 *  dès que le lien est enregistré dans Avis et témoignages. */
export async function syncGoogleLinkTask(): Promise<void> {
  const { syncRefTask } = await import("@/lib/team-tasks-repo");
  const url = await getGoogleReviewUrl();
  await syncRefTask(GOOGLE_LINK_TASK, {
    title: "Ajouter le lien d'avis de la fiche Google (P3.8.19)",
    details:
      "Sans ce lien, le bouton « Laisser cet avis sur Google » reste caché aux parents qui donnent 9 ou 10 au sondage du bulletin du 15 décembre.\n" +
      "1. Créer la fiche Google de l'académie si ce n'est pas fait (P3.8.06).\n" +
      "2. Dans la fiche : « Demander des avis », copier le lien (il commence par https://g.page/r/… ou https://search.google.com/local/writereview?placeid=…).\n" +
      "3. Admin → Voix des familles → Avis et témoignages : coller le lien Google et enregistrer. La tâche se coche toute seule.",
    due: "2026-12-08",
    done: !!url,
    doneNote: url ? "Lien enregistré dans Avis et témoignages." : null
  });
}

export interface GateStats {
  survey: Survey;
  invited: number;
  responded: number;
  high: number;
  googleClicks: number;
}

/** Pour l'admin : les sondages de bulletin et leurs chiffres (vus, répondus, 9-10, clics Google). */
export async function listGateStats(): Promise<GateStats[]> {
  const season = await activeSeasonId();
  const ids = (["mi-saison", "fin-saison"] as BulletinPeriod[]).map((p) => gateSurveyId(season, p));
  const [{ data: surveys }, { data: invites }, { data: responses }] = await Promise.all([
    db().from("surveys").select("*").in("id", ids).eq("club_id", CLUB_ID),
    db().from("survey_invites").select("survey_id").in("survey_id", ids),
    db().from("survey_responses").select("survey_id, recommend_score, google_clicked_at").in("survey_id", ids)
  ]);
  return ((surveys ?? []) as Survey[])
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((s) => {
      const res = ((responses ?? []) as any[]).filter((r) => r.survey_id === s.id);
      return {
        survey: s,
        invited: ((invites ?? []) as any[]).filter((i) => i.survey_id === s.id).length,
        responded: res.length,
        high: res.filter((r) => typeof r.recommend_score === "number" && r.recommend_score >= 9).length,
        googleClicks: res.filter((r) => r.google_clicked_at).length
      };
    });
}

/** Le sondage de ce parent connecté pour un bulletin : sa famille (inscriptions reliées), son courriel de compte. */
export async function getParentGate(userId: string, period: BulletinPeriod): Promise<(GateForParent & { email: string }) | null> {
  const { getFamilyRegistrations, getParentAccount } = await import("@/lib/parent-repo");
  const [account, family, seasonId] = await Promise.all([getParentAccount(userId), getFamilyRegistrations(userId).catch(() => []), activeSeasonId()]);
  if (!account?.email || !family.length) return null;
  const gate = await getGateForParent({
    seasonId,
    period,
    email: account.email,
    parentName: account.fullName || null,
    playerNames: family.map((f) => `${f.firstName} ${f.lastName}`.trim())
  });
  return gate ? { ...gate, email: account.email } : null;
}
