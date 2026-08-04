"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { Container } from "@/components/container";
import type { ProductWithVariants } from "@/lib/shop-repo";

interface CartItem {
  productId: string;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  unitPriceCents: number;
  quantity: number;
  photoUrl: string | null;
  maxQuantity: number;
}

const CART_KEY = "nv_shop_cart";

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

function cartItemKey(productId: string, variantId: string | null) {
  return `${productId}::${variantId ?? ""}`;
}

/** Miroir de la logique serveur (/api/boutique/commande) — pour que le total
 *  affiché avant paiement corresponde exactement à ce que Stripe facturera. */
function computeCartTotal(cart: CartItem[], bundle: { jerseyId: string; shortId: string; socksId: string } | null): { totalCents: number; freeSocksCount: number } {
  if (!bundle) return { totalCents: cart.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0), freeSocksCount: 0 };

  const qtyFor = (id: string) => cart.filter((i) => i.productId === id).reduce((sum, i) => sum + i.quantity, 0);
  const freeSocksCount = Math.min(qtyFor(bundle.jerseyId), qtyFor(bundle.shortId), qtyFor(bundle.socksId));

  let totalCents = 0;
  let freeRemaining = freeSocksCount;
  for (const item of cart) {
    if (item.productId === bundle.socksId && freeRemaining > 0) {
      const freeQty = Math.min(freeRemaining, item.quantity);
      freeRemaining -= freeQty;
      totalCents += (item.quantity - freeQty) * item.unitPriceCents;
    } else {
      totalCents += item.quantity * item.unitPriceCents;
    }
  }
  return { totalCents, freeSocksCount };
}

