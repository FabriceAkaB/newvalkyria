import { randomBytes } from "node:crypto";

import { CLUB_ID } from "@/lib/club";
import { env } from "@/lib/env";
import { getResendClient, isEmailConfigured } from "@/lib/resend";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Voix des familles : sondages avec un lien personnel par famille. On sait qui a répondu quoi,
 *  on rappelle les familles insatisfaites (note sous 7), on mesure la satisfaction et on garde
 *  la liste des familles intéressées par un projet pour cibler les lancements et les offres.
 *  Objectif P4.8 du Mandalart, automatisation AU17. */

function db() {
  return getSupabaseAdminClient() as any;
}

export type QuestionType = "note10" | "echelle5" | "choix" | "choix_multiple" | "oui_non" | "texte";

export interface SurveyQuestion {
  id: string;
  type: QuestionType;
  label: string;
  help?: string;
  options?: string[];
  required?: boolean;
  /** recommandation : note sur 10 qui alimente l'indicateur ; interet : réponse qui classe la famille intéressée ou non. */
  role?: "recommandation" | "interet";
}

export type SurveyKind = "mi-saison" | "fin-saison" | "bulletin" | "changement" | "interet" | "lab" | "autre";

export const SURVEY_KIND_LABEL: Record<SurveyKind, string> = {
  "mi-saison": "Mi-saison",
  "fin-saison": "Fin de saison",
  bulletin: "Après un bulletin",
  changement: "« Vous avez dit, on a fait »",
  interet: "Intérêt pour un projet",
  lab: "Valkyria Lab",
  autre: "Autre"
};

const RECOMMEND: SurveyQuestion = {
  id: "recommandation",
  type: "note10",
  label: "Sur 10, recommanderiez-vous Valkyria à une famille de votre entourage ?",
  help: "0 = pas du tout, 10 = sans hésiter",
  required: true,
  role: "recommandation"
};
const CALL_ME: SurveyQuestion = { id: "rappel", type: "oui_non", label: "Aimeriez-vous qu'on vous appelle pour en parler ?" };

export interface SurveyTemplate {
  kind: SurveyKind;
  title: string;
  intro: string;
  questions: SurveyQuestion[];
  projectLabel?: string;
}

