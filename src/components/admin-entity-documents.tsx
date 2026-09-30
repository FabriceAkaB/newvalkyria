"use client";

import { useEffect, useState } from "react";

import { DOCUMENT_CATEGORIES, type DocumentEntityType, type EntityDocument } from "@/lib/documents-repo";

/** Visionneuse intégrée — un document (PDF, image...) s'ouvre dans un
 *  panneau superposé plutôt que dans un nouvel onglet, pour ne jamais
 *  forcer l'utilisateur à quitter le site. */
function DocumentViewerModal({ fileName, signedUrl, onClose }: { fileName: string; signedUrl: string; onClose: () => void }) {
  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "92vw", height: "88vh", maxWidth: "1100px", background: "#100e17", border: "1px solid #302e36", borderRadius: "10px", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0.9rem", borderBottom: "1px solid #1f1d25" }}>
          <span style={{ fontSize: "0.8rem", color: "#c3c2c8" }}>📄 {fileName}</span>
          <button onClick={onClose} className="admin-drawer-close" aria-label="Fermer">×</button>
        </div>
        <iframe src={signedUrl} title={fileName} style={{ flex: 1, border: "none", background: "#fff" }} />
      </div>
    </div>
  );
}

export function EntityDocuments({ entityType, entityId, apiBase = "/api/admin/documents", readOnly = false }: { entityType: DocumentEntityType; entityId: string; apiBase?: string; readOnly?: boolean }) {
  const [documents, setDocuments] = useState<EntityDocument[] | null>(null);
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[DOCUMENT_CATEGORIES.length - 1]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ fileName: string; signedUrl: string } | null>(null);

  useEffect(() => {
    fetch(`${apiBase}?entityType=${entityType}&entityId=${entityId}`)
      .then((r) => r.json())
      .then((data) => setDocuments(data.documents ?? []))
      .catch(() => setDocuments([]));
  }, [apiBase, entityType, entityId]);

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
      const res = await fetch(apiBase, { method: "POST", body: formData });
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
    await fetch(`${apiBase}/${id}`, { method: "DELETE" });
  };

  const view = async (d: EntityDocument) => {
    const res = await fetch(`${apiBase}/${d.id}/download`);
    const data = await res.json().catch(() => null);
    if (data?.signedUrl) setViewing({ fileName: d.file_name, signedUrl: data.signedUrl });
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
            <button onClick={() => view(d)} style={{ background: "none", border: "none", color: "#88c0d0", cursor: "pointer", padding: 0, textAlign: "left", flex: 1 }}>
              📄 {d.file_name} <span style={{ color: "#6d6b71" }}>· {d.category}</span>
            </button>
            {!readOnly && <button onClick={() => remove(d.id)} style={{ fontSize: "0.68rem", color: "#ff9999", background: "none", border: "none", cursor: "pointer" }}>×</button>}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div style={{ display: "flex", gap: "0.35rem" }}>
          <select className="admin-input" value={category} onChange={(e) => setCategory(e.target.value)} style={{ fontSize: "0.72rem", width: "auto" }}>
            {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="admin-btn-ghost" style={{ fontSize: "0.72rem", cursor: "pointer" }}>
            {uploading ? "..." : "+ Ajouter"}
            <input type="file" style={{ display: "none" }} onChange={(e) => upload(e.target.files?.[0])} disabled={uploading} />
          </label>
        </div>
      )}
      {viewing && <DocumentViewerModal fileName={viewing.fileName} signedUrl={viewing.signedUrl} onClose={() => setViewing(null)} />}
    </div>
  );
}
