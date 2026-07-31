"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { BirthCategory, Program, Registration, RegistrationStatus, Season, TimeSlotTemplate } from "@/lib/season-admin-repo";

interface Props {
  season: Season;
  categories: BirthCategory[];
  programs: Program[];
  slots: TimeSlotTemplate[];
  initialRegistrations: Registration[];
}

const STATUS_LABELS: Record<RegistrationStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  paid: "Payée",
  waitlist: "Liste d'attente",
  cancelled: "Annulée"
};

function playerName(r: Registration): string {
  const name = [r.player_first_name, r.player_last_name].filter(Boolean).join(" ");
  return name || "Sans nom";
}

function isHalfSeasonExpiringSoon(r: Registration): boolean {
  if (!r.is_half_season || !r.half_season_ends_on) return false;
  const diffDays = (new Date(r.half_season_ends_on).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diffDays <= 2;
}

export function AdminSaisonInscriptions({ season, categories, programs, slots, initialRegistrations }: Props) {
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [filter, setFilter] = useState<"all" | RegistrationStatus>("all");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = filter === "all" ? registrations : registrations.filter((r) => r.status === filter);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setSaving(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/season/${season.id}/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      setRegistrations((prev) => prev.map((r) => (r.id === id ? { ...r, ...mapBodyToRegistration(body) } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(null);
    }
  };

  function mapBodyToRegistration(body: Record<string, unknown>): Partial<Registration> {
    const out: Partial<Registration> = {};
    if ("programId" in body) out.program_id = body.programId as string | null;
    if ("categoryId" in body) out.category_id = body.categoryId as string | null;
    if ("timeSlotTemplateId" in body) out.time_slot_template_id = body.timeSlotTemplateId as string | null;
    if ("advancedGroup" in body) out.advanced_group = body.advancedGroup as boolean;
    if ("status" in body) out.status = body.status as RegistrationStatus;
    if ("isHalfSeason" in body) out.is_half_season = body.isHalfSeason as boolean;
    if ("halfSeasonEndsOn" in body) out.half_season_ends_on = body.halfSeasonEndsOn as string | null;
    if ("isTrial" in body) out.is_trial = body.isTrial as boolean;
    return out;
  }

  const slotsForCategory = (categoryId: string | null) =>
    categoryId ? slots.filter((s) => s.category_ids.includes(categoryId)) : slots;

  const counts = {
    all: registrations.length,
    pending: registrations.filter((r) => r.status === "pending").length,
    confirmed: registrations.filter((r) => r.status === "confirmed").length,
    paid: registrations.filter((r) => r.status === "paid").length,
    waitlist: registrations.filter((r) => r.status === "waitlist").length,
    cancelled: registrations.filter((r) => r.status === "cancelled").length
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Gestion des inscriptions</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Déplacez une joueuse entre plages, catégories ou programmes, ou basculez-la entre groupe avancé et régulier — sans recréer l&apos;inscription.
          </p>

          {error && <p className="admin-error" style={{ marginBottom: "1rem" }}>{error}</p>}

          {/* Filters */}
          <div className="admin-filters" style={{ marginBottom: "1.25rem" }}>
            {(["all", "pending", "confirmed", "paid", "waitlist", "cancelled"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className="admin-filter-btn" data-active={String(filter === f)}>
                {f === "all" ? "Toutes" : STATUS_LABELS[f]}
                <span className="admin-filter-count">{counts[f]}</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 && <p className="admin-empty-text">Aucune inscription dans ce filtre.</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {filtered.map((r) => {
              const isSaving = saving === r.id;
              const availableSlots = slotsForCategory(r.category_id);
              const expiringSoon = isHalfSeasonExpiringSoon(r);
              return (
                <div
                  key={r.id}
                  style={{
                    background: "#100e17",
                    border: expiringSoon ? "1px solid rgba(248,113,113,0.5)" : "1px solid #1f1d25",
                    borderRadius: "10px",
                    padding: "0.85rem 1.1rem",
                    opacity: isSaving ? 0.6 : 1
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.65rem" }}>
                    <div>
                      <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "#fff", margin: 0 }}>{playerName(r)}</p>
                      <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", margin: "0.15rem 0 0" }}>{r.parent_name} · {r.parent_email} · {r.parent_phone}</p>
                      {expiringSoon && (
                        <p style={{ fontSize: "0.7rem", color: "#f87171", fontWeight: 700, margin: "0.3rem 0 0" }}>
                          ⚠ Demi-saison se termine le {r.half_season_ends_on}
                        </p>
                      )}
                    </div>
                    <span className={`admin-badge ${r.status === "paid" ? "admin-badge-paid" : r.status === "waitlist" ? "admin-badge-waitlist" : "admin-badge-pending"}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.6rem" }}>
                    <label className="admin-field" style={{ gap: "0.3rem" }}>
                      <span style={{ fontSize: "0.6rem" }}>Programme</span>
                      <select className="admin-input" value={r.program_id ?? ""} onChange={(e) => patch(r.id, { programId: e.target.value || null })}>
                        <option value="">—</option>
                        {programs.map((p) => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
                      </select>
                    </label>

                    <label className="admin-field" style={{ gap: "0.3rem" }}>
                      <span style={{ fontSize: "0.6rem" }}>Catégorie</span>
                      <select className="admin-input" value={r.category_id ?? ""} onChange={(e) => patch(r.id, { categoryId: e.target.value || null, timeSlotTemplateId: null })}>
                        <option value="">—</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </label>

                    <label className="admin-field" style={{ gap: "0.3rem" }}>
                      <span style={{ fontSize: "0.6rem" }}>Plage horaire</span>
                      <select className="admin-input" value={r.time_slot_template_id ?? ""} onChange={(e) => patch(r.id, { timeSlotTemplateId: e.target.value || null })}>
                        <option value="">Non assignée</option>
                        {availableSlots.map((s) => (
                          <option key={s.id} value={s.id}>{s.day} {s.start_time}–{s.end_time} · {s.location}</option>
                        ))}
                      </select>
                    </label>

                    <label className="admin-field" style={{ gap: "0.3rem" }}>
                      <span style={{ fontSize: "0.6rem" }}>Statut</span>
                      <select className="admin-input" value={r.status} onChange={(e) => patch(r.id, { status: e.target.value })}>
                        {(Object.keys(STATUS_LABELS) as RegistrationStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                    </label>
                  </div>

                  <div style={{ display: "flex", gap: "1.25rem", marginTop: "0.7rem", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#c3c2c8", cursor: "pointer" }}>
                      <input type="checkbox" checked={r.advanced_group} onChange={(e) => patch(r.id, { advancedGroup: e.target.checked })} />
                      Groupe avancé
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#c3c2c8", cursor: "pointer" }}>
                      <input type="checkbox" checked={r.is_trial} onChange={(e) => patch(r.id, { isTrial: e.target.checked })} />
                      À l&apos;essai
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#c3c2c8", cursor: "pointer" }}>
                      <input type="checkbox" checked={r.is_half_season} onChange={(e) => patch(r.id, { isHalfSeason: e.target.checked, halfSeasonEndsOn: e.target.checked ? r.half_season_ends_on : null })} />
                      Demi-saison
                    </label>
                    {r.is_half_season && (
                      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#c3c2c8" }}>
                        Fin le
                        <input
                          type="date"
                          value={r.half_season_ends_on ?? ""}
                          onChange={(e) => patch(r.id, { halfSeasonEndsOn: e.target.value || null })}
                          style={{ padding: "0.2rem 0.4rem", fontSize: "0.72rem", background: "#17151e", border: "1px solid #302e36", borderRadius: "4px", color: "#fff" }}
                        />
                      </label>
                    )}
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
