import { getAllLeads } from "@/lib/repositories";
import { ETE_SEASON_KEY, ETE_SEASON_LABEL } from "@/lib/revenue-calc";
import { getSeasonRegistrations, getSeasons } from "@/lib/season-admin-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

/** Nombre de sacs offerts aux premiers payants d'une saison "hiver" — même
 *  seuil que l'offre boutique existante (voir /api/inscription/offre-sac). */
const FREE_BAG_THRESHOLD = 30;

export type UniformKitSourceType = "lead" | "registration";

export interface UniformKitRow {
  sourceType: UniformKitSourceType;
  sourceId: string;
  seasonKey: string;
  seasonLabel: string;
  playerName: string;
  ageLabel: string;
  parentName: string;
  parentPhone: string;
  items: string[];
  includesSac: boolean;
  delivered: boolean;
  deliveredAt: string | null;
  deliveredBy: string | null;
  registeredAt: string;
}

function childNameFromGoal(goal: string): string {
  const match = goal.match(/Joueuse:\s*([^·]+)/);
  return match?.[1]?.trim() || "";
}

/** Le kit de base (chandail + short + bas) est inclus avec toute inscription
 *  payée — jamais un achat boutique séparé. La saison Été n'offre pas de sac ;
 *  les saisons du système multi-saisons (hiver et suivantes) offrent un sac
 *  gratuit aux 30 premiers payants, selon leur ordre d'inscription. */
export async function getBaseUniformList(filterSeasonKey?: string): Promise<UniformKitRow[]> {
  const [seasons, kitRows] = await Promise.all([
    getSeasons(),
    db().from("registration_uniform_kits").select("*")
  ]);
  if (kitRows.error) throw new Error(kitRows.error.message);

  const kitBySource = new Map<string, any>();
  for (const k of kitRows.data ?? []) kitBySource.set(`${k.source_type}:${k.source_id}`, k);

  const rows: UniformKitRow[] = [];

  if (!filterSeasonKey || filterSeasonKey === ETE_SEASON_KEY) {
    const leads = await getAllLeads();
    const paidLeads = leads.filter((l) => l.status === "paid" && !l.is_waitlist).sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const lead of paidLeads) {
      const kit = kitBySource.get(`lead:${lead.id}`);
      rows.push({
        sourceType: "lead",
        sourceId: lead.id,
        seasonKey: ETE_SEASON_KEY,
        seasonLabel: ETE_SEASON_LABEL,
        playerName: childNameFromGoal(lead.goal) || "Sans nom",
        ageLabel: lead.player_age,
        parentName: lead.parent_name,
        parentPhone: lead.phone,
        items: ["Chandail", "Short", "Bas"],
        includesSac: false,
        delivered: Boolean(kit?.delivered),
        deliveredAt: kit?.delivered_at ?? null,
        deliveredBy: kit?.delivered_by ?? null,
        registeredAt: lead.created_at
      });
    }
  }

  for (const season of seasons.filter((s) => s.id !== ETE_SEASON_KEY)) {
    if (filterSeasonKey && season.id !== filterSeasonKey) continue;
    const registrations = await getSeasonRegistrations(season.id);
    const paid = registrations.filter((r) => r.status === "paid" && !r.is_trial).sort((a, b) => a.created_at.localeCompare(b.created_at));
    paid.forEach((r, index) => {
      const kit = kitBySource.get(`registration:${r.id}`);
      const includesSac = index < FREE_BAG_THRESHOLD;
      rows.push({
        sourceType: "registration",
        sourceId: r.id,
        seasonKey: season.id,
        seasonLabel: season.label,
        playerName: `${r.player_first_name ?? ""} ${r.player_last_name ?? ""}`.trim() || "Sans nom",
        ageLabel: r.category_id ?? "—",
        parentName: r.parent_name,
        parentPhone: r.parent_phone,
        items: includesSac ? ["Chandail", "Short", "Bas", "Sac"] : ["Chandail", "Short", "Bas"],
        includesSac,
        delivered: Boolean(kit?.delivered),
        deliveredAt: kit?.delivered_at ?? null,
        deliveredBy: kit?.delivered_by ?? null,
        registeredAt: r.created_at
      });
    });
  }

  return rows.sort((a, b) => (a.delivered === b.delivered ? a.registeredAt.localeCompare(b.registeredAt) : a.delivered ? 1 : -1));
}

export async function setUniformKitDelivered(
  seasonKey: string,
  sourceType: UniformKitSourceType,
  sourceId: string,
  delivered: boolean,
  deliveredBy: string | null
): Promise<void> {
  const supabase = db();
  const { error } = await supabase.from("registration_uniform_kits").upsert(
    {
      season_key: seasonKey,
      source_type: sourceType,
      source_id: sourceId,
      delivered,
      delivered_at: delivered ? new Date().toISOString() : null,
      delivered_by: delivered ? deliveredBy : null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "season_key,source_type,source_id" }
  );
  if (error) throw new Error(error.message);
}
