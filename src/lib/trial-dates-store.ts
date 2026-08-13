/**
 * Trial/essai dates configuration — persisted in Supabase (singleton table
 * `trial_config`). Admin updates via /api/admin/essais. Qualification form
 * reads via /api/essais.
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export interface TrialGroup {
  label: string;
  dates: string[];
  horaires: string[];
  exception?: string;
}

export interface TrialConfig {
  groups: Record<string, TrialGroup[]>;
  lieu: string;
  lieuNote: string;
}

/* ── Default config (matches current hardcoded values) ── */

const DEFAULT_CONFIG: TrialConfig = {
  groups: {
    "2016": [
      {
        label: "Groupe 1 — 2015 & 2016",
        dates: ["Mar 14 avril", "Jeu 16 avril", "Sam 18 avril"],
        horaires: ["2016 : 18h00 à 19h25", "2015 : 19h30 à 20h55"],
        exception: "Exception — Sam 18 avril : 2016 de 13h30 à 14h55"
      }
    ],
    "2015": [
      {
        label: "Groupe 1 — 2015 & 2016",
        dates: ["Mar 14 avril", "Jeu 16 avril", "Sam 18 avril"],
        horaires: ["2016 : 18h00 à 19h25", "2015 : 19h30 à 20h55"],
        exception: "Exception — Sam 18 avril : 2015 de 15h00 à 16h30"
      },
      {
        label: "Groupe 2 — 2015 & 2014-2013",
        dates: ["Lun 13 avril", "Mer 15 avril", "Ven 17 avril"],
        horaires: ["2015 : 18h00 à 19h25", "2014-2013 : 19h30 à 20h55"]
      }
    ],
    "2014-2013": [
      {
        label: "Groupe 2 — 2015 & 2014-2013",
        dates: ["Lun 13 avril", "Mer 15 avril", "Ven 17 avril"],
        horaires: ["2015 : 18h00 à 19h25", "2014-2013 : 19h30 à 20h55"]
      }
    ]
  },
  lieu: "Terrain synthétique — Parc à Rosemère, Rue Charbonneau, Rosemère, QC J7A 1G1",
  lieuNote: "Le terrain peut changer — vous serez avertis par courriel."
};

function isSupabaseAvailable(): boolean {
  try { getSupabaseAdminClient(); return true; } catch { return false; }
}

// Repli en mémoire uniquement si Supabase est indisponible (perdu au redémarrage).
let memCache: TrialConfig = structuredClone(DEFAULT_CONFIG);

export async function getTrialConfig(): Promise<TrialConfig> {
  if (isSupabaseAvailable()) {
    const { data, error } = await db()
      .from("trial_config")
      .select("config")
      .eq("id", true)
      .maybeSingle();
    if (!error) {
      if (data) {
        memCache = data.config as TrialConfig;
        return structuredClone(memCache);
      }
      // Rien en base encore — on amorce avec la config par défaut.
      await setTrialConfig(structuredClone(DEFAULT_CONFIG));
      return structuredClone(DEFAULT_CONFIG);
    }
  }
  return structuredClone(memCache);
}

export async function setTrialConfig(config: TrialConfig): Promise<void> {
  memCache = structuredClone(config);

  if (isSupabaseAvailable()) {
    const { error } = await db()
      .from("trial_config")
      .upsert({ id: true, config, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
}

export function getDefaultTrialConfig(): TrialConfig {
  return structuredClone(DEFAULT_CONFIG);
}
