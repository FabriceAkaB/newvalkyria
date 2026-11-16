/** Prise de connaissance de la pratique par l'éducateur assigné (portail, étape « Avant »).
 *  L'éducateur ouvre les diapos et lit chaque exercice du plan ; il ne peut confirmer qu'une fois tout vu.
 *  Règles pures : la liste des éléments à voir, ce qui manque, et si la confirmation est permise. */

export interface ReadItem {
  key: string;
  label: string;
  /** Nom du fichier (sans .pdf) ou titre de l'exercice. */
  title: string;
  kind: "deck" | "block";
}

export const deckKey = (documentId: string) => `deck:${documentId}`;
export const blockKey = (blockId: string) => `block:${blockId}`;

/** Les éléments à voir : chaque PDF de la pratique déposé, puis chaque exercice du plan de séance. */
export function practiceReadItems(input: { decks: { id: string; fileName: string }[]; blocks: { id: string; title: string }[] }): ReadItem[] {
  return [
    ...input.decks.map((d) => {
      const title = d.fileName.replace(/\.pdf$/i, "");
      return { key: deckKey(d.id), label: `Diapos : ${title}`, title, kind: "deck" as const };
    }),
    ...input.blocks.map((b, i) => ({ key: blockKey(b.id), label: `Exercice ${i + 1} : ${b.title}`, title: b.title, kind: "block" as const }))
  ];
}

export interface ReadStatus {
  total: number;
  seen: number;
  missing: ReadItem[];
  /** Il y a quelque chose à lire (sinon la pratique n'est pas encore prête). */
  hasContent: boolean;
  canConfirm: boolean;
  confirmed: boolean;
}

export function practiceReadStatus(items: ReadItem[], seenKeys: string[], readAt: string | null): ReadStatus {
  const seen = new Set(seenKeys);
  const missing = items.filter((i) => !seen.has(i.key));
  return {
    total: items.length,
    seen: items.length - missing.length,
    missing,
    hasContent: items.length > 0,
    canConfirm: items.length > 0 && missing.length === 0,
    confirmed: Boolean(readAt)
  };
}

/** Ajoute un élément vu à la liste, sans doublon (ordre conservé). */
export function addSeen(seenKeys: unknown, key: string): string[] {
  const list = Array.isArray(seenKeys) ? seenKeys.filter((k): k is string => typeof k === "string") : [];
  return list.includes(key) ? list : [...list, key];
}

/** Libellé court pour JP : « Lue le 16 nov. à 18 h 02 », « 2/5 vus », « Pas encore ouverte ». */
export function readLabel(status: Pick<ReadStatus, "total" | "seen" | "confirmed">, readAt: string | null): string {
  if (status.confirmed && readAt) {
    const d = new Date(readAt);
    const day = d.toLocaleDateString("fr-CA", { timeZone: "America/Toronto", day: "numeric", month: "short" });
    const time = d.toLocaleTimeString("fr-CA", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit" }).replace(":", " h ");
    return `Pratique lue le ${day} à ${time}`;
  }
  if (!status.total) return "Rien à lire : la pratique n'est pas déposée";
  if (!status.seen) return "Pratique pas encore ouverte";
  return `Pratique en lecture : ${status.seen}/${status.total} vus`;
}
