"use client";

import { useEffect, useState } from "react";

import { DocumentViewerModal } from "@/components/admin-entity-documents";

/** Portail des éducateurs : les diapos de la pratique déposées par JP (documents « Pratique » de l'activité), en haut de
 *  l'étape « Avant », avec un aperçu dans la page et le plein écran pour le téléphone. */
export function CoachPracticeDeck({ activityId }: { activityId: string }) {
  const [docs, setDocs] = useState<{ id: string; file_name: string; category: string }[]>([]);
  const [viewing, setViewing] = useState<{ fileName: string; signedUrl: string } | null>(null);

  useEffect(() => {
    fetch(`/api/coach/documents?entityType=coach_activity&entityId=${activityId}`)
      .then((r) => r.json())
      .then((d) => setDocs(((d.documents ?? []) as { id: string; file_name: string; category: string }[]).filter((x) => x.category === "Pratique")))
      .catch(() => setDocs([]));
  }, [activityId]);

  if (!docs.length) return null;
  const open = async (id: string, fileName: string) => {
    const res = await fetch(`/api/coach/documents/${id}/download`);
    const data = await res.json().catch(() => null);
    if (data?.signedUrl) setViewing({ fileName, signedUrl: data.signedUrl });
  };
  return (
    <div className="coach-card" style={{ marginBottom: 12 }}>
      <p className="coach-card__label">La pratique en diapos</p>
      <div style={{ display: "grid", gap: 8 }}>
        {docs.map((d) => (
          <button key={d.id} type="button" className="coach-primary" style={{ whiteSpace: "normal", lineHeight: 1.3 }} onClick={() => open(d.id, d.file_name)}>
            📽️ Voir la pratique · {d.file_name.replace(/\.pdf$/i, "")}
          </button>
        ))}
      </div>
      {viewing ? <DocumentViewerModal fileName={viewing.fileName} signedUrl={viewing.signedUrl} onClose={() => setViewing(null)} /> : null}
    </div>
  );
}
