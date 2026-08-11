import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

/* ── Types ─────────────────────────────────────────────────────── */

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  /** Stock du produit lui-même — n'est utilisé au moment du paiement que
   *  si le produit n'a aucune variante (sinon le stock par variante prime). */
  inventory_count: number;
  /** Un seul produit peut porter ce drapeau — c'est le cadeau offert
   *  automatiquement aux N premiers clients d'une saison (voir season-admin-repo). */
  is_signup_bonus: boolean;
  /** Rôle dans l'offre "2e uniforme" (chandail + short au prix régulier, bas offerts).
   *  Un seul produit par rôle. */
  uniform_bundle_role: "jersey" | "short" | "socks" | null;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductPhoto {
  id: string;
  product_id: string;
  url: string;
  display_order: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  label: string;
  size: string | null;
  color: string | null;
  sku: string | null;
  inventory_count: number;
  active: boolean;
  display_order: number;
}

export interface ProductWithVariants extends Product {
  photos: ProductPhoto[];
  variants: ProductVariant[];
}

export type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled";

/** Cycle de vie de la distribution — distinct du statut de paiement. Une
 *  commande payée démarre à "a_commander" (on ne sait pas encore où elle en
 *  est réellement chez le fournisseur). */
export type DistributionStatus = "a_commander" | "en_production" | "recu" | "pret_a_remettre" | "partiellement_remis" | "remis";

export const DISTRIBUTION_STATUS_LABELS: Record<DistributionStatus, string> = {
  a_commander: "À commander",
  en_production: "En production",
  recu: "Reçu par l'académie",
  pret_a_remettre: "Prêt à remettre",
  partiellement_remis: "Partiellement remis",
  remis: "Remis"
};

export interface ShopOrder {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_postal_code: string | null;
  status: OrderStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  total_cents: number;
  registration_id: string | null;
  season_key: string | null;
  notes: string | null;
  distribution_status: DistributionStatus;
  created_at: string;
  updated_at: string;
}

export interface ShopOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_label: string | null;
  unit_price_cents: number;
  quantity: number;
  delivered_quantity: number;
}

export interface ShopOrderEvent {
  id: string;
  order_id: string;
  event: string;
  detail: string | null;
  performed_by: string | null;
  created_at: string;
}

export type ProblemType =
  | "mauvaise_taille" | "article_manquant" | "mauvais_article" | "quantite_incorrecte"
  | "article_endommage" | "commande_incomplete" | "echange_demande" | "retour_fournisseur" | "autre";

export const PROBLEM_TYPE_LABELS: Record<ProblemType, string> = {
  mauvaise_taille: "Mauvaise taille",
  article_manquant: "Article manquant",
  mauvais_article: "Mauvais article",
  quantite_incorrecte: "Quantité incorrecte",
  article_endommage: "Article endommagé",
  commande_incomplete: "Commande incomplète",
  echange_demande: "Échange demandé",
  retour_fournisseur: "Retour fournisseur",
  autre: "Autre"
};

export interface ShopOrderProblem {
  id: string;
  order_id: string;
  problem_type: ProblemType;
  description: string | null;
  status: "ouvert" | "resolu";
  created_at: string;
  resolved_at: string | null;
}

export interface ShopOrderWithItems extends ShopOrder {
  items: ShopOrderItem[];
}

/* ── Produits ──────────────────────────────────────────────────── */

async function attachPhotosAndVariants(
  supabase: any,
  products: Product[],
  includeInactive: boolean
): Promise<ProductWithVariants[]> {
  if (products.length === 0) return [];
  const productIds = products.map((p) => p.id);

  const [{ data: photos, error: photoErr }, variantResult] = await Promise.all([
    supabase.from("product_photos").select("*").in("product_id", productIds).order("display_order", { ascending: true }),
    (() => {
      let q = supabase.from("product_variants").select("*").in("product_id", productIds).order("display_order", { ascending: true });
      if (!includeInactive) q = q.eq("active", true);
      return q;
    })()
  ]);
  if (photoErr) throw new Error(photoErr.message);
  if (variantResult.error) throw new Error(variantResult.error.message);

  const photosByProduct = new Map<string, ProductPhoto[]>();
  for (const photo of photos ?? []) {
    const list = photosByProduct.get(photo.product_id as string) ?? [];
    list.push(photo as ProductPhoto);
    photosByProduct.set(photo.product_id as string, list);
  }

  const variantsByProduct = new Map<string, ProductVariant[]>();
  for (const v of variantResult.data ?? []) {
    const list = variantsByProduct.get(v.product_id as string) ?? [];
    list.push(v as ProductVariant);
    variantsByProduct.set(v.product_id as string, list);
  }

  return products.map((p) => ({
    ...p,
    photos: photosByProduct.get(p.id) ?? [],
    variants: variantsByProduct.get(p.id) ?? []
  }));
}

