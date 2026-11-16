"use client";

import { useState } from "react";

import { DocumentViewerModal } from "@/components/admin-entity-documents";
import type { ReadItem } from "@/lib/practice-read";

/** Portail des éducateurs : les diapos de la pratique déposées par JP (documents « Pratique » de l'activité), en haut de
 *  l'étape « Avant », avec un aperçu dans la page et le plein écran pour le téléphone. Ouvrir les diapos les note « vues ». */
export function CoachPracticeDeck({ decks, seen, onOpened }: { decks: ReadItem[]; seen: string[]; onOpened: (key: string) => void }) {
  const [viewing, setViewing] = useState<{ fileName: string; signedUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!decks.length) return null;
  const open = async (d: ReadItem) => {
    setError(null);
    const res = await fetch(`/api/coach/documents/${d.key.slice("deck:".length)}/download`);
    const data = await res.json().catch(() => null);
    if (!data?.signedUrl) return setError("Les diapos n'ont pas pu s'ouvrir. Réessaie.");
    setViewing({ fileName: d.title, signedUrl: data.signedUrl });
    onOpened(d.key);
  };
  return (
    <div className="coach-card" style={{ marginBottom: 12 }}>
      <p className="coach-card__label">La pratique en diapos</p>
      <div style={{ display: "grid", gap: 8 }}>
        {decks.map((d) => (
          <button key={d.key} type="button" className={seen.includes(d.key) ? "coach-secondary" : "coach-primary"} style={{ whiteSpace: "normal", lineHeight: 1.3, width: "100%" }} onClick={() => open(d)}>
            {seen.includes(d.key) ? "✓ Vue · " : "📽️ Voir la pratique · "}
            {d.title}
          </button>
        ))}
      </div>
      {error ? <p className="coach-error">{error}</p> : null}
      {viewing ? <DocumentViewerModal fileName={viewing.fileName} signedUrl={viewing.signedUrl} onClose={() => setViewing(null)} /> : null}
    </div>
  );
}
