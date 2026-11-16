"use client";

import { PracticeDeckViewer } from "@/components/practice-deck-viewer";
import type { ReadItem } from "@/lib/practice-read";

/** Portail des éducateurs : les diapos de la pratique déposées par JP, déjà ouvertes en haut de l'étape « Avant »,
 *  avec « Télécharger » et « Plein écran ». Les diapos affichées sont notées « vues » pour la prise de connaissance. */
export function CoachPracticeDeck({ decks, onOpened }: { decks: ReadItem[]; seen?: string[]; onOpened: (key: string) => void }) {
  if (!decks.length) return null;
  return (
    <PracticeDeckViewer
      variant="coach"
      decks={decks.map((d) => ({ id: d.key.slice("deck:".length), fileName: `${d.title}.pdf` }))}
      downloadUrl={(id) => `/api/coach/documents/${id}/download`}
      onShown={(id) => onOpened(`deck:${id}`)}
    />
  );
}
