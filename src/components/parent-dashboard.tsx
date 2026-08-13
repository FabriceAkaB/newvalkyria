"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { birthYearFromDob, BIRTH_YEAR_LABELS } from "@/lib/season-2027";
import type { Child } from "@/lib/parent-repo";

const LEVELS = ["Débutante", "D3", "D2", "D1"];

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
                  <div style={{ marginTop: "0.85rem", padding: "0.6rem 0.85rem", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: "8px" }}>
                    <p style={{ fontSize: "0.7rem", color: "#605f65", margin: 0 }}>📋 Bulletin de progression — disponible bientôt</p>
                  </div>
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
