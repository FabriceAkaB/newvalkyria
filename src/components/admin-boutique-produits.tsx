"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { ProductWithVariants } from "@/lib/shop-repo";

interface VariantFormState {
  label: string;
  size: string;
  color: string;
  sku: string;
  inventoryCount: string;
}

const EMPTY_VARIANT_FORM: VariantFormState = { label: "", size: "", color: "", sku: "", inventoryCount: "0" };

interface ProductFormState {
  name: string;
  description: string;
  priceCents: string;
  inventoryCount: string;
}

const EMPTY_PRODUCT_FORM: ProductFormState = { name: "", description: "", priceCents: "", inventoryCount: "0" };

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

export function AdminBoutiqueProduits({ initialProducts }: { initialProducts: ProductWithVariants[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [variantForms, setVariantForms] = useState<Record<string, VariantFormState>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleAddProduct = async () => {
    const priceCents = Math.round(parseFloat(addForm.priceCents) * 100);
    const inventoryCount = Math.max(0, parseInt(addForm.inventoryCount, 10) || 0);
    if (!addForm.name.trim() || !Number.isFinite(priceCents) || priceCents < 0) {
      setError("Nom et prix valides requis.");
      return;
    }
    setBusy("add-product");
    setError(null);
    try {
      const res = await fetch("/api/admin/boutique/produits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addForm.name, description: addForm.description || undefined, priceCents, inventoryCount })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur d'enregistrement");
      setProducts((prev) => [
        ...prev,
        {
          id: data.id,
          name: addForm.name,
          description: addForm.description || null,
          price_cents: priceCents,
          inventory_count: inventoryCount,
          is_signup_bonus: false,
          uniform_bundle_role: null,
          active: true,
          display_order: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          photos: [],
          variants: []
        }
      ]);
      setAddForm(EMPTY_PRODUCT_FORM);
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/boutique/produits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active })
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, active } : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const handleToggleSignupBonus = async (id: string, on: boolean) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/boutique/produits/${id}/cadeau-lancement`, { method: on ? "POST" : "DELETE" });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      setProducts((prev) => prev.map((p) => ({ ...p, is_signup_bonus: p.id === id ? on : false })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const handleSetBundleRole = async (id: string, role: "" | "jersey" | "short" | "socks") => {
    setBusy(id);
    try {
      const res = role
        ? await fetch(`/api/admin/boutique/produits/${id}/bundle-uniforme`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) })
        : await fetch(`/api/admin/boutique/produits/${id}/bundle-uniforme`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id === id) return { ...p, uniform_bundle_role: role || null };
          return role && p.uniform_bundle_role === role ? { ...p, uniform_bundle_role: null } : p;
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const handleProductInventoryChange = async (id: string, inventoryCount: number) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, inventory_count: inventoryCount } : p)));
    try {
      await fetch(`/api/admin/boutique/produits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryCount })
      });
    } catch {
      setError("Erreur de sauvegarde du stock");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Supprimer ce produit et toutes ses variantes ? Action irréversible.")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/boutique/produits/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const handleAddPhoto = async (id: string, file: File | undefined) => {
    if (!file) return;
    setBusy(id);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch(`/api/admin/boutique/produits/${id}/photo`, { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur de téléversement");
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, photos: [...p.photos, data.photo] } : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const handleDeletePhoto = async (productId: string, photoId: string) => {
    setBusy(productId);
    try {
      const res = await fetch(`/api/admin/boutique/produits/${productId}/photo/${photoId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, photos: p.photos.filter((ph) => ph.id !== photoId) } : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const variantFormFor = (productId: string) => variantForms[productId] ?? EMPTY_VARIANT_FORM;
  const setVariantField = (productId: string, field: keyof VariantFormState, value: string) => {
    setVariantForms((prev) => ({ ...prev, [productId]: { ...variantFormFor(productId), [field]: value } }));
  };

  const handleAddVariant = async (productId: string) => {
    const form = variantFormFor(productId);
    const inventoryCount = parseInt(form.inventoryCount, 10) || 0;
    if (!form.label.trim()) {
      setError("L'étiquette de la variante est requise (ex. Petit, Rouge).");
      return;
    }
    setBusy(`variant-${productId}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/boutique/produits/${productId}/variantes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.label,
          size: form.size || undefined,
          color: form.color || undefined,
          sku: form.sku || undefined,
          inventoryCount
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur d'enregistrement");
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                variants: [
                  ...p.variants,
                  { id: data.id, product_id: productId, label: form.label, size: form.size || null, color: form.color || null, sku: form.sku || null, inventory_count: inventoryCount, active: true, display_order: 0 }
                ]
              }
            : p
        )
      );
      setVariantForms((prev) => ({ ...prev, [productId]: EMPTY_VARIANT_FORM }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const handleToggleVariantActive = async (productId: string, variantId: string, active: boolean) => {
    setBusy(variantId);
    try {
      const res = await fetch(`/api/admin/boutique/variantes/${variantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active })
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, variants: p.variants.map((v) => (v.id === variantId ? { ...v, active } : v)) } : p))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const handleVariantInventoryChange = async (productId: string, variantId: string, inventoryCount: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, variants: p.variants.map((v) => (v.id === variantId ? { ...v, inventory_count: inventoryCount } : v)) } : p))
    );
    try {
      await fetch(`/api/admin/boutique/variantes/${variantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryCount })
      });
    } catch {
      setError("Erreur de sauvegarde de l'inventaire");
    }
  };

  const handleDeleteVariant = async (productId: string, variantId: string) => {
    setBusy(variantId);
    try {
      const res = await fetch(`/api/admin/boutique/variantes/${variantId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, variants: p.variants.filter((v) => v.id !== variantId) } : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Produits de la boutique</p>
            <button onClick={() => setShowAddForm((v) => !v)} className="admin-btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.78rem" }}>
              {showAddForm ? "Annuler" : "+ Nouveau produit"}
            </button>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.5rem" }}>
            Photos, prix, stock, variantes (taille/couleur) — tout ce qui est actif s&apos;affiche automatiquement sur la boutique publique.
          </p>

          {error && <p className="admin-error" style={{ marginBottom: "1rem" }}>{error}</p>}

          {showAddForm && (
            <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1.1rem 1.25rem", marginBottom: "1.5rem" }}>
              <div className="nv27-form-fields">
                <label className="admin-field">
                  <span>Nom</span>
                  <input className="admin-input" value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Description</span>
                  <textarea className="admin-input" rows={2} value={addForm.description} onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))} />
                </label>
                <div className="nv27-grid2">
                  <label className="admin-field">
                    <span>Prix (CAD)</span>
                    <input type="number" step="0.01" min="0" className="admin-input" value={addForm.priceCents} onChange={(e) => setAddForm((p) => ({ ...p, priceCents: e.target.value }))} />
                  </label>
                  <label className="admin-field">
                    <span>Stock initial</span>
                    <input type="number" min="0" className="admin-input" value={addForm.inventoryCount} onChange={(e) => setAddForm((p) => ({ ...p, inventoryCount: e.target.value }))} />
                  </label>
                </div>
                <button onClick={handleAddProduct} disabled={busy === "add-product"} className="admin-btn-primary" style={{ alignSelf: "flex-start", padding: "0.5rem 1rem", fontSize: "0.8rem" }}>
                  {busy === "add-product" ? "…" : "Créer le produit"}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {products.length === 0 && <p className="admin-empty-text">Aucun produit pour l&apos;instant.</p>}

            {products.map((product) => {
              const vForm = variantFormFor(product.id);
              const hasVariants = product.variants.length > 0;
              return (
                <div key={product.id} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "12px", padding: "1.1rem 1.25rem", opacity: busy === product.id ? 0.6 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff", margin: 0 }}>{product.name}</p>
                      <p style={{ fontSize: "0.8rem", color: "#9f85ba", margin: "2px 0 0" }}>{formatPrice(product.price_cents)}</p>
                      {product.description && <p style={{ fontSize: "0.72rem", color: "#605f65", margin: "2px 0 0", maxWidth: "26rem" }}>{product.description}</p>}
                      {product.is_signup_bonus && (
                        <span style={{ display: "inline-block", marginTop: "0.4rem", fontSize: "0.62rem", color: "#f0c878", background: "rgba(240,200,120,0.1)", padding: "0.15rem 0.5rem", borderRadius: "4px" }}>
                          🎁 Cadeau des 30 premiers clients
                        </span>
                      )}
                      {product.uniform_bundle_role && (
                        <span style={{ display: "inline-block", marginTop: "0.4rem", marginLeft: "0.4rem", fontSize: "0.62rem", color: "#88c0d0", background: "rgba(136,192,208,0.1)", padding: "0.15rem 0.5rem", borderRadius: "4px" }}>
                          👕 Bundle 2e uniforme — {product.uniform_bundle_role === "jersey" ? "Chandail" : product.uniform_bundle_role === "short" ? "Short" : "Bas"}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", color: "#c3c2c8" }}>
                        <span>Bundle 2e uniforme</span>
                        <select
                          value={product.uniform_bundle_role ?? ""}
                          onChange={(e) => handleSetBundleRole(product.id, e.target.value as "" | "jersey" | "short" | "socks")}
                          style={{ padding: "0.25rem 0.4rem", fontSize: "0.72rem", background: "#17151e", border: "1px solid #302e36", borderRadius: "4px", color: "#fff" }}
                        >
                          <option value="">Aucun</option>
                          <option value="jersey">Chandail</option>
                          <option value="short">Short</option>
                          <option value="socks">Bas</option>
                        </select>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", color: "#c3c2c8", cursor: "pointer" }}>
                        <input type="checkbox" checked={product.is_signup_bonus} onChange={(e) => handleToggleSignupBonus(product.id, e.target.checked)} />
                        Cadeau lancement
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", color: "#c3c2c8", cursor: "pointer" }}>
                        <input type="checkbox" checked={product.active} onChange={(e) => handleToggleActive(product.id, e.target.checked)} />
                        Actif
                      </label>
                      <button onClick={() => handleDeleteProduct(product.id)} className="admin-btn-ghost" style={{ padding: "0.35rem 0.7rem", fontSize: "0.72rem", color: "#f87171" }}>
                        Supprimer
                      </button>
                    </div>
                  </div>

                  {/* ── Galerie de photos ── */}
                  <div style={{ marginTop: "0.85rem" }}>
                    <p style={{ fontSize: "0.68rem", color: "#7a7982", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                      Photos ({product.photos.length})
                    </p>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {product.photos.map((photo) => (
                        <div key={photo.id} style={{ position: "relative", width: "4.2rem", height: "4.2rem", borderRadius: "8px", overflow: "hidden", background: "#1f1d25" }}>
                          <Image src={photo.url} alt={product.name} fill sizes="4.2rem" style={{ objectFit: "cover" }} />
                          <button
                            onClick={() => handleDeletePhoto(product.id, photo.id)}
                            style={{ position: "absolute", top: 2, right: 2, width: "1.2rem", height: "1.2rem", borderRadius: "50%", background: "rgba(0,0,0,0.7)", color: "#f87171", border: "none", cursor: "pointer", fontSize: "0.7rem", lineHeight: 1 }}
                            title="Retirer cette photo"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => fileInputs.current[product.id]?.click()}
                        style={{ width: "4.2rem", height: "4.2rem", borderRadius: "8px", border: "1px dashed rgba(255,255,255,0.2)", background: "transparent", color: "#605f65", cursor: "pointer", fontSize: "0.65rem" }}
                      >
                        + Ajouter
                      </button>
                    </div>
                    <input
                      ref={(el) => { fileInputs.current[product.id] = el; }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: "none" }}
                      onChange={(e) => { handleAddPhoto(product.id, e.target.files?.[0]); e.target.value = ""; }}
                    />
                  </div>

                  {/* ── Stock du produit (utilisé seulement s'il n'y a aucune variante) ── */}
                  <div style={{ marginTop: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#c3c2c8" }}>
                      <span>Stock du produit</span>
                      <input
                        type="number"
                        min={0}
                        value={product.inventory_count}
                        onChange={(e) => handleProductInventoryChange(product.id, Math.max(0, parseInt(e.target.value, 10) || 0))}
                        style={{ width: "4rem", padding: "0.25rem 0.4rem", fontSize: "0.78rem", background: "#17151e", border: "1px solid #302e36", borderRadius: "4px", color: "#fff", textAlign: "center" }}
                      />
                    </label>
                    {hasVariants && (
                      <span style={{ fontSize: "0.65rem", color: "#605f65", fontStyle: "italic" }}>
                        ignoré tant qu&apos;il y a des variantes — le stock par variante ci-dessous s&apos;applique
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid #1a1820" }}>
                    <p style={{ fontSize: "0.68rem", color: "#7a7982", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>
                      Variantes ({product.variants.length})
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.75rem" }}>
                      {product.variants.map((v) => (
                        <div key={v.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", fontSize: "0.78rem", color: "#c3c2c8" }}>
                          <span style={{ minWidth: "8rem" }}>{v.label}{v.size ? ` · ${v.size}` : ""}{v.color ? ` · ${v.color}` : ""}</span>
                          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            <span style={{ fontSize: "0.65rem", color: "#605f65" }}>Inventaire</span>
                            <input
                              type="number"
                              min={0}
                              value={v.inventory_count}
                              onChange={(e) => handleVariantInventoryChange(product.id, v.id, Math.max(0, parseInt(e.target.value, 10) || 0))}
                              style={{ width: "3.6rem", padding: "0.2rem 0.4rem", fontSize: "0.75rem", background: "#17151e", border: "1px solid #302e36", borderRadius: "4px", color: "#fff", textAlign: "center" }}
                            />
                          </label>
                          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            <input type="checkbox" checked={v.active} onChange={(e) => handleToggleVariantActive(product.id, v.id, e.target.checked)} />
                            Actif
                          </label>
                          <button onClick={() => handleDeleteVariant(product.id, v.id)} style={{ background: "none", border: "none", color: "rgba(255,100,100,0.6)", cursor: "pointer", fontSize: "0.72rem" }}>
                            Retirer
                          </button>
                        </div>
                      ))}
                      {product.variants.length === 0 && <p style={{ fontSize: "0.72rem", color: "#3c3a41", fontStyle: "italic" }}>Aucune variante — le produit se vend tel quel.</p>}
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                      <input placeholder="Étiquette (ex. Petit)" value={vForm.label} onChange={(e) => setVariantField(product.id, "label", e.target.value)} style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem", background: "#17151e", border: "1px solid #302e36", borderRadius: "4px", color: "#fff", width: "9rem" }} />
                      <input placeholder="Taille" value={vForm.size} onChange={(e) => setVariantField(product.id, "size", e.target.value)} style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem", background: "#17151e", border: "1px solid #302e36", borderRadius: "4px", color: "#fff", width: "6rem" }} />
                      <input placeholder="Couleur" value={vForm.color} onChange={(e) => setVariantField(product.id, "color", e.target.value)} style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem", background: "#17151e", border: "1px solid #302e36", borderRadius: "4px", color: "#fff", width: "6rem" }} />
                      <input placeholder="Inventaire" type="number" min={0} value={vForm.inventoryCount} onChange={(e) => setVariantField(product.id, "inventoryCount", e.target.value)} style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem", background: "#17151e", border: "1px solid #302e36", borderRadius: "4px", color: "#fff", width: "5.5rem" }} />
                      <button onClick={() => handleAddVariant(product.id)} disabled={busy === `variant-${product.id}`} className="admin-btn-ghost" style={{ padding: "0.35rem 0.7rem", fontSize: "0.72rem" }}>
                        + Ajouter
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
