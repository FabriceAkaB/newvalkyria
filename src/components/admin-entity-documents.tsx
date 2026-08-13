"use client";

import { useEffect, useState } from "react";

import { DOCUMENT_CATEGORIES, type DocumentEntityType, type EntityDocument } from "@/lib/documents-repo";

export function EntityDocuments({ entityType, entityId }: { entityType: DocumentEntityType; entityId: string }) {
  const [documents, setDocuments] = useState<EntityDocument[] | null>(null);
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[DOCUMENT_CATEGORIES.length - 1]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/documents?entityType=${entityType}&entityId=${entityId}`)
      .then((r) => r.json())
      .then((data) => setDocuments(data.documents ?? []))
      .catch(() => setDocuments([]));
  }, [entityType, entityId]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);
      formData.append("category", category);
      formData.append("file", file);
      const res = await fetch("/api/admin/documents", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur d'envoi");
      setDocuments((prev) => [{ id: data.id, entity_type: entityType, entity_id: entityId, category, file_name: file.name, storage_path: "", uploaded_by: null, uploaded_at: new Date().toISOString() }, ...(prev ?? [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    setDocuments((prev) => (prev ?? []).filter((d) => d.id !== id));
    await fetch(`/api/admin/documents/${id}`, { method: "DELETE" });
  };

  const view = async (id: string) => {
    const res = await fetch(`/api/admin/documents/${id}/download`);
    const data = await res.json().catch(() => null);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div>
      <p style={{ fontSize: "0.68rem", color: "#9d9da0", textTransform: "uppercase", margin: "0 0 0.4rem" }}>Documents</p>
      {error && <p className="admin-error" style={{ fontSize: "0.72rem", marginBottom: "0.4rem" }}>{error}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "0.5rem" }}>
        {documents === null && <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: 0 }}>Chargement...</p>}
        {documents?.length === 0 && <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: 0 }}>Aucun document.</p>}
        {documents?.map((d) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#c3c2c8" }}>
            <button onClick={() => view(d.id)} style={{ background: "none", border: "none", color: "#88c0d0", cursor: "pointer", padding: 0, textAlign: "left", flex: 1 }}>
              📄 {d.file_name} <span style={{ color: "#6d6b71" }}>· {d.category}</span>
            </button>
            <button onClick={() => remove(d.id)} style={{ fontSize: "0.68rem", color: "#ff9999", background: "none", border: "none", cursor: "pointer" }}>×</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.35rem" }}>
        <select className="admin-input" value={category} onChange={(e) => setCategory(e.target.value)} style={{ fontSize: "0.72rem", width: "auto" }}>
          {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="admin-btn-ghost" style={{ fontSize: "0.72rem", cursor: "pointer" }}>
          {uploading ? "..." : "+ Ajouter"}
          <input type="file" style={{ display: "none" }} onChange={(e) => upload(e.target.files?.[0])} disabled={uploading} />
        </label>
      </div>
    </div>
  );
}
