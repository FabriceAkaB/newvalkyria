/**
 * In-memory store for time slot (plage horaire) configuration.
 * 5 slots with configurable capacity.
 */

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
  { id: "lun-2015", label: "Lundi — 2015 F", day: "Lundi", horaire: "18h00 à 19h30", category: "2015", practices: 15, maxPlaces: 10 },
  { id: "mar-2016", label: "Mardi — 2016 F", day: "Mardi", horaire: "18h00 à 19h15", category: "2016", practices: 17, maxPlaces: 10 },
  { id: "mer-2015", label: "Mercredi — 2015 F", day: "Mercredi", horaire: "19h25 à 20h55", category: "2015", practices: 15, maxPlaces: 10 },
  { id: "jeu-2015", label: "Jeudi — 2015 F", day: "Jeudi", horaire: "18h00 à 19h15", category: "2015", practices: 17, maxPlaces: 10 },
  { id: "lun-2014", label: "Lundi — 2014-2013 F", day: "Lundi", horaire: "19h25 à 20h55", category: "2014-2013", practices: 15, maxPlaces: 10 },
];

let currentSlots: SlotConfig[] = structuredClone(DEFAULT_SLOTS);

export function getSlotConfigs(): SlotConfig[] {
  return currentSlots.map((s) => ({ ...s }));
}

export function setSlotConfigs(slots: SlotConfig[]): void {
  currentSlots = slots.map((s) => ({ ...s }));
}

export function updateSlotCapacity(slotId: string, maxPlaces: number): void {
  currentSlots = currentSlots.map((s) =>
    s.id === slotId ? { ...s, maxPlaces } : s
  );
}

export function getDefaultSlots(): SlotConfig[] {
  return structuredClone(DEFAULT_SLOTS);
}
