import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
  { id: "lun-2015", label: "Lundi — 2015 F",        day: "Lundi",    horaire: "18h00 à 19h30", category: "2015",      practices: 15, maxPlaces: 10 },
  { id: "mar-2016", label: "Mardi — 2016 F",         day: "Mardi",    horaire: "18h00 à 19h15", category: "2016",      practices: 17, maxPlaces: 10 },
  { id: "mer-2015", label: "Mercredi — 2015 F",      day: "Mercredi", horaire: "19h25 à 20h55", category: "2015",      practices: 15, maxPlaces: 10 },
  { id: "jeu-2015", label: "Jeudi — 2015 F",         day: "Jeudi",    horaire: "18h00 à 19h15", category: "2015",      practices: 17, maxPlaces: 10 },
  { id: "lun-2014", label: "Lundi — 2014-2013 F",    day: "Lundi",    horaire: "19h25 à 20h55", category: "2014-2013", practices: 15, maxPlaces: 10 },
];

// ── Supabase helpers ────────────────────────────────────────────────

function supabase() {
  return getSupabaseAdminClient();
}

function isSupabaseAvailable(): boolean {
  try { supabase(); return true; } catch { return false; }
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

// ── File fallback (local dev without Supabase) ──────────────────────

const DATA_DIR   = join(process.cwd(), "data");
const SLOTS_FILE = join(DATA_DIR, "slots.json");

function readFromFile(): SlotConfig[] | null {
  try {
    if (!existsSync(SLOTS_FILE)) return null;
    const parsed = JSON.parse(readFileSync(SLOTS_FILE, "utf-8")) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as SlotConfig[];
  } catch { return null; }
}

function writeToFile(slots: SlotConfig[]): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(SLOTS_FILE, JSON.stringify(slots, null, 2), "utf-8");
  } catch { /* read-only filesystem — in-memory state still works */ }
}

// In-memory cache — always reflects the last known state
let memCache: SlotConfig[] = readFromFile() ?? structuredClone(DEFAULT_SLOTS);

// ── Public API ──────────────────────────────────────────────────────

export async function getSlotConfigs(): Promise<SlotConfig[]> {
  if (isSupabaseAvailable()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase() as any)
      .from("slot_configs")
      .select("*")
      .order("id");

    if (!error && data) {
      if (data.length === 0) {
        // Table exists but is empty — seed with defaults
        await setSlotConfigs(structuredClone(DEFAULT_SLOTS));
        return structuredClone(DEFAULT_SLOTS);
      }
      const slots = (data as Record<string, unknown>[]).map(rowToSlot);
      memCache = slots;
      return slots.map((s) => ({ ...s }));
    }
    // Fall through to cache on error
  }

  return memCache.map((s) => ({ ...s }));
}

export async function setSlotConfigs(slots: SlotConfig[]): Promise<void> {
  memCache = slots.map((s) => ({ ...s }));

  if (isSupabaseAvailable()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase() as any)
      .from("slot_configs")
      .upsert(slots.map(slotToRow), { onConflict: "id" });
    return;
  }

  writeToFile(memCache);
}

export async function updateSlotCapacity(slotId: string, maxPlaces: number): Promise<void> {
  memCache = memCache.map((s) => (s.id === slotId ? { ...s, maxPlaces } : s));

  if (isSupabaseAvailable()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase() as any)
      .from("slot_configs")
      .update({ max_places: maxPlaces, updated_at: new Date().toISOString() })
      .eq("id", slotId);
    return;
  }

  writeToFile(memCache);
}

export function getDefaultSlots(): SlotConfig[] {
  return structuredClone(DEFAULT_SLOTS);
}
