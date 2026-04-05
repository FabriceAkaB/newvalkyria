/**
 * In-memory store for trial/essai dates configuration.
 * Persists across requests in the same server process.
 * Admin can update via /api/admin/essais.
 * Qualification form reads via /api/essais.
 */

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
        label: "Groupe 2 — 2015, 2014 & 2013",
        dates: ["Lun 13 avril", "Mer 15 avril", "Ven 17 avril"],
        horaires: ["2015 : 18h00 à 19h25", "2013-2014 : 19h30 à 20h55"]
      }
    ],
    "2014-2013": [
      {
        label: "Groupe 2 — 2015, 2014 & 2013",
        dates: ["Lun 13 avril", "Mer 15 avril", "Ven 17 avril"],
        horaires: ["2015 : 18h00 à 19h25", "2013-2014 : 19h30 à 20h55"]
      }
    ]
  },
  lieu: "Terrain synthétique — Parc à Rosemère, Rue Charbonneau, Rosemère, QC J7A 1G1",
  lieuNote: "Le terrain peut changer — vous serez avertis par courriel."
};

/* ── In-memory store ── */

let currentConfig: TrialConfig = structuredClone(DEFAULT_CONFIG);

export function getTrialConfig(): TrialConfig {
  return currentConfig;
}

export function setTrialConfig(config: TrialConfig): void {
  currentConfig = config;
}

export function getDefaultTrialConfig(): TrialConfig {
  return structuredClone(DEFAULT_CONFIG);
}