export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    kind: "mi-saison",
    title: "Comment se passe la saison ?",
    intro: "Nous sommes à mi-saison et votre avis compte vraiment : il nous aide à rendre chaque entraînement encore meilleur pour votre fille. Ça prend 2 minutes.",
    questions: [
      RECOMMEND,
      { id: "plaisir", type: "echelle5", label: "Votre fille a-t-elle du plaisir aux entraînements ?", required: true },
      { id: "progres", type: "echelle5", label: "Voyez-vous des progrès depuis le début de la saison (ballon, confiance, créativité) ?", required: true },
      { id: "coachs", type: "echelle5", label: "Les coachs : attention portée à votre fille, clarté, encadrement" },
      { id: "communication", type: "echelle5", label: "La communication de l'académie (courriels, réponses à vos questions)" },
      { id: "bulletins", type: "echelle5", label: "Les bulletins et le suivi de votre fille" },
      { id: "horaire", type: "echelle5", label: "L'horaire et les lieux d'entraînement" },
      { id: "uniformes", type: "echelle5", label: "Les uniformes et l'équipement" },
      { id: "mieux", type: "texte", label: "Qu'est-ce qu'on fait de mieux ?" },
      { id: "ameliorer", type: "texte", label: "Qu'est-ce qu'on devrait améliorer en priorité ?" },
      CALL_ME
    ]
  },
  {
    kind: "fin-saison",
    title: "Bilan de la saison",
    intro: "La saison tire à sa fin. Dites-nous ce que vous en avez pensé : chaque réponse est lue et sert à préparer la prochaine saison.",
    questions: [
      RECOMMEND,
      { id: "plaisir", type: "echelle5", label: "Votre fille a-t-elle eu du plaisir cette saison ?", required: true },
      { id: "progres", type: "echelle5", label: "Avez-vous vu des progrès au cours de la saison ?", required: true },
      { id: "retour", type: "choix", label: "Comptez-vous inscrire votre fille la saison prochaine ?", options: ["Oui, c'est certain", "Probablement", "Je ne sais pas encore", "Non"], required: true },
      { id: "pourquoi", type: "texte", label: "Si vous hésitez ou ne revenez pas, qu'est-ce qui pourrait vous faire changer d'idée ?" },
      { id: "moment", type: "texte", label: "Quel moment de la saison a le plus marqué votre fille ?" },
      { id: "ameliorer", type: "texte", label: "Qu'est-ce qu'on devrait améliorer ?" },
      CALL_ME
    ]
  },
  {
    kind: "bulletin",
    title: "Le bulletin vous a-t-il été utile ?",
    intro: "Vous venez de recevoir le bulletin de votre fille. Trois questions rapides pour le rendre encore plus utile.",
    questions: [
      { id: "utile", type: "echelle5", label: "Le bulletin vous a-t-il été utile ?", required: true },
      { id: "appris", type: "oui_non", label: "Avez-vous appris quelque chose de nouveau sur la progression de votre fille ?" },
      { id: "plus", type: "texte", label: "Qu'aimeriez-vous y voir de plus ?" }
    ]
  },
  {
    kind: "changement",
    title: "Vous avez dit, on a fait",
    intro: "Suite à vos réponses au dernier sondage, voici ce que nous avons changé : [décrire les changements]. Comment trouvez-vous ça ?",
    questions: [
      { id: "changement", type: "echelle5", label: "Comment trouvez-vous ces changements ?", required: true },
      { id: "encore", type: "texte", label: "Qu'est-ce qu'on pourrait faire encore mieux ?" },
      RECOMMEND
    ]
  },
  {
    kind: "interet",
    title: "L'été 2027 : qu'est-ce qui vous intéresse ?",
    intro: "Nous préparons l'été 2027 et de nouveaux projets. Avant de les lancer, on veut savoir ce qui vous intéresse vraiment : les familles intéressées seront les premières informées, avec les meilleurs prix.",
    projectLabel: "Été 2027 et nouveaux projets",
    questions: [
      {
        id: "offres",
        type: "choix_multiple",
        label: "Quelles offres de l'été 2027 vous intéressent ?",
        options: ["Camp de jour (à la semaine)", "Valkyria Été (soirs)", "Sport-Études d'août", "Séances privées ou Solo", "Camp spécialisé avec un club professionnel", "Aucune pour l'instant"],
        required: true,
        role: "interet"
      },
      { id: "semaines", type: "choix", label: "Combien de semaines de camp envisagez-vous ?", options: ["1", "2", "3", "4 ou plus", "Je ne sais pas"] },
      { id: "important", type: "choix_multiple", label: "Qu'est-ce qui compte le plus pour vous ?", options: ["Prix", "Horaire", "Proximité", "Encadrement par un club professionnel", "Niveau de jeu", "Amies dans le groupe"] },
      { id: "idees", type: "texte", label: "Une idée de projet que vous aimeriez voir chez Valkyria ?" }
    ]
  },
  {
    kind: "lab",
    title: "Le Valkyria Lab, un mois plus tard",
    intro: "Le Valkyria Lab (routine maison, défis vidéo) a commencé il y a un mois. Aidez-nous à l'améliorer.",
    questions: [
      { id: "frequence", type: "choix", label: "Combien de fois votre fille a-t-elle fait la routine maison ce mois-ci ?", options: ["Jamais", "1 à 2 fois", "Chaque semaine", "Plusieurs fois par semaine"], required: true },
      { id: "facile", type: "echelle5", label: "Est-ce facile à suivre à la maison ?" },
      { id: "frein", type: "texte", label: "Qu'est-ce qui l'empêche de la faire plus souvent ?" },
      { id: "envie", type: "texte", label: "Qu'aimeriez-vous y trouver ?" }
    ]
  }
];

