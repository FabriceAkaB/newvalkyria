import { CLUB_ID } from "@/lib/club";
import { logCommunication } from "@/lib/communications-repo";
import { env } from "@/lib/env";
import { getResendClient, isEmailConfigured } from "@/lib/resend";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Courriels programmés : préparés d'avance (ex. « préviens les parents demain 8 h »), envoyés par le cron horaire
 *  (`api/cron/mcs-robot`, chaque heure à 5 min) dès que leur heure est passée. Un courriel par famille. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface ScheduledEmailInput {
  sendAt: string;
  to: string;
  cc?: string | null;
  subject: string;
  html: string;
  text?: string | null;
  campaign: string;
  parentName?: string | null;
  playerName?: string | null;
}

export interface ScheduledMcsPostInput {
  sendAt: string;
  /** Courriel du parent : gardé pour le suivi (rien n'est envoyé à cette adresse par le site). */
  to: string;
  subject: string;
  html: string;
  campaign: string;
  teamId: number;
  seasonId: number;
  memberIds: number[];
  parentName?: string | null;
  playerName?: string | null;
  /** Ex. « survey_invite:<id> » : l'invitation du sondage est marquée envoyée à la publication. */
  ref?: string | null;
}

/** Publications privées MonClubSportif programmées (un lien personnel par famille, ex. un sondage), faites par le robot. */
export async function scheduleMcsPosts(rows: ScheduledMcsPostInput[]): Promise<number> {
  if (!rows.length) return 0;
  const { error } = await db()
    .from("scheduled_emails")
    .insert(rows.map((r) => ({ club_id: CLUB_ID, channel: "mcs", send_at: r.sendAt, to_email: r.to, subject: r.subject, html: r.html, campaign: r.campaign, parent_name: r.parentName ?? null, player_name: r.playerName ?? null, mcs_team_id: r.teamId, mcs_season_id: r.seasonId, mcs_member_ids: r.memberIds, ref: r.ref ?? null })));
  if (error) throw new Error(error.message);
  return rows.length;
}

