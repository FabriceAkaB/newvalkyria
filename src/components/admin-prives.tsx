"use client";

import { useEffect, useMemo, useState } from "react";

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
  dates: initialDates,
  registrations: initialRegistrations,
  origin
}: {
  programs: PrivateProgram[];
  stats: Record<string, ProgramStats>;
  dates: Record<string, { id: string; session_date: string; start_time: string; end_time: string; location: string }[]>;
  registrations: PrivateRegistrationRow[];
  origin: string;
}) {
  const [programs, setPrograms] = useState(initialPrograms);
  const [dates, setDates] = useState(initialDates);
  const [newDate, setNewDate] = useState<Record<string, { sessionDate: string; startTime: string; endTime: string; location: string }>>({});
  const [showNew, setShowNew] = useState(false);
  const [trials, setTrials] = useState<any[] | null>(null);
  useEffect(() => {
    fetch("/api/admin/prives/essais").then((r) => r.json()).then((j) => setTrials(j.trials ?? [])).catch(() => setTrials([]));
  }, []);
  const [np, setNp] = useState({ name: "", gender: "mixte", years: "", price: "", capacity: "6", fee: "40", discount: "50", practices: "", matches: "0", costPerSession: "", fixedCosts: "" });
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

          {/* ── Nouveau programme juvénile semi-privé ── */}
          <div style={{ marginBottom: "1.5rem" }}>
            <button className="admin-btn-ghost" style={{ fontSize: "0.76rem" }} onClick={() => setShowNew((v) => !v)}>{showNew ? "Fermer" : "+ Nouveau programme juvénile semi-privé (gabarit)"}</button>
            {showNew && (
              <div style={{ background: "#100e17", border: "1px solid #3a3550", borderRadius: "12px", padding: "1rem", marginTop: "0.7rem" }}>
                <p style={{ fontSize: "0.74rem", color: "#9d9da0", margin: "0 0 0.7rem" }}>Maximum 6 joueurs, séances techniques semi-privées. Le programme est créé en <strong>brouillon</strong> : rien n&apos;est publié avant votre validation.</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.6rem" }}>
                  <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Nom *<input className="admin-input" style={{ width: "100%" }} value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} /></label>
                  <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Public
                    <select className="admin-group-select" style={{ width: "100%" }} value={np.gender} onChange={(e) => setNp({ ...np, gender: e.target.value })}>
                      <option value="mixte">Mixte</option><option value="filles">Filles</option><option value="garcons">Garçons</option>
                    </select>
                  </label>
                  <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Années de naissance * (séparées par des virgules)<input className="admin-input" style={{ width: "100%" }} placeholder="2016, 2017" value={np.years} onChange={(e) => setNp({ ...np, years: e.target.value })} /></label>
                  <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Prix ($)<input className="admin-input" style={{ width: "100%" }} value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} /></label>
                  <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Places (max 6)<input type="number" min={1} max={6} className="admin-input" style={{ width: "100%" }} value={np.capacity} onChange={(e) => setNp({ ...np, capacity: e.target.value })} /></label>
                  <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Supplément 2 versements ($)<input className="admin-input" style={{ width: "100%" }} value={np.fee} onChange={(e) => setNp({ ...np, fee: e.target.value })} /></label>
                  <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Rabais référencement ($)<input className="admin-input" style={{ width: "100%" }} value={np.discount} onChange={(e) => setNp({ ...np, discount: e.target.value })} /></label>
                  <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Nombre de séances<input type="number" className="admin-input" style={{ width: "100%" }} value={np.practices} onChange={(e) => setNp({ ...np, practices: e.target.value })} /></label>
                  <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Matchs inclus<input type="number" className="admin-input" style={{ width: "100%" }} value={np.matches} onChange={(e) => setNp({ ...np, matches: e.target.value })} /></label>
                  <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Coût par séance ($)<input className="admin-input" style={{ width: "100%" }} value={np.costPerSession} onChange={(e) => setNp({ ...np, costPerSession: e.target.value })} /></label>
                  <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Frais fixes ($)<input className="admin-input" style={{ width: "100%" }} value={np.fixedCosts} onChange={(e) => setNp({ ...np, fixedCosts: e.target.value })} /></label>
                </div>
                <button
                  className="admin-btn-primary"
                  style={{ marginTop: "0.8rem", fontSize: "0.76rem" }}
                  onClick={async () => {
                    const dollars = (v: string) => Math.round((parseFloat(v.replace(",", ".")) || 0) * 100);
                    const res = await fetch("/api/admin/prives/programmes", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: np.name,
                        gender: np.gender,
                        birthYears: np.years.split(/[ ,;]+/).filter(Boolean),
                        priceCents: dollars(np.price),
                        capacity: parseInt(np.capacity, 10) || 6,
                        installmentFeeCents: dollars(np.fee),
                        referralDiscountCents: dollars(np.discount),
                        practices: parseInt(np.practices, 10) || 0,
                        matches: parseInt(np.matches, 10) || 0,
                        costPerSessionCents: dollars(np.costPerSession),
                        fixedCostsCents: dollars(np.fixedCosts)
                      })
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) return flash(json.error ?? "Erreur");
                    location.reload();
                  }}
                >
                  Créer en brouillon
                </button>
              </div>
            )}
          </div>

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
                    <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Capacité max. (limite des inscriptions)
                      <input type="number" min={0} className="admin-input" style={input} value={p.max_capacity} onChange={(e) => update({ max_capacity: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                    </label>
                    <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Taille min. affichée (« 12 à 14 »)
                      <input type="number" min={0} className="admin-input" style={input} value={p.min_capacity ?? ""} onChange={(e) => update({ min_capacity: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value, 10) || 0) })} />
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
                          minCapacity: p.min_capacity,
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
                  {p.program_kind === "semi_prive_juvenile" && (
                    <div style={{ marginTop: "0.8rem", borderTop: "1px solid #251f30", paddingTop: "0.7rem" }}>
                      <p style={{ fontSize: "0.7rem", color: p.published ? "#8fce9f" : "#f0c878", margin: "0 0 0.5rem", fontWeight: 700 }}>
                        {p.published && p.active ? "Publié" : "Brouillon — non publié"}
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.6rem" }}>
                        <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Coût par séance ($)
                          <input type="number" min={0} step="0.01" className="admin-input" style={input} value={(p.cost_per_session_cents / 100).toString()} onChange={(e) => update({ cost_per_session_cents: Math.round((parseFloat(e.target.value) || 0) * 100) })} />
                        </label>
                        <label style={{ fontSize: "0.68rem", color: "#9d9da0" }}>Frais fixes ($)
                          <input type="number" min={0} step="0.01" className="admin-input" style={input} value={(p.fixed_costs_cents / 100).toString()} onChange={(e) => update({ fixed_costs_cents: Math.round((parseFloat(e.target.value) || 0) * 100) })} />
                        </label>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button className="admin-btn-ghost" style={{ fontSize: "0.7rem" }} disabled={busy === p.slug} onClick={() => saveProgram(p.slug, { costPerSessionCents: p.cost_per_session_cents, fixedCostsCents: p.fixed_costs_cents })}>Enregistrer les coûts</button>
                        {!(p.published && p.active) ? (
                          <button
                            className="admin-btn-primary"
                            style={{ fontSize: "0.7rem" }}
                            disabled={busy === p.slug}
                            onClick={() => {
                              if (!confirm("Publier ce programme ? La page deviendra accessible par son lien et les inscriptions s'ouvriront. Vérifiez d'abord le prix, la capacité et le calendrier.")) return;
                              update({ published: true, active: true });
                              saveProgram(p.slug, { published: true, active: true });
                            }}
                          >
                            Publier (après validation)
                          </button>
                        ) : (
                          <button
                            className="admin-btn-ghost"
                            style={{ fontSize: "0.7rem" }}
                            disabled={busy === p.slug}
                            onClick={() => {
                              update({ published: false, active: false });
                              saveProgram(p.slug, { published: false, active: false });
                            }}
                          >
                            Dépublier
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Calendrier configurable */}
                  <div style={{ marginTop: "0.8rem", borderTop: "1px solid #251f30", paddingTop: "0.7rem" }}>
                    <p style={{ fontSize: "0.72rem", color: "#9d9da0", margin: "0 0 0.4rem", fontWeight: 700 }}>Calendrier ({(dates[p.slug] ?? []).length} séance{(dates[p.slug] ?? []).length !== 1 ? "s" : ""})</p>
                    {(dates[p.slug] ?? []).map((d) => (
                      <div key={d.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#c3c2c8", padding: "0.15rem 0" }}>
                        <span>{d.session_date} · {d.start_time}–{d.end_time} · {d.location}</span>
                        <button
                          className="admin-btn-ghost"
                          style={{ fontSize: "0.62rem", color: "#ff9999" }}
                          onClick={async () => {
                            await fetch(`/api/admin/prives/dates?id=${d.id}`, { method: "DELETE" });
                            setDates((prev) => ({ ...prev, [p.slug]: (prev[p.slug] ?? []).filter((x) => x.id !== d.id) }));
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {(() => {
                      const nd = newDate[p.slug] ?? { sessionDate: "", startTime: "", endTime: "", location: "" };
                      const set = (patch: Partial<typeof nd>) => setNewDate((prev) => ({ ...prev, [p.slug]: { ...nd, ...patch } }));
                      return (
                        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                          <input type="date" className="admin-input" value={nd.sessionDate} onChange={(e) => set({ sessionDate: e.target.value })} />
                          <input type="time" className="admin-input" value={nd.startTime} onChange={(e) => set({ startTime: e.target.value })} />
                          <input type="time" className="admin-input" value={nd.endTime} onChange={(e) => set({ endTime: e.target.value })} />
                          <input className="admin-input" placeholder="Lieu" style={{ flex: 1, minWidth: "120px" }} value={nd.location} onChange={(e) => set({ location: e.target.value })} />
                          <button
                            className="admin-btn-ghost"
                            style={{ fontSize: "0.68rem" }}
                            onClick={async () => {
                              if (!nd.sessionDate || !nd.startTime || !nd.endTime || !nd.location) return flash("Date, heures et lieu requis.");
                              const res = await fetch("/api/admin/prives/dates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: p.slug, ...nd }) });
                              const json = await res.json().catch(() => ({}));
                              if (!res.ok) return flash(json.error ?? "Erreur");
                              location.reload();
                            }}
                          >
                            + Séance
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Essais gratuits du mardi ── */}
          <p className="admin-section-title" style={{ marginBottom: "0.6rem" }}>Essais gratuits du mardi ({(trials ?? []).filter((t) => t.status !== "cancelled").length})</p>
          <div style={{ overflowX: "auto", marginBottom: "2rem" }}>
            {(trials ?? []).length === 0 ? (
              <p className="admin-empty-text">Aucun essai réservé pour l&apos;instant.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem", minWidth: "760px" }}>
                <tbody>
                  {(trials ?? []).map((t) => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #1f1d25", opacity: t.status === "cancelled" ? 0.5 : 1 }}>
                      <td style={{ padding: "0.4rem 0.5rem", color: "#c3c2c8" }}>{t.trial_date}</td>
                      <td style={{ padding: "0.4rem 0.5rem", color: "#fff", fontWeight: 600 }}>{t.player_first_name} {t.player_last_name} <span style={{ color: "#6d6b71", fontWeight: 400 }}>({t.birth_year})</span></td>
                      <td style={{ padding: "0.4rem 0.5rem", color: "#c3c2c8" }}>{t.program?.name ?? t.program_slug}</td>
                      <td style={{ padding: "0.4rem 0.5rem", color: "#c3c2c8" }}>{t.parent_name} · {t.parent_phone} · {t.parent_email}</td>
                      <td style={{ padding: "0.4rem 0.5rem", color: "#c3c2c8" }}>{t.status === "confirmed" ? "Confirmé" : t.status === "attended" ? "Présent" : t.status === "absent" ? "Absent" : "Annulé"}</td>
                      <td style={{ padding: "0.4rem 0.5rem" }}>
                        {t.status === "confirmed" && (
                          <>
                            {(["attended", "absent", "cancelled"] as const).map((st) => (
                              <button
                                key={st}
                                className="admin-btn-ghost"
                                style={{ fontSize: "0.64rem", marginRight: "0.25rem" }}
                                onClick={async () => {
                                  await fetch("/api/admin/prives/essais", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, status: st }) });
                                  setTrials((prev) => (prev ?? []).map((x) => (x.id === t.id ? { ...x, status: st } : x)));
                                }}
                              >
                                {st === "attended" ? "Présent" : st === "absent" ? "Absent" : "Annuler"}
                              </button>
                            ))}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
