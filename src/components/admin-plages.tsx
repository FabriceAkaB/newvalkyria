"use client";

import { useEffect, useRef, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { AdminLead } from "@/lib/repositories";
import type { SlotConfig } from "@/lib/timeslot-config-store";

const POLL_INTERVAL = 10_000;

interface Props {
  leads: AdminLead[];
}

/** Parse the goal field to get child name */
function getChildName(goal: string): string {
  const m = goal.match(/Joueuse:\s*([^·]+)/);
  return m?.[1]?.trim() ?? "";
}

export function AdminPlages({ leads: initialLeads }: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [slots, setSlots] = useState<SlotConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movingLead, setMovingLead] = useState<string | null>(null);

  // Load slot configs
  useEffect(() => {
    fetch("/api/admin/plages")
      .then((r) => r.json())
      .then((data: { slots: SlotConfig[] }) => setSlots(data.slots ?? []))
      .catch(() => setError("Impossible de charger les plages"))
      .finally(() => setLoading(false));
  }, []);

  // Poll leads for real-time updates (cancellations, status changes)
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/admin/leads", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { leads: AdminLead[] };
        setLeads(data.leads);
      } catch {
        // silencieux — on garde les données précédentes
      }
    };

    intervalRef.current = setInterval(() => { void poll(); }, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Group leads by time_slot (exclude cancelled)
  const leadsBySlot: Record<string, AdminLead[]> = {};
  const unassigned: AdminLead[] = [];

  for (const lead of leads.filter((l) => l.status !== "cancelled")) {
    const slotId = lead.time_slot;
    if (slotId && slots.some((s) => s.id === slotId)) {
      if (!leadsBySlot[slotId]) leadsBySlot[slotId] = [];
      leadsBySlot[slotId].push(lead);
    } else if (slotId) {
      // Has a time_slot string but doesn't match any slot ID — try matching by label
      const matched = slots.find((s) => `${s.day} — ${s.horaire}` === slotId || s.label === slotId);
      if (matched) {
        if (!leadsBySlot[matched.id]) leadsBySlot[matched.id] = [];
        leadsBySlot[matched.id].push(lead);
      } else {
        unassigned.push(lead);
      }
    } else {
      unassigned.push(lead);
    }
  }

  // Save slot configs
  const handleSaveSlots = async () => {
    setSaving(true);
    setError(null);
    setSaveOk(false);
    try {
      const res = await fetch("/api/admin/plages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  // Move a lead to a different slot
  const handleMoveLead = async (leadId: string, newSlotId: string) => {
    setMovingLead(leadId);
    setError(null);

    const slot = slots.find((s) => s.id === newSlotId);
    const newTimeSlot = slot ? `${slot.day} — ${slot.horaire}` : "";

    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time_slot: newSlotId }),
      });
      if (!res.ok) throw new Error("Erreur de déplacement");

      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, time_slot: newSlotId } : l))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setMovingLead(null);
    }
  };

  // Remove a lead from their slot (set to unassigned)
  const handleRemoveFromSlot = async (leadId: string) => {
    setMovingLead(leadId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time_slot: "" }),
      });
      if (!res.ok) throw new Error("Erreur");
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, time_slot: "" } : l))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setMovingLead(null);
    }
  };

  const handleCapacityChange = (slotId: string, value: number) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, maxPlaces: value } : s))
    );
  };

  if (loading) {
    return (
      <>
        <AdminTopbar />
        <div className="admin-content">
          <div className="admin-section">
            <p style={{ color: "#6d6b71" }}>Chargement...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>
              Plages horaires ({leads.length} joueuses)
            </p>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {saveOk && <span style={{ color: "#9ec99e", fontSize: "0.75rem" }}>✓ Sauvegardé</span>}
              <button onClick={handleSaveSlots} disabled={saving} className="admin-btn-primary" style={{ padding: "0.45rem 1rem", fontSize: "0.78rem" }}>
                {saving ? "Sauvegarde..." : "Sauvegarder capacités"}
              </button>
            </div>
          </div>

          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.5rem" }}>
            Gérez les joueuses par plage horaire. Déplacez-les entre créneaux et ajustez la capacité de chaque groupe.
          </p>

          {error && <p className="admin-error" style={{ marginBottom: "1rem" }}>{error}</p>}

          {/* Slots grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
            {slots.map((slot) => {
              const slotLeads = leadsBySlot[slot.id] ?? [];
              const isFull = slotLeads.length >= slot.maxPlaces;
              return (
                <div
                  key={slot.id}
                  style={{
                    background: "#100e17",
                    border: isFull
                      ? "1px solid rgba(255,100,100,0.3)"
                      : "1px solid #1f1d25",
                    borderRadius: "12px",
                    padding: "1rem 1.2rem",
                  }}
                >
                  {/* Slot header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff", margin: 0 }}>{slot.day}</p>
                      <p style={{ fontSize: "0.8rem", color: "#9f85ba", margin: "2px 0 0 0" }}>{slot.horaire}</p>
                      <p style={{ fontSize: "0.7rem", color: "#605f65", margin: "2px 0 0 0" }}>{slot.category} · {slot.practices} pratiques</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{
                        fontSize: "1.3rem",
                        fontWeight: 800,
                        color: isFull ? "#ff9999" : "#9ec99e",
                        margin: 0,
                      }}>
                        {slotLeads.length}/{slot.maxPlaces}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.3rem" }}>
                        <label style={{ fontSize: "0.6rem", color: "#605f65", textTransform: "uppercase" }}>Max</label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={slot.maxPlaces}
                          onChange={(e) => handleCapacityChange(slot.id, parseInt(e.target.value) || 1)}
                          style={{
                            width: "3rem",
                            padding: "0.2rem 0.4rem",
                            fontSize: "0.8rem",
                            background: "#17151e",
                            border: "1px solid #302e36",
                            borderRadius: "4px",
                            color: "#fff",
                            textAlign: "center",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Players list */}
                  <div style={{ minHeight: "2rem" }}>
                    {slotLeads.length === 0 ? (
                      <p style={{ fontSize: "0.75rem", color: "#3c3a41", fontStyle: "italic", padding: "0.5rem 0" }}>
                        Aucune joueuse assignée
                      </p>
                    ) : (
                      slotLeads.map((lead) => {
                        const childName = getChildName(lead.goal) || "Sans nom";
                        const isMoving = movingLead === lead.id;
                        return (
                          <div
                            key={lead.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "0.45rem 0.6rem",
                              marginBottom: "0.3rem",
                              background: "#121019",
                              borderRadius: "6px",
                              border: "1px solid #1a1820",
                              opacity: isMoving ? 0.5 : 1,
                            }}
                          >
                            <div>
                              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>{childName}</span>
                              <span style={{ fontSize: "0.7rem", color: "#605f65", marginLeft: "0.5rem" }}>{lead.parent_name}</span>
                            </div>
                            <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                              <select
                                value={slot.id}
                                onChange={(e) => handleMoveLead(lead.id, e.target.value)}
                                disabled={isMoving}
                                style={{
                                  padding: "0.2rem 0.4rem",
                                  fontSize: "0.68rem",
                                  background: "#17151e",
                                  border: "1px solid #302e36",
                                  borderRadius: "4px",
                                  color: "#b6b5b8",
                                  cursor: "pointer",
                                }}
                              >
                                {slots.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.day} {s.horaire}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleRemoveFromSlot(lead.id)}
                                disabled={isMoving}
                                title="Retirer du créneau"
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "rgba(255,100,100,0.6)",
                                  cursor: "pointer",
                                  fontSize: "0.9rem",
                                  padding: "0 0.2rem",
                                }}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unassigned players */}
          {unassigned.length > 0 && (
            <div style={{ padding: "1rem 1.2rem", background: "#151115", border: "1px solid #30261e", borderRadius: "10px" }}>
              <p style={{ fontSize: "0.85rem", color: "#f0c878", marginBottom: "0.6rem", fontWeight: 700 }}>
                ⚠ Joueuses non assignées ({unassigned.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {unassigned.map((lead) => {
                  const childName = getChildName(lead.goal) || "Sans nom";
                  const isMoving = movingLead === lead.id;
                  return (
                    <div
                      key={lead.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.5rem 0.7rem",
                        background: "#121019",
                        borderRadius: "6px",
                        border: "1px solid #1a1820",
                        opacity: isMoving ? 0.5 : 1,
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>{childName}</span>
                        <span style={{ fontSize: "0.7rem", color: "#605f65", marginLeft: "0.5rem" }}>{lead.parent_name}</span>
                        <span style={{ fontSize: "0.65rem", color: "#68577b", marginLeft: "0.5rem" }}>{lead.player_age}</span>
                      </div>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) handleMoveLead(lead.id, e.target.value);
                        }}
                        disabled={isMoving}
                        style={{
                          padding: "0.3rem 0.5rem",
                          fontSize: "0.72rem",
                          background: "#17151e",
                          border: "1px solid #433751",
                          borderRadius: "5px",
                          color: "#9f85ba",
                          cursor: "pointer",
                        }}
                      >
                        <option value="">Assigner →</option>
                        {slots.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.day} {s.horaire} ({s.category})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