export async function getProducts(includeInactive = false): Promise<ProductWithVariants[]> {
  const supabase = db();
  let query = supabase.from("products").select("*").order("display_order", { ascending: true });
  if (!includeInactive) query = query.eq("active", true);
  const { data: products, error } = await query;
  if (error) throw new Error(error.message);
  return attachPhotosAndVariants(supabase, (products ?? []) as Product[], includeInactive);
}

export async function getProduct(id: string): Promise<ProductWithVariants | null> {
  const supabase = db();
  const { data: product, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!product) return null;

  const [result] = await attachPhotosAndVariants(supabase, [product as Product], true);
  return result;
}

export async function createProduct(input: {
  name: string;
  description: string | null;
  priceCents: number;
  inventoryCount?: number;
  displayOrder?: number;
}): Promise<string> {
  const supabase = db();
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: input.name,
      description: input.description,
      price_cents: input.priceCents,
      inventory_count: input.inventoryCount ?? 0,
      display_order: input.displayOrder ?? 0
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateProduct(
  id: string,
  patch: Partial<{ name: string; description: string | null; priceCents: number; inventoryCount: number; active: boolean; displayOrder: number }>
): Promise<void> {
  const supabase = db();
  const columnPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) columnPatch.name = patch.name;
  if (patch.description !== undefined) columnPatch.description = patch.description;
  if (patch.priceCents !== undefined) columnPatch.price_cents = patch.priceCents;
  if (patch.inventoryCount !== undefined) columnPatch.inventory_count = patch.inventoryCount;
  if (patch.active !== undefined) columnPatch.active = patch.active;
  if (patch.displayOrder !== undefined) columnPatch.display_order = patch.displayOrder;

  const { error } = await supabase.from("products").update(columnPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await db().from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Le produit actuellement marqué comme cadeau des premiers clients (s'il y en a un). */
export async function getSignupBonusProduct(): Promise<Product | null> {
  const { data, error } = await db().from("products").select("*").eq("is_signup_bonus", true).eq("active", true).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Product | null;
}

/** Première photo d'un produit (par ordre d'affichage), pour les aperçus
 *  hors de la boutique (ex. offre de lancement dans le tunnel d'inscription). */
export async function getFirstProductPhoto(productId: string): Promise<string | null> {
  const { data, error } = await db()
    .from("product_photos")
    .select("url")
    .eq("product_id", productId)
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.url as string | undefined) ?? null;
}

/** Un seul produit à la fois peut porter ce drapeau — on retire l'ancien avant de poser le nouveau. */
export async function setSignupBonusProduct(productId: string | null): Promise<void> {
  const supabase = db();
  const { error: clearErr } = await supabase.from("products").update({ is_signup_bonus: false }).eq("is_signup_bonus", true);
  if (clearErr) throw new Error(clearErr.message);
  if (productId) {
    const { error } = await supabase.from("products").update({ is_signup_bonus: true }).eq("id", productId);
    if (error) throw new Error(error.message);
  }
}

export type UniformBundleRole = "jersey" | "short" | "socks";

/** Les 3 produits de l'offre "2e uniforme" (s'ils sont tous configurés). */
export async function getUniformBundleProducts(): Promise<Record<UniformBundleRole, ProductWithVariants | null>> {
  const products = await getProducts(false);
  const byRole: Record<UniformBundleRole, ProductWithVariants | null> = { jersey: null, short: null, socks: null };
  for (const p of products) {
    if (p.uniform_bundle_role) byRole[p.uniform_bundle_role] = p;
  }
  return byRole;
}

/** Un seul produit à la fois peut porter un rôle donné — on retire l'ancien titulaire avant de poser le nouveau. */
export async function setUniformBundleRole(productId: string, role: UniformBundleRole | null): Promise<void> {
  const supabase = db();
  if (role) {
    const { error: clearErr } = await supabase.from("products").update({ uniform_bundle_role: null }).eq("uniform_bundle_role", role);
    if (clearErr) throw new Error(clearErr.message);
  }
  const { error } = await supabase.from("products").update({ uniform_bundle_role: role }).eq("id", productId);
  if (error) throw new Error(error.message);
}

const PRODUCT_PHOTO_BUCKET = "product-photos";

export async function addProductPhoto(productId: string, file: File): Promise<ProductPhoto> {
  const supabase = getSupabaseAdminClient() as any;
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${productId}-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from(PRODUCT_PHOTO_BUCKET).getPublicUrl(path);
  const publicUrl = publicUrlData.publicUrl as string;

  const { count } = await supabase.from("product_photos").select("id", { count: "exact", head: true }).eq("product_id", productId);

  const { data, error } = await supabase
    .from("product_photos")
    .insert({ product_id: productId, url: publicUrl, display_order: count ?? 0 })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return data as ProductPhoto;
}

export async function deleteProductPhoto(photoId: string): Promise<void> {
  const { error } = await db().from("product_photos").delete().eq("id", photoId);
  if (error) throw new Error(error.message);
}

/* ── Variantes ─────────────────────────────────────────────────── */

export async function createVariant(
  productId: string,
  input: { label: string; size: string | null; color: string | null; sku: string | null; inventoryCount: number; displayOrder?: number }
): Promise<string> {
  const { data, error } = await db()
    .from("product_variants")
    .insert({
      product_id: productId,
      label: input.label,
      size: input.size,
      color: input.color,
      sku: input.sku,
      inventory_count: input.inventoryCount,
      display_order: input.displayOrder ?? 0
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateVariant(
  id: string,
  patch: Partial<{ label: string; size: string | null; color: string | null; sku: string | null; inventoryCount: number; active: boolean; displayOrder: number }>
): Promise<void> {
  const columnPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.label !== undefined) columnPatch.label = patch.label;
  if (patch.size !== undefined) columnPatch.size = patch.size;
  if (patch.color !== undefined) columnPatch.color = patch.color;
  if (patch.sku !== undefined) columnPatch.sku = patch.sku;
  if (patch.inventoryCount !== undefined) columnPatch.inventory_count = patch.inventoryCount;
  if (patch.active !== undefined) columnPatch.active = patch.active;
  if (patch.displayOrder !== undefined) columnPatch.display_order = patch.displayOrder;

  const { error } = await db().from("product_variants").update(columnPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteVariant(id: string): Promise<void> {
  const { error } = await db().from("product_variants").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ── Commandes ─────────────────────────────────────────────────── */

export interface CreateOrderItemInput {
  productId: string;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  unitPriceCents: number;
  quantity: number;
}

export async function createOrder(input: {
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  items: CreateOrderItemInput[];
}): Promise<{ orderId: string; totalCents: number }> {
  const supabase = db();
  const totalCents = input.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);

  const { data: order, error } = await supabase
    .from("shop_orders")
    .insert({
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone,
      shipping_address: input.shippingAddress,
      shipping_city: input.shippingCity,
      shipping_postal_code: input.shippingPostalCode,
      status: "pending",
      total_cents: totalCents
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const orderId = order.id as string;

  const { error: itemsErr } = await supabase.from("shop_order_items").insert(
    input.items.map((item) => ({
      order_id: orderId,
      product_id: item.productId,
      variant_id: item.variantId,
      product_name: item.productName,
      variant_label: item.variantLabel,
      unit_price_cents: item.unitPriceCents,
      quantity: item.quantity
    }))
  );
  if (itemsErr) throw new Error(itemsErr.message);

  return { orderId, totalCents };
}

export async function setOrderCheckoutSession(id: string, checkoutSessionId: string): Promise<void> {
  const { error } = await db()
    .from("shop_orders")
    .update({ stripe_checkout_session_id: checkoutSessionId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function cancelOrder(id: string): Promise<void> {
  const { error } = await db().from("shop_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Suppression définitive (pas un simple statut "cancelled") — les articles
 *  liés (shop_order_items) sont supprimés en cascade côté base de données. */
export async function deleteOrder(id: string): Promise<void> {
  const { error } = await db().from("shop_orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getOrders(): Promise<ShopOrderWithItems[]> {
  const supabase = db();
  const { data: orders, error } = await supabase.from("shop_orders").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map((o: { id: string }) => o.id);
  const { data: items, error: itemsErr } = await supabase.from("shop_order_items").select("*").in("order_id", orderIds);
  if (itemsErr) throw new Error(itemsErr.message);

  const itemsByOrder = new Map<string, ShopOrderItem[]>();
  for (const item of items ?? []) {
    const list = itemsByOrder.get(item.order_id as string) ?? [];
    list.push(item as ShopOrderItem);
    itemsByOrder.set(item.order_id as string, list);
  }

  return orders.map((o: ShopOrder) => ({ ...o, items: itemsByOrder.get(o.id) ?? [] }));
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await db().from("shop_orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markOrderPaidByCheckoutSession(
  checkoutSessionId: string,
  paymentIntentId: string | undefined
): Promise<ShopOrderWithItems | null> {
  const supabase = db();
  const { data: order, error } = await supabase
    .from("shop_orders")
    .update({ status: "paid", stripe_payment_intent_id: paymentIntentId ?? null, updated_at: new Date().toISOString() })
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return null;

  const { data: items, error: itemsErr } = await supabase.from("shop_order_items").select("*").eq("order_id", order.id);
  if (itemsErr) throw new Error(itemsErr.message);

  for (const item of items ?? []) {
    if (item.variant_id) {
      await decrementVariantInventory(item.variant_id as string, item.quantity as number);
    } else if (item.product_id) {
      await decrementProductInventory(item.product_id as string, item.quantity as number);
    }
  }

  return { ...order, items: (items ?? []) as ShopOrderItem[] };
}

export async function decrementVariantInventory(variantId: string, quantity: number): Promise<void> {
  const supabase = db();
  const { data: variant, error } = await supabase.from("product_variants").select("inventory_count").eq("id", variantId).maybeSingle();
  if (error || !variant) return;
  const newCount = Math.max(0, (variant.inventory_count as number) - quantity);
  await supabase.from("product_variants").update({ inventory_count: newCount, updated_at: new Date().toISOString() }).eq("id", variantId);
}

export async function decrementProductInventory(productId: string, quantity: number): Promise<void> {
  const supabase = db();
  const { data: product, error } = await supabase.from("products").select("inventory_count").eq("id", productId).maybeSingle();
  if (error || !product) return;
  const newCount = Math.max(0, (product.inventory_count as number) - quantity);
  await supabase.from("products").update({ inventory_count: newCount, updated_at: new Date().toISOString() }).eq("id", productId);
}

/* ── Uniformes — distribution ──────────────────────────────────────
 *  Construit par-dessus les commandes boutique existantes (une seule
 *  source d'information — voir la fiche jointe). Ne touche jamais au
 *  statut de paiement (`status`), seulement au cycle de distribution. */

export interface RegistrationSummary {
  id: string;
  playerFirstName: string | null;
  playerLastName: string | null;
  categoryId: string | null;
  advancedGroup: boolean;
  parentName: string;
  parentPhone: string;
  seasonId: string;
}

export interface OrderWithDistribution extends ShopOrderWithItems {
  registration: RegistrationSummary | null;
  openProblemCount: number;
}

async function attachDistributionInfo(supabase: any, orders: ShopOrderWithItems[]): Promise<OrderWithDistribution[]> {
  if (orders.length === 0) return [];
  const orderIds = orders.map((o) => o.id);
  const registrationIds = Array.from(new Set(orders.map((o) => o.registration_id).filter((id): id is string => Boolean(id))));

  const [regResult, problemResult] = await Promise.all([
    registrationIds.length > 0
      ? supabase.from("registrations").select("id, player_first_name, player_last_name, category_id, advanced_group, parent_name, parent_phone, season_id").in("id", registrationIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("shop_order_problems").select("order_id").in("order_id", orderIds).eq("status", "ouvert")
  ]);
  if (regResult.error) throw new Error(regResult.error.message);
  if (problemResult.error) throw new Error(problemResult.error.message);

  const regById = new Map<string, RegistrationSummary>(
    (regResult.data ?? []).map((r: any) => [
      r.id,
      {
        id: r.id,
        playerFirstName: r.player_first_name,
        playerLastName: r.player_last_name,
        categoryId: r.category_id,
        advancedGroup: r.advanced_group,
        parentName: r.parent_name,
        parentPhone: r.parent_phone,
        seasonId: r.season_id
      }
    ])
  );

  const openProblemCountByOrder = new Map<string, number>();
  for (const p of problemResult.data ?? []) {
    openProblemCountByOrder.set(p.order_id, (openProblemCountByOrder.get(p.order_id) ?? 0) + 1);
  }

  return orders.map((o) => ({
    ...o,
    registration: o.registration_id ? regById.get(o.registration_id) ?? null : null,
    openProblemCount: openProblemCountByOrder.get(o.id) ?? 0
  }));
}

/** Commandes payées à distribuer (tout ce qui n'est pas encore "remis"),
 *  triées par priorité : problèmes ouverts d'abord, puis prêtes à remettre,
 *  puis les plus anciennes en premier. */
export async function getOrdersToDistribute(seasonKey?: string): Promise<OrderWithDistribution[]> {
  const supabase = db();
  let query = supabase.from("shop_orders").select("*").eq("status", "paid").neq("distribution_status", "remis").order("created_at", { ascending: true });
  if (seasonKey) query = query.eq("season_key", seasonKey);
  const { data: orders, error } = await query;
  if (error) throw new Error(error.message);
  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map((o: { id: string }) => o.id);
  const { data: items, error: itemsErr } = await supabase.from("shop_order_items").select("*").in("order_id", orderIds);
  if (itemsErr) throw new Error(itemsErr.message);
  const itemsByOrder = new Map<string, ShopOrderItem[]>();
  for (const item of items ?? []) {
    const list = itemsByOrder.get(item.order_id as string) ?? [];
    list.push(item as ShopOrderItem);
    itemsByOrder.set(item.order_id as string, list);
  }

  const withItems = orders.map((o: ShopOrder) => ({ ...o, items: itemsByOrder.get(o.id) ?? [] }));
  const withInfo = await attachDistributionInfo(supabase, withItems);

  const priority = (o: OrderWithDistribution) => {
    if (o.openProblemCount > 0) return 0;
    if (o.distribution_status === "pret_a_remettre") return 1;
    if (o.distribution_status === "partiellement_remis") return 2;
    return 3;
  };
  return withInfo.sort((a, b) => priority(a) - priority(b) || a.created_at.localeCompare(b.created_at));
}

/** Toutes les commandes uniformes (payées) d'une saison, avec infos
 *  joueuse/parent et problèmes — pour le tableau de bord et la recherche. */
export async function getSeasonOrders(seasonKey: string): Promise<OrderWithDistribution[]> {
  const supabase = db();
  const { data: orders, error } = await supabase.from("shop_orders").select("*").eq("status", "paid").eq("season_key", seasonKey).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map((o: { id: string }) => o.id);
  const { data: items, error: itemsErr } = await supabase.from("shop_order_items").select("*").in("order_id", orderIds);
  if (itemsErr) throw new Error(itemsErr.message);
  const itemsByOrder = new Map<string, ShopOrderItem[]>();
  for (const item of items ?? []) {
    const list = itemsByOrder.get(item.order_id as string) ?? [];
    list.push(item as ShopOrderItem);
    itemsByOrder.set(item.order_id as string, list);
  }

  const withItems = orders.map((o: ShopOrder) => ({ ...o, items: itemsByOrder.get(o.id) ?? [] }));
  return attachDistributionInfo(supabase, withItems);
}

/** Commandes payées jamais classées par saison — à trier avant qu'elles
 *  n'apparaissent dans un tableau de bord de saison. */
export async function getUnassignedOrders(): Promise<OrderWithDistribution[]> {
  const supabase = db();
  const { data: orders, error } = await supabase.from("shop_orders").select("*").eq("status", "paid").is("season_key", null).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map((o: { id: string }) => o.id);
  const { data: items, error: itemsErr } = await supabase.from("shop_order_items").select("*").in("order_id", orderIds);
  if (itemsErr) throw new Error(itemsErr.message);
  const itemsByOrder = new Map<string, ShopOrderItem[]>();
  for (const item of items ?? []) {
    const list = itemsByOrder.get(item.order_id as string) ?? [];
    list.push(item as ShopOrderItem);
    itemsByOrder.set(item.order_id as string, list);
  }

  const withItems = orders.map((o: ShopOrder) => ({ ...o, items: itemsByOrder.get(o.id) ?? [] }));
  return attachDistributionInfo(supabase, withItems);
}

export async function getOrderDetail(id: string): Promise<OrderWithDistribution | null> {
  const supabase = db();
  const { data: order, error } = await supabase.from("shop_orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return null;

  const { data: items, error: itemsErr } = await supabase.from("shop_order_items").select("*").eq("order_id", id);
  if (itemsErr) throw new Error(itemsErr.message);

  const [withInfo] = await attachDistributionInfo(supabase, [{ ...order, items: (items ?? []) as ShopOrderItem[] }]);
  return withInfo;
}

/** Distinctes des saisons de `registrations` — une commande boutique peut
 *  avoir sa propre saison sans être reliée à une joueuse. */
export async function getUsedSeasonKeys(): Promise<string[]> {
  const { data, error } = await db().from("shop_orders").select("season_key").eq("status", "paid").not("season_key", "is", null);
  if (error) throw new Error(error.message);
  const keys = new Set<string>((data ?? []).map((r: any) => r.season_key as string));
  return Array.from(keys).sort();
}

async function logOrderEvent(orderId: string, event: string, detail: string | null, performedBy: string | null): Promise<void> {
  const { error } = await db().from("shop_order_events").insert({ order_id: orderId, event, detail, performed_by: performedBy });
  if (error) throw new Error(error.message);
}

export async function getOrderEvents(orderId: string): Promise<ShopOrderEvent[]> {
  const { data, error } = await db().from("shop_order_events").select("*").eq("order_id", orderId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ShopOrderEvent[];
}

export async function linkOrderToRegistration(orderId: string, registrationId: string): Promise<void> {
  const supabase = db();
  const { data: reg, error: regErr } = await supabase.from("registrations").select("season_id, player_first_name, player_last_name").eq("id", registrationId).maybeSingle();
  if (regErr) throw new Error(regErr.message);
  if (!reg) throw new Error("Joueuse introuvable");

  const { error } = await supabase
    .from("shop_orders")
    .update({ registration_id: registrationId, season_key: reg.season_id, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw new Error(error.message);

  await logOrderEvent(orderId, "joueuse_liee", `${reg.player_first_name ?? ""} ${reg.player_last_name ?? ""}`.trim(), null);
}

export async function unlinkOrderFromRegistration(orderId: string): Promise<void> {
  const { error } = await db().from("shop_orders").update({ registration_id: null, updated_at: new Date().toISOString() }).eq("id", orderId);
  if (error) throw new Error(error.message);
  await logOrderEvent(orderId, "joueuse_deliee", null, null);
}

export async function setOrderSeasonKey(orderId: string, seasonKey: string): Promise<void> {
  const { error } = await db().from("shop_orders").update({ season_key: seasonKey, updated_at: new Date().toISOString() }).eq("id", orderId);
  if (error) throw new Error(error.message);
}

export async function setOrderNotes(orderId: string, notes: string): Promise<void> {
  const { error } = await db().from("shop_orders").update({ notes, updated_at: new Date().toISOString() }).eq("id", orderId);
  if (error) throw new Error(error.message);
}

export async function updateDistributionStatus(orderId: string, status: DistributionStatus): Promise<void> {
  const { error } = await db().from("shop_orders").update({ distribution_status: status, updated_at: new Date().toISOString() }).eq("id", orderId);
  if (error) throw new Error(error.message);
  await logOrderEvent(orderId, "statut_change", DISTRIBUTION_STATUS_LABELS[status], null);
}

/** Confirme la remise (totale ou partielle) d'une commande — enregistre la
 *  quantité remise par article, recalcule automatiquement le statut de
 *  distribution ("remis" si tout est remis, sinon "partiellement_remis"),
 *  et laisse une trace dans l'historique (qui, quand, quoi). */
export async function recordDelivery(
  orderId: string,
  deliveries: { itemId: string; deliveredQuantity: number }[],
  deliveredBy: string,
  parentConfirmed: boolean
): Promise<void> {
  const supabase = db();

  for (const d of deliveries) {
    const { error } = await supabase.from("shop_order_items").update({ delivered_quantity: d.deliveredQuantity }).eq("id", d.itemId);
    if (error) throw new Error(error.message);
  }

  const { data: items, error: itemsErr } = await supabase.from("shop_order_items").select("quantity, delivered_quantity, product_name, variant_label").eq("order_id", orderId);
  if (itemsErr) throw new Error(itemsErr.message);

  const allDelivered = (items ?? []).every((i: any) => i.delivered_quantity >= i.quantity);
  const anyDelivered = (items ?? []).some((i: any) => i.delivered_quantity > 0);
  const newStatus: DistributionStatus = allDelivered ? "remis" : anyDelivered ? "partiellement_remis" : "recu";

  const { error } = await supabase.from("shop_orders").update({ distribution_status: newStatus, updated_at: new Date().toISOString() }).eq("id", orderId);
  if (error) throw new Error(error.message);

  const summary = (items ?? [])
    .map((i: any) => `${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ""} : ${i.delivered_quantity}/${i.quantity}`)
    .join(", ");
  await logOrderEvent(
    orderId,
    allDelivered ? "remis" : "remis_partiel",
    `${summary}${parentConfirmed ? " · Parent a confirmé la réception" : ""}`,
    deliveredBy
  );
}

export async function addOrderProblem(orderId: string, problemType: ProblemType, description: string | null): Promise<void> {
  const { error } = await db().from("shop_order_problems").insert({ order_id: orderId, problem_type: problemType, description });
  if (error) throw new Error(error.message);
  await logOrderEvent(orderId, "probleme_signale", `${PROBLEM_TYPE_LABELS[problemType]}${description ? ` — ${description}` : ""}`, null);
}

export async function resolveOrderProblem(problemId: string): Promise<void> {
  const supabase = db();
  const { data: problem, error: fetchErr } = await supabase.from("shop_order_problems").select("order_id, problem_type").eq("id", problemId).maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);

  const { error } = await supabase.from("shop_order_problems").update({ status: "resolu", resolved_at: new Date().toISOString() }).eq("id", problemId);
  if (error) throw new Error(error.message);

  if (problem) await logOrderEvent(problem.order_id as string, "probleme_resolu", PROBLEM_TYPE_LABELS[problem.problem_type as ProblemType], null);
}

/** Tous les problèmes (ouverts et résolus) d'une commande — pour la fiche
 *  de commande, qui doit garder l'historique complet. */
export async function getOrderProblems(orderId: string): Promise<ShopOrderProblem[]> {
  const { data, error } = await db().from("shop_order_problems").select("*").eq("order_id", orderId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ShopOrderProblem[];
}

export interface ProblemWithOrder extends ShopOrderProblem {
  order: { id: string; customer_name: string; season_key: string | null };
}

export async function getOpenProblems(seasonKey?: string): Promise<ProblemWithOrder[]> {
  const supabase = db();
  const { data: problems, error } = await supabase.from("shop_order_problems").select("*").eq("status", "ouvert").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!problems || problems.length === 0) return [];

  const orderIds = Array.from(new Set(problems.map((p: any) => p.order_id)));
  const { data: orders, error: ordersErr } = await supabase.from("shop_orders").select("id, customer_name, season_key").in("id", orderIds);
  if (ordersErr) throw new Error(ordersErr.message);
  const orderById = new Map((orders ?? []).map((o: any) => [o.id, o]));

  return (problems as ShopOrderProblem[])
    .map((p) => ({ ...p, order: orderById.get(p.order_id) as { id: string; customer_name: string; season_key: string | null } }))
    .filter((p) => p.order && (!seasonKey || p.order.season_key === seasonKey));
}

export interface UniformStats {
  totalOrders: number;
  distributed: number;
  toDistribute: number;
  incomplete: number;
  problems: number;
  totalItems: number;
  distributedItems: number;
}

export async function getUniformStats(seasonKey: string): Promise<UniformStats> {
  const orders = await getSeasonOrders(seasonKey);
  const totalItems = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
  const distributedItems = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.delivered_quantity, 0), 0);
  return {
    totalOrders: orders.length,
    distributed: orders.filter((o) => o.distribution_status === "remis").length,
    toDistribute: orders.filter((o) => o.distribution_status !== "remis").length,
    incomplete: orders.filter((o) => o.distribution_status === "partiellement_remis").length,
    problems: orders.reduce((sum, o) => sum + o.openProblemCount, 0),
    totalItems,
    distributedItems
  };
}
