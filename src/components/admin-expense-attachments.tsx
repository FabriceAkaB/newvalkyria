"use client";

import { useEffect, useState } from "react";

import type { ExpenseDocument } from "@/lib/revenue-repo";

/** Détail + pièces jointes d'une dépense — réutilisé dans la liste des
 *  charges (Vue d'ensemble) et dans la Vue annuelle. Chargé à la demande
 *  quand on ouvre une dépense, pas en avance pour toute la liste. */
export function ExpenseAttachments({ expenseId }: { expenseId: string }) {
  const [documents, setDocuments] = useState<ExpenseDocument[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/revenue-expenses/${expenseId}/documents`);
      if (res.ok) {
        const data = (await res.json()) as { documents: ExpenseDocument[] };
        setDocuments(data.documents);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseId]);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`/api/admin/revenue-expenses/${expenseId}/documents`, { method: "POST", body: formData });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Erreur d'envoi");
        }
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setUploading(false);
    }
  };

  const download = async (docId: string) => {
    const res = await fetch(`/api/admin/revenue-expenses/documents/${docId}/download`);
    if (res.ok) {
      const data = (await res.json()) as { url: string };
      window.open(data.url, "_blank");
    }
  };

  const remove = async (docId: string) => {
    const res = await fetch(`/api/admin/revenue-expenses/documents/${docId}`, { method: "DELETE" });
    if (res.ok) setDocuments((prev) => prev?.filter((d) => d.id !== docId) ?? null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <p style={{ fontSize: "0.68rem", color: "#6d6b71", textTransform: "uppercase", margin: 0 }}>Pièces jointes</p>
      {error && <p className="admin-error" style={{ fontSize: "0.7rem" }}>{error}</p>}
      {loading ? (
        <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: 0 }}>Chargement...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {(documents ?? []).map((d) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "#c3c2c8" }}>
              <button onClick={() => download(d.id)} style={{ background: "none", border: "none", color: "#8d76a5", cursor: "pointer", textDecoration: "underline", padding: 0, textAlign: "left" }}>
                📎 {d.file_name}
              </button>
              <button onClick={() => remove(d.id)} style={{ background: "none", border: "none", color: "#6d6b71", cursor: "pointer", fontSize: "0.9rem", padding: 0 }} aria-label="Supprimer">×</button>
            </div>
          ))}
          {(documents ?? []).length === 0 && <p style={{ fontSize: "0.72rem", color: "#3c3a41", fontStyle: "italic", margin: 0 }}>Aucune pièce jointe.</p>}
        </div>
      )}
      <label className="admin-btn-ghost" style={{ fontSize: "0.7rem", padding: "0.35rem 0.6rem", textAlign: "center", cursor: "pointer", width: "fit-content" }}>
        {uploading ? "Envoi..." : "+ Ajouter pièce(s) jointe(s)"}
        <input type="file" multiple onChange={(e) => upload(e.target.files)} disabled={uploading} style={{ display: "none" }} />
      </label>
    </div>
  );
}
