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
