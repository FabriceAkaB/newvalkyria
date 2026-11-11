import { CLUB_ID } from "@/lib/club";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Inventaire du matériel (Mandalart P7.6.02) : quoi, combien, où, confié à qui, dans quel état, et
 *  quand le remplacer. L'année de remplacement est calculée (jamais saisie) : date d'achat + durée de
 *  vie ; un article « usé » se remplace dans les 12 mois ; « à remplacer » se remplace tout de suite.
 *  Sans date d'achat, l'année est estimée à partir de l'état et du jour où il a été noté.
 *
 *  La première partie est pure (testée dans inventory-repo.test.ts) ; la seconde lit et écrit la base. */

export type InventoryCategory = "ballons" | "dossards" | "cones" | "mini-buts" | "tapis" | "cibles" | "camera" | "premiers-soins" | "autre";
export type InventoryCondition = "neuf" | "bon" | "use" | "a_remplacer";

/** Catégories et durée de vie par défaut (mois), modifiable article par article. */
export const INVENTORY_CATEGORIES: { value: InventoryCategory; label: string; lifespanMonths: number; example: string }[] = [
  { value: "ballons", label: "Ballons", lifespanMonths: 12, example: "Ballons taille 4" },
  { value: "dossards", label: "Dossards bicolores", lifespanMonths: 24, example: "Dossards bicolores mauve/gris" },
  { value: "cones", label: "Cônes", lifespanMonths: 36, example: "Cônes plats" },
  { value: "mini-buts", label: "Mini-buts", lifespanMonths: 48, example: "Mini-buts pliables" },
  { value: "tapis", label: "Tapis", lifespanMonths: 60, example: "Tapis de gardien" },
  { value: "cibles", label: "Cibles", lifespanMonths: 36, example: "Cibles de coin" },
  { value: "camera", label: "Caméra", lifespanMonths: 48, example: "Caméra et trépied" },
  { value: "premiers-soins", label: "Trousse de premiers soins", lifespanMonths: 12, example: "Trousse de premiers soins" },
  { value: "autre", label: "Autre", lifespanMonths: 36, example: "Pompe à ballons" }
];
export const CATEGORY_LABEL = Object.fromEntries(INVENTORY_CATEGORIES.map((c) => [c.value, c.label])) as Record<InventoryCategory, string>;
export const defaultLifespan = (c: InventoryCategory) => INVENTORY_CATEGORIES.find((x) => x.value === c)?.lifespanMonths ?? 36;

export const CONDITIONS: { value: InventoryCondition; label: string }[] = [
  { value: "neuf", label: "Neuf" },
  { value: "bon", label: "Bon" },
  { value: "use", label: "Usé" },
  { value: "a_remplacer", label: "À remplacer" }
];
export const CONDITION_LABEL = Object.fromEntries(CONDITIONS.map((c) => [c.value, c.label])) as Record<InventoryCondition, string>;
export const CONDITION_TONE: Record<InventoryCondition, "good" | "warn" | "bad" | undefined> = { neuf: "good", bon: undefined, use: "warn", a_remplacer: "bad" };

