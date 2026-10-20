"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { formatMoney } from "@/lib/private-programs";
import { SPONSORSHIP_GOAL_CENTS, TIER_BENEFITS } from "@/lib/sponsorship-2027";
import type { SponsorSlotRow } from "@/app/api/admin/sponsors-2027/route";
import type { PartnershipOffer } from "@/lib/partnership-offers";

const OFFER_STATUS: Record<string, [string, string]> = {
  draft: ["Brouillon (non envoyée)", "#9d9da0"],
  sent: ["Envoyée", "#f0c878"],
  accepted: ["Acceptée", "#8fce9f"],
  declined: ["Refusée", "#ff9999"],
  expired: ["Expirée", "#6d6b71"]
};
const OPTION_STATUS: Record<string, [string, string]> = {
  open: ["Ouverte", "#c3c2c8"],
  paid: ["Payée", "#8fce9f"],
  unavailable: ["Emplacement plus disponible", "#ffb464"],
  closed: ["Non retenue", "#6d6b71"]
};

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  available: { label: "Disponible", color: "#8fce9f" },
  reserved: { label: "Réservé", color: "#f0c878" },
  sold: { label: "Vendu", color: "#c4a4e4" }
};

export function AdminSponsors2027({ initialSlots, role, initialOffers = [], origin = "" }: { initialSlots: SponsorSlotRow[]; role: "admin" | "gerante"; initialOffers?: PartnershipOffer[]; origin?: string }) {
  const [offers, setOffers] = useState(initialOffers);
  const [optPrice, setOptPrice] = useState<Record<string, string>>({});
  const offeredOn = (slotKey: string) =>
    offers.filter((o) => o.status !== "declined" && o.status !== "expired" && o.options.some((x) => x.slot_key === slotKey && x.status === "open")).map((o) => o.company_name);
  const offerCall = async (body: Record<string, unknown>, ok: string) => {
    try {
      const res = await fetch("/api/admin/partenariats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      setOffers(json.offers);
      const s = await fetch("/api/admin/sponsors-2027").then((r) => r.json());
      if (s.slots) setSlots(s.slots);
      flash(ok);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Erreur");
    }
  };
  const isAdmin = role === "admin";
  const [priceFor, setPriceFor] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [slots, setSlots] = useState(initialSlots);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ company: "", contactName: "", contactEmail: "", note: "" });

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 5000);
  };

  const call = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/sponsors-2027", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      setSlots(json.slots);
      flash(ok);
      setOpen(null);
      setForm({ company: "", contactName: "", contactEmail: "", note: "" });
    } catch (e) {
      flash(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const soldCents = slots.filter((s) => s.status === "sold").reduce((n, s) => n + s.price_cents, 0);
  const reservedCents = slots.filter((s) => s.status === "reserved").reduce((n, s) => n + s.price_cents, 0);
  const availableCents = slots.filter((s) => s.status === "available").reduce((n, s) => n + s.price_cents, 0);
  const count = (st: string) => slots.filter((s) => s.status === st).length;

  const tiers = Array.from(new Map(slots.map((s) => [s.tier, s.tier_label])).entries());
  const cell: React.CSSProperties = { padding: "0.55rem 0.5rem", borderBottom: "1px solid #1f1d25", fontSize: "0.78rem", color: "#c3c2c8", verticalAlign: "top" };
  const card: React.CSSProperties = { background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem", marginBottom: "1.25rem" };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Sponsors 2027</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1rem" }}>
            Programme de partenariat : 13 emplacements, chacun avec son lien de paiement Stripe à usage unique. Un paiement marque l&apos;emplacement « Vendu » automatiquement et crée le commanditaire dans « Commandites ».
          </p>
          {msg && <p style={{ fontSize: "0.78rem", color: "#8fce9f" }}>{msg}</p>}

          <div className="admin-stats" style={{ marginBottom: "1.2rem" }}>
            <div className="admin-stat-card admin-stat-card-accent"><p className="admin-stat-value">{formatMoney(soldCents)}</p><p className="admin-stat-label">Vendu ({count("sold")} emplacement{count("sold") > 1 ? "s" : ""})</p></div>
            <div className="admin-stat-card admin-stat-card-warn"><p className="admin-stat-value">{formatMoney(reservedCents)}</p><p className="admin-stat-label">Réservé ({count("reserved")})</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{formatMoney(availableCents)}</p><p className="admin-stat-label">Encore disponible ({count("available")})</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{formatMoney(SPONSORSHIP_GOAL_CENTS)}</p><p className="admin-stat-label">Objectif 2027 ({slots.length} places)</p></div>
          </div>

          <div style={card}>
            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>Par forfait</p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Forfait", "Tarif", "Places", "Vendues", "Disponibles"].map((h) => <th key={h} style={{ ...cell, color: "#9d9da0", textAlign: "left", fontWeight: 600 }}>{h}</th>)}</tr></thead>
              <tbody>
                {tiers.map(([tier, label]) => {
                  const list = slots.filter((s) => s.tier === tier);
                  return (
                    <tr key={tier}>
                      <td style={cell}><strong style={{ color: "#fff" }}>{label}</strong></td>
                      <td style={cell}>{formatMoney(list[0].price_cents)}</td>
                      <td style={cell}>{list.length}</td>
                      <td style={cell}>{list.filter((s) => s.status !== "available").length}</td>
                      <td style={cell}>{list.filter((s) => s.status === "available").length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={card}>
            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>Emplacements ({slots.length})</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "820px" }}>
                <thead><tr>{["Emplacement", "Tarif", "Statut", "Commanditaire", "Lien de paiement", ""].map((h) => <th key={h} style={{ ...cell, color: "#9d9da0", textAlign: "left", fontWeight: 600 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {slots.map((s) => {
                    const st = STATUS_STYLE[s.status];
                    return (
                      <tr key={s.slot_key}>
                        <td style={cell}>
                          <strong style={{ color: "#fff" }}>{s.tier_label}</strong>
                          <br />{s.placement}
                          <br /><span style={{ color: "#6d6b71" }}>{s.slot_key}</span>
                        </td>
                        <td style={cell}>
                          {formatMoney(s.price_cents)}
                          {s.list_price_cents != null && s.list_price_cents !== s.price_cents ? <><br /><span style={{ color: "#f0c878" }}>Prix négocié</span><br /><span style={{ color: "#6d6b71", textDecoration: "line-through" }}>{formatMoney(s.list_price_cents)}</span></> : null}
                        </td>
                        <td style={cell}>
                          <span style={{ color: st.color, fontWeight: 700 }}>{st.label}</span>
                          {s.status === "available" && offeredOn(s.slot_key).length > 0 && (
                            <><br /><span style={{ color: "#78a8f0", fontSize: "0.7rem" }}>Proposé à : {offeredOn(s.slot_key).join(", ")}</span></>
                          )}
                        </td>
                        <td style={cell}>
                          {s.company_name ? (
                            <>
                              <strong style={{ color: "#fff" }}>{s.company_name}</strong>
                              {s.contact_name ? <><br />{s.contact_name}</> : null}
                              {s.contact_email ? <><br />{s.contact_email}</> : null}
                            </>
                          ) : <span style={{ color: "#6d6b71" }}>—</span>}
                        </td>
                        <td style={cell}>
                          {s.status === "available" && s.payment_link_url ? (
                            <>
                              <button className="admin-btn-ghost" style={{ fontSize: "0.68rem" }} onClick={() => navigator.clipboard.writeText(s.payment_link_url!).then(() => flash(`Lien copié : ${s.tier_label} — ${s.placement}`))}>Copier le lien</button>{" "}
                              <a href={s.payment_link_url} target="_blank" rel="noreferrer" style={{ color: "#c4a4e4", fontSize: "0.68rem" }}>Ouvrir</a>
                            </>
                          ) : s.status === "available" ? (
                            <button className="admin-btn-ghost" style={{ fontSize: "0.68rem" }} disabled={busy} onClick={() => call({ action: "new_link", slotKey: s.slot_key }, "Lien créé.")}>Créer le lien</button>
                          ) : (
                            <span style={{ color: "#6d6b71" }}>Lien désactivé</span>
                          )}
                        </td>
                        <td style={cell}>
                          {s.status === "available" && (
                            <>
                              <button className="admin-btn-ghost" style={{ fontSize: "0.68rem" }} disabled={busy} onClick={() => setOpen(open === s.slot_key ? null : s.slot_key)}>{isAdmin ? "Marquer vendu / réservé" : "Réserver"}</button>{" "}
                              {isAdmin && (
                                <button className="admin-btn-ghost" style={{ fontSize: "0.68rem" }} disabled={busy} onClick={() => { setPriceFor(priceFor === s.slot_key ? null : s.slot_key); setPrice(String(s.price_cents / 100)); }}>Ajuster le prix</button>
                              )}
                              {priceFor === s.slot_key && (
                                <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                                  <input className="admin-input" style={{ width: "100px" }} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /> $
                                  <button className="admin-btn-primary" style={{ fontSize: "0.68rem" }} disabled={busy} onClick={() => confirm(`Créer un nouveau lien à ${price} $ ? L'ancien lien sera désactivé.`) && call({ action: "custom_price", slotKey: s.slot_key, amountCents: Math.round((parseFloat(price.replace(",", ".")) || 0) * 100) }, "Nouveau lien créé au prix négocié.").then(() => setPriceFor(null))}>Créer le lien</button>
                                </div>
                              )}
                            </>
                          )}
                          {s.status !== "available" && (
                            <>
                              <button className="admin-btn-ghost" style={{ fontSize: "0.68rem" }} disabled={busy} onClick={() => setOpen(open === s.slot_key ? null : s.slot_key)}>Modifier l&apos;entreprise</button>{" "}
                              {isAdmin && <button className="admin-btn-ghost" style={{ fontSize: "0.68rem", color: "#ff9999" }} disabled={busy} onClick={() => confirm("Remettre cet emplacement disponible ? Le lien de paiement sera réactivé.") && call({ action: "release", slotKey: s.slot_key }, "Emplacement remis disponible.")}>Remettre disponible</button>}
                            </>
                          )}
                          {open === s.slot_key && (
                            <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.35rem", maxWidth: "280px" }}>
                              <input className="admin-input" placeholder="Nom de l'entreprise *" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                              <input className="admin-input" placeholder="Responsable" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                              <input className="admin-input" placeholder="Courriel" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
                              {s.status === "available" ? (
                                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                                  {isAdmin && <button className="admin-btn-primary" style={{ fontSize: "0.68rem" }} disabled={busy || !form.company} onClick={() => call({ action: "mark_sold", slotKey: s.slot_key, ...form }, "Emplacement marqué vendu (lien désactivé).")}>Vendu (payé)</button>}
                                  <button className="admin-btn-ghost" style={{ fontSize: "0.68rem" }} disabled={busy || !form.company} onClick={() => call({ action: "reserve", slotKey: s.slot_key, ...form }, "Emplacement réservé (lien désactivé).")}>Réservé</button>
                                </div>
                              ) : (
                                <button className="admin-btn-primary" style={{ fontSize: "0.68rem" }} disabled={busy || !form.company} onClick={() => call({ action: "set_company", slotKey: s.slot_key, ...form }, "Commanditaire mis à jour.")}>Enregistrer</button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Propositions personnalisées ── */}
          <div style={card}>
            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.2rem" }}>Propositions personnalisées ({offers.length})</p>
            <p style={{ fontSize: "0.74rem", color: "#6d6b71", margin: "0 0 0.8rem" }}>
              Chaque entreprise a sa page privée avec ses options et un bouton de paiement par option. Une option chandail est liée à un emplacement : dès que l&apos;emplacement est vendu (à elle ou à quelqu&apos;un d&apos;autre), toutes les autres offres sur cet emplacement se ferment automatiquement.
            </p>
            {offers.length === 0 && <p className="admin-empty-text">Aucune proposition pour l&apos;instant.</p>}
            {offers.map((o) => {
              const page = `${origin}/partenariat/${o.token}`;
              const [label, color] = OFFER_STATUS[o.status] ?? [o.status, "#c3c2c8"];
              return (
                <div key={o.id} style={{ borderTop: "1px solid #1f1d25", padding: "0.8rem 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ color: "#fff" }}>{o.company_name}</strong>
                      <span style={{ color, fontWeight: 700, fontSize: "0.74rem", marginLeft: "0.5rem" }}>{label}</span>
                      <br />
                      <span style={{ fontSize: "0.74rem", color: "#9d9da0" }}>
                        {o.contact_name} · {o.contact_email}
                        {o.respond_by ? ` · réponse attendue le ${new Date(`${o.respond_by}T12:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}` : ""}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      <a href={page} target="_blank" rel="noreferrer" className="admin-btn-ghost" style={{ fontSize: "0.68rem" }}>Voir sa page</a>
                      <button className="admin-btn-ghost" style={{ fontSize: "0.68rem" }} onClick={() => navigator.clipboard.writeText(page).then(() => flash("Lien de la proposition copié."))}>Copier le lien</button>
                      {isAdmin && o.status === "sent" && (
                        <button className="admin-btn-ghost" style={{ fontSize: "0.68rem", color: "#ff9999" }} onClick={() => confirm("Marquer cette proposition comme refusée ?") && offerCall({ action: "set_status", offerId: o.id, status: "declined" }, "Proposition marquée refusée.")}>Refusée</button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: "0.3rem", marginTop: "0.5rem" }}>
                    {o.options.map((x) => {
                      const [ol, oc] = OPTION_STATUS[x.status] ?? [x.status, "#c3c2c8"];
                      return (
                        <div key={x.id} style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap", fontSize: "0.78rem", color: "#c3c2c8" }}>
                          <span style={{ minWidth: "230px" }}>{x.slot_key ? `Chandail (${x.slot_key}) — ` : ""}{x.label}</span>
                          <strong style={{ color: "#fff" }}>{x.price_cents != null ? formatMoney(x.price_cents) : "à convenir"}</strong>
                          <span style={{ color: oc, fontWeight: 600 }}>{ol}</span>
                          {x.payment_link_url && x.status === "open" && (
                            <button className="admin-btn-ghost" style={{ fontSize: "0.66rem" }} onClick={() => navigator.clipboard.writeText(x.payment_link_url!).then(() => flash(`Lien de paiement copié : ${x.label}`))}>Copier le lien de paiement</button>
                          )}
                          {isAdmin && x.status === "open" && x.slot_key && (
                            <>
                              <input className="admin-input" style={{ width: "90px" }} placeholder="Prix $" value={optPrice[x.id] ?? ""} onChange={(e) => setOptPrice({ ...optPrice, [x.id]: e.target.value })} />
                              <button className="admin-btn-ghost" style={{ fontSize: "0.66rem" }} disabled={!optPrice[x.id]} onClick={() => offerCall({ action: "set_option_price", optionId: x.id, priceCents: Math.round((parseFloat((optPrice[x.id] ?? "").replace(",", ".")) || 0) * 100) }, "Prix fixé : lien de paiement créé.")}>
                                {x.price_cents != null ? "Changer le prix" : "Fixer le prix convenu"}
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={card}>
            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>Ce qui est offert par forfait</p>
            {tiers.map(([tier, label]) => (
              <div key={tier} style={{ marginBottom: "0.8rem" }}>
                <p style={{ margin: "0 0 0.25rem", fontSize: "0.8rem", fontWeight: 700, color: "#c4a4e4" }}>{label}</p>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.76rem", color: "#c3c2c8", lineHeight: 1.55 }}>
                  {TIER_BENEFITS[tier as keyof typeof TIER_BENEFITS].map((b) => <li key={b}>{b}</li>)}
                </ul>
              </div>
            ))}
            <p style={{ fontSize: "0.74rem", color: "#6d6b71", margin: 0 }}>Partenaire en nature : valeur variable, places illimitées — à négocier au cas par cas (aucun lien de paiement).</p>
          </div>
        </div>
      </div>
    </>
  );
}
