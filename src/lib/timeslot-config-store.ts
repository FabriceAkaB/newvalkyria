import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export interface SlotConfig {
  id: string;
  label: string;
  day: string;
  horaire: string;
  category: string;
  practices: number;
  maxPlaces: number;
}

const DEFAULT_SLOTS: SlotConfig[] = [
  { id: "lun-2015", label: "Lundi — 2015 F",          day: "Lundi",    horaire: "18h00 à 19h30", category: "2015",      practices: 15, maxPlaces: 10 },
  { id: "mar-2016", label: "Mardi — 2016 F",           day: "Mardi",    horaire: "18h00 à 19h15", category: "2016",      practices: 17, maxPlaces: 10 },
  { id: "mer-2015", label: "Mercredi — 2015 F",        day: "Mercredi", horaire: "19h25 à 20h55", category: "2015",      practices: 15, maxPlaces: 10 },
  { id: "jeu-2015", label: "Jeudi — 2015 F",           day: "Jeudi",    horaire: "18h00 à 19h15", category: "2015",      practices: 17, maxPlaces: 10 },
  { id: "ven-2014", label: "Vendredi — 2014-2013 F",   day: "Vendredi", horaire: "18h00 à 19h15", category: "2014-2013", practices: 17, maxPlaces: 10 },
];

function isSupabaseAvailable(): boolean {
  try { getSupabaseAdminClient(); return true; } catch { return false; }
}

function rowToSlot(row: Record<string, unknown>): SlotConfig {
  return {
    id:        row.id        as string,
    label:     row.label     as string,
    day:       row.day       as string,
    horaire:   row.horaire   as string,
    category:  row.category  as string,
    practices: row.practices as number,
    maxPlaces: row.max_places as number,
  };
}

function slotToRow(s: SlotConfig) {
  return {
    id:         s.id,
    label:      s.label,
    day:        s.day,
    horaire:    s.horaire,
    category:   s.category,
    practices:  s.practices,
    max_places: s.maxPlaces,
    updated_at: new Date().toISOString(),
  };
}

// In-memory fallback (lost on cold start, fine for serverless)
let memCache: SlotConfig[] = structuredClone(DEFAULT_SLOTS);

export async function getSlotConfigs(): Promise<SlotConfig[]> {
  if (isSupabaseAvailable()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (getSupabaseAdminClient() as any)
      .from("slot_configs")
      .select("*")
      .order("id");

    if (!error && data) {
      if (data.length === 0) {
        await setSlotConfigs(structuredClone(DEFAULT_SLOTS));
        return structuredClone(DEFAULT_SLOTS);
      }
      const slots = (data as Record<string, unknown>[]).map(rowToSlot);
      memCache = slots;
      return slots.map((s) => ({ ...s }));
    }
  }

  return memCache.map((s) => ({ ...s }));
}

export async function setSlotConfigs(slots: SlotConfig[]): Promise<void> {
  memCache = slots.map((s) => ({ ...s }));

  if (isSupabaseAvailable()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getSupabaseAdminClient() as any)
      .from("slot_configs")
      .upsert(slots.map(slotToRow), { onConflict: "id" });
  }
}

export async function updateSlotCapacity(slotId: string, maxPlaces: number): Promise<void> {
  memCache = memCache.map((s) => (s.id === slotId ? { ...s, maxPlaces } : s));

  if (isSupabaseAvailable()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getSupabaseAdminClient() as any)
      .from("slot_configs")
      .update({ max_places: maxPlaces, updated_at: new Date().toISOString() })
      .eq("id", slotId);
  }
}

export function getDefaultSlots(): SlotConfig[] {
  return structuredClone(DEFAULT_SLOTS);
}