/** Un article « usé » doit être remplacé au plus tard 12 mois après qu'on l'a noté usé. */
export const WORN_MONTHS = 12;
/** Part de la durée de vie qui reste selon l'état, quand la date d'achat est inconnue. */
const REMAINING_BY_CONDITION: Record<InventoryCondition, number> = { neuf: 1, bon: 0.5, use: 0.25, a_remplacer: 0 };

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  location: string | null;
  assigned_to: string | null;
  condition: InventoryCondition;
  condition_at: string;
  purchased_on: string | null;
  unit_cost_cents: number | null;
  lifespan_months: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Replacement {
  /** Date de remplacement prévue (AAAA-MM-JJ). */
  date: string;
  /** Année où le remplacement tombe dans le fonds (une date dépassée compte pour l'année en cours). */
  year: number;
  /** Calculée sans date d'achat. */
  estimated: boolean;
  /** Date atteinte ou dépassée (ou marqué « à remplacer »). */
  due: boolean;
  reason: string;
}

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const dayFr = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS_SHORT[m - 1]} ${y}`;
};
export const monthFr = (iso: string) => {
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
};

/** Jour à Montréal d'un horodatage, ou le jour d'une date. */
export function localDay(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value.slice(0, 10) : d.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export const lifespanOf = (item: Pick<InventoryItem, "lifespan_months" | "category">) => item.lifespan_months ?? defaultLifespan(item.category);

/** Quand remplacer cet article, et pourquoi. */
export function replacementOf(item: InventoryItem, today: string): Replacement {
  const thisYear = Number(today.slice(0, 4));
  const noted = localDay(item.condition_at ?? item.created_at);
  const life = lifespanOf(item);
  const finish = (date: string, estimated: boolean, reason: string, forceDue = false): Replacement => {
    const due = forceDue || date <= today;
    return { date, year: due ? thisYear : Math.max(thisYear, Number(date.slice(0, 4))), estimated, due, reason };
  };

  if (item.condition === "a_remplacer") return finish(noted, false, `Marqué « à remplacer » le ${dayFr(noted)}`, true);

  let date: string;
  let estimated: boolean;
  let reason: string;
  if (item.purchased_on) {
    date = addMonths(item.purchased_on.slice(0, 10), life);
    estimated = false;
    reason = `Acheté le ${dayFr(item.purchased_on)} · durée de vie ${life} mois`;
  } else {
    // Le reste de la durée de vie se compte à partir du jour où l'état a été noté (à l'ajout, ou au dernier
    // changement d'état) : un lot remis à « neuf » sans date d'achat repart pour une durée de vie complète.
    date = addMonths(noted, Math.round(life * REMAINING_BY_CONDITION[item.condition]));
    estimated = true;
    reason = `Estimée selon l'état (date d'achat inconnue) · durée de vie ${life} mois`;
  }
  if (item.condition === "use") {
    const cap = addMonths(noted, WORN_MONTHS);
    if (cap < date) {
      date = cap;
      estimated = false;
      reason = `Noté usé le ${dayFr(noted)} : à remplacer dans les ${WORN_MONTHS} mois`;
    }
  }
  if (date <= today) reason = `Durée de vie atteinte en ${monthFr(date)}${estimated ? " (estimée)" : ""}`;
  return finish(date, estimated, reason);
}

/** Coût d'un lot (quantité × coût unitaire), ou null si le coût n'est pas connu. */
export const lotCost = (item: Pick<InventoryItem, "quantity" | "unit_cost_cents">) => (item.unit_cost_cents === null ? null : item.quantity * item.unit_cost_cents);

export interface PlannedItem {
  item: InventoryItem;
  replacement: Replacement;
  costCents: number | null;
}

export interface FundYear {
  year: number;
  items: PlannedItem[];
  costCents: number;
  /** Lots dont le coût unitaire manque : le total est un minimum. */
  unknownCost: number;
}

export interface InventoryOverview {
  today: string;
  items: PlannedItem[];
  /** À remplacer d'ici le 31 décembre (dépassés et « à remplacer » compris). */
  thisYear: FundYear;
  /** Fonds de remplacement des 3 prochaines années (l'année en cours d'abord). */
  fund: FundYear[];
  /** À traiter maintenant : marqués « à remplacer » ou date dépassée. */
  dueNow: PlannedItem[];
  units: number;
  valueCents: number;
  locations: string[];
  assignees: string[];
}

const rank = (p: PlannedItem) => (p.item.condition === "a_remplacer" ? 0 : p.replacement.due ? 1 : 2);

export function planInventory(items: InventoryItem[], today: string): InventoryOverview {
  const thisYear = Number(today.slice(0, 4));
  const planned = items.map((item) => ({ item, replacement: replacementOf(item, today), costCents: lotCost(item) }));
  const fund = [thisYear, thisYear + 1, thisYear + 2].map((year) => {
    const inYear = planned
      .filter((p) => p.replacement.year === year && p.item.quantity > 0)
      .sort((a, b) => rank(a) - rank(b) || a.replacement.date.localeCompare(b.replacement.date) || a.item.name.localeCompare(b.item.name, "fr"));
    return {
      year,
      items: inYear,
      costCents: inYear.reduce((s, p) => s + (p.costCents ?? 0), 0),
      unknownCost: inYear.filter((p) => p.costCents === null).length
    };
  });
  const uniq = (xs: (string | null)[]) => [...new Set(xs.map((x) => x?.trim()).filter((x): x is string => Boolean(x)))].sort((a, b) => a.localeCompare(b, "fr"));
  return {
    today,
    items: planned,
    thisYear: fund[0],
    fund,
    dueNow: fund[0].items.filter((p) => p.replacement.due),
    units: items.reduce((s, i) => s + i.quantity, 0),
    valueCents: planned.reduce((s, p) => s + (p.costCents ?? 0), 0),
    locations: uniq(items.map((i) => i.location)),
    assignees: uniq(items.map((i) => i.assigned_to))
  };
}

const money = (c: number) => `${Math.round(c / 100).toLocaleString("fr-CA")} $`;

/** Lignes prêtes pour la page « Aujourd'hui » (même forme que `TodayItem` de admin-today.ts). */
export function inventoryTodayItems(dueNow: PlannedItem[]): { title: string; detail: string | null; meta: string | null; href: string }[] {
  return dueNow.map(({ item, replacement, costCents }) => ({
    title: `Remplacer ${item.quantity} × ${item.name}`,
    detail: [item.location, item.assigned_to ? `confié à ${item.assigned_to}` : null, replacement.reason].filter(Boolean).join(" · "),
    meta: costCents !== null ? money(costCents) : "Coût à préciser",
    href: `/admin/inventaire#i-${item.id}`
  }));
}

// ───────────────────────────── Base de données ─────────────────────────────

function db() {
  return getSupabaseAdminClient() as any;
}

export const torontoToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

