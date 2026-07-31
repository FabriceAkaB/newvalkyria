"use client";

import { useEffect, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { BirthCategory, Program, Registration, Season, TimeSlotTemplate } from "@/lib/season-admin-repo";

const SEEN_KEY_PREFIX = "nv_admin_saison_seen_";

interface Props {
  season: Season;
  categories: BirthCategory[];
  programs: Program[];
  slots: TimeSlotTemplate[];
  registrations: Registration[];
}

function playerName(r: Registration): string {
  const name = [r.player_first_name, r.player_last_name].filter(Boolean).join(" ");
  return name || "Sans nom";
}

function isHalfSeasonExpiringSoon(r: Registration): boolean {
  if (!r.is_half_season || !r.half_season_ends_on) return false;
  const end = new Date(r.half_season_ends_on);
  const now = new Date();
  const diffDays = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 2;
}

export function AdminSaisonOverview({ season, categories, programs, slots, registrations }: Props) {
  const [seenSince, setSeenSince] = useState<number>(0);

  useEffect(() => {
    const key = SEEN_KEY_PREFIX + season.id;
    const stored = localStorage.getItem(key);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture ponctuelle d'un système externe (localStorage) au montage
    setSeenSince(stored ? parseInt(stored, 10) : 0);
    localStorage.setItem(key, String(Date.now()));
  }, [season.id]);

  const active = registrations.filter((r) => r.status !== "cancelled");
  const paid = active.filter((r) => r.status === "paid");
  const pending = active.filter((r) => r.status === "pending" || r.status === "confirmed");
  const waitlist = active.filter((r) => r.status === "waitlist");
  const trials = active.filter((r) => r.is_trial);
  const halfSeason = active.filter((r) => r.is_half_season);
  const expiringSoon = active.filter(isHalfSeasonExpiringSoon);
  const newRegs = active.filter((r) => new Date(r.created_at).getTime() > seenSince);
  const unassigned = active.filter((r) => !r.time_slot_template_id);

  const programById = new Map(programs.map((p) => [p.id, p]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Vue d&apos;ensemble des groupes</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.5rem" }}>
            {active.length} inscription{active.length !== 1 ? "s" : ""} active{active.length !== 1 ? "s" : ""} pour {season.label}.
          </p>

          {/* Stats */}
          <div className="admin-stats" style={{ marginBottom: "2rem" }}>
            <div className="admin-stat-card">
              <p className="admin-stat-value">{active.length}</p>
              <p className="admin-stat-label">Total actives</p>
            </div>
            <div className="admin-stat-card admin-stat-card-accent">
              <p className="admin-stat-value">{paid.length}</p>
              <p className="admin-stat-label">Payées</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-value">{pending.length}</p>
              <p className="admin-stat-label">En attente</p>
            </div>
            <div className="admin-stat-card admin-stat-card-warn">
              <p className="admin-stat-value">{waitlist.length}</p>
              <p className="admin-stat-label">Liste d&apos;attente</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-value">{trials.length}</p>
              <p className="admin-stat-label">À l&apos;essai</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-value">{halfSeason.length}</p>
              <p className="admin-stat-label">Demi-saison</p>
            </div>
            {newRegs.length > 0 && (
              <div className="admin-stat-card admin-stat-card-accent">
                <p className="admin-stat-value">{newRegs.length}</p>
                <p className="admin-stat-label">Nouvelles</p>
              </div>
            )}
          </div>

          {/* Half-season expiring alert */}
          {expiringSoon.length > 0 && (
            <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: "10px", padding: "1rem 1.2rem", marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#f87171", marginBottom: "0.5rem" }}>
                ⚠ {expiringSoon.length} demi-saison{expiringSoon.length > 1 ? "s" : ""} se termine{expiringSoon.length > 1 ? "nt" : ""} dans 2 jours ou moins
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {expiringSoon.map((r) => (
                  <p key={r.id} style={{ fontSize: "0.78rem", color: "#ff9999", margin: 0 }}>
                    {playerName(r)} — {r.parent_name} ({r.parent_phone}) — fin le {r.half_season_ends_on}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Slots grid */}
          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>Par plage horaire</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
            {slots.map((slot) => {
              const slotRegs = active.filter((r) => r.time_slot_template_id === slot.id);
              const isFull = slotRegs.length >= slot.max_places;
              const remaining = Math.max(0, slot.max_places - slotRegs.length);
              return (
                <div
                  key={slot.id}
                  style={{
                    background: "#100e17",
                    border: isFull ? "1px solid rgba(255,100,100,0.3)" : "1px solid #1f1d25",
                    borderRadius: "12px",
                    padding: "1rem 1.2rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff", margin: 0 }}>
                        {slot.day} {slot.recommended_for_advanced && <span style={{ color: "#f0c878" }}>⭐</span>}
                      </p>
                      <p style={{ fontSize: "0.8rem", color: "#9f85ba", margin: "2px 0 0 0" }}>
                        {slot.start_time} – {slot.end_time} · {slot.location}
                      </p>
                      <p style={{ fontSize: "0.68rem", color: "#605f65", margin: "2px 0 0 0" }}>
                        {slot.category_ids.join(", ")}
                        {slot.advanced_only && <span style={{ color: "#f0c878" }}> · Avancé uniquement</span>}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "1.3rem", fontWeight: 800, color: isFull ? "#ff9999" : "#9ec99e", margin: 0 }}>
                        {slotRegs.length}/{slot.max_places}
                      </p>
                      <p style={{ fontSize: "0.68rem", color: "#605f65", margin: 0 }}>
                        {isFull ? "Complet" : `${remaining} place${remaining > 1 ? "s" : ""}`}
                      </p>
                    </div>
                  </div>
                  <div style={{ minHeight: "1.5rem" }}>
                    {slotRegs.length === 0 ? (
                      <p style={{ fontSize: "0.75rem", color: "#3c3a41", fontStyle: "italic" }}>Aucune joueuse assignée</p>
                    ) : (
                      slotRegs.map((r) => {
                        const isNew = new Date(r.created_at).getTime() > seenSince;
                        return (
                          <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.35rem 0", borderBottom: "1px solid #1a1820" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fff" }}>{playerName(r)}</span>
                              {isNew && <span className="admin-badge-new">Nouveau</span>}
                              {r.is_half_season && <span style={{ fontSize: "0.6rem", color: "#f0c878", background: "rgba(240,200,120,0.1)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>Demi-saison</span>}
                              {r.is_trial && <span style={{ fontSize: "0.6rem", color: "#88c0d0", background: "rgba(136,192,208,0.1)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>Essai</span>}
                            </div>
                            <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)" }}>
                              {r.program_id ?? "—"}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unassigned */}
          {unassigned.length > 0 && (
            <div style={{ padding: "1rem 1.2rem", background: "#151115", border: "1px solid #30261e", borderRadius: "10px" }}>
              <p style={{ fontSize: "0.85rem", color: "#f0c878", marginBottom: "0.6rem", fontWeight: 700 }}>
                ⚠ Inscriptions non assignées à une plage ({unassigned.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {unassigned.map((r) => (
                  <p key={r.id} style={{ fontSize: "0.8rem", color: "#fff", margin: 0 }}>
                    {playerName(r)} — {categoryById.get(r.category_id ?? "")?.label ?? r.category_id ?? "?"} · {programById.get(r.program_id ?? "")?.name ?? r.program_id ?? "?"}
                  </p>
                ))}
              </div>
            </div>
          )}

          {active.length === 0 && (
            <p className="admin-empty-text">Aucune inscription pour l&apos;instant dans cette saison.</p>
          )}
        </div>
      </div>
    </>
  );
}
