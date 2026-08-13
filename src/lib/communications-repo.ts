import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export const TARGET_TYPES = ["all", "season", "category", "group", "parents", "coaches", "player"] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export interface AudienceCriteria {
  seasonKey?: string;
  categoryId?: string;
  timeSlotTemplateId?: string;
  registrationId?: string;
  leadId?: string;
}

export interface Recipient {
  name: string;
  email: string;
}

const ETE_SEASON_KEY = "ete-2026";

function dedup(recipients: Recipient[]): Recipient[] {
  const byEmail = new Map<string, Recipient>();
  for (const r of recipients) {
    if (r.email) byEmail.set(r.email.toLowerCase(), r);
  }
  return Array.from(byEmail.values());
}

async function allLeadParents(): Promise<Recipient[]> {
  const { data, error } = await db().from("leads").select("parent_name, email").not("email", "is", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((l: any) => ({ name: l.parent_name, email: l.email }));
}

async function allRegistrationParents(filter: { seasonId?: string; categoryId?: string; timeSlotTemplateId?: string } = {}): Promise<Recipient[]> {
  let query = db().from("registrations").select("parent_name, parent_email").eq("status", "paid").not("parent_email", "is", null);
  if (filter.seasonId) query = query.eq("season_id", filter.seasonId);
  if (filter.categoryId) query = query.eq("category_id", filter.categoryId);
  if (filter.timeSlotTemplateId) query = query.eq("time_slot_template_id", filter.timeSlotTemplateId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ name: r.parent_name, email: r.parent_email }));
}

async function allCoachRecipients(): Promise<Recipient[]> {
  const { data, error } = await db().from("coaches").select("first_name, last_name, email").eq("status", "active").not("email", "is", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((c: any) => ({ name: `${c.first_name} ${c.last_name}`, email: c.email }));
}

export async function resolveAudience(targetType: TargetType, criteria: AudienceCriteria): Promise<Recipient[]> {
  switch (targetType) {
    case "all": {
      const [leads, regs, coaches] = await Promise.all([allLeadParents(), allRegistrationParents(), allCoachRecipients()]);
      return dedup([...leads, ...regs, ...coaches]);
    }
    case "parents": {
      const [leads, regs] = await Promise.all([allLeadParents(), allRegistrationParents()]);
      return dedup([...leads, ...regs]);
    }
    case "coaches":
      return dedup(await allCoachRecipients());
    case "season": {
      if (!criteria.seasonKey) return [];
      if (criteria.seasonKey === ETE_SEASON_KEY) return dedup(await allLeadParents());
      return dedup(await allRegistrationParents({ seasonId: criteria.seasonKey }));
    }
    case "category": {
      if (!criteria.seasonKey || !criteria.categoryId) return [];
      if (criteria.seasonKey === ETE_SEASON_KEY) {
        const { data, error } = await db().from("leads").select("parent_name, email").eq("player_age", criteria.categoryId).not("email", "is", null);
        if (error) throw new Error(error.message);
        return dedup((data ?? []).map((l: any) => ({ name: l.parent_name, email: l.email })));
      }
      return dedup(await allRegistrationParents({ seasonId: criteria.seasonKey, categoryId: criteria.categoryId }));
    }
    case "group": {
      if (!criteria.timeSlotTemplateId) return [];
      return dedup(await allRegistrationParents({ timeSlotTemplateId: criteria.timeSlotTemplateId }));
    }
    case "player": {
      if (criteria.registrationId) {
        const { data, error } = await db().from("registrations").select("parent_name, parent_email").eq("id", criteria.registrationId).maybeSingle();
        if (error) throw new Error(error.message);
        return data?.parent_email ? [{ name: data.parent_name, email: data.parent_email }] : [];
      }
      if (criteria.leadId) {
        const { data, error } = await db().from("leads").select("parent_name, email").eq("id", criteria.leadId).maybeSingle();
        if (error) throw new Error(error.message);
        return data?.email ? [{ name: data.parent_name, email: data.email }] : [];
      }
      return [];
    }
    default:
      return [];
  }
}

export interface CommunicationLogEntry {
  id: string;
  sender_role: string;
  target_type: string;
  target_label: string;
  subject: string;
  body: string;
  recipient_count: number;
  sent_at: string;
}

export async function logCommunication(input: {
  senderRole: string;
  targetType: TargetType;
  targetLabel: string;
  targetCriteria: AudienceCriteria;
  subject: string;
  body: string;
  recipientCount: number;
}): Promise<void> {
  const { error } = await db().from("communications").insert({
    sender_role: input.senderRole,
    target_type: input.targetType,
    target_label: input.targetLabel,
    target_criteria: input.targetCriteria,
    subject: input.subject,
    body: input.body,
    recipient_count: input.recipientCount
  });
  if (error) throw new Error(error.message);
}

export async function getCommunicationHistory(): Promise<CommunicationLogEntry[]> {
  const { data, error } = await db().from("communications").select("*").order("sent_at", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as CommunicationLogEntry[];
}