export interface Survey {
  id: string;
  title: string;
  kind: SurveyKind;
  intro: string | null;
  questions: SurveyQuestion[];
  status: "brouillon" | "envoye" | "ferme";
  audience_label: string | null;
  project_label: string | null;
  closes_on: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface SurveyInvite {
  id: string;
  survey_id: string;
  token: string;
  parent_email: string;
  parent_name: string | null;
  player_names: string | null;
  segment: string | null;
  sent_at: string | null;
  reminder_count: number;
  last_reminded_at: string | null;
  opened_at: string | null;
  responded_at: string | null;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  invite_id: string | null;
  answers: Record<string, string | string[] | number>;
  recommend_score: number | null;
  followup_status: "aucun" | "a_appeler" | "appele" | "regle";
  followup_note: string | null;
  created_at: string;
}

export interface SurveySummary extends Survey {
  invited: number;
  sent: number;
  responded: number;
  responseRate: number | null;
  avgRecommend: number | null;
  toCall: number;
}

export async function listSurveys(): Promise<SurveySummary[]> {
  const [{ data: surveys }, { data: invites }, { data: responses }] = await Promise.all([
    db().from("surveys").select("*").eq("club_id", CLUB_ID).order("created_at", { ascending: false }),
    db().from("survey_invites").select("survey_id, sent_at, responded_at"),
    db().from("survey_responses").select("survey_id, recommend_score, followup_status")
  ]);
  return (surveys ?? []).map((s: Survey) => {
    const inv = (invites ?? []).filter((i: any) => i.survey_id === s.id);
    const res = (responses ?? []).filter((r: any) => r.survey_id === s.id);
    const scores = res.map((r: any) => r.recommend_score).filter((x: any) => typeof x === "number");
    const sent = inv.filter((i: any) => i.sent_at).length;
    return {
      ...s,
      invited: inv.length,
      sent,
      responded: res.length,
      responseRate: sent ? res.length / sent : null,
      avgRecommend: scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null,
      toCall: res.filter((r: any) => r.followup_status === "a_appeler").length
    };
  });
}

export async function getSurvey(id: string): Promise<{ survey: Survey; invites: SurveyInvite[]; responses: SurveyResponse[] } | null> {
  const { data: survey } = await db().from("surveys").select("*").eq("id", id).eq("club_id", CLUB_ID).maybeSingle();
  if (!survey) return null;
  const [{ data: invites }, { data: responses }] = await Promise.all([
    db().from("survey_invites").select("*").eq("survey_id", id).order("parent_name"),
    db().from("survey_responses").select("*").eq("survey_id", id).order("created_at", { ascending: false })
  ]);
  return { survey, invites: invites ?? [], responses: responses ?? [] };
}

export async function createSurvey(input: { kind: SurveyKind; title?: string; intro?: string; projectLabel?: string | null; closesOn?: string | null }): Promise<string> {
  const tpl = SURVEY_TEMPLATES.find((t) => t.kind === input.kind);
  const { data, error } = await db()
    .from("surveys")
    .insert({
      club_id: CLUB_ID,
      kind: input.kind,
      title: input.title?.trim() || tpl?.title || "Sondage",
      intro: input.intro ?? tpl?.intro ?? null,
      questions: tpl?.questions ?? [RECOMMEND],
      project_label: input.projectLabel ?? tpl?.projectLabel ?? null,
      closes_on: input.closesOn ?? null
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateSurvey(id: string, patch: Partial<Pick<Survey, "title" | "intro" | "questions" | "status" | "project_label" | "closes_on">>): Promise<void> {
  const { error } = await db().from("surveys").update(patch).eq("id", id).eq("club_id", CLUB_ID);
  if (error) throw error;
}

export async function deleteSurvey(id: string): Promise<void> {
  const { count } = await db().from("survey_responses").select("id", { count: "exact", head: true }).eq("survey_id", id);
  if ((count ?? 0) > 0) throw new Error("Ce sondage a déjà des réponses : fermez-le au lieu de le supprimer.");
  const { error } = await db().from("surveys").delete().eq("id", id).eq("club_id", CLUB_ID);
  if (error) throw error;
}

// ── Destinataires ──

export type AudienceKey = "saison" | "garcons" | "sport-etudes" | "ete";

export const AUDIENCE_LABEL: Record<AudienceKey, string> = {
  saison: "Familles de la saison filles en cours",
  garcons: "Familles des programmes garçons",
  "sport-etudes": "Familles du Sport-Études",
  ete: "Familles de l'été 2026"
};

export interface Family {
  email: string;
  parentName: string | null;
  playerNames: string[];
  segment: string;
}

const title = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());

/** Familles d'un ou plusieurs publics, regroupées par courriel (un seul lien par famille). */
export async function getAudience(keys: AudienceKey[]): Promise<Family[]> {
  const map = new Map<string, Family>();
  const add = (email: unknown, parentName: unknown, player: string, segment: string) => {
    const e = String(email ?? "").trim().toLowerCase();
    if (!e || !e.includes("@")) return;
    const f = map.get(e) ?? { email: e, parentName: parentName ? String(parentName) : null, playerNames: [], segment };
    if (player && !f.playerNames.includes(player)) f.playerNames.push(player);
    if (!f.segment.includes(segment)) f.segment = `${f.segment} · ${segment}`;
    map.set(e, f);
  };
  if (keys.includes("saison")) {
    const { data: season } = await db().from("seasons").select("id").eq("is_active", true).maybeSingle();
    const { data } = await db().from("registrations").select("parent_email, parent_name, player_first_name, player_last_name").eq("season_id", season?.id ?? "automne-hiver-2026").eq("status", "paid");
    for (const r of data ?? []) add(r.parent_email, r.parent_name, title(`${r.player_first_name ?? ""} ${r.player_last_name ?? ""}`.trim()), "Saison filles");
  }
  if (keys.includes("garcons")) {
    const { data: progs } = await db().from("session_programs").select("slug").eq("gender", "garcons");
    const slugs = (progs ?? []).map((p: any) => p.slug);
    if (slugs.length) {
      const { data } = await db().from("session_program_registrations").select("parent_email, parent_name, player_first_name, player_last_name").in("program_slug", slugs).eq("status", "paid");
      for (const r of data ?? []) add(r.parent_email, r.parent_name, title(`${r.player_first_name ?? ""} ${r.player_last_name ?? ""}`.trim()), "Garçons");
    }
  }
  if (keys.includes("sport-etudes")) {
    const { data } = await db().from("sport_etudes_registrations").select("parent_email, parent_first_name, parent_last_name, player_first_name, player_last_name, status").in("status", ["paid", "confirmed"]);
    for (const r of data ?? []) add(r.parent_email, `${r.parent_first_name ?? ""} ${r.parent_last_name ?? ""}`.trim(), title(`${r.player_first_name ?? ""} ${r.player_last_name ?? ""}`.trim()), "Sport-Études");
  }
  if (keys.includes("ete")) {
    const { data } = await db().from("leads").select("email, parent_name").eq("status", "paid");
    for (const r of data ?? []) add(r.email, r.parent_name, "", "Été 2026");
  }
  return [...map.values()].sort((a, b) => (a.parentName ?? a.email).localeCompare(b.parentName ?? b.email, "fr"));
}

export async function addInvites(surveyId: string, families: Family[], audienceLabel: string): Promise<number> {
  const { data: existing } = await db().from("survey_invites").select("parent_email").eq("survey_id", surveyId);
  const have = new Set((existing ?? []).map((i: any) => String(i.parent_email).toLowerCase()));
  const rowsToAdd = families
    .filter((f) => !have.has(f.email))
    .map((f) => ({
      survey_id: surveyId,
      token: randomBytes(12).toString("base64url"),
      parent_email: f.email,
      parent_name: f.parentName,
      player_names: f.playerNames.join(", ") || null,
      segment: f.segment
    }));
  if (rowsToAdd.length) {
    const { error } = await db().from("survey_invites").insert(rowsToAdd);
    if (error) throw error;
  }
  await db().from("surveys").update({ audience_label: audienceLabel }).eq("id", surveyId);
  return rowsToAdd.length;
}

export async function removeInvite(inviteId: string): Promise<void> {
  const { error } = await db().from("survey_invites").delete().eq("id", inviteId).is("responded_at", null);
  if (error) throw error;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function surveyLink(token: string) {
  return `${env.publicSiteUrl}/sondage/${token}`;
}

function inviteEmail(survey: Survey, invite: SurveyInvite, reminder: boolean) {
  const first = (invite.parent_name ?? "").trim().split(/\s+/)[0];
  const players = invite.player_names ? ` pour ${esc(invite.player_names)}` : "";
  const link = surveyLink(invite.token);
  const subject = reminder ? `Rappel : ${survey.title}` : survey.title;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#161419;max-width:600px">
      <p>Bonjour${first ? ` ${esc(first)}` : ""},</p>
      ${reminder ? "<p>Petit rappel : votre avis nous manque !</p>" : ""}
      <p>${esc(survey.intro ?? "")}</p>
      <p style="margin:28px 0">
        <a href="${link}" style="background:#7c4dff;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold;display:inline-block">Répondre au sondage${players}</a>
      </p>
      <p style="color:#555;font-size:14px">Ce lien est personnel à votre famille. Toutes les réponses sont lues par l'équipe.</p>
    </div>`;
  return { subject, html };
}

/** Envoie le lien aux familles invitées. reminder = relance des familles qui n'ont pas répondu. */
export async function sendInvites(surveyId: string, opts: { reminder: boolean; inviteIds?: string[] }): Promise<{ sent: number; failed: number }> {
  if (!isEmailConfigured()) throw new Error("Courriel non configuré");
  const data = await getSurvey(surveyId);
  if (!data) throw new Error("Sondage introuvable");
  let targets = data.invites.filter((i) => !i.responded_at && (opts.reminder ? !!i.sent_at : !i.sent_at));
  if (opts.inviteIds) targets = targets.filter((i) => opts.inviteIds!.includes(i.id));
  const resend = getResendClient();
  let sent = 0;
  let failed = 0;
  for (const inv of targets) {
    const { subject, html } = inviteEmail(data.survey, inv, opts.reminder);
    try {
      await resend.emails.send({ from: env.resendFrom, to: inv.parent_email, subject, html });
      const now = new Date().toISOString();
      await db()
        .from("survey_invites")
        .update(opts.reminder ? { reminder_count: inv.reminder_count + 1, last_reminded_at: now } : { sent_at: now })
        .eq("id", inv.id);
      sent++;
    } catch (err) {
      console.error("Survey invite failed", inv.parent_email, err);
      failed++;
    }
  }
  if (sent && data.survey.status === "brouillon") await db().from("surveys").update({ status: "envoye", sent_at: new Date().toISOString() }).eq("id", surveyId);
  return { sent, failed };
}

// ── Réponse d'une famille (page publique /sondage/[token]) ──

export async function getInviteByToken(token: string): Promise<{ invite: SurveyInvite; survey: Survey; response: SurveyResponse | null } | null> {
  const { data: invite } = await db().from("survey_invites").select("*").eq("token", token).maybeSingle();
  if (!invite) return null;
  const { data: survey } = await db().from("surveys").select("*").eq("id", invite.survey_id).maybeSingle();
  if (!survey) return null;
  const { data: response } = await db().from("survey_responses").select("*").eq("invite_id", invite.id).maybeSingle();
  if (!invite.opened_at) await db().from("survey_invites").update({ opened_at: new Date().toISOString() }).eq("id", invite.id);
  return { invite, survey, response: response ?? null };
}

export function validateAnswers(questions: SurveyQuestion[], raw: Record<string, unknown>): { answers: Record<string, string | string[] | number>; error: string | null } {
  const answers: Record<string, string | string[] | number> = {};
  for (const q of questions) {
    const v = raw[q.id];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (q.required) return { answers, error: `Répondez à : « ${q.label} »` };
      continue;
    }
    if (q.type === "note10" || q.type === "echelle5") {
      const n = Number(v);
      const max = q.type === "note10" ? 10 : 5;
      if (!Number.isInteger(n) || n < (q.type === "note10" ? 0 : 1) || n > max) return { answers, error: `Réponse invalide : « ${q.label} »` };
      answers[q.id] = n;
    } else if (q.type === "choix_multiple") {
      const arr = (Array.isArray(v) ? v : [v]).map(String).filter((x) => q.options?.includes(x));
      if (arr.length) answers[q.id] = arr;
    } else if (q.type === "choix" || q.type === "oui_non") {
      const s = String(v);
      const allowed = q.type === "oui_non" ? ["Oui", "Non"] : q.options ?? [];
      if (!allowed.includes(s)) return { answers, error: `Réponse invalide : « ${q.label} »` };
      answers[q.id] = s;
    } else {
      answers[q.id] = String(v).slice(0, 4000);
    }
  }
  return { answers, error: null };
}

export async function submitResponse(token: string, raw: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
  const found = await getInviteByToken(token);
  if (!found) return { ok: false, error: "Lien introuvable." };
  if (found.survey.status === "ferme") return { ok: false, error: "Ce sondage est fermé. Merci !" };
  const { answers, error } = validateAnswers(found.survey.questions, raw);
  if (error) return { ok: false, error };
  const rq = found.survey.questions.find((q) => q.role === "recommandation");
  const score = rq && typeof answers[rq.id] === "number" ? (answers[rq.id] as number) : null;
  const wantsCall = answers.rappel === "Oui";
  const row = {
    survey_id: found.survey.id,
    invite_id: found.invite.id,
    answers,
    recommend_score: score,
    followup_status: (score !== null && score < 7) || wantsCall ? "a_appeler" : "aucun",
    updated_at: new Date().toISOString()
  };
  if (found.response) {
    const { error: e } = await db().from("survey_responses").update({ ...row, followup_status: found.response.followup_status === "aucun" ? row.followup_status : found.response.followup_status }).eq("id", found.response.id);
    if (e) throw e;
  } else {
    const { error: e } = await db().from("survey_responses").insert(row);
    if (e) throw e;
  }
  await db().from("survey_invites").update({ responded_at: new Date().toISOString() }).eq("id", found.invite.id);
  return { ok: true };
}

export async function setFollowup(responseId: string, status: SurveyResponse["followup_status"], note: string | null): Promise<void> {
  const { error } = await db().from("survey_responses").update({ followup_status: status, followup_note: note, updated_at: new Date().toISOString() }).eq("id", responseId);
  if (error) throw error;
}

/** Familles à rappeler (note sous 7 ou demande d'appel), tous sondages confondus — pour « Aujourd'hui ». */
export async function getFamiliesToCall(): Promise<{ responseId: string; surveyId: string; surveyTitle: string; parentName: string | null; playerNames: string | null; score: number | null; at: string }[]> {
  const { data } = await db().from("survey_responses").select("id, survey_id, recommend_score, created_at, invite_id").eq("followup_status", "a_appeler").order("created_at");
  if (!data?.length) return [];
  const [{ data: invites }, { data: surveys }] = await Promise.all([
    db().from("survey_invites").select("id, parent_name, player_names").in("id", data.map((r: any) => r.invite_id).filter(Boolean)),
    db().from("surveys").select("id, title").eq("club_id", CLUB_ID)
  ]);
  return data
    .filter((r: any) => (surveys ?? []).some((s: any) => s.id === r.survey_id))
    .map((r: any) => {
      const inv = (invites ?? []).find((i: any) => i.id === r.invite_id);
      return { responseId: r.id, surveyId: r.survey_id, surveyTitle: (surveys ?? []).find((s: any) => s.id === r.survey_id)?.title ?? "", parentName: inv?.parent_name ?? null, playerNames: inv?.player_names ?? null, score: r.recommend_score, at: r.created_at };
    });
}

/** Une famille est « intéressée » si sa réponse à la question d'intérêt n'est pas un refus. */
export function isInterested(q: SurveyQuestion, v: unknown): boolean {
  if (v === undefined || v === null || v === "") return false;
  const vals = Array.isArray(v) ? v.map(String) : [String(v)];
  return vals.some((x) => !/^(non|aucune)/i.test(x));
}

/** Indicateurs du Mandalart : taux de réponse du dernier sondage envoyé, satisfaction et note de recommandation (12 derniers mois). */
export async function getSurveyKpis(): Promise<{ responseRate: number | null; responseNote: string; satisfaction: number | null; satisfactionNote: string; recommend: number | null; recommendNote: string }> {
  const surveys = await listSurveys();
  const last = surveys.find((s) => s.sent > 0);
  const since = new Date(Date.now() - 365 * 86400000).toISOString();
  const { data: res } = await db().from("survey_responses").select("recommend_score, survey_id, created_at").gte("created_at", since).not("recommend_score", "is", null);
  const ours = (res ?? []).filter((r: any) => surveys.some((s) => s.id === r.survey_id));
  const scores: number[] = ours.map((r: any) => Number(r.recommend_score));
  return {
    responseRate: last?.responseRate != null ? Math.round(last.responseRate * 1000) / 10 : null,
    responseNote: last ? `${last.responded} réponses sur ${last.sent} familles (« ${last.title} »).` : "Aucun sondage envoyé.",
    satisfaction: scores.length ? Math.round((scores.filter((x) => x >= 8).length / scores.length) * 1000) / 10 : null,
    satisfactionNote: `${scores.filter((x) => x >= 8).length} familles sur ${scores.length} donnent 8 sur 10 ou plus (12 derniers mois).`,
    recommend: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    recommendNote: `Moyenne de ${scores.length} réponses (12 derniers mois).`
  };
}
