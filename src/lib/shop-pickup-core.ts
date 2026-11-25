/** Remise d'une commande de la boutique à la séance choisie par le parent (JP, 25 nov. 2026). Règles pures, sans base.
 *  - Une commande dont tous les articles sont en stock au paiement reçoit un lien personnel /remise/<jeton>.
 *  - Le parent y choisit une séance de l'académie de cette semaine ou de la suivante (pratiques des filles,
 *    programmes à dates fixes), au plus tard 1 h avant son début, et peut cocher « C'est un cadeau ».
 *  - Modifiable tant que la commande n'est pas remise.
 *  - Cadeau : le parent va voir le responsable sur le terrain, qui lui remet le colis discrètement. */

export const GIFT_NOTE = "Cadeau : remettre discrètement au parent, pas devant la joueuse";

/** Une séance doit commencer au moins une heure après le choix (le temps de préparer le colis). */
export const PICKUP_MIN_LEAD_MINUTES = 60;

export interface PickupPracticeInput {
  key: string;
  date: string;
  start: string;
  end: string | null;
  group: string;
  location: string;
  source: "saison" | "programme" | "activite";
  organization: string | null;
  activityId: string | null;
  activityType: string;
}

export interface PickupOption {
  key: string;
  date: string;
  start: string;
  end: string | null;
  group: string;
  location: string;
  activityId: string | null;
}

export interface PickupChoice {
  pickup_date: string | null;
  pickup_start: string | null;
  pickup_location: string | null;
  pickup_group: string | null;
  is_gift: boolean;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Cette semaine et la suivante (semaines du lundi au dimanche) : d'aujourd'hui au dimanche de la semaine prochaine. */
export function pickupWindow(today: string): { from: string; to: string } {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  const toSunday = (7 - dow) % 7;
  return { from: today, to: addDays(today, toSunday + 7) };
}

/** Toutes les commandes payées dont chaque article avait assez de stock. */
export function allInStock(lines: { quantity: number; available: number }[]): boolean {
  return lines.length > 0 && lines.every((l) => l.available >= l.quantity);
}

/** Les séances où le parent peut passer : pratiques de l'académie (pas les matchs ni les pratiques de JP hors Académie),
 *  dans la fenêtre, qui commencent au moins une heure plus tard. Deux groupes à la même heure au même endroit = une seule séance. */
export function pickupOptions(practices: PickupPracticeInput[], now: { date: string; time: string }): PickupOption[] {
  const { from, to } = pickupWindow(now.date);
  const out: PickupOption[] = [];
  for (const p of practices) {
    if (p.organization) continue;
    if (/match|tournoi/i.test(p.activityType)) continue;
    // Activités entrées à la main : seulement les pratiques d'équipe des filles (pas les séances privées ou solo d'une famille).
    if (p.source === "activite" && !/^(équipe|filles)\b/i.test(p.group)) continue;
    if (!p.start || p.date < from || p.date > to) continue;
    if (p.date === now.date && minutes(p.start) - minutes(now.time) < PICKUP_MIN_LEAD_MINUTES) continue;
    const twin = out.find((o) => o.date === p.date && o.location === p.location && Math.abs(minutes(o.start) - minutes(p.start)) <= 15);
    if (twin) {
      twin.activityId ??= p.activityId;
      if (!twin.group.includes(p.group)) twin.group = `${twin.group} et ${p.group}`;
      continue;
    }
    out.push({ key: p.key, date: p.date, start: p.start, end: p.end, group: p.group, location: p.location, activityId: p.activityId });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

/** Le choix du parent : la séance doit être dans la liste proposée ; la commande ne doit pas être déjà remise. */
export function checkPickupChoice(
  order: { status: string; distribution_status: string; in_stock: boolean },
  options: PickupOption[],
  key: unknown
): { ok: true; option: PickupOption } | { ok: false; error: string } {
  if (!order.in_stock) return { ok: false, error: "Cette commande sera remise par l'équipe : nous vous écrirons." };
  if (order.status === "cancelled") return { ok: false, error: "Cette commande est annulée." };
  if (order.distribution_status === "remis") return { ok: false, error: "Votre commande vous a déjà été remise." };
  const option = options.find((o) => o.key === key);
  if (!option) return { ok: false, error: "Cette séance n'est plus offerte. Choisissez-en une autre." };
  return { ok: true, option };
}

const frDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
export const frTime = (t: string) => {
  const [h, m] = t.slice(0, 5).split(":");
  return `${Number(h)} h${m && m !== "00" ? ` ${m}` : ""}`;
};

/** « lundi 30 novembre, 18 h » */
export function pickupWhen(date: string, start: string | null): string {
  return `${frDate(date)}${start ? `, ${frTime(start)}` : ""}`;
}

/** Résumé d'une séance choisie, pour JP (tâche, admin) : « lundi 30 novembre, 18 h · Filles 2016 · Gymnase X · cadeau ». */
export function pickupSummary(choice: PickupChoice): string | null {
  if (!choice.pickup_date) return null;
  return [
    pickupWhen(choice.pickup_date, choice.pickup_start),
    choice.pickup_group,
    choice.pickup_location,
    choice.is_gift ? "cadeau (remise discrète au parent)" : null
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Les commandes à remettre à une activité : celle choisie par son id, ou à défaut la même date et la même heure (15 min près). */
export function ordersForActivity<T extends { pickup_activity_id: string | null; pickup_date: string | null; pickup_start: string | null }>(
  orders: T[],
  activity: { id: string; activity_date: string; start_time: string | null }
): T[] {
  const date = String(activity.activity_date).slice(0, 10);
  const start = activity.start_time ? String(activity.start_time).slice(0, 5) : null;
  return orders.filter((o) => {
    if (o.pickup_activity_id) return o.pickup_activity_id === activity.id;
    if (!o.pickup_date || String(o.pickup_date).slice(0, 10) !== date) return false;
    if (!o.pickup_start || !start) return true;
    return Math.abs(minutes(o.pickup_start) - minutes(start)) <= 15;
  });
}
