"use client";

import { Fragment, useMemo, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { effectiveCategories, restrictionLabel, totalsFor, type SlotGender } from "@/lib/match-slots-core";
import { formatMoney } from "@/lib/private-programs";
import type { MatchBooking, MatchSlot, MatchTeamProfile } from "@/lib/match-slots-repo";

type Slot = MatchSlot & { available: boolean };
type Booking = MatchBooking & { slot: MatchSlot };
const STATUS: Record<string, [string, string]> = { pending: ["En attente", "#f0c878"], paid: ["Payée", "#8fce9f"], cancelled: ["Annulée", "#ff9999"] };
const GENDER_LABEL: Record<string, string> = { filles: "Filles", garcons: "Garçons", mixte: "Mixte" };

/** Valeurs du formulaire d'édition d'une plage (tout en texte, converti à l'envoi). */
interface CategoryDraft {
  gender: SlotGender;
  min: string;
  max: string;
}

interface Draft {
  format: string;
  opponent: string;
  /** Catégories d'équipes admises (une ligne = genre + années). Vide = aucune restriction. */
  categories: CategoryDraft[];
  preferred: string;
  restrictionNote: string;
  notes: string;
  deposit: string;
  balance: string;
  location: string;
  field: string;
}

/** Équipes de chez nous, pour annoncer clairement l'adversaire (menu rapide). */
const NV_TEAMS = [
  "Équipe 2015 AV (filles)",
  "Équipe 2016-2017 AV (filles)",
  "Équipe 2015 INT (filles)",
  "Équipe 2016-2017 INT (filles)",
  "Équipe 2013-2014 INT (filles)"
];

function draftOf(s: MatchSlot): Draft {
  const cats = effectiveCategories(s) ?? [];
  return {
    format: s.match_format ?? "",
    opponent: s.opponent ?? "",
    categories: cats.map((c) => ({ gender: c.gender, min: c.birthYearMin?.toString() ?? "", max: c.birthYearMax?.toString() ?? "" })),
    preferred: s.preferred_note ?? "",
    restrictionNote: s.restriction_note ?? "",
    notes: s.notes ?? "",
    deposit: (s.price_cents / 100).toString(),
    balance: (s.balance_due_cents / 100).toString(),
    location: s.location,
    field: s.field_label ?? ""
  };
}

const toCents = (v: string) => Math.round((parseFloat(v.replace(",", ".")) || 0) * 100);

function payload(d: Draft, only?: Set<keyof Draft>): Record<string, unknown> {
  const all: Record<keyof Draft, Record<string, unknown>> = {
    format: { format: d.format },
    opponent: { opponent: d.opponent },
    // Les catégories remplacent entièrement les anciennes colonnes simples (genre + années).
    categories: {
      allowedCategories: d.categories.map((c) => ({ gender: c.gender, birthYearMin: c.min, birthYearMax: c.max })),
      allowedGender: "tous",
      birthYearMin: "",
      birthYearMax: ""
    },
    preferred: { preferredNote: d.preferred },
    restrictionNote: { restrictionNote: d.restrictionNote },
    notes: { notes: d.notes },
    deposit: { priceCents: toCents(d.deposit) },
    balance: { balanceDueCents: toCents(d.balance) },
    location: { location: d.location },
    field: { field: d.field }
  };
  const keys = (only ? Array.from(only) : (Object.keys(all) as (keyof Draft)[]));
  return Object.assign({}, ...keys.map((k) => all[k]));
}

const EMPTY_BULK: Draft = { format: "", opponent: "", categories: [], preferred: "", restrictionNote: "", notes: "", deposit: "", balance: "", location: "", field: "" };

export function AdminMatchs({ initial, origin }: { initial: { slots: Slot[]; bookings: Booking[]; profiles: MatchTeamProfile[] }; origin: string }) {
  const [data, setData] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [bulk, setBulk] = useState<Draft>(EMPTY_BULK);
  const [bulkFields, setBulkFields] = useState<Set<keyof Draft>>(new Set());
  const [ns, setNs] = useState({ date: "", start: "17:30", end: "18:30", location: "Complexe sportif Terrebonne, Centre de soccer multifonctionnel, terrain #4 – 2475, boul. des Entreprises, Terrebonne J6X 4J9", field: "Terrain n° 4", deposit: "50", balance: "150" });
  const today = new Date().toISOString().slice(0, 10);
  const link = `${origin}/prive/matchs`;

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 5000);
  };

  const call = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/matchs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      setData(await fetch("/api/admin/matchs").then((r) => r.json()));
      flash(json.refunded ? `${ok} — remboursée via Stripe.` : ok);
      return true;
    } catch (e) {
      flash(e instanceof Error ? e.message : "Erreur");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const takenBy = (slotId: string) => data.bookings.find((b) => b.slot_id === slotId && (b.status === "paid" || b.status === "pending"));
  const slots = data.slots.filter((s) => showPast || s.slot_date >= today);
  const upcoming = data.slots.filter((s) => s.active && s.slot_date >= today);
  const potential = totalsFor(upcoming);
  const sold = data.bookings.filter((b) => b.status === "paid");
  const depositsCents = sold.reduce((n, b) => n + b.price_cents, 0);
  const balanceReceived = sold.filter((b) => b.balance_paid_at).reduce((n, b) => n + b.balance_due_cents, 0);
  const balanceExpected = sold.filter((b) => !b.balance_paid_at).reduce((n, b) => n + b.balance_due_cents, 0);
  const doublesCount = new Set(upcoming.filter((s) => s.double_group).map((s) => s.double_group)).size;

  const cell: React.CSSProperties = { padding: "0.45rem 0.5rem", borderBottom: "1px solid #1f1d25", fontSize: "0.76rem", color: "#c3c2c8", verticalAlign: "top" };
  const card: React.CSSProperties = { background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem", marginBottom: "1.25rem" };
  const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.7rem", color: "#9d9da0" };

  const fields = (d: Draft, set: (n: Draft) => void, bulkMode = false) => {
    const wrap = (key: keyof Draft, label: string, node: React.ReactNode) => (
      <label style={lbl}>
        <span>
          {bulkMode && <input type="checkbox" checked={bulkFields.has(key)} onChange={(e) => setBulkFields((prev) => { const n = new Set(prev); e.target.checked ? n.add(key) : n.delete(key); return n; })} style={{ marginRight: "0.35rem" }} />}
          {label}
        </span>
        {node}
      </label>
    );
    const touch = (key: keyof Draft) => bulkMode && setBulkFields((prev) => new Set(prev).add(key));
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "0.6rem" }}>
        {wrap("format", "Format du match", <input className="admin-input" placeholder="ex. 7 contre 7" value={d.format} onChange={(e) => { touch("format"); set({ ...d, format: e.target.value }); }} />)}
        {wrap("opponent", "Adversaire (équipe de chez nous)", (
          <>
            <select className="admin-input" value="" onChange={(e) => { if (e.target.value) { touch("opponent"); set({ ...d, opponent: `New Valkyria — ${e.target.value}` }); } }}>
              <option value="">Choisir une équipe…</option>
              {NV_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="admin-input" placeholder="ou écrire : New Valkyria — Équipe 2015 AV" value={d.opponent} onChange={(e) => { touch("opponent"); set({ ...d, opponent: e.target.value }); }} />
          </>
        ))}
        {wrap("categories", "Équipes admises (catégories)", (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {d.categories.length === 0 && <span style={{ fontSize: "0.72rem", color: "#6d6b71" }}>Aucune restriction : toutes les équipes sont admises.</span>}
            {d.categories.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: "0.3rem", alignItems: "center", flexWrap: "wrap" }}>
                <select className="admin-input" value={c.gender} onChange={(e) => { touch("categories"); set({ ...d, categories: d.categories.map((x, j) => (j === i ? { ...x, gender: e.target.value as SlotGender } : x)) }); }}>
                  <option value="tous">Tous genres</option>
                  <option value="filles">Filles</option>
                  <option value="garcons">Garçons</option>
                </select>
                <input className="admin-input" style={{ width: "64px" }} inputMode="numeric" placeholder="de 2014" title="Année de naissance la plus ancienne admise" value={c.min} onChange={(e) => { touch("categories"); set({ ...d, categories: d.categories.map((x, j) => (j === i ? { ...x, min: e.target.value.replace(/\D/g, "").slice(0, 4) } : x)) }); }} />
                <span style={{ fontSize: "0.7rem" }}>à</span>
                <input className="admin-input" style={{ width: "64px" }} inputMode="numeric" placeholder="à 2015" title="Année de naissance la plus récente admise" value={c.max} onChange={(e) => { touch("categories"); set({ ...d, categories: d.categories.map((x, j) => (j === i ? { ...x, max: e.target.value.replace(/\D/g, "").slice(0, 4) } : x)) }); }} />
                <button type="button" className="admin-btn-ghost" style={{ fontSize: "0.66rem", color: "#ff9999" }} onClick={() => { touch("categories"); set({ ...d, categories: d.categories.filter((_, j) => j !== i) }); }}>Retirer</button>
              </div>
            ))}
            <button type="button" className="admin-btn-ghost" style={{ fontSize: "0.7rem", alignSelf: "flex-start" }} onClick={() => { touch("categories"); set({ ...d, categories: [...d.categories, { gender: "garcons", min: "", max: "" }] }); }}>+ Ajouter une catégorie admise</button>
            <span style={{ fontSize: "0.66rem", color: "#6d6b71" }}>Ex. : « Garçons de 2014 à 2014 » + « Filles de 2014 à 2015 ». L&apos;équipe doit correspondre à au moins une ligne.</span>
          </div>
        ))}
        {wrap("preferred", "Équipe recherchée (message positif)", <input className="admin-input" placeholder="ex. Équipe 2014 recherchée" value={d.preferred} onChange={(e) => { touch("preferred"); set({ ...d, preferred: e.target.value }); }} />)}
        {wrap("restrictionNote", "Autre restriction (texte)", <input className="admin-input" placeholder="ex. niveau compétitif" value={d.restrictionNote} onChange={(e) => { touch("restrictionNote"); set({ ...d, restrictionNote: e.target.value }); }} />)}
        {wrap("deposit", "Acompte pour réserver ($)", <input className="admin-input" value={d.deposit} onChange={(e) => { touch("deposit"); set({ ...d, deposit: e.target.value }); }} />)}
        {wrap("balance", "Solde le jour du match ($)", <input className="admin-input" value={d.balance} onChange={(e) => { touch("balance"); set({ ...d, balance: e.target.value }); }} />)}
        {wrap("notes", "Précisions affichées aux équipes", <input className="admin-input" placeholder="ex. arrivée 20 min avant" value={d.notes} onChange={(e) => { touch("notes"); set({ ...d, notes: e.target.value }); }} />)}
        {!bulkMode && wrap("location", "Adresse / lieu", <input className="admin-input" value={d.location} onChange={(e) => set({ ...d, location: e.target.value })} />)}
        {!bulkMode && wrap("field", "Terrain", <input className="admin-input" value={d.field} onChange={(e) => set({ ...d, field: e.target.value })} />)}
      </div>
    );
  };

  const checkedSlots = useMemo(() => data.slots.filter((s) => checked.includes(s.id)), [data.slots, checked]);
  const canLink = checkedSlots.length === 2 && !checkedSlots[0].double_group && !checkedSlots[1].double_group;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Matchs vendus aux académies</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1rem" }}>
            Page de réservation à envoyer aux équipes extérieures :{" "}
            <a href={link} target="_blank" rel="noreferrer" style={{ color: "#c4a4e4" }}>{link}</a>{" "}
            <button className="admin-btn-ghost" style={{ fontSize: "0.68rem" }} onClick={() => navigator.clipboard.writeText(link).then(() => flash("Lien copié."))}>Copier</button>
            <br />Règles automatiques : acompte en ligne pour réserver (50 $ par plage par défaut), solde payable le jour du match (150 $ par plage par défaut, pour un total de 200 $ par plage), 2 plages maximum par équipe, doubles cédules réservées en bloc, restrictions vérifiées côté serveur.
          </p>
          {msg && <p style={{ fontSize: "0.78rem", color: "#8fce9f" }}>{msg}</p>}

          <div className="admin-stats" style={{ marginBottom: "1.2rem" }}>
            <div className="admin-stat-card"><p className="admin-stat-value">{upcoming.length}</p><p className="admin-stat-label">Plages à venir{doublesCount ? ` (dont ${doublesCount} doubles)` : ""}</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{sold.filter((b) => b.slot.slot_date >= today).length}</p><p className="admin-stat-label">Vendues (à venir)</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{formatMoney(potential.totalCents)}</p><p className="admin-stat-label">Potentiel total si tout est vendu</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{formatMoney(depositsCents)}</p><p className="admin-stat-label">Acomptes encaissés</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{formatMoney(balanceExpected)}</p><p className="admin-stat-label">Soldes à recevoir (jour du match)</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{formatMoney(balanceReceived)}</p><p className="admin-stat-label">Soldes reçus</p></div>
          </div>
          <p style={{ fontSize: "0.76rem", color: "#9d9da0", margin: "-0.6rem 0 1.2rem" }}>
            Potentiel : {upcoming.length} plage{upcoming.length > 1 ? "s" : ""} = {formatMoney(potential.depositCents)} d&apos;acomptes + {formatMoney(potential.balanceCents)} de soldes le jour du match.
          </p>

          {/* ── Équipes ayant rempli le formulaire ── */}
          <div style={card}>
            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.2rem" }}>Équipes ayant rempli le formulaire ({data.profiles.length})</p>
            <p style={{ fontSize: "0.74rem", color: "#6d6b71", margin: "0 0 0.6rem" }}>Une équipe doit remplir ce formulaire avant de pouvoir choisir une plage. Utile pour relancer celles qui n&apos;ont pas réservé.</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
                <thead><tr>{["Académie / équipe", "Catégorie", "Niveau", "Contact", "Réservation", "Reçu le"].map((h) => <th key={h} style={{ ...cell, color: "#9d9da0", textAlign: "left", fontWeight: 600 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.profiles.map((p) => {
                    const booked = data.bookings.filter((b) => b.team_profile_id === p.id && b.status !== "cancelled").length;
                    return (
                      <tr key={p.id}>
                        <td style={cell}><strong style={{ color: "#fff" }}>{p.org_name}</strong><br />{p.team_label}{p.notes ? <><br /><em>{p.notes}</em></> : null}</td>
                        <td style={cell}>{GENDER_LABEL[p.team_gender]} · nés en {p.team_birth_year}</td>
                        <td style={cell}>{p.team_level}{p.team_players ? <><br />{p.team_players} joueurs</> : null}</td>
                        <td style={cell}>{p.contact_name}<br />{p.contact_email}<br />{p.contact_phone}</td>
                        <td style={cell}>{booked > 0 ? <span style={{ color: "#8fce9f", fontWeight: 700 }}>{booked} plage{booked > 1 ? "s" : ""}</span> : <span style={{ color: "#f0c878" }}>Aucune — à relancer</span>}</td>
                        <td style={cell}>{new Date(p.created_at).toLocaleDateString("fr-CA")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {data.profiles.length === 0 && <p className="admin-empty-text">Aucune équipe n&apos;a encore rempli le formulaire.</p>}
            </div>
          </div>

          {/* ── Réservations ── */}
          <div style={card}>
            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>Réservations ({data.bookings.length})</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                <thead><tr>{["Match", "Académie / équipe", "Contact", "Acompte", "Solde jour du match", "Statut", ""].map((h) => <th key={h} style={{ ...cell, color: "#9d9da0", textAlign: "left", fontWeight: 600 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.bookings.map((b) => (
                    <tr key={b.id} style={{ opacity: b.status === "cancelled" ? 0.5 : 1 }}>
                      <td style={cell}>{b.slot.slot_date}<br />{b.slot.start_time} – {b.slot.end_time}{b.slot.double_group ? <><br /><span style={{ color: "#c4a4e4" }}>Double cédule</span></> : null}</td>
                      <td style={cell}>
                        <strong style={{ color: "#fff" }}>{b.org_name}</strong><br />{b.team_label}
                        {b.team_gender ? <><br />{GENDER_LABEL[b.team_gender]}{b.team_birth_year ? ` · nés en ${b.team_birth_year}` : ""}{b.team_level ? ` · ${b.team_level}` : ""}</> : null}
                        {b.notes ? <><br /><em>{b.notes}</em></> : null}
                      </td>
                      <td style={cell}>{b.contact_name}<br />{b.contact_email}<br />{b.contact_phone}</td>
                      <td style={cell}>{formatMoney(b.price_cents)}</td>
                      <td style={cell}>
                        {formatMoney(b.balance_due_cents)}
                        {b.status === "paid" && (
                          <><br />
                            {b.balance_paid_at
                              ? <button className="admin-btn-ghost" style={{ fontSize: "0.66rem", color: "#8fce9f" }} disabled={busy} onClick={() => call({ action: "booking_balance_paid", bookingId: b.id, paid: false }, "Solde remis à recevoir.")}>✓ Solde reçu</button>
                              : <button className="admin-btn-ghost" style={{ fontSize: "0.66rem" }} disabled={busy} onClick={() => call({ action: "booking_balance_paid", bookingId: b.id, paid: true }, "Solde marqué reçu.")}>Marquer le solde reçu</button>}
                          </>
                        )}
                      </td>
                      <td style={cell}><span style={{ color: STATUS[b.status][1], fontWeight: 700 }}>{STATUS[b.status][0]}</span>{b.cancelled_reason ? <><br /><span style={{ color: "#6d6b71" }}>{b.cancelled_reason}</span></> : null}</td>
                      <td style={cell}>
                        {b.status === "pending" && <button className="admin-btn-ghost" style={{ fontSize: "0.66rem" }} disabled={busy} onClick={() => confirm("Marquer comme payée (paiement reçu hors ligne) ?") && call({ action: "booking_mark_paid", bookingId: b.id }, "Marquée payée.")}>Marquer payée</button>}{" "}
                        {b.status === "paid" && <button className="admin-btn-ghost" style={{ fontSize: "0.66rem" }} disabled={busy} onClick={() => call({ action: "booking_resend", bookingId: b.id }, "Confirmation renvoyée.")}>Renvoyer la confirmation</button>}{" "}
                        {b.status !== "cancelled" && <button className="admin-btn-ghost" style={{ fontSize: "0.66rem", color: "#ff9999" }} disabled={busy} onClick={() => confirm(b.status === "paid" ? `Annuler et rembourser l'acompte de ${formatMoney(b.price_cents)} ?` : "Libérer cette plage ?") && call({ action: "booking_cancel", bookingId: b.id, refund: b.status === "paid" }, "Annulée")}>{b.status === "paid" ? "Annuler + rembourser" : "Libérer"}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.bookings.length === 0 && <p className="admin-empty-text">Aucune réservation pour l&apos;instant.</p>}
            </div>
          </div>

          {/* ── Plages ── */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.7rem" }}>
              <p style={{ fontWeight: 700, color: "#fff", margin: 0 }}>Plages de match ({slots.length})</p>
              <label style={{ fontSize: "0.72rem", color: "#9d9da0" }}><input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> Afficher les plages passées</label>
            </div>

            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
              <input type="date" className="admin-input" value={ns.date} onChange={(e) => setNs({ ...ns, date: e.target.value })} />
              <input type="time" className="admin-input" value={ns.start} onChange={(e) => setNs({ ...ns, start: e.target.value })} />
              <input type="time" className="admin-input" value={ns.end} onChange={(e) => setNs({ ...ns, end: e.target.value })} />
              <input className="admin-input" style={{ flex: 1, minWidth: "180px" }} value={ns.location} onChange={(e) => setNs({ ...ns, location: e.target.value })} />
              <input className="admin-input" style={{ width: "80px" }} title="Acompte ($)" value={ns.deposit} onChange={(e) => setNs({ ...ns, deposit: e.target.value })} />
              <input className="admin-input" style={{ width: "80px" }} title="Solde le jour du match ($)" value={ns.balance} onChange={(e) => setNs({ ...ns, balance: e.target.value })} />
              <button className="admin-btn-primary" style={{ fontSize: "0.72rem" }} disabled={busy || !ns.date} onClick={() => call({ action: "slot_create", date: ns.date, start: ns.start, end: ns.end, location: ns.location, field: ns.field, priceCents: toCents(ns.deposit), balanceDueCents: toCents(ns.balance) }, "Plage ajoutée (liée automatiquement en double cédule si elle suit une autre plage).")}>+ Ajouter une plage</button>
            </div>

            {checked.length > 0 && (
              <div style={{ border: "1px solid #3a2f4d", borderRadius: "10px", padding: "0.8rem", marginBottom: "0.9rem", background: "#14111c" }}>
                <p style={{ margin: "0 0 0.5rem", fontWeight: 700, color: "#fff", fontSize: "0.82rem" }}>
                  {checked.length} plage{checked.length > 1 ? "s" : ""} cochée{checked.length > 1 ? "s" : ""} — cochez les champs à appliquer, puis validez
                </p>
                {fields(bulk, setBulk, true)}
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.7rem" }}>
                  <button
                    className="admin-btn-primary"
                    style={{ fontSize: "0.72rem" }}
                    disabled={busy || bulkFields.size === 0}
                    onClick={async () => {
                      const ok = await call({ action: "slots_bulk_update", slotIds: checked, ...payload(bulk, bulkFields) }, `Appliqué à ${checked.length} plage${checked.length > 1 ? "s" : ""}.`);
                      if (ok) { setBulkFields(new Set()); setBulk(EMPTY_BULK); }
                    }}
                  >
                    Appliquer aux plages cochées
                  </button>
                  {canLink && (
                    <button className="admin-btn-ghost" style={{ fontSize: "0.72rem" }} disabled={busy} onClick={() => call({ action: "slot_link_double", slotIds: checked }, "Double cédule créée.")}>Lier ces 2 plages en double cédule</button>
                  )}
                  <button className="admin-btn-ghost" style={{ fontSize: "0.72rem" }} onClick={() => setChecked([])}>Tout décocher</button>
                </div>
              </div>
            )}

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "860px" }}>
                <tbody>
                  {slots.map((s) => {
                    const b = takenBy(s.id);
                    const restr = restrictionLabel(s);
                    const open = editing === s.id && draft;
                    return (
                      <Fragment key={s.id}>
                        <tr style={{ opacity: s.active ? 1 : 0.5 }}>
                          <td style={cell}><input type="checkbox" aria-label="Cocher la plage" checked={checked.includes(s.id)} onChange={(e) => setChecked((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)))} /></td>
                          <td style={cell}>
                            {new Date(s.slot_date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                            <br />{s.start_time} – {s.end_time}
                            {s.double_group && <><br /><span style={{ color: "#c4a4e4", fontWeight: 700 }}>Double cédule</span></>}
                          </td>
                          <td style={cell}>
                            <strong style={{ color: "#fff" }}>{s.match_format ?? "Format à préciser"}</strong>
                            <br />Adversaire : {s.opponent ?? <em style={{ color: "#f0c878" }}>à préciser</em>}
                            <br />{s.field_label ?? s.location.split("–")[0]}
                          </td>
                          <td style={cell}>{restr ?? <span style={{ color: "#6d6b71" }}>Aucune restriction</span>}{s.preferred_note ? <><br /><span style={{ color: "#8fce9f" }}>{s.preferred_note}</span></> : null}</td>
                          <td style={cell}>Acompte {formatMoney(s.price_cents)}<br />Solde {formatMoney(s.balance_due_cents)}</td>
                          <td style={cell}>{b ? <span style={{ color: STATUS[b.status][1], fontWeight: 700 }}>{b.status === "paid" ? "Vendue" : "En paiement"} — {b.org_name}</span> : <span style={{ color: "#8fce9f" }}>Libre</span>}</td>
                          <td style={cell}>
                            <button className="admin-btn-ghost" style={{ fontSize: "0.66rem" }} disabled={busy} onClick={() => { if (open) { setEditing(null); setDraft(null); } else { setEditing(s.id); setDraft(draftOf(s)); } }}>{open ? "Fermer" : "Modifier"}</button>{" "}
                            <button className="admin-btn-ghost" style={{ fontSize: "0.66rem" }} disabled={busy} onClick={() => call({ action: "slot_update", slotId: s.id, active: !s.active }, s.active ? "Plage masquée." : "Plage affichée.")}>{s.active ? "Masquer" : "Afficher"}</button>{" "}
                            {s.double_group && <button className="admin-btn-ghost" style={{ fontSize: "0.66rem" }} disabled={busy} onClick={() => confirm("Dissocier cette double cédule ? Les deux plages redeviennent indépendantes.") && call({ action: "slot_unlink_double", slotId: s.id }, "Double cédule dissociée.")}>Dissocier</button>}{" "}
                            {!b && <button className="admin-btn-ghost" style={{ fontSize: "0.66rem", color: "#ff9999" }} disabled={busy} onClick={() => confirm("Supprimer cette plage ?") && call({ action: "slot_delete", slotId: s.id }, "Plage supprimée.")}>Supprimer</button>}
                          </td>
                        </tr>
                        {open && draft && (
                          <tr>
                            <td colSpan={7} style={{ ...cell, background: "#14111c" }}>
                              {fields(draft, setDraft)}
                              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem" }}>
                                <button
                                  className="admin-btn-primary"
                                  style={{ fontSize: "0.72rem" }}
                                  disabled={busy}
                                  onClick={async () => {
                                    const ok = await call({ action: "slot_update", slotId: s.id, ...payload(draft) }, "Plage mise à jour.");
                                    if (ok) { setEditing(null); setDraft(null); }
                                  }}
                                >
                                  Enregistrer
                                </button>
                                <button className="admin-btn-ghost" style={{ fontSize: "0.72rem" }} onClick={() => { setEditing(null); setDraft(null); }}>Annuler</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
