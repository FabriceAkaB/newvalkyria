"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { birthYearFromDob, BIRTH_YEAR_LABELS } from "@/lib/season-2027";
import type { Child } from "@/lib/parent-repo";

const LEVELS = ["Débutante", "D3", "D2", "D1"];

interface PlayerCandidate {
  playerId: string;
  firstName: string;
  lastName: string;
  dob: string | null;
  registrationCount: number;
}

interface SeasonActivity {
  registrationId: string;
  seasonLabel: string;
  programName: string | null;
  status: string;
  isTrial: boolean;
  attendance: { id: string; status: string; activity: { activity_date: string; title: string | null; activity_type: string } }[];
  evaluations: { id: string; ratings: Record<string, number>; comment: string | null; created_at: string; activity: { activity_date: string; title: string | null } }[];
  objectives: { id: string; objective: string; active: boolean }[];
  paymentPlan: {
    totalAmountCents: number;
    installments: { sequenceNo: number; amountCents: number; dueDate: string; status: string; paidAt: string | null }[];
  } | null;
}

const ATTENDANCE_LABELS: Record<string, string> = {
  present: "Présente", absent: "Absente", injured: "Blessée", late: "En retard", left_early: "Partie tôt"
};

function formatCAD(cents: number): string {
  return (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

function LinkPlayerBlock({ childId, onLinked }: { childId: string; onLinked: (playerId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<PlayerCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const load = async () => {
    setOpen(true);
    if (candidates) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/compte/enfants/${childId}/candidats`);
      const data = await res.json().catch(() => ({ candidates: [] }));
      setCandidates(data.candidates ?? []);
    } finally {
      setLoading(false);
    }
  };

  const confirmLink = async (playerId: string) => {
    setLinkingId(playerId);
    try {
      const res = await fetch(`/api/compte/enfants/${childId}/lier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId })
      });
      if (res.ok) onLinked(playerId);
    } finally {
      setLinkingId(null);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={load}
        style={{ marginTop: "0.85rem", padding: "0.6rem 0.85rem", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: "8px", color: "#9f85ba", fontSize: "0.72rem", cursor: "pointer", width: "100%", textAlign: "left" }}
      >
        🔗 Relier à une inscription pour voir le calendrier, les évaluations et les paiements
      </button>
    );
  }

  return (
    <div style={{ marginTop: "0.85rem", padding: "0.75rem 0.85rem", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: "8px" }}>
      <p style={{ fontSize: "0.72rem", color: "#9f85ba", margin: "0 0 0.5rem" }}>
        Laquelle de ces inscriptions correspond à ce profil ?
      </p>
      {loading && <p style={{ fontSize: "0.72rem", color: "#605f65", margin: 0 }}>Recherche...</p>}
      {!loading && candidates?.length === 0 && (
        <p style={{ fontSize: "0.72rem", color: "#605f65", margin: 0 }}>Aucune inscription trouvée avec le courriel de ce compte pour l&apos;instant.</p>
      )}
      {!loading && candidates && candidates.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {candidates.map((c) => (
            <button
              key={c.playerId}
              type="button"
              onClick={() => confirmLink(c.playerId)}
              disabled={linkingId !== null}
              style={{ textAlign: "left", padding: "0.5rem 0.7rem", background: "#17151e", border: "1px solid #251f30", borderRadius: "6px", color: "#fff", fontSize: "0.78rem", cursor: "pointer" }}
            >
              {linkingId === c.playerId ? "Association..." : `${c.firstName} ${c.lastName}${c.dob ? ` · née le ${new Date(c.dob).toLocaleDateString("fr-CA")}` : ""}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChildActivity({ childId, onUnlink }: { childId: string; onUnlink: () => void }) {
  const [open, setOpen] = useState(false);
  const [seasons, setSeasons] = useState<SeasonActivity[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const load = async () => {
    const next = !open;
    setOpen(next);
    if (!next || seasons) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/compte/enfants/${childId}/activite`);
      const data = await res.json().catch(() => ({ seasons: [] }));
      setSeasons(data.seasons ?? []);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm("Retirer le lien avec cette inscription ?")) return;
    setUnlinking(true);
    try {
      const res = await fetch(`/api/compte/enfants/${childId}/lier`, { method: "DELETE" });
      if (res.ok) onUnlink();
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div style={{ marginTop: "0.85rem" }}>
      <button
        type="button"
        onClick={load}
        style={{ padding: "0.5rem 0.7rem", background: "rgba(159,133,186,0.08)", border: "1px solid rgba(159,133,186,0.25)", borderRadius: "8px", color: "#9f85ba", fontSize: "0.72rem", cursor: "pointer", width: "100%", textAlign: "left" }}
      >
        {open ? "▾" : "▸"} Calendrier, évaluations et paiements
      </button>
      {open && (
        <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {loading && <p style={{ fontSize: "0.72rem", color: "#605f65" }}>Chargement...</p>}
          {!loading && seasons?.length === 0 && <p style={{ fontSize: "0.72rem", color: "#605f65" }}>Aucune inscription trouvée.</p>}
          {!loading && seasons?.map((s) => (
            <div key={s.registrationId} style={{ background: "#17151e", border: "1px solid #251f30", borderRadius: "8px", padding: "0.7rem 0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                <p style={{ fontWeight: 700, fontSize: "0.82rem", color: "#fff", margin: 0 }}>
                  {s.seasonLabel}{s.programName ? ` — ${s.programName}` : ""}{s.isTrial ? " (essai)" : ""}
                </p>
                <a href={`/compte/bulletin/${s.registrationId}`} style={{ fontSize: "0.68rem", color: "#9f85ba", textDecoration: "none", whiteSpace: "nowrap" }}>
                  📋 Bulletin
                </a>
              </div>

              {s.attendance.length > 0 && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <p style={{ fontSize: "0.68rem", color: "#9f85ba", margin: "0 0 0.2rem", textTransform: "uppercase" }}>Présences</p>
                  {s.attendance.map((a) => (
                    <p key={a.id} style={{ fontSize: "0.75rem", color: "#c3c2c8", margin: "0.1rem 0" }}>
                      {new Date(a.activity.activity_date).toLocaleDateString("fr-CA")} — {a.activity.title ?? a.activity.activity_type} · {ATTENDANCE_LABELS[a.status] ?? a.status}
                    </p>
                  ))}
                </div>
              )}

              {s.evaluations.length > 0 && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <p style={{ fontSize: "0.68rem", color: "#9f85ba", margin: "0 0 0.2rem", textTransform: "uppercase" }}>Évaluations</p>
                  {s.evaluations.map((e) => (
                    <div key={e.id} style={{ fontSize: "0.75rem", color: "#c3c2c8", margin: "0.2rem 0" }}>
                      <span>{new Date(e.activity.activity_date).toLocaleDateString("fr-CA")} — {e.activity.title ?? "Pratique"}</span>
                      {e.comment && <p style={{ margin: "0.15rem 0 0", color: "#9d9da0", fontStyle: "italic" }}>« {e.comment} »</p>}
                    </div>
                  ))}
                </div>
              )}

              {s.objectives.filter((o) => o.active).length > 0 && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <p style={{ fontSize: "0.68rem", color: "#9f85ba", margin: "0 0 0.2rem", textTransform: "uppercase" }}>Objectifs</p>
                  {s.objectives.filter((o) => o.active).map((o) => (
                    <p key={o.id} style={{ fontSize: "0.75rem", color: "#c3c2c8", margin: "0.1rem 0" }}>• {o.objective}</p>
                  ))}
                </div>
              )}

              {s.paymentPlan && (
                <div>
                  <p style={{ fontSize: "0.68rem", color: "#9f85ba", margin: "0 0 0.2rem", textTransform: "uppercase" }}>Paiement en plusieurs fois</p>
                  {s.paymentPlan.installments.map((i) => (
                    <p key={i.sequenceNo} style={{ fontSize: "0.75rem", color: "#c3c2c8", margin: "0.1rem 0" }}>
                      Versement {i.sequenceNo} — {formatCAD(i.amountCents)} — {i.status === "paid" ? `payé le ${i.paidAt ? new Date(i.paidAt).toLocaleDateString("fr-CA") : ""}` : `dû le ${new Date(i.dueDate).toLocaleDateString("fr-CA")}`}
                    </p>
                  ))}
                </div>
              )}

              {s.attendance.length === 0 && s.evaluations.length === 0 && s.objectives.length === 0 && !s.paymentPlan && (
                <p style={{ fontSize: "0.72rem", color: "#605f65", margin: 0 }}>Rien à afficher pour l&apos;instant.</p>
              )}
            </div>
          ))}
          <button type="button" onClick={handleUnlink} disabled={unlinking} style={{ alignSelf: "flex-start", fontSize: "0.68rem", color: "#605f65", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            {unlinking ? "..." : "Ce n'est pas la bonne inscription ?"}
          </button>
        </div>
      )}
    </div>
  );
}

interface ChildFormState {
  firstName: string;
  lastName: string;
  dob: string;
  level: string;
  club: string;
}

const EMPTY_FORM: ChildFormState = { firstName: "", lastName: "", dob: "", level: "", club: "" };

function toFormState(child: Child): ChildFormState {
  return {
    firstName: child.first_name,
    lastName: child.last_name,
    dob: child.dob,
    level: child.level ?? "",
    club: child.club ?? ""
  };
}

export function ParentDashboard({ initialChildren }: { initialChildren: Child[] }) {
  const router = useRouter();
  const [children, setChildren] = useState(initialChildren);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<ChildFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ChildFormState>(EMPTY_FORM);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleLogout = async () => {
    await fetch("/api/compte/connexion", { method: "DELETE" });
    router.push("/compte");
    router.refresh();
  };

  const handleAddChild = async () => {
    if (!addForm.firstName || !addForm.lastName || !addForm.dob) {
      setError("Prénom, nom et date de naissance sont requis.");
      return;
    }
    setBusy("add");
    setError(null);
    try {
      const res = await fetch("/api/compte/enfants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur d'enregistrement");
      setChildren((prev) => [
        ...prev,
        {
          id: data.id,
          parent_user_id: "",
          first_name: addForm.firstName,
          last_name: addForm.lastName,
          dob: addForm.dob,
          level: addForm.level || null,
          club: addForm.club || null,
          photo_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          player_id: null
        }
      ]);
      setAddForm(EMPTY_FORM);
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const handleSaveEdit = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/compte/enfants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Erreur d'enregistrement");
      }
      setChildren((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, first_name: editForm.firstName, last_name: editForm.lastName, dob: editForm.dob, level: editForm.level || null, club: editForm.club || null }
            : c
        )
      );
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Retirer ce profil ? Cette action est irréversible.")) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/compte/enfants/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
      setChildren((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const handlePhotoChange = async (id: string, file: File | undefined) => {
    if (!file) return;
    setBusy(id);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch(`/api/compte/enfants/${id}/photo`, { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur de téléversement");
      setChildren((prev) => prev.map((c) => (c.id === id ? { ...c, photo_url: data.photoUrl } : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="nv27-step">
      {error && <p className="nv27-pay-error">{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        {children.length === 0 && !showAddForm && (
          <p className="nv27-empty">Aucun enfant enregistré pour l&apos;instant.</p>
        )}

        {children.map((child) => {
          const isEditing = editingId === child.id;
          const isBusy = busy === child.id;
          const detectedYear = birthYearFromDob(child.dob);

          return (
            <div key={child.id} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "12px", padding: "1.1rem 1.25rem", opacity: isBusy ? 0.6 : 1 }}>
              {isEditing ? (
                <div className="nv27-form-fields">
                  <div className="nv27-grid2">
                    <label className="insc-field">
                      <span>Prénom</span>
                      <input className="insc-input" value={editForm.firstName} onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))} />
                    </label>
                    <label className="insc-field">
                      <span>Nom</span>
                      <input className="insc-input" value={editForm.lastName} onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))} />
                    </label>
                  </div>
                  <div className="nv27-grid2">
                    <label className="insc-field">
                      <span>Date de naissance</span>
                      <input type="date" className="insc-input" value={editForm.dob} onChange={(e) => setEditForm((p) => ({ ...p, dob: e.target.value }))} />
                    </label>
                    <label className="insc-field">
                      <span>Niveau de jeu</span>
                      <select className="insc-input insc-select" value={editForm.level} onChange={(e) => setEditForm((p) => ({ ...p, level: e.target.value }))}>
                        <option value="">—</option>
                        {LEVELS.map((l) => <option key={l}>{l}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="insc-field">
                    <span>Club actuel (facultatif)</span>
                    <input className="insc-input" value={editForm.club} onChange={(e) => setEditForm((p) => ({ ...p, club: e.target.value }))} />
                  </label>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <button type="button" className="nv27-btn-primary" onClick={() => handleSaveEdit(child.id)} disabled={isBusy} style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}>
                      Enregistrer
                    </button>
                    <button type="button" className="nv27-btn-ghost" onClick={() => setEditingId(null)}>Annuler</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                    <div style={{ display: "flex", gap: "0.85rem", alignItems: "center" }}>
                      <div
                        style={{
                          width: "3.2rem", height: "3.2rem", borderRadius: "50%", overflow: "hidden",
                          background: "#1f1d25", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "1rem", color: "#9f85ba", fontWeight: 700, cursor: "pointer", position: "relative"
                        }}
                        onClick={() => fileInputs.current[child.id]?.click()}
                        title="Changer la photo"
                      >
                        {child.photo_url
                          ? <Image src={child.photo_url} alt={`${child.first_name} ${child.last_name}`} fill sizes="3.2rem" style={{ objectFit: "cover" }} />
                          : child.first_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff", margin: 0 }}>{child.first_name} {child.last_name}</p>
                        <p style={{ fontSize: "0.78rem", color: "#9f85ba", margin: "2px 0 0" }}>
                          Née le {new Date(child.dob + "T00:00:00").toLocaleDateString("fr-CA")}
                          {detectedYear && <> · Catégorie {BIRTH_YEAR_LABELS[detectedYear]}</>}
                        </p>
                        {(child.level || child.club) && (
                          <p style={{ fontSize: "0.72rem", color: "#605f65", margin: "2px 0 0" }}>
                            {[child.level, child.club].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                      <button type="button" className="nv27-btn-ghost" style={{ padding: "0.35rem 0.7rem", fontSize: "0.72rem" }} onClick={() => { setEditingId(child.id); setEditForm(toFormState(child)); }}>
                        Modifier
                      </button>
                      <button type="button" className="nv27-btn-ghost" style={{ padding: "0.35rem 0.7rem", fontSize: "0.72rem", color: "#f87171" }} onClick={() => handleDelete(child.id)}>
                        Retirer
                      </button>
                    </div>
                  </div>
                  <input
                    ref={(el) => { fileInputs.current[child.id] = el; }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => handlePhotoChange(child.id, e.target.files?.[0])}
                  />
                  {child.player_id ? (
                    <ChildActivity childId={child.id} onUnlink={() => setChildren((prev) => prev.map((c) => (c.id === child.id ? { ...c, player_id: null } : c)))} />
                  ) : (
                    <LinkPlayerBlock childId={child.id} onLinked={(playerId) => setChildren((prev) => prev.map((c) => (c.id === child.id ? { ...c, player_id: playerId } : c)))} />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {showAddForm ? (
        <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1.1rem 1.25rem", marginBottom: "1rem" }}>
          <div className="nv27-form-fields">
            <div className="nv27-grid2">
              <label className="insc-field">
                <span>Prénom *</span>
                <input className="insc-input" value={addForm.firstName} onChange={(e) => setAddForm((p) => ({ ...p, firstName: e.target.value }))} />
              </label>
              <label className="insc-field">
                <span>Nom *</span>
                <input className="insc-input" value={addForm.lastName} onChange={(e) => setAddForm((p) => ({ ...p, lastName: e.target.value }))} />
              </label>
            </div>
            <div className="nv27-grid2">
              <label className="insc-field">
                <span>Date de naissance *</span>
                <input type="date" className="insc-input" value={addForm.dob} onChange={(e) => setAddForm((p) => ({ ...p, dob: e.target.value }))} />
              </label>
              <label className="insc-field">
                <span>Niveau de jeu</span>
                <select className="insc-input insc-select" value={addForm.level} onChange={(e) => setAddForm((p) => ({ ...p, level: e.target.value }))}>
                  <option value="">—</option>
                  {LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </label>
            </div>
            <label className="insc-field">
              <span>Club actuel (facultatif)</span>
              <input className="insc-input" value={addForm.club} onChange={(e) => setAddForm((p) => ({ ...p, club: e.target.value }))} />
            </label>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button type="button" className="nv27-btn-primary" onClick={handleAddChild} disabled={busy === "add"} style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}>
                {busy === "add" ? "…" : "Ajouter"}
              </button>
              <button type="button" className="nv27-btn-ghost" onClick={() => { setShowAddForm(false); setAddForm(EMPTY_FORM); }}>Annuler</button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" className="nv27-add-btn" onClick={() => setShowAddForm(true)} style={{ marginBottom: "1.5rem" }}>
          + Ajouter un enfant
        </button>
      )}

      <button type="button" className="nv27-btn-ghost" onClick={handleLogout}>
        Se déconnecter
      </button>
    </div>
  );
}
