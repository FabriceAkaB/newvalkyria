"use client";

import { useMemo, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { formatMoney, privateProgramUrl } from "@/lib/private-programs";
import type { PrivateProgram, PrivateRegistrationRow } from "@/lib/private-programs-repo";

const STATUS_LABELS: Record<string, string> = { pending: "En attente", paid: "Payée", confirmed: "Confirmée", waitlist: "Liste d'attente", cancelled: "Annulée" };
const STATUS_COLORS: Record<string, string> = { pending: "#f0c878", paid: "#8fce9f", confirmed: "#9ec9ff", waitlist: "#c4a4e4", cancelled: "#ff9999" };

interface ProgramStats {
  held: number;
  paid: number;
  waitlist: number;
}

function csvEscape(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function AdminPrives({
  programs: initialPrograms,
  stats,
  registrations: initialRegistrations,
  origin
}: {
  programs: PrivateProgram[];
  stats: Record<string, ProgramStats>;
  registrations: PrivateRegistrationRow[];
  origin: string;
}) {
  const [programs, setPrograms] = useState(initialPrograms);
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const programName = useMemo(() => new Map(programs.map((p) => [p.slug, p.name])), [programs]);

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(null), 4000);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash("Lien copié dans le presse-papier.");
    } catch {
      window.prompt("Copiez ce lien :", text);
    }
  };

  const saveProgram = async (slug: string, patch: Record<string, unknown>) => {
    setBusy(slug);
    try {
      const res = await fetch("/api/admin/prives", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...patch }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      flash("Enregistré.");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const act = async (id: string, action: "cancel" | "mark_paid", extra: Record<string, unknown> = {}) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/prives/inscriptions/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setRegistrations((prev) => prev.map((r) => (r.id === id ? { ...r, status: action === "cancel" ? "cancelled" : "paid" } : r)));
      flash(action === "cancel" ? (data.refunds ? `Annulée — ${data.refunds} remboursement(s), ${formatMoney(data.refundedCents)}.` : "Annulée — la place est libérée.") : "Marquée comme payée.");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const filtered = registrations.filter((r) => {
    if (programFilter !== "all" && r.program_slug !== programFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${r.player_first_name} ${r.player_last_name} ${r.parent_name} ${r.parent_email} ${r.parent_phone} ${r.referral?.referrer_name ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const exportCsv = () => {
    const header = ["Joueur", "Année de naissance", "Programme", "Parent", "Courriel", "Téléphone", "Prix du programme", "Rabais utilisé", "Crédit utilisé", "Supplément", "Total dû", "Mode de paiement", "Montant payé", "Montant restant", "Statut", "Parent référent", "Date"];
    const lines = filtered.map((r) => {
      const total = r.total_due_cents ?? r.price_cents ?? 0;
      const remaining = r.status === "cancelled" || r.status === "waitlist" ? 0 : Math.max(0, total - r.paid_cents);
      return [
        `${r.player_first_name} ${r.player_last_name}`.trim(),
        r.birth_year ?? "",
        programName.get(r.program_slug) ?? r.program_slug,
        r.parent_name,
        r.parent_email,
        r.parent_phone,
        ((r.list_price_cents ?? 0) / 100).toFixed(2),
        (r.referral_discount_cents / 100).toFixed(2),
        (r.credit_applied_cents / 100).toFixed(2),
        (r.installment_fee_cents / 100).toFixed(2),
        (total / 100).toFixed(2),
        r.payment_option === "two_installments" ? "2 versements" : "Complet",
        (r.paid_cents / 100).toFixed(2),
        (remaining / 100).toFixed(2),
        STATUS_LABELS[r.status] ?? r.status,
        r.referral?.referrer_name ?? "",
        r.created_at.slice(0, 10)
      ].map(csvEscape).join(";");
    });
    const blob = new Blob(["﻿" + [header.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `programmes-prives-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const input: React.CSSProperties = { width: "110px" };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Programmes garçons privés</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.2rem" }}>
            Pages non répertoriées : jamais dans le catalogue, les menus ou les moteurs de recherche. Seules les personnes qui reçoivent le lien y accèdent (et peuvent le partager).
          </p>
          {message && <p style={{ fontSize: "0.78rem", color: "#8fce9f", marginBottom: "0.8rem" }}>{message}</p>}

          {/* ── Programmes : lien, capacité, réglages ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
            {programs.map((p, idx) => {
              const s = stats[p.slug] ?? { held: 0, paid: 0, waitlist: 0 };
              const link = privateProgramUrl(origin, p.slug);
              const update = (patch: Partial<PrivateProgram>) => setPrograms((prev) => prev.map((x) => (x.slug === p.slug ? { ...x, ...patch } : x)));
              return (
                <div key={p.slug} style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem" }}>
                  <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.2rem" }}>{p.name}</p>
                  <p style={{ fontSize: "0.72rem", color: "#9d9da0", margin: "0 0 0.7rem" }}>
                    {s.paid} payée{s.paid !== 1 ? "s" : ""} · {s.held} place{s.held !== 1 ? "s" : ""} prise{s.held !== 1 ? "s" : ""} sur {p.max_capacity} · {s.waitlist} en attente
                  </p>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.8rem" }}>
                    <input className="admin-input" readOnly value={link} style={{ flex: 1, fontSize: "0.7rem" }} />
                    <button className="admin-btn-primary" style={{ fontSize: "0.72rem", padding: "0.4rem 0.7rem" }} onClick={() => copy(link)}>Copier</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Capacité max.
                      <input type="number" min={0} className="admin-input" style={input} value={p.max_capacity} onChange={(e) => update({ max_capacity: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                    </label>
                    <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Prix ($)
                      <input type="number" min={0} step="0.01" className="admin-input" style={input} value={(p.price_cents / 100).toString()} onChange={(e) => update({ price_cents: Math.round((parseFloat(e.target.value) || 0) * 100) })} />
                    </label>
                    <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Supplément 2 versements ($)
                      <input type="number" min={0} step="0.01" className="admin-input" style={input} value={(p.installment_fee_cents / 100).toString()} onChange={(e) => update({ installment_fee_cents: Math.round((parseFloat(e.target.value) || 0) * 100) })} />
                    </label>
                    <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Rabais référencement ($)
                      <input type="number" min={0} step="0.01" className="admin-input" style={input} value={(p.referral_discount_cents / 100).toString()} onChange={(e) => update({ referral_discount_cents: Math.round((parseFloat(e.target.value) || 0) * 100) })} />
                    </label>
                    <label style={{ fontSize: "0.68rem", color: "#9d9da0", gridColumn: "1 / -1" }}>Date du 2ᵉ versement (à valider — vide = 30 jours après l&apos;inscription)
                      <input type="date" className="admin-input" style={{ width: "160px" }} value={p.second_installment_date ?? ""} onChange={(e) => update({ second_installment_date: e.target.value || null })} />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem", alignItems: "center" }}>
                    <button
                      className="admin-btn-primary"
                      style={{ fontSize: "0.74rem" }}
                      disabled={busy === p.slug}
                      onClick={() =>
                        saveProgram(p.slug, {
                          maxCapacity: p.max_capacity,
                          priceCents: p.price_cents,
                          installmentFeeCents: p.installment_fee_cents,
                          referralDiscountCents: p.referral_discount_cents,
                          secondInstallmentDate: p.second_installment_date
                        })
                      }
                    >
                      {busy === p.slug ? "..." : "Enregistrer les réglages"}
                    </button>
                    <label style={{ fontSize: "0.72rem", color: "#9d9da0", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <input
                        type="checkbox"
                        checked={p.active}
                        onChange={(e) => {
                          update({ active: e.target.checked });
                          saveProgram(p.slug, { active: e.target.checked });
                        }}
                      />
                      Page ouverte
                    </label>
                  </div>
                  {idx === 0 && null}
                </div>
              );
            })}
          </div>

          {/* ── Tableau des inscriptions ── */}
          <p className="admin-section-title" style={{ marginBottom: "0.6rem" }}>Inscriptions ({filtered.length})</p>
          <div className="admin-filters-row" style={{ marginBottom: "0.8rem", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <select className="admin-group-select" value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
              <option value="all">Tous les programmes</option>
              {programs.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
            </select>
            <select className="admin-group-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tous les statuts</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input type="search" className="admin-search-input" placeholder="Rechercher joueur, parent, courriel, référent…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="admin-export-btn" onClick={exportCsv}>↓ Exporter CSV</button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem", minWidth: "980px" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#9d9da0" }}>
                  {["Joueur", "Naiss.", "Programme", "Parent / contact", "Prix", "Rabais", "Paiement", "Payé", "Restant", "Statut", "Référent"].map((h) => (
                    <th key={h} style={{ padding: "0.45rem 0.5rem", borderBottom: "1px solid #251f30", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const total = r.total_due_cents ?? r.price_cents ?? 0;
                  const remaining = r.status === "cancelled" || r.status === "waitlist" ? 0 : Math.max(0, total - r.paid_cents);
                  const open = openId === r.id;
                  return (
                    <>
                      <tr key={r.id} onClick={() => setOpenId(open ? null : r.id)} style={{ cursor: "pointer", borderBottom: "1px solid #1f1d25", opacity: r.status === "cancelled" ? 0.5 : 1 }}>
                        <td style={{ padding: "0.45rem 0.5rem", color: "#fff", fontWeight: 600 }}>{r.player_first_name} {r.player_last_name}</td>
                        <td style={{ padding: "0.45rem 0.5rem", color: "#c3c2c8" }}>{r.birth_year ?? "—"}</td>
                        <td style={{ padding: "0.45rem 0.5rem", color: "#c3c2c8" }}>{programName.get(r.program_slug) ?? r.program_slug}</td>
                        <td style={{ padding: "0.45rem 0.5rem", color: "#c3c2c8" }}>{r.parent_name}<br /><span style={{ color: "#6d6b71" }}>{r.parent_email} · {r.parent_phone}</span></td>
                        <td style={{ padding: "0.45rem 0.5rem", color: "#c3c2c8" }}>{formatMoney(r.list_price_cents ?? 0)}</td>
                        <td style={{ padding: "0.45rem 0.5rem", color: "#8fce9f" }}>{r.referral_discount_cents + r.credit_applied_cents > 0 ? `− ${formatMoney(r.referral_discount_cents + r.credit_applied_cents)}` : "—"}</td>
                        <td style={{ padding: "0.45rem 0.5rem", color: "#c3c2c8" }}>{r.payment_option === "two_installments" ? "2 versements" : "Complet"}</td>
                        <td style={{ padding: "0.45rem 0.5rem", color: "#c3c2c8" }}>{formatMoney(r.paid_cents)}</td>
                        <td style={{ padding: "0.45rem 0.5rem", color: remaining > 0 ? "#ffb464" : "#c3c2c8" }}>{formatMoney(remaining)}</td>
                        <td style={{ padding: "0.45rem 0.5rem" }}><span style={{ color: STATUS_COLORS[r.status], fontWeight: 700 }}>{STATUS_LABELS[r.status] ?? r.status}</span></td>
                        <td style={{ padding: "0.45rem 0.5rem", color: "#c3c2c8" }}>{r.referral?.referrer_name ?? "—"}{r.referral && r.referral.status === "a_verifier" ? " ⚠" : ""}</td>
                      </tr>
                      {open && (
                        <tr key={r.id + "-detail"} style={{ background: "#0d0b13" }}>
                          <td colSpan={11} style={{ padding: "0.7rem 0.8rem" }}>
                            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "0.6rem", fontSize: "0.74rem", color: "#c3c2c8" }}>
                              <span>Échéancier : {r.installments.length === 0 ? "paiement unique" : r.installments.map((i) => `${i.sequence_no}. ${formatMoney(i.amount_cents)} (${i.due_date}) — ${i.status === "paid" ? "payé" : i.status === "pending" ? "à venir" : "échoué"}`).join(" · ")}</span>
                              {r.auto_debit_consent && <span>✓ Prélèvement automatique autorisé</span>}
                              {r.comments && <span>Commentaire : {r.comments}</span>}
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                              {(r.status === "pending" || r.status === "waitlist") && (
                                <button className="admin-btn-ghost" style={{ fontSize: "0.7rem" }} disabled={busy === r.id} onClick={() => confirm("Marquer comme payée (paiement reçu hors ligne) ?") && act(r.id, "mark_paid")}>Marquer payée</button>
                              )}
                              {r.status !== "cancelled" && (
                                <>
                                  <button className="admin-btn-ghost" style={{ fontSize: "0.7rem", color: "#ff9999" }} disabled={busy === r.id} onClick={() => confirm("Annuler cette inscription ? La place est libérée et les versements à venir sont annulés.") && act(r.id, "cancel", { refund: false })}>Annuler</button>
                                  {r.paid_cents > 0 && (
                                    <button className="admin-btn-ghost" style={{ fontSize: "0.7rem", color: "#ff9999" }} disabled={busy === r.id} onClick={() => confirm(`Annuler ET rembourser ${formatMoney(r.paid_cents)} sur la carte via Stripe ?`) && act(r.id, "cancel", { refund: true })}>Annuler + rembourser</button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="admin-empty-text">Aucune inscription pour l&apos;instant.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