export function BoutiqueContent({ initialProducts }: { initialProducts: ProductWithVariants[] }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Record<string, string>>({});
  const [activePhoto, setActivePhoto] = useState<Record<string, number>>({});
  const [showCheckout, setShowCheckout] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", city: "", postal: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bundleJersey = initialProducts.find((p) => p.uniform_bundle_role === "jersey") ?? null;
  const bundleShort = initialProducts.find((p) => p.uniform_bundle_role === "short") ?? null;
  const bundleSocks = initialProducts.find((p) => p.uniform_bundle_role === "socks") ?? null;
  const bundleActive = Boolean(bundleJersey && bundleShort && bundleSocks);
  const bundleIds = bundleActive ? { jerseyId: bundleJersey!.id, shortId: bundleShort!.id, socksId: bundleSocks!.id } : null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setCart(JSON.parse(raw));
    } catch {
      /* panier corrompu — on repart d'un panier vide */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product: ProductWithVariants, variantId: string | null) => {
    const variant = variantId ? product.variants.find((v) => v.id === variantId) : undefined;
    const maxQuantity = variant ? variant.inventory_count : product.inventory_count;
    if (maxQuantity <= 0) return;

    setCart((prev) => {
      const key = cartItemKey(product.id, variantId);
      const existing = prev.find((i) => cartItemKey(i.productId, i.variantId) === key);
      if (existing) {
        if (existing.quantity >= maxQuantity) return prev;
        return prev.map((i) => (cartItemKey(i.productId, i.variantId) === key ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          productId: product.id,
          variantId,
          productName: product.name,
          variantLabel: variant?.label ?? null,
          unitPriceCents: product.price_cents,
          quantity: 1,
          photoUrl: product.photos[0]?.url ?? null,
          maxQuantity
        }
      ];
    });
  };

  const updateQuantity = (productId: string, variantId: string | null, quantity: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId && i.variantId === variantId ? { ...i, quantity: Math.max(1, Math.min(quantity, i.maxQuantity)) } : i))
    );
  };

  const removeFromCart = (productId: string, variantId: string | null) => {
    setCart((prev) => prev.filter((i) => !(i.productId === productId && i.variantId === variantId)));
  };

  const decrementInCart = (productId: string, variantId: string | null) => {
    setCart((prev) => {
      const key = cartItemKey(productId, variantId);
      const existing = prev.find((i) => cartItemKey(i.productId, i.variantId) === key);
      if (!existing) return prev;
      if (existing.quantity <= 1) return prev.filter((i) => cartItemKey(i.productId, i.variantId) !== key);
      return prev.map((i) => (cartItemKey(i.productId, i.variantId) === key ? { ...i, quantity: i.quantity - 1 } : i));
    });
  };

  const cartQuantityFor = (productId: string, variantId: string | null) =>
    cart.find((i) => i.productId === productId && i.variantId === variantId)?.quantity ?? 0;

  const { totalCents, freeSocksCount } = computeCartTotal(cart, bundleIds);

  const handleCheckout = async () => {
    if (!form.name || !form.email) {
      setError("Nom et courriel requis.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/boutique/commande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.name,
          customerEmail: form.email,
          customerPhone: form.phone || undefined,
          shippingAddress: form.address || undefined,
          shippingCity: form.city || undefined,
          shippingPostalCode: form.postal || undefined,
          items: cart.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }))
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Une erreur est survenue.");
      localStorage.removeItem(CART_KEY);
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="insc-hero">
        <Container>
          <div className="insc-hero-inner">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Boutique</p>
            <h1 className="insc-hero-title">Boutique New Valkyria</h1>
            <p className="insc-hero-sub">Vêtements et accessoires de l&apos;académie — commandez en ligne, on s&apos;occupe du reste.</p>
          </div>
        </Container>
      </section>

      <section className="section-band band-dark">
        <Container>
          {initialProducts.length === 0 ? (
            <p className="nv27-empty">Aucun produit disponible pour l&apos;instant — revenez bientôt.</p>
          ) : (
            <div className="shop-grid">
              {initialProducts.map((product) => {
                const hasVariants = product.variants.length > 0;
                const activeVariants = product.variants.filter((v) => v.active);
                const currentVariantId = selectedVariant[product.id] ?? activeVariants[0]?.id ?? null;
                const currentVariant = activeVariants.find((v) => v.id === currentVariantId);
                const outOfStock = hasVariants ? !currentVariant || currentVariant.inventory_count <= 0 : product.inventory_count <= 0;
                const fullyOutOfStock = hasVariants
                  ? activeVariants.length === 0 || activeVariants.every((v) => v.inventory_count <= 0)
                  : product.inventory_count <= 0;
                const photoIndex = Math.min(activePhoto[product.id] ?? 0, Math.max(product.photos.length - 1, 0));
                const mainPhoto = product.photos[photoIndex];
                const cartQty = cartQuantityFor(product.id, currentVariantId);
                const maxQty = currentVariant ? currentVariant.inventory_count : product.inventory_count;

                return (
                  <div key={product.id} className="shop-card">
                    <div className="shop-card-photo" data-soldout={fullyOutOfStock}>
                      {fullyOutOfStock && <span className="shop-card-badge">Rupture de stock</span>}
                      {mainPhoto ? (
                        <Image src={mainPhoto.url} alt={product.name} fill sizes="(max-width: 640px) 100vw, 33vw" style={{ objectFit: "cover" }} />
                      ) : (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#3c3a41", fontSize: "0.8rem" }}>
                          Photo à venir
                        </div>
                      )}
                    </div>
                    {product.photos.length > 1 && (
                      <div style={{ display: "flex", gap: "0.4rem", padding: "0.6rem 1.1rem 0" }}>
                        {product.photos.map((photo, i) => (
                          <button
                            key={photo.id}
                            type="button"
                            onClick={() => setActivePhoto((prev) => ({ ...prev, [product.id]: i }))}
                            style={{
                              position: "relative", width: "2.6rem", height: "2.6rem", borderRadius: "6px", overflow: "hidden",
                              border: photoIndex === i ? "2px solid #b78ee0" : "1px solid rgba(255,255,255,0.12)", background: "#1a1820", padding: 0, cursor: "pointer"
                            }}
                          >
                            <Image src={photo.url} alt="" fill sizes="2.6rem" style={{ objectFit: "cover" }} />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="shop-card-body">
                      <div>
                        <p className="shop-card-name">{product.name}</p>
                        <p className="shop-card-price">{formatPrice(product.price_cents)}</p>
                      </div>
                      <p className="shop-card-desc">{product.description}</p>

                      {hasVariants && (
                        <select
                          className="shop-size-select"
                          value={currentVariantId ?? ""}
                          onChange={(e) => setSelectedVariant((prev) => ({ ...prev, [product.id]: e.target.value }))}
                        >
                          {activeVariants.map((v) => (
                            <option key={v.id} value={v.id} disabled={v.inventory_count <= 0}>
                              {v.label}{v.inventory_count <= 0 ? " — épuisé" : ""}
                            </option>
                          ))}
                        </select>
                      )}

                      {cartQty > 0 ? (
                        <div className="shop-qty-stepper">
                          <button type="button" className="shop-qty-btn" onClick={() => decrementInCart(product.id, currentVariantId)} aria-label="Retirer un exemplaire">−</button>
                          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff" }}>{cartQty} au panier</span>
                          <button
                            type="button"
                            className="shop-qty-btn"
                            onClick={() => addToCart(product, currentVariantId)}
                            disabled={cartQty >= maxQty}
                            aria-label="Ajouter un exemplaire"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="shop-add-btn"
                          disabled={outOfStock}
                          onClick={() => addToCart(product, currentVariantId)}
                        >
                          {outOfStock ? "Rupture de stock" : "Ajouter au panier"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {cart.length > 0 && (
            <div className="nv27-step" id="panier">
              <p className="nv27-step-kicker">Panier</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.25rem" }}>
                {cart.map((item) => (
                  <div key={cartItemKey(item.productId, item.variantId)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.7rem 1rem" }}>
                    <div>
                      <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", margin: 0 }}>
                        {item.productName}{item.variantLabel ? ` — ${item.variantLabel}` : ""}
                      </p>
                      <p style={{ fontSize: "0.75rem", color: "#9f85ba", margin: "2px 0 0" }}>{formatPrice(item.unitPriceCents)} chacun</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input
                        type="number"
                        min={1}
                        max={item.maxQuantity === Infinity ? undefined : item.maxQuantity}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.productId, item.variantId, parseInt(e.target.value, 10) || 1)}
                        style={{ width: "3.4rem", padding: "0.3rem", fontSize: "0.8rem", background: "#17151e", border: "1px solid #302e36", borderRadius: "4px", color: "#fff", textAlign: "center" }}
                      />
                      <button type="button" onClick={() => removeFromCart(item.productId, item.variantId)} style={{ background: "none", border: "none", color: "rgba(255,100,100,0.6)", cursor: "pointer", fontSize: "0.78rem" }}>
                        Retirer
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="nv27-pay-summary">
                {freeSocksCount > 0 && bundleSocks && (
                  <div className="nv27-pay-row">
                    <span>🎁 {bundleSocks.name} offert{freeSocksCount > 1 ? "s" : ""} (2e uniforme)</span>
                    <span>−{formatPrice(bundleSocks.price_cents * freeSocksCount)}</span>
                  </div>
                )}
                <div className="nv27-pay-total"><span>Total</span><span>{formatPrice(totalCents)}</span></div>
              </div>

              {!showCheckout ? (
                <button type="button" className="nv27-btn-primary nv27-btn-pay" onClick={() => setShowCheckout(true)}>
                  Passer à la commande →
                </button>
              ) : (
                <div className="nv27-form-fields" style={{ marginTop: "1rem" }}>
                  {error && <p className="nv27-pay-error">{error}</p>}
                  <div className="nv27-grid2">
                    <label className="insc-field">
                      <span>Nom complet</span>
                      <input className="insc-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                    </label>
                    <label className="insc-field">
                      <span>Courriel</span>
                      <input type="email" className="insc-input" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                    </label>
                  </div>
                  <div className="nv27-grid2">
                    <label className="insc-field">
                      <span>Téléphone (facultatif)</span>
                      <input className="insc-input" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                    </label>
                    <label className="insc-field">
                      <span>Adresse (facultatif)</span>
                      <input className="insc-input" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
                    </label>
                  </div>
                  <div className="nv27-grid2">
                    <label className="insc-field">
                      <span>Ville</span>
                      <input className="insc-input" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
                    </label>
                    <label className="insc-field">
                      <span>Code postal</span>
                      <input className="insc-input" value={form.postal} onChange={(e) => setForm((p) => ({ ...p, postal: e.target.value }))} />
                    </label>
                  </div>
                  <button type="button" className="nv27-btn-primary nv27-btn-pay" disabled={submitting} onClick={handleCheckout}>
                    {submitting ? "Redirection vers le paiement…" : `Payer ${formatPrice(totalCents)} →`}
                  </button>
                </div>
              )}
            </div>
          )}
        </Container>
      </section>

      {cart.length > 0 && (
        <div className="shop-cart-bar">
          <Container>
            <button
              type="button"
              className="shop-cart-bar-inner"
              onClick={() => document.getElementById("panier")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <span className="shop-cart-bar-count">
                🛒 {cart.reduce((sum, i) => sum + i.quantity, 0)} article{cart.reduce((sum, i) => sum + i.quantity, 0) > 1 ? "s" : ""}
              </span>
              <span className="shop-cart-bar-total">{formatPrice(totalCents)}</span>
              <span className="shop-cart-bar-cta">Voir mon panier →</span>
            </button>
          </Container>
        </div>
      )}
    </>
  );
}
