import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Suivi des relances : chaque courriel de relance (ou d'excuse) envoyé à une famille
 *  est noté dans outreach_log ; le résultat (inscrite ou non) est recalculé à partir
 *  des inscriptions payées et des offres. */

function db() {
  return getSupabaseAdminClient() as any;
}

export type OutreachKind = "relance" | "reponse" | "excuse" | "erreur" | "refus" | "plus-tard";

export async function logOutreach(entry: {
  parentEmail: string;
  parentName?: string | null;
  playerName?: string | null;
  registrationId?: string | null;
  campaign: string;
  subject?: string | null;
  offerToken?: string | null;
  kind?: OutreachKind;
  notes?: string | null;
  sentAt?: string;
}) {
  await db()
    .from("outreach_log")
    .insert({
      parent_email: entry.parentEmail,
      parent_name: entry.parentName ?? null,
      player_name: entry.playerName ?? null,
      registration_id: entry.registrationId ?? null,
      campaign: entry.campaign,
      subject: entry.subject ?? null,
      offer_token: entry.offerToken ?? null,
      kind: entry.kind ?? "relance",
      notes: entry.notes ?? null,
      ...(entry.sentAt ? { sent_at: entry.sentAt } : {})
    });
}

const norm = (s: string | null | undefined) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export type OutreachStatus = "inscrite" | "offre-ouverte" | "offre-expiree" | "deja-inscrite" | "en-attente" | "refus" | "plus-tard";

export interface OutreachPerson {
  key: string;
  parentName: string | null;
  parentEmail: string;
  playerName: string | null;
  relances: number;
  excuses: number;
  firstAt: string;
  lastAt: string;
  campaigns: string[];
  history: { at: string; campaign: string; subject: string | null; kind: OutreachKind }[];
  status: OutreachStatus;
  statusDetail: string;
  offerUrl: string | null;
  revenueCents: number;
}

export interface OutreachSummary {
  people: OutreachPerson[];
  totals: { people: number; relances: number; inscrites: number; ouvertes: number; erreurs: number; revenueCents: number; conversionPct: number };
  campaigns: { campaign: string; relances: number; people: number; inscrites: number }[];
}

export async function getOutreachSummary(): Promise<OutreachSummary> {
  const [{ data: log }, { data: offers }, { data: paidRegs }, { data: paidBoys }] = await Promise.all([
    db().from("outreach_log").select("*").order("sent_at"),
    db().from("special_offers").select("token, amount_cents, expires_at, paid_at, registrations"),
    db().from("registrations").select("id, player_first_name, player_last_name, program_id, status, updated_at").eq("status", "paid"),
    db().from("session_program_registrations").select("player_first_name, player_last_name, program_slug, status").eq("status", "paid")
  ]);
  const offerByToken = new Map<string, any>((offers ?? []).map((o: any) => [o.token, o]));
  const paidById = new Map<string, any>((paidRegs ?? []).map((r: any) => [r.id, r]));
  const paidNames = new Map<string, string>();
  for (const r of [...(paidRegs ?? []), ...(paidBoys ?? [])]) paidNames.set(norm(`${r.player_first_name} ${r.player_last_name}`), r.program_id ?? r.program_slug ?? "");

  const groups = new Map<string, any[]>();
  for (const e of log ?? []) {
    const key = `${norm(e.parent_email)}|${norm(e.player_name)}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  const now = Date.now();
  const people: OutreachPerson[] = [];
  for (const [key, entries] of groups) {
    const relances = entries.filter((e) => e.kind === "relance" || e.kind === "reponse");
    const excuses = entries.filter((e) => e.kind === "excuse");
    const errors = entries.filter((e) => e.kind === "erreur");
    // Un refus ne compte que s'il est la dernière nouvelle : une offre envoyée après le relance.
    const lastExchange = [...entries].reverse().find((e) => ["refus", "plus-tard", "relance", "reponse"].includes(e.kind));
    const refusal = lastExchange && (lastExchange.kind === "refus" || lastExchange.kind === "plus-tard") ? lastExchange : null;
    const last = entries[entries.length - 1];
    const lastOffer = [...entries].reverse().map((e) => (e.offer_token ? offerByToken.get(e.offer_token) : null)).find(Boolean);
    const regId = [...entries].reverse().map((e) => e.registration_id).find(Boolean);
    const paidReg = regId ? paidById.get(regId) : null;
    const nameMatch = last.player_name ? paidNames.get(norm(last.player_name)) : undefined;
    // Inscrite après la 1re relance : via l'offre, la fiche relancée, ou son nom dans les inscriptions payées.
    const paidOffer = entries.map((e) => (e.offer_token ? offerByToken.get(e.offer_token) : null)).find((o: any) => o?.paid_at);
    let status: OutreachStatus;
    let statusDetail: string;
    if (errors.length || excuses.length) {
      status = "deja-inscrite";
      statusDetail = "Déjà inscrite : relancée par erreur (excuses envoyées)";
    } else if (refusal) {
      status = refusal.kind === "refus" ? "refus" : "plus-tard";
      statusDetail = refusal.notes ?? (refusal.kind === "refus" ? "A refusé" : "Intéressée plus tard");
    } else if (paidOffer || paidReg || nameMatch !== undefined) {
      status = "inscrite";
      statusDetail = `Inscrite${paidReg?.program_id ? ` (${paidReg.program_id})` : nameMatch ? ` (${nameMatch})` : ""}`;
    } else if (lastOffer && !lastOffer.paid_at && new Date(lastOffer.expires_at).getTime() > now) {
      status = "offre-ouverte";
      statusDetail = `Offre ouverte jusqu'au ${new Date(lastOffer.expires_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", timeZone: "America/Toronto" })}`;
    } else if (lastOffer) {
      status = "offre-expiree";
      statusDetail = "Offre expirée sans inscription";
    } else {
      status = "en-attente";
      statusDetail = "Pas encore inscrite";
    }
    people.push({
      key,
      parentName: last.parent_name,
      parentEmail: last.parent_email,
      playerName: last.player_name,
      relances: relances.length,
      excuses: excuses.length,
      firstAt: entries[0].sent_at,
      lastAt: last.sent_at,
      campaigns: [...new Set(entries.map((e) => e.campaign as string))],
      history: entries.map((e) => ({ at: e.sent_at, campaign: e.campaign, subject: e.subject, kind: e.kind })),
      status,
      statusDetail,
      offerUrl: lastOffer && status === "offre-ouverte" ? `/offre/${lastOffer.token}` : null,
      revenueCents: paidOffer?.amount_cents ?? 0
    });
  }
  const order: Record<OutreachStatus, number> = { "plus-tard": 0, "offre-ouverte": 1, "en-attente": 2, inscrite: 3, "offre-expiree": 4, refus: 5, "deja-inscrite": 6 };
  people.sort((a, b) => order[a.status] - order[b.status] || b.lastAt.localeCompare(a.lastAt));

  const real = people.filter((p) => p.status !== "deja-inscrite");
  const inscrites = real.filter((p) => p.status === "inscrite").length;
  const campaigns = new Map<string, { relances: number; people: Set<string>; inscrites: Set<string> }>();
  for (const p of people) {
    for (const h of p.history) {
      if (h.kind !== "relance" && h.kind !== "reponse") continue;
      const c = campaigns.get(h.campaign) ?? { relances: 0, people: new Set(), inscrites: new Set() };
      c.relances += 1;
      c.people.add(p.key);
      if (p.status === "inscrite") c.inscrites.add(p.key);
      campaigns.set(h.campaign, c);
    }
  }
  return {
    people,
    totals: {
      people: real.length,
      relances: real.reduce((t, p) => t + p.relances, 0),
      inscrites,
      ouvertes: real.filter((p) => p.status === "offre-ouverte").length,
      erreurs: people.length - real.length,
      revenueCents: people.reduce((t, p) => t + p.revenueCents, 0),
      conversionPct: real.length ? Math.round((inscrites / real.length) * 1000) / 10 : 0
    },
    campaigns: [...campaigns.entries()].map(([campaign, c]) => ({ campaign, relances: c.relances, people: c.people.size, inscrites: c.inscrites.size }))
  };
}
