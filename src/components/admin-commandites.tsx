"use client";

import { Fragment, useMemo, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { EntityDocuments } from "@/components/admin-entity-documents";
import { formatMoney } from "@/lib/private-programs";
import { SPONSOR_CATEGORIES, SPONSOR_STATUSES, type Sponsor, type SponsorPayment } from "@/lib/sponsors-repo";

const STATUS_COLOR: Record<string, string> = { prospect: "#9d9da0", contacte: "#9ec9ff", negociation: "#f0c878", confirme: "#c4a4e4", paye: "#8fce9f", refuse: "#ff9999", termine: "#6d6b71" };
const label = (list: readonly { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;

const EMPTY = { companyName: "", contactName: "", contactEmail: "", contactPhone: "", category: "equipement", partnershipType: "", amount: "", status: "prospect", lastContactAt: "", lastContactNote: "", followUpDate: "", notes: "" };

export function AdminCommandites({ initial }: { initial: { sponsors: Sponsor[]; payments: SponsorPayment[] } }) {
  const [data, setData] = useState(initial);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState({ amount: "", dueDate: "", paidAt: "", method: "", note: "" });
  const today = new Date().toISOString().slice(0, 10);

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(null), 4000);
  };

  const call = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/commandites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      setData(await fetch("/api/admin/commandites").then((r) => r.json()));
      flash(ok);
      return true;
    } catch (err) {
      flash(err instanceof Error ? err.message : "Erreur");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => {
    const active = data.sponsors.filter((s) => s.status !== "refuse");
    const confirmed = data.sponsors.filter((s) => s.status === "confirme" || s.status === "paye" || s.status === "termine");
    const paid = data.payments.filter((p) => p.paid_at).reduce((s, p) => s + p.amount_cents, 0);
    const due = data.payments.filter((p) => !p.paid_at).reduce((s, p) => s + p.amount_cents, 0);
    const relances = data.sponsors.filter((s) => s.follow_up_date && s.follow_up_date <= today && s.status !== "refuse" && s.status !== "termine" && s.status !== "paye");
    return {
      pipeline: active.reduce((s, x) => s + x.proposed_amount_cents, 0),
      confirmed: confirmed.reduce((s, x) => s + x.proposed_amount_cents, 0),
      paid,
      due,
      relances
    };
  }, [data, today]);

  const list = data.sponsors.filter((s) => (filter === "all" ? true : filter === "relance" ? totals.relances.some((r) => r.id === s.id) : s.status === filter || s.category === filter));

  const cell: React.CSSProperties = { padding: "0.5rem", borderBottom: "1px solid #1f1d25", fontSize: "0.76rem", color: "#c3c2c8", verticalAlign: "top" };
  const field: React.CSSProperties = { fontSize: "0.66rem", color: "#9d9da0" };

  const submitNew = async () => {
    if (!form.companyName.trim()) {
      flash("Le nom de l'entreprise est requis.");
      return;
    }
    const amount = parseFloat(form.amount.replace(",", "."));
    const ok = await call(
      {
        action: "create",
        sponsor: {
          companyName: form.companyName,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          category: form.category,
          partnershipType: form.partnershipType,
          proposedAmountCents: Number.isFinite(amount) ? Math.round(amount * 100) : 0,
          status: form.status,
          lastContactAt: form.lastContactAt,
          lastContactNote: form.lastContactNote,
          followUpDate: form.followUpDate,
          notes: form.notes
        }
      },
      "Commanditaire ajouté."
    );
    if (ok) {
      setForm(EMPTY);
      setShowForm(false);
    }
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.6rem", marginBottom: "0.8rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Commandites et partenaires</p>
            <button className="admin-btn-primary" style={{ fontSize: "0.76rem" }} onClick={() => setShowForm((v) => !v)}>{showForm ? "Fermer" : "+ Ajouter un commanditaire"}</button>
          </div>
          {message && <p style={{ fontSize: "0.78rem", color: "#8fce9f" }}>{message}</p>}

          <div className="admin-stats" style={{ marginBottom: "1.2rem" }}>
            <div className="admin-stat-card"><p className="admin-stat-value">{formatMoney(totals.pipeline)}</p><p className="admin-stat-label">Montants proposés</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{formatMoney(totals.confirmed)}</p><p className="admin-stat-label">Confirmés</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{formatMoney(totals.paid)}</p><p className="admin-stat-label">Encaissés</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{formatMoney(totals.due)}</p><p className="admin-stat-label">À encaisser</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value" style={{ color: totals.relances.length ? "#ffb464" : undefined }}>{totals.relances.length}</p><p className="admin-stat-label">Relances à faire</p></div>
          </div>

          {showForm && (
            <div style={{ background: "#100e17", border: "1px solid #3a3550", borderRadius: "12px", padding: "1rem", marginBottom: "1.2rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.6rem" }}>
                <label style={field}>Entreprise *<input className="admin-input" style={{ width: "100%" }} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></label>
                <label style={field}>Contact<input className="admin-input" style={{ width: "100%" }} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
                <label style={field}>Courriel<input className="admin-input" style={{ width: "100%" }} value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></label>
                <label style={field}>Téléphone<input className="admin-input" style={{ width: "100%" }} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
                <label style={field}>Catégorie
                  <select className="admin-group-select" style={{ width: "100%" }} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {SPONSOR_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>
                <label style={field}>Type de partenariat<input className="admin-input" style={{ width: "100%" }} placeholder="ex. logo chandail, bannière…" value={form.partnershipType} onChange={(e) => setForm({ ...form, partnershipType: e.target.value })} /></label>
                <label style={field}>Montant proposé ($)<input className="admin-input" style={{ width: "100%" }} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
                <label style={field}>Statut
                  <select className="admin-group-select" style={{ width: "100%" }} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {SPONSOR_STATUSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>
                <label style={field}>Dernière communication<input type="date" className="admin-input" style={{ width: "100%" }} value={form.lastContactAt} onChange={(e) => setForm({ ...form, lastContactAt: e.target.value })} /></label>
                <label style={field}>Relance prévue le<input type="date" className="admin-input" style={{ width: "100%" }} value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} /></label>
                <label style={{ ...field, gridColumn: "1 / -1" }}>Note de la dernière communication<input className="admin-input" style={{ width: "100%" }} value={form.lastContactNote} onChange={(e) => setForm({ ...form, lastContactNote: e.target.value })} /></label>
              </div>
              <button className="admin-btn-primary" style={{ marginTop: "0.8rem", fontSize: "0.76rem" }} disabled={busy} onClick={submitNew}>Enregistrer</button>
            </div>
          )}

          <div className="admin-filters" style={{ marginBottom: "0.8rem", flexWrap: "wrap" }}>
            {[{ v: "all", l: "Tous" }, { v: "relance", l: `Relances (${totals.relances.length})` }, ...SPONSOR_STATUSES.map((s) => ({ v: s.value, l: s.label })), ...SPONSOR_CATEGORIES.map((c) => ({ v: c.value, l: c.label }))].map((f) => (
              <button key={f.v} className="admin-filter-btn" data-active={String(filter === f.v)} onClick={() => setFilter(f.v)}>{f.l}</button>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
              <thead>
                <tr>{["Entreprise", "Catégorie / partenariat", "Montant", "Statut", "Dernière communication", "Relance", "Payé / dû"].map((h) => <th key={h} style={{ ...cell, color: "#9d9da0", fontWeight: 600, textAlign: "left" }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const pays = data.payments.filter((p) => p.sponsor_id === s.id);
                  const paid = pays.filter((p) => p.paid_at).reduce((a, p) => a + p.amount_cents, 0);
                  const due = pays.filter((p) => !p.paid_at).reduce((a, p) => a + p.amount_cents, 0);
                  const open = openId === s.id;
                  const lateFollow = s.follow_up_date && s.follow_up_date <= today && !["refuse", "termine", "paye"].includes(s.status);
                  return (
                    <Fragment key={s.id}>
                      <tr onClick={() => setOpenId(open ? null : s.id)} style={{ cursor: "pointer" }}>
                        <td style={cell}><strong style={{ color: "#fff" }}>{s.company_name}</strong><br /><span style={{ color: "#6d6b71" }}>{[s.contact_name, s.contact_phone, s.contact_email].filter(Boolean).join(" · ")}</span></td>
                        <td style={cell}>{label(SPONSOR_CATEGORIES, s.category)}<br /><span style={{ color: "#6d6b71" }}>{s.partnership_type ?? ""}</span></td>
                        <td style={cell}>{formatMoney(s.proposed_amount_cents)}</td>
                        <td style={cell}><span style={{ color: STATUS_COLOR[s.status], fontWeight: 700 }}>{label(SPONSOR_STATUSES, s.status)}</span></td>
                        <td style={cell}>{s.last_contact_at ?? "—"}<br /><span style={{ color: "#6d6b71" }}>{s.last_contact_note ?? ""}</span></td>
                        <td style={{ ...cell, color: lateFollow ? "#ffb464" : "#c3c2c8", fontWeight: lateFollow ? 700 : 400 }}>{s.follow_up_date ?? "—"}{lateFollow ? " ⚠" : ""}</td>
                        <td style={cell}>{formatMoney(paid)} / {formatMoney(due)}</td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={7} style={{ ...cell, background: "#0d0b13" }}>
                            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
                              <label style={field}>Statut
                                <select className="admin-group-select" value={s.status} disabled={busy} onChange={(e) => call({ action: "update", id: s.id, sponsor: { status: e.target.value } }, "Statut mis à jour.")}>
                                  {SPONSOR_STATUSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                              </label>
                              <label style={field}>Relance le<input type="date" className="admin-input" defaultValue={s.follow_up_date ?? ""} onBlur={(e) => e.target.value !== (s.follow_up_date ?? "") && call({ action: "update", id: s.id, sponsor: { followUpDate: e.target.value } }, "Relance programmée.")} /></label>
                              <label style={field}>Dernière communication<input type="date" className="admin-input" defaultValue={s.last_contact_at ?? ""} onBlur={(e) => e.target.value !== (s.last_contact_at ?? "") && call({ action: "update", id: s.id, sponsor: { lastContactAt: e.target.value } }, "Date mise à jour.")} /></label>
                              <label style={{ ...field, flex: 1, minWidth: "220px" }}>Note de communication<input className="admin-input" style={{ width: "100%" }} defaultValue={s.last_contact_note ?? ""} onBlur={(e) => e.target.value !== (s.last_contact_note ?? "") && call({ action: "update", id: s.id, sponsor: { lastContactNote: e.target.value } }, "Note enregistrée.")} /></label>
                              <label style={field}>Montant ($)<input className="admin-input" style={{ width: "110px" }} defaultValue={(s.proposed_amount_cents / 100).toString()} onBlur={(e) => { const v = Math.round((parseFloat(e.target.value.replace(",", ".")) || 0) * 100); if (v !== s.proposed_amount_cents) call({ action: "update", id: s.id, sponsor: { proposedAmountCents: v } }, "Montant mis à jour."); }} /></label>
                            </div>

                            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.4rem", fontSize: "0.78rem" }}>Paiements</p>
                            {pays.map((p) => (
                              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", padding: "0.25rem 0", borderBottom: "1px solid #1f1d25" }}>
                                <span>{formatMoney(p.amount_cents)}{p.due_date ? ` · dû le ${p.due_date}` : ""}{p.method ? ` · ${p.method}` : ""}{p.note ? ` — ${p.note}` : ""}</span>
                                <span>
                                  {p.paid_at ? <span style={{ color: "#8fce9f" }}>✓ Payé le {p.paid_at}</span> : <button className="admin-btn-ghost" style={{ fontSize: "0.66rem" }} disabled={busy} onClick={() => call({ action: "payment_update", id: p.id, paidAt: today }, "Paiement reçu.")}>Marquer payé</button>}{" "}
                                  <button className="admin-btn-ghost" style={{ fontSize: "0.66rem", color: "#ff9999" }} disabled={busy} onClick={() => confirm("Supprimer ce paiement ?") && call({ action: "payment_delete", id: p.id }, "Paiement supprimé.")}>×</button>
                                </span>
                              </div>
                            ))}
                            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", margin: "0.6rem 0 1rem" }}>
                              <input className="admin-input" placeholder="Montant ($)" style={{ width: "110px" }} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                              <input type="date" className="admin-input" title="Échéance" value={pay.dueDate} onChange={(e) => setPay({ ...pay, dueDate: e.target.value })} />
                              <input className="admin-input" placeholder="Mode (virement, chèque…)" style={{ width: "170px" }} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} />
                              <input className="admin-input" placeholder="Note" style={{ flex: 1, minWidth: "140px" }} value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
                              <button
                                className="admin-btn-primary"
                                style={{ fontSize: "0.7rem" }}
                                disabled={busy}
                                onClick={async () => {
                                  const v = parseFloat(pay.amount.replace(",", "."));
                                  if (!Number.isFinite(v) || v <= 0) return flash("Montant invalide.");
                                  if (await call({ action: "payment_add", sponsorId: s.id, amountCents: Math.round(v * 100), dueDate: pay.dueDate, method: pay.method, note: pay.note }, "Paiement ajouté.")) setPay({ amount: "", dueDate: "", paidAt: "", method: "", note: "" });
                                }}
                              >
                                + Paiement
                              </button>
                            </div>

                            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.4rem", fontSize: "0.78rem" }}>Documents (contrats, factures…)</p>
                            <EntityDocuments entityType="sponsor" entityId={s.id} />

                            <p style={{ margin: "0.8rem 0 0" }}>
                              <button className="admin-btn-ghost" style={{ fontSize: "0.68rem", color: "#ff9999" }} disabled={busy} onClick={() => confirm(`Supprimer définitivement ${s.company_name} ?`) && call({ action: "delete", id: s.id }, "Commanditaire supprimé.")}>Supprimer ce commanditaire</button>
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {list.length === 0 && <p className="admin-empty-text">Aucun commanditaire pour l&apos;instant.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