const COLUMNS = "id, name, category, quantity, location, assigned_to, condition, condition_at, purchased_on, unit_cost_cents, lifespan_months, notes, created_at, updated_at";

export async function listInventory(): Promise<InventoryItem[]> {
  const { data, error } = await db().from("inventory_items").select(COLUMNS).eq("club_id", CLUB_ID).is("archived_at", null).order("category").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ ...r, purchased_on: r.purchased_on ? String(r.purchased_on).slice(0, 10) : null }));
}

export async function getInventoryOverview(today = torontoToday()): Promise<InventoryOverview> {
  return planInventory(await listInventory(), today);
}

/** Pour « Aujourd'hui » : nombre d'articles suivis et ceux à remplacer maintenant. */
export async function getInventoryAlerts(today = torontoToday()): Promise<{ itemCount: number; dueNow: PlannedItem[]; thisYearCents: number }> {
  const o = await getInventoryOverview(today);
  return { itemCount: o.items.length, dueNow: o.dueNow, thisYearCents: o.thisYear.costCents };
}

export interface InventoryInput {
  name: string;
  category: InventoryCategory;
  quantity: number;
  location?: string | null;
  assignedTo?: string | null;
  condition: InventoryCondition;
  purchasedOn?: string | null;
  unitCostCents?: number | null;
  lifespanMonths?: number | null;
  notes?: string | null;
}

const blank = (s: string | null | undefined) => s?.trim() || null;

export async function getItem(id: string): Promise<InventoryItem | null> {
  const { data } = await db().from("inventory_items").select(COLUMNS).eq("club_id", CLUB_ID).eq("id", id).maybeSingle();
  return data ?? null;
}

export async function addInventoryItem(input: InventoryInput): Promise<string> {
  const { data, error } = await db()
    .from("inventory_items")
    .insert({
      club_id: CLUB_ID,
      name: input.name.trim(),
      category: input.category,
      quantity: input.quantity,
      location: blank(input.location),
      assigned_to: blank(input.assignedTo),
      condition: input.condition,
      purchased_on: input.purchasedOn || null,
      unit_cost_cents: input.unitCostCents ?? null,
      // La durée de vie par défaut de la catégorie n'est pas recopiée : si elle change, l'article suit.
      lifespan_months: input.lifespanMonths && input.lifespanMonths !== defaultLifespan(input.category) ? input.lifespanMonths : null,
      notes: blank(input.notes)
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateInventoryItem(id: string, input: InventoryInput): Promise<{ before: InventoryItem; after: Record<string, unknown> }> {
  const before = await getItem(id);
  if (!before) throw new Error("Article introuvable");
  const now = new Date().toISOString();
  const after = {
    name: input.name.trim(),
    category: input.category,
    quantity: input.quantity,
    location: blank(input.location),
    assigned_to: blank(input.assignedTo),
    condition: input.condition,
    ...(input.condition !== before.condition ? { condition_at: now } : {}),
    purchased_on: input.purchasedOn || null,
    unit_cost_cents: input.unitCostCents ?? null,
    lifespan_months: input.lifespanMonths && input.lifespanMonths !== defaultLifespan(input.category) ? input.lifespanMonths : null,
    notes: blank(input.notes),
    updated_at: now
  };
  const { error } = await db().from("inventory_items").update(after).eq("club_id", CLUB_ID).eq("id", id);
  if (error) throw new Error(error.message);
  return { before, after };
}

/** + / − sur la quantité (jamais sous 0). */
export async function adjustQuantity(id: string, delta: number): Promise<{ before: number; quantity: number; name: string }> {
  const item = await getItem(id);
  if (!item) throw new Error("Article introuvable");
  const quantity = Math.max(0, item.quantity + delta);
  const { error } = await db().from("inventory_items").update({ quantity, updated_at: new Date().toISOString() }).eq("club_id", CLUB_ID).eq("id", id);
  if (error) throw new Error(error.message);
  return { before: item.quantity, quantity, name: item.name };
}

/** Remplacé : le lot redevient neuf, acheté aujourd'hui (au nouveau prix s'il est donné). */
export async function markReplaced(id: string, unitCostCents?: number | null, today = torontoToday()): Promise<InventoryItem> {
  const item = await getItem(id);
  if (!item) throw new Error("Article introuvable");
  const now = new Date().toISOString();
  const { error } = await db()
    .from("inventory_items")
    .update({ condition: "neuf", condition_at: now, purchased_on: today, ...(unitCostCents != null ? { unit_cost_cents: unitCostCents } : {}), updated_at: now })
    .eq("club_id", CLUB_ID)
    .eq("id", id);
  if (error) throw new Error(error.message);
  return item;
}

/** Retire un article de l'inventaire (perdu, jeté, donné) ; la ligne reste en base pour l'historique. */
export async function archiveItem(id: string): Promise<InventoryItem> {
  const item = await getItem(id);
  if (!item) throw new Error("Article introuvable");
  const { error } = await db().from("inventory_items").update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("club_id", CLUB_ID).eq("id", id);
  if (error) throw new Error(error.message);
  return item;
}
