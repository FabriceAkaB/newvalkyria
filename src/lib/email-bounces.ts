import { CLUB_ID } from "@/lib/club";
import { getMailConfig } from "@/lib/mail-config";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Courriels refusés : le cron horaire lit les rebonds (« Mail Delivery Subsystem ») reçus dans info@ et les range dans
 *  `email_bounces` ; Aujourd'hui les montre en rouge, avec le destinataire, le sujet et la raison en clair.
 *  Né le 6 nov. 2026 : Microsoft refusait tous nos courriels (pas de DMARC) et personne ne le savait. */

function db() {
  return getSupabaseAdminClient() as any;
}

export type BounceKind = "authentification" | "adresse-inexistante" | "boite-pleine" | "spam" | "autre";

export const BOUNCE_KIND_LABEL: Record<BounceKind, string> = {
  authentification: "Refusé : le domaine n'est pas authentifié (SPF, DKIM ou DMARC)",
  "adresse-inexistante": "Adresse qui n'existe pas (faute de frappe ?)",
  "boite-pleine": "Boîte du destinataire pleine",
  spam: "Refusé comme pourriel",
  autre: "Refusé par le serveur du destinataire"
};

export interface ParsedBounce {
  recipient: string | null;
  subject: string | null;
  reason: string | null;
  kind: BounceKind;
}

/** Lit le texte d'un rebond Gmail (français ou anglais). Fonction pure, testée. */
export function parseBounce(text: string, originalSubject?: string | null): ParsedBounce {
  const flat = text.replace(/\r/g, "");
  const recipient =
    flat.match(/message (?:à|to) <?([^\s<>]+@[^\s<>]+?)>? (?:a été|n'a pas|wasn't|couldn't|has been)/i)?.[1] ??
    flat.match(/delivered to <?([^\s<>]+@[^\s<>]+?)>? because/i)?.[1] ??
    flat.match(/(?:Final-Recipient|Original-Recipient):\s*rfc822;\s*([^\s]+)/i)?.[1] ??
    null;
  const reason = flat.match(/\b([45]\d\d[ -][45]\.\d{1,3}\.\d{1,3}[^\n[]*)/)?.[1]?.trim().slice(0, 240) ?? null;
  const r = (reason ?? flat).toLowerCase();
  const kind: BounceKind = /spf|dkim|dmarc|auth records|unauthenticated|not authenticated/.test(r)
    ? "authentification"
    : /does not exist|doesn't exist|no such user|user unknown|n'existe pas|address not found|introuvable|recipient address rejected|5\.1\.1/.test(r)
      ? "adresse-inexistante"
      : /quota|mailbox full|over quota|5\.2\.2/.test(r)
        ? "boite-pleine"
        : /spam|junk|policy/.test(r)
          ? "spam"
          : "autre";
  return { recipient: recipient?.replace(/[.,;]$/, "") ?? null, subject: originalSubject?.trim() || null, reason, kind };
}

/** Lit les rebonds des derniers jours dans info@ (lecture seule) et range les nouveaux. */
export async function syncBounces(days = 3): Promise<{ found: number; added: number; skipped?: string }> {
  const cfg = await getMailConfig().catch(() => null);
  if (!cfg?.user || !cfg?.password) return { found: 0, added: 0, skipped: "Boîte info@ non configurée." };
  const { ImapFlow } = await import("imapflow");
  const { simpleParser } = await import("mailparser");
  const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user: cfg.user, pass: cfg.password }, logger: false });
  const rows: { club_id: string; message_id: string; bounced_at: string; recipient: string | null; subject: string | null; reason: string | null; kind: BounceKind }[] = [];
  await client.connect();
  try {
    // « Tous les messages » : un rebond archivé (ou lu ailleurs) quitte la boîte de réception mais reste ici.
    const all = (await client.list()).find((b: any) => b.specialUse === "\\All")?.path ?? "INBOX";
    const lock = await client.getMailboxLock(all);
    try {
      const uids = (await client.search({ since: new Date(Date.now() - days * 86_400_000), from: "mailer-daemon" }, { uid: true })) || [];
      if (uids.length) {
        for await (const msg of client.fetch(uids, { envelope: true, source: true, internalDate: true }, { uid: true })) {
          const raw = msg.source?.toString("utf8") ?? "";
          const parsed = await simpleParser(raw).catch(() => null);
          const att = (parsed?.attachments ?? []).find((a: any) => /rfc822/.test(a.contentType ?? ""));
          const original = att ? ((await simpleParser(att.content).catch(() => null))?.subject ?? null) : (raw.match(/\nSubject: ([^\n]+)/g)?.slice(-1)[0]?.replace(/^\nSubject: /, "") ?? null);
          // Le texte du rebond seulement (les entêtes bruts contiennent « DKIM-Signature » et fausseraient le classement).
          const p = parseBounce(parsed?.text || raw, original);
          rows.push({ club_id: CLUB_ID, message_id: msg.envelope?.messageId ?? `uid-${msg.uid}`, bounced_at: new Date(msg.internalDate ?? Date.now()).toISOString(), recipient: p.recipient, subject: p.subject, reason: p.reason, kind: p.kind });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => null);
  }
  if (!rows.length) return { found: 0, added: 0 };
  const { data, error } = await db().from("email_bounces").upsert(rows, { onConflict: "message_id", ignoreDuplicates: true }).select("id");
  if (error) throw new Error(error.message);
  return { found: rows.length, added: (data ?? []).length };
}

export interface BounceRow {
  id: number;
  bounced_at: string;
  recipient: string | null;
  subject: string | null;
  reason: string | null;
  kind: BounceKind;
}

/** Rebonds des 7 derniers jours pas encore réglés (Aujourd'hui). */
export async function getRecentBounces(days = 7): Promise<BounceRow[]> {
  const { data } = await db().from("email_bounces").select("id, bounced_at, recipient, subject, reason, kind").eq("club_id", CLUB_ID).is("resolved_at", null).gte("bounced_at", new Date(Date.now() - days * 86_400_000).toISOString()).order("bounced_at", { ascending: false });
  return (data ?? []) as BounceRow[];
}