/** Fait les publications MonClubSportif dont l'heure est passée (au plus 60 par passage). */
export async function sendDueMcsPosts(now = new Date()): Promise<{ posted: number; failed: number; skipped?: string }> {
  const { data } = await db().from("scheduled_emails").select("*").eq("club_id", CLUB_ID).eq("channel", "mcs").eq("status", "en_attente").lte("send_at", now.toISOString()).order("send_at").limit(60);
  const rows = (data ?? []) as any[];
  if (!rows.length) return { posted: 0, failed: 0 };
  const { openRobotSession } = await import("@/lib/mcs-robot-runner");
  const session = await openRobotSession();
  if (!session) return { posted: 0, failed: 0, skipped: "Compte robot MonClubSportif pas enregistré." };
  let posted = 0;
  let failed = 0;
  const campaigns = new Map<string, { subject: string; count: number }>();
  for (const e of rows) {
    const { data: claimed } = await db().from("scheduled_emails").update({ status: "envoye", sent_at: new Date().toISOString() }).eq("id", e.id).eq("status", "en_attente").select("id");
    if (!claimed?.length) continue;
    try {
      await session.createPost(e.mcs_team_id, e.mcs_season_id, { subject: e.subject, html: e.html, to: e.mcs_member_ids ?? [], notify: true });
      posted++;
      if (String(e.ref ?? "").startsWith("survey_invite:")) {
        const at = new Date().toISOString();
        const { data: inv } = await db().from("survey_invites").update({ sent_at: at }).eq("id", String(e.ref).slice("survey_invite:".length)).is("sent_at", null).select("survey_id");
        const surveyId = (inv as any[] | null)?.[0]?.survey_id;
        if (surveyId) await db().from("surveys").update({ status: "envoye", sent_at: at }).eq("id", surveyId).eq("status", "brouillon");
      }
      const c = campaigns.get(e.campaign ?? e.subject) ?? { subject: e.subject, count: 0 };
      c.count++;
      campaigns.set(e.campaign ?? e.subject, c);
    } catch (err) {
      failed++;
      await db().from("scheduled_emails").update({ status: "echec", sent_at: null, error: err instanceof Error ? err.message.slice(0, 500) : "erreur" }).eq("id", e.id);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  for (const [campaign, c] of campaigns) {
    await logCommunication({ senderRole: "admin", targetType: "parents", targetLabel: `Publication MonClubSportif programmée : ${campaign}`, targetCriteria: {} as never, subject: c.subject, body: "", recipientCount: c.count }).catch(() => null);
  }
  return { posted, failed };
}

export async function scheduleEmails(rows: ScheduledEmailInput[]): Promise<number> {
  if (!rows.length) return 0;
  const { error } = await db()
    .from("scheduled_emails")
    .insert(rows.map((r) => ({ club_id: CLUB_ID, send_at: r.sendAt, to_email: r.to, cc: r.cc ?? null, subject: r.subject, html: r.html, text_body: r.text ?? null, campaign: r.campaign, parent_name: r.parentName ?? null, player_name: r.playerName ?? null })));
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function listPendingEmails() {
  const { data } = await db().from("scheduled_emails").select("id, send_at, to_email, subject, campaign, player_name").eq("club_id", CLUB_ID).eq("status", "en_attente").order("send_at");
  return (data ?? []) as { id: string; send_at: string; to_email: string; subject: string; campaign: string | null; player_name: string | null }[];
}

export async function cancelScheduledEmails(filter: { id?: string; campaign?: string }): Promise<void> {
  let q = db().from("scheduled_emails").update({ status: "annule" }).eq("club_id", CLUB_ID).eq("status", "en_attente");
  if (filter.id) q = q.eq("id", filter.id);
  if (filter.campaign) q = q.eq("campaign", filter.campaign);
  await q;
}

/** Envoie les courriels dont l'heure est passée (au plus 60 par passage, une pause entre chaque pour Gmail). */
export async function sendDueEmails(now = new Date()): Promise<{ sent: number; failed: number }> {
  if (!isEmailConfigured()) return { sent: 0, failed: 0 };
  const { data } = await db().from("scheduled_emails").select("*").eq("club_id", CLUB_ID).eq("channel", "email").eq("status", "en_attente").lte("send_at", now.toISOString()).order("send_at").limit(60);
  let sent = 0;
  let failed = 0;
  const campaigns = new Map<string, { subject: string; body: string; count: number }>();
  for (const e of (data ?? []) as any[]) {
    // Réservé avant l'envoi : un deuxième passage en même temps ne l'enverra pas deux fois.
    const { data: claimed } = await db().from("scheduled_emails").update({ status: "envoye", sent_at: new Date().toISOString() }).eq("id", e.id).eq("status", "en_attente").select("id");
    if (!claimed?.length) continue;
    try {
      const res = await getResendClient().emails.send({ from: env.resendFrom, to: e.to_email, ...(e.cc ? { cc: e.cc } : {}), subject: e.subject, html: e.html, ...(e.text_body ? { text: e.text_body } : {}) } as never);
      const err = (res as { error?: { message: string } | null })?.error;
      if (err) throw new Error(err.message);
      sent++;
      const c = campaigns.get(e.campaign ?? e.subject) ?? { subject: e.subject, body: e.text_body ?? "", count: 0 };
      c.count++;
      campaigns.set(e.campaign ?? e.subject, c);
    } catch (err) {
      failed++;
      await db().from("scheduled_emails").update({ status: "echec", sent_at: null, error: err instanceof Error ? err.message.slice(0, 500) : "erreur" }).eq("id", e.id);
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  for (const [campaign, c] of campaigns) {
    await logCommunication({ senderRole: "admin", targetType: "parents", targetLabel: `Envoi programmé : ${campaign}`, targetCriteria: {} as never, subject: c.subject, body: c.body.slice(0, 4000), recipientCount: c.count }).catch(() => null);
  }
  return { sent, failed };
}
