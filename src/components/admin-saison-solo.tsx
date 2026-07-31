"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { Registration, Season, SoloGroup, SoloGroupDate, SoloGroupMember } from "@/lib/season-admin-repo";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

interface Props {
  season: Season;
  initialGroups: SoloGroup[];
  initialDatesByGroup: Record<string, SoloGroupDate[]>;
  initialMembersByGroup: Record<string, SoloGroupMember[]>;
  initialUnassigned: Registration[];
}

interface NewGroupForm {
  label: string;
  day: string;
  startTime: string;
  endTime: string;
  location: string;
  maxPlaces: number;
}

const EMPTY_FORM: NewGroupForm = { label: "", day: "Vendredi", startTime: "18:00", endTime: "19:15", location: "", maxPlaces: 4 };

function playerName(r: Registration): string {
  const name = [r.player_first_name, r.player_last_name].filter(Boolean).join(" ");
  return name || "Sans nom";
}

export function AdminSaisonSolo({ season, initialGroups, initialDatesByGroup, initialMembersByGroup, initialUnassigned }: Props) {
  const [groups, setGroups] = useState(initialGroups);
  const [datesByGroup, setDatesByGroup] = useState(initialDatesByGroup);
  const [membersByGroup, setMembersByGroup] = useState(initialMembersByGroup);
  const [unassigned, setUnassigned] = useState(initialUnassigned);
  const [registrationById] = useState(() => {
    const map = new Map<string, Registration>();
    for (const r of initialUnassigned) map.set(r.id, r);
    return map;
  });
  const [newDateInput, setNewDateInput] = useState<Record<string, string>>({});
  const [assignSelect, setAssignSelect] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewGroupForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const handleCreateGroup = async () => {
    if (!form.label.trim() || !form.location.trim()) {
      setError("Étiquette et lieu requis.");
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/admin/season/${season.id}/solo-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur de création");
      setGroups((prev) => [
        ...prev,
        { id: data.id, season_id: season.id, label: form.label, day: form.day, start_time: form.startTime, end_time: form.endTime, location: form.location, max_places: form.maxPlaces, active: true, display_order: 0 }
      ]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm("Supprimer ce groupe solo ? Les dates et assignations seront perdues.")) return;
    try {
      const res = await fetch(`/api/admin/season/${season.id}/solo-groups/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
      setGroups((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleAddDate = async (groupId: string) => {
    const date = newDateInput[groupId];
    if (!date) return;
    try {
      const res = await fetch(`/api/admin/season/${season.id}/solo-groups/${groupId}/dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occursOn: date })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur d'ajout");
      setDatesByGroup((prev) => ({
        ...prev,
        [groupId]: [...(prev[groupId] ?? []), { id: data.id, solo_group_id: groupId, occurs_on: date, cancelled: false }].sort((a, b) => a.occurs_on.localeCompare(b.occurs_on))
      }));
      setNewDateInput((prev) => ({ ...prev, [groupId]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleRemoveDate = async (groupId: string, dateId: string) => {
    try {
      await fetch(`/api/admin/season/${season.id}/solo-groups/${groupId}/dates/${dateId}`, { method: "DELETE" });
      setDatesByGroup((prev) => ({ ...prev, [groupId]: (prev[groupId] ?? []).filter((d) => d.id !== dateId) }));
    } catch {
      setError("Erreur de suppression de date");
    }
  };

  const handleAssign = async (groupId: string) => {
    const registrationId = assignSelect[groupId];
    if (!registrationId) return;
    try {
      const res = await fetch(`/api/admin/season/${season.id}/solo-groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId })
      });
      if (!res.ok) throw new Error("Erreur d'assignation");
      setMembersByGroup((prev) => ({
        ...prev,
        [groupId]: [...(prev[groupId] ?? []), { id: `${groupId}-${registrationId}`, solo_group_id: groupId, registration_id: registrationId, created_at: new Date().toISOString() }]
      }));
      setUnassigned((prev) => prev.filter((r) => r.id !== registrationId));
      setAssignSelect((prev) => ({ ...prev, [groupId]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleRemoveMember = async (groupId: string, memberId: string, registrationId: string) => {
    try {
      await fetch(`/api/admin/season/${season.id}/solo-groups/${groupId}/members/${memberId}`, { method: "DELETE" });
      setMembersByGroup((prev) => ({ ...prev, [groupId]: (prev[groupId] ?? []).filter((m) => m.id !== memberId) }));
      const reg = registrationById.get(registrationId);
      if (reg) setUnassigned((prev) => [...prev, reg]);
    } catch {
      setError("Erreur de retrait");
    }
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Séances individuelles (solo)</p>
            <button onClick={() => setShowForm((v) => !v)} className="admin-btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.78rem" }}>
              {showForm ? "Annuler" : "+ Nouveau groupe"}
            </button>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.5rem" }}>
            Rotation de groupes pour les 5 séances individuelles incluses dans Solo Valkyria / SVA — chaque joueuse vient 1 fois aux 2 semaines.
            Assignez les inscriptions SV/SVA à un groupe puis ajoutez les dates réelles du calendrier.
          </p>

          {error && <p className="admin-error" style={{ marginBottom: "1rem" }}>{error}</p>}

          {unassigned.length > 0 && (
            <div style={{ padding: "0.85rem 1.1rem", background: "#151115", border: "1px solid #30261e", borderRadius: "10px", marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "0.78rem", color: "#f0c878", fontWeight: 700, marginBottom: "0.4rem" }}>
                {unassigned.length} inscription{unassigned.length > 1 ? "s" : ""} SV/SVA non assignée{unassigned.length > 1 ? "s" : ""} à un groupe
              </p>
              <p style={{ fontSize: "0.72rem", color: "#9d9da0" }}>
                {unassigned.map(playerName).join(", ")}
              </p>
            </div>
          )}

          {showForm && (
            <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1.1rem 1.25rem", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
                <label className="admin-field">
                  <span>Étiquette</span>
                  <input className="admin-input" value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} placeholder="Ex. Bloc 18h · Groupe C" />
                </label>
                <label className="admin-field">
                  <span>Jour</span>
                  <select className="admin-input" value={form.day} onChange={(e) => setForm((p) => ({ ...p, day: e.target.value }))}>
                    {DAYS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </label>
                <label className="admin-field">
                  <span>Début</span>
                  <input type="time" className="admin-input" value={form.startTime} onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Fin</span>
                  <input type="time" className="admin-input" value={form.endTime} onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Places max</span>
                  <input type="number" min={1} className="admin-input" value={form.maxPlaces} onChange={(e) => setForm((p) => ({ ...p, maxPlaces: parseInt(e.target.value) || 1 }))} />
                </label>
              </div>
              <label className="admin-field">
                <span>Lieu</span>
                <input className="admin-input" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} placeholder="Ex. Sainte-Thérèse" />
              </label>
              <button onClick={handleCreateGroup} className="admin-btn-primary" style={{ alignSelf: "flex-start" }}>
                Créer le groupe
              </button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {groups.map((group) => {
              const dates = datesByGroup[group.id] ?? [];
              const members = membersByGroup[group.id] ?? [];
              return (
                <div key={group.id} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "12px", padding: "1rem 1.2rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: "0.92rem", color: "#fff", margin: 0 }}>{group.label}</p>
                      <p style={{ fontSize: "0.78rem", color: "#9f85ba", margin: "0.2rem 0 0" }}>
                        {group.day} {group.start_time}–{group.end_time} · {group.location} · {members.length}/{group.max_places} places
                      </p>
                    </div>
                    <button onClick={() => handleDeleteGroup(group.id)} className="admin-btn-danger" style={{ padding: "0.35rem 0.75rem", fontSize: "0.72rem" }}>
                      Supprimer
                    </button>
                  </div>

                  {/* Membres */}
                  <div style={{ marginTop: "0.85rem", paddingTop: "0.75rem", borderTop: "1px solid #1a1820" }}>
                    <p style={{ fontSize: "0.65rem", color: "#7a7982", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Joueuses</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "0.6rem" }}>
                      {members.map((m) => {
                        const reg = registrationById.get(m.registration_id);
                        return (
                          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", color: "#c3c2c8" }}>
                            <span>{reg ? playerName(reg) : m.registration_id}</span>
                            <button onClick={() => handleRemoveMember(group.id, m.id, m.registration_id)} style={{ background: "none", border: "none", color: "rgba(255,100,100,0.6)", cursor: "pointer", fontSize: "0.72rem" }}>
                              Retirer
                            </button>
                          </div>
                        );
                      })}
                      {members.length === 0 && <p style={{ fontSize: "0.72rem", color: "#3c3a41", fontStyle: "italic" }}>Aucune joueuse assignée</p>}
                    </div>
                    {unassigned.length > 0 && (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <select
                          value={assignSelect[group.id] ?? ""}
                          onChange={(e) => setAssignSelect((prev) => ({ ...prev, [group.id]: e.target.value }))}
                          style={{ flex: 1, padding: "0.35rem 0.6rem", fontSize: "0.75rem", background: "#17151e", border: "1px solid #302e36", borderRadius: "4px", color: "#fff" }}
                        >
                          <option value="">Assigner une joueuse…</option>
                          {unassigned.map((r) => <option key={r.id} value={r.id}>{playerName(r)}</option>)}
                        </select>
                        <button onClick={() => handleAssign(group.id)} className="admin-btn-ghost" style={{ padding: "0.35rem 0.7rem", fontSize: "0.72rem" }}>
                          Assigner
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Dates */}
                  <div style={{ marginTop: "0.85rem", paddingTop: "0.75rem", borderTop: "1px solid #1a1820" }}>
                    <p style={{ fontSize: "0.65rem", color: "#7a7982", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                      Dates ({dates.length})
                    </p>
                    {dates.length === 0 ? (
                      <p style={{ fontSize: "0.72rem", color: "#3c3a41", fontStyle: "italic", marginBottom: "0.6rem" }}>Aucune date ajoutée.</p>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.6rem" }}>
                        {dates.map((d) => (
                          <span key={d.id} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#c3c2c8", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "999px", padding: "0.3rem 0.6rem" }}>
                            {new Date(d.occurs_on + "T00:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}
                            <button onClick={() => handleRemoveDate(group.id, d.id)} style={{ background: "none", border: "none", color: "rgba(255,100,100,0.6)", cursor: "pointer", fontSize: "0.85rem", padding: 0, lineHeight: 1 }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <input
                        type="date"
                        value={newDateInput[group.id] ?? ""}
                        onChange={(e) => setNewDateInput((prev) => ({ ...prev, [group.id]: e.target.value }))}
                        style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem", background: "#17151e", border: "1px solid #302e36", borderRadius: "6px", color: "#fff" }}
                      />
                      <button onClick={() => handleAddDate(group.id)} className="admin-btn-ghost" style={{ padding: "0.35rem 0.75rem", fontSize: "0.72rem" }}>
                        Ajouter la date
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {groups.length === 0 && <p className="admin-empty-text">Aucun groupe solo créé pour l&apos;instant.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
