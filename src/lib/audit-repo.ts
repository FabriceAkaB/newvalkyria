import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export interface AuditLogEntry {
  id: string;
  actor_role: string;
  actor_label: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export async function logAudit(input: {
  actorRole: string;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  before?: object | null;
  after?: object | null;
}): Promise<void> {
  const { error } = await db().from("audit_log").insert({
    actor_role: input.actorRole,
    actor_label: input.actorLabel,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    entity_label: input.entityLabel ?? null,
    before: input.before ?? null,
    after: input.after ?? null
  });
  // Le journal ne doit jamais faire échouer l'action qu'il enregistre —
  // une erreur d'écriture ici est seulement journalisée côté serveur.
  if (error) console.error("audit_log insert failed:", error.message);
}

export async function getAuditLog(filters?: { entityType?: string; limit?: number }): Promise<AuditLogEntry[]> {
  let query = db().from("audit_log").select("*").order("created_at", { ascending: false }).limit(filters?.limit ?? 100);
  if (filters?.entityType) query = query.eq("entity_type", filters.entityType);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditLogEntry[];
}
