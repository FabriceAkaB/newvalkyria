import { env } from "@/lib/env";
import { listPractices } from "@/lib/practices-repo";
import { checkPickupChoice, ordersForActivity, pickupOptions, pickupWhen, pickupWindow, type PickupOption } from "@/lib/shop-pickup-core";
import { recordDelivery, syncOrderTask, type ShopOrderItem, type ShopOrderWithItems } from "@/lib/shop-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Remise d'une commande de la boutique à la séance choisie par le parent (JP, 25 nov. 2026). Règles : shop-pickup-core.ts. */

function db() {
  return getSupabaseAdminClient() as any;
}

const TZ = "America/Toronto";

function nowLocal(): { date: string; time: string } {
  const d = new Date();
  return {
    date: d.toLocaleDateString("en-CA", { timeZone: TZ }),
    time: d.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false })
  };
}

export const pickupUrl = (token: string) => `${env.publicSiteUrl}/remise/${token}`;

const itemsText = (items: Pick<ShopOrderItem, "product_name" | "variant_label" | "quantity">[]) =>
  items.map((i) => `${i.quantity > 1 ? `${i.quantity} × ` : ""}${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ""}`).join(", ");

async function orderByToken(token: string): Promise<ShopOrderWithItems | null> {
  if (!token || token.length < 16) return null;
  const { data: order } = await db().from("shop_orders").select("*").eq("pickup_token", token).maybeSingle();
  if (!order) return null;
  const { data: items } = await db().from("shop_order_items").select("*").eq("order_id", order.id);
  return { ...order, items: (items ?? []) as ShopOrderItem[] };
}

/** Séances proposées au parent : pratiques des filles et programmes à dates fixes de cette semaine et de la suivante. */
export async function getPickupOptions(): Promise<PickupOption[]> {
  const now = nowLocal();
  const { from, to } = pickupWindow(now.date);
  return pickupOptions(await listPractices({ from, to }), now);
}

export interface PickupPage {
  order: ShopOrderWithItems;
  items: string;
  options: PickupOption[];
  /** La séance choisie n'est plus dans la liste (passée ou retirée) : on la montre quand même. */
  chosenKeyMissing: boolean;
  chosenKey: string | null;
}

export async function getPickupPage(token: string): Promise<PickupPage | null> {
  const order = await orderByToken(token);
  if (!order || order.status === "cancelled") return null;
  const options = order.in_stock && order.distribution_status !== "remis" ? await getPickupOptions() : [];
  const chosen = order.pickup_date
    ? options.find((o) => o.date === String(order.pickup_date).slice(0, 10) && o.start === order.pickup_start && o.location === (order.pickup_location ?? "")) ?? null
    : null;
  return { order, items: itemsText(order.items), options, chosenKey: chosen?.key ?? null, chosenKeyMissing: Boolean(order.pickup_date && !chosen) };
}

/** Le parent choisit (ou change) sa séance et dit si c'est un cadeau ; JP voit la séance dans sa tâche. */
export async function savePickupChoice(
  token: string,
  input: { key: unknown; isGift: unknown }
): Promise<{ ok: true; when: string; notify: () => Promise<void> } | { ok: false; error: string }> {
  const order = await orderByToken(token);
  if (!order) return { ok: false, error: "Commande introuvable." };
  const options = await getPickupOptions();
  const check = checkPickupChoice({ status: order.status, distribution_status: order.distribution_status, in_stock: Boolean(order.in_stock) }, options, input.key);
  if (!check.ok) return check;
  const o = check.option;
  const isGift = input.isGift === true;
  const { error } = await db()
    .from("shop_orders")
    .update({
      pickup_activity_id: o.activityId,
      pickup_date: o.date,
      pickup_start: o.start,
      pickup_location: o.location || null,
      pickup_group: o.group,
      is_gift: isGift,
      pickup_chosen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", order.id);
  if (error) return { ok: false, error: "Le choix n'a pas pu être enregistré. Réessayez." };
  const when = pickupWhen(o.date, o.start);
  await db()
    .from("shop_order_events")
    .insert({ order_id: order.id, event: "seance_choisie", detail: `${when} · ${o.group}${o.location ? ` · ${o.location}` : ""}${isGift ? " · cadeau" : ""}`, performed_by: "Parent" })
    .then(() => null, () => null);
  await syncOrderTask(order.id).catch((e) => console.error("Tâche de commande", e));
  // Rappel au parent, envoyé après la réponse (l'envoi par Gmail prend quelques secondes).
  const notify = async () => {
    try {
      const { sendShopPickupChoiceEmail } = await import("@/lib/email");
      await sendShopPickupChoiceEmail({
        to: order.customer_email,
        customerName: order.customer_name,
        items: itemsText(order.items),
        when,
        group: o.group,
        location: o.location || null,
        isGift,
        pickupUrl: pickupUrl(token)
      });
    } catch (e) {
      console.error("Courriel de la séance de remise", e);
    }
  };
  return { ok: true, when, notify };
}

export interface ActivityPickup {
  id: string;
  parentName: string;
  parentPhone: string | null;
  playerName: string | null;
  items: string;
  isGift: boolean;
}

/** Colis à remettre à une activité (portail des éducateurs) : commandes payées, pas encore remises. */
export async function getPickupsForActivity(activity: { id: string; activity_date: string; start_time: string | null }): Promise<ActivityPickup[]> {
  const date = String(activity.activity_date).slice(0, 10);
  const { data: orders } = await db()
    .from("shop_orders")
    .select("id, customer_name, customer_phone, registration_id, is_gift, pickup_activity_id, pickup_date, pickup_start, distribution_status, items:shop_order_items(product_name, variant_label, quantity)")
    .eq("status", "paid")
    .neq("distribution_status", "remis")
    .or(`pickup_activity_id.eq.${activity.id},pickup_date.eq.${date}`);
  const mine = ordersForActivity((orders ?? []) as any[], activity);
  if (!mine.length) return [];
  const regIds = mine.map((o) => o.registration_id).filter(Boolean);
  const { data: regs } = regIds.length ? await db().from("registrations").select("id, player_first_name, player_last_name").in("id", regIds) : { data: [] };
  const regName = new Map<string, string>(((regs ?? []) as any[]).map((r) => [r.id, `${r.player_first_name ?? ""} ${r.player_last_name ?? ""}`.trim()]));
  return mine.map((o) => ({
    id: o.id,
    parentName: String(o.customer_name ?? "").trim() || "Parent",
    parentPhone: o.customer_phone ?? null,
    playerName: o.registration_id ? regName.get(o.registration_id) || null : null,
    items: itemsText(o.items ?? []),
    isGift: Boolean(o.is_gift)
  }));
}

/** « Remis » dans le portail : tous les articles remis, la tâche de JP se coche (recordDelivery → syncOrderTask). */
export async function markPickupDelivered(activity: { id: string; activity_date: string; start_time: string | null }, orderId: string, deliveredBy: string): Promise<boolean> {
  const pickups = await getPickupsForActivity(activity);
  if (!pickups.some((p) => p.id === orderId)) return false;
  const { data: items } = await db().from("shop_order_items").select("id, quantity").eq("order_id", orderId);
  await recordDelivery(orderId, ((items ?? []) as any[]).map((i) => ({ itemId: i.id, deliveredQuantity: i.quantity })), deliveredBy, false);
  return true;
}
