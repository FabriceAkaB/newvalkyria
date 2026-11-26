/** « La Bible New Valkyria » (JP, 25 nov. 2026) : toute la banque d'exercices, pour les éducateurs, en livre qu'on
 *  feuillette (couverture, sommaire, un chapitre par thème, une page par exercice) et en grille d'images.
 *  Les exercices JP référence (les phares choisis par JP, 26 nov. 2026) et les meilleurs exercices (statut « approuvé »
 *  de la banque) sont mis en avant.
 *  Règles pures, testées (exercise-book-core.test.ts). Aucune date de planification, aucune note d'éducateur nommé :
 *  la planification annuelle reste fermée aux éducateurs (coach-access-core.ts). */

import { EXERCISE_CATEGORIES, EXERCISE_TYPES, placeLabel, typeLabel, venueLabel, type BankStatus } from "@/lib/exercise-bank";

export interface BookDiagram {
  elements: { id: string; type: string; x: number; y: number; label?: string }[];
  arrows: { id: string; type: string; x1: number; y1: number; x2: number; y2: number }[];
}

/** Un exercice tel que le livre et la grille le montrent (sérialisable, envoyé au navigateur). */
export interface BookExercise {
  id: string;
  title: string;
  status: BankStatus;
  approved: boolean;
  top: boolean;
  average: number | null;
  /** Exercice phare de JP (« JP référence ») et, s'il l'a écrit, ce pour quoi c'est le meilleur. */
  jpReference: boolean;
  jpReferenceNote: string | null;
  imageUrl: string | null;
  diagram: BookDiagram | null;
  videoUrl: string | null;
  /** Chapitre : le geste ou thème de la fiche (« Autre » s'il manque). */
  chapter: string;
  typeKey: string | null;
  type: string | null;
  place: string | null;
  level: string | null;
  ages: string[];
  venue: string | null;
  players: string | null;
  duration: number | null;
  dimensions: string | null;
  objective: string | null;
  instructions: string | null;
  coachingPoints: string | null;
  setups: { label: string; text: string }[];
  easier: string | null;
  harder: string | null;
  cognitive: string | null;
  variants: string | null;
  progression: string | null;
  mistakes: string | null;
  material: string | null;
  /** Autres exercices de la banque avec la même diapo ou le même titre : montrés une seule fois, dans cette page. */
  versions: BookVersion[];
}

/** Une autre version d'un exercice (même diapo, autre thème ou autre règle), rangée sous l'exercice principal. */
export interface BookVersion {
  id: string;
  title: string;
  chapter: string;
  type: string | null;
  instructions: string | null;
  coachingPoints: string | null;
}

/** Champs de la banque lus par le livre (sous-ensemble de BankEntry). */
export interface BookSource {
  id: string;
  title: string;
  category: string | null;
  exercise_type: string | null;
  session_place: string | null;
  level: string | null;
  age_groups: string[] | null;
  venue: string | null;
  min_players: number | null;
  max_players: number | null;
  duration_minutes: number | null;
  dimensions: string | null;
  objective: string | null;
  instructions: string | null;
  coaching_points: string | null;
  setup_5_7: string | null;
  setup_8_10: string | null;
  setup_11_16: string | null;
  variant_easier: string | null;
  variant_harder: string | null;
  variant_cognitive: string | null;
  variants: string | null;
  progression: string | null;
  common_mistakes: string | null;
  material: string | null;
  image_url: string | null;
  video_url: string | null;
  diagram_data: unknown;
  /** Empreinte de la diapo (SHA-256) : deux exercices avec la même diapo sont le même exercice à l'écran. */
  image_hash?: string | null;
  created_at?: string | null;
  jp_reference_at?: string | null;
  jp_reference_note?: string | null;
  bank: { status: BankStatus; top: boolean; average: number | null; count: number };
}

export const OTHER_CHAPTER = "Autre";
const TYPE_RANK = new Map<string, number>(EXERCISE_TYPES.map((t, i) => [t.key, i]));
const clean = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);
const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function chapterOf(category: string | null | undefined): string {
  const c = clean(category);
  if (!c) return OTHER_CHAPTER;
  return EXERCISE_CATEGORIES.find((k) => k.toLowerCase() === c.toLowerCase()) ?? c;
}

export function playersLabel(min: number | null, max: number | null): string | null {
  if (min && max && min !== max) return `${min} à ${max} joueuses`;
  if (min || max) return `${max ?? min} joueuses`;
  return null;
}

function diagramOf(d: unknown): BookDiagram | null {
  if (!d || typeof d !== "object") return null;
  const x = d as BookDiagram;
  return (x.elements?.length ?? 0) + (x.arrows?.length ?? 0) > 0 ? { elements: x.elements ?? [], arrows: x.arrows ?? [] } : null;
}

export function toBookExercise(e: BookSource): BookExercise {
  return {
    id: e.id,
    title: e.title,
    status: e.bank.status,
    approved: e.bank.status === "approuve",
    top: e.bank.top,
    average: e.bank.average,
    jpReference: Boolean(e.jp_reference_at),
    jpReferenceNote: e.jp_reference_at ? clean(e.jp_reference_note) : null,
    imageUrl: clean(e.image_url),
    diagram: diagramOf(e.diagram_data),
    videoUrl: clean(e.video_url),
    chapter: chapterOf(e.category),
    typeKey: clean(e.exercise_type),
    type: typeLabel(e.exercise_type),
    place: placeLabel(e.session_place),
    level: clean(e.level),
    ages: e.age_groups ?? [],
    venue: venueLabel(e.venue),
    players: playersLabel(e.min_players, e.max_players),
    duration: e.duration_minutes,
    dimensions: clean(e.dimensions),
    objective: clean(e.objective),
    instructions: clean(e.instructions),
    coachingPoints: clean(e.coaching_points),
    setups: [
      { label: "5 à 7 joueuses", text: e.setup_5_7 },
      { label: "8 à 10 joueuses", text: e.setup_8_10 },
      { label: "11 à 16 joueuses", text: e.setup_11_16 }
    ]
      .filter((s) => Boolean(clean(s.text)))
      .map((s) => ({ label: s.label, text: s.text!.trim() })),
    easier: clean(e.variant_easier),
    harder: clean(e.variant_harder),
    cognitive: clean(e.variant_cognitive),
    variants: clean(e.variants),
    progression: clean(e.progression),
    mistakes: clean(e.common_mistakes),
    material: clean(e.material),
    versions: []
  };
}

/** Titre ramené à l'essentiel (accents, majuscules, ponctuation et espaces ignorés) pour repérer un doublon. */
export function titleKey(title: string | null | undefined): string {
  return norm(title)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** L'exercice qu'on garde à l'écran dans un groupe de doublons : JP référence, approuvé, top, le plus noté, la meilleure note, le plus ancien. */
export function compareKeep(a: Pick<BookSource, "bank" | "created_at" | "title" | "jp_reference_at">, b: Pick<BookSource, "bank" | "created_at" | "title" | "jp_reference_at">): number {
  return (
    Number(Boolean(b.jp_reference_at)) - Number(Boolean(a.jp_reference_at)) ||
    Number(b.bank.status === "approuve") - Number(a.bank.status === "approuve") ||
    Number(b.bank.top) - Number(a.bank.top) ||
    b.bank.count - a.bank.count ||
    (b.bank.average ?? -1) - (a.bank.average ?? -1) ||
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) ||
    a.title.localeCompare(b.title, "fr")
  );
}

/** Groupes d'exercices identiques à l'écran : même diapo (empreinte) ou même titre. Chaque groupe, dans l'ordre d'arrivée. */
export function duplicateGroups<T extends Pick<BookSource, "id" | "title" | "image_hash">>(entries: T[]): T[][] {
  const parent = entries.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const seen = new Map<string, number>();
  entries.forEach((e, i) => {
    for (const key of [e.image_hash ? `img:${e.image_hash}` : null, titleKey(e.title) ? `t:${titleKey(e.title)}` : null]) {
      if (!key) continue;
      const j = seen.get(key);
      if (j === undefined) seen.set(key, i);
      else parent[find(i)] = find(j);
    }
  });
  const groups = new Map<number, T[]>();
  entries.forEach((e, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), e]));
  return [...groups.values()];
}

/** Toute la banque pour les éducateurs : tout sauf les exercices retirés, et chaque exercice une seule fois
 *  (même diapo ou même titre = un seul exercice à l'écran, les autres sont ses « autres versions »). */
export function bookExercises(entries: BookSource[]): BookExercise[] {
  return duplicateGroups(entries.filter((e) => e.bank.status !== "retire")).map((group) => {
    const [keep, ...others] = [...group].sort(compareKeep);
    const main = toBookExercise(keep);
    main.versions = others.map((o) => ({
      id: o.id,
      title: o.title,
      chapter: chapterOf(o.category),
      type: typeLabel(o.exercise_type),
      instructions: clean(o.instructions),
      coachingPoints: clean(o.coaching_points)
    }));
    return main;
  });
}

/** Dans un chapitre : par catégorie (type d'exercice, dans l'ordre de la séance), puis JP référence, les approuvés, la note, le titre. */
export function compareInChapter(a: BookExercise, b: BookExercise): number {
  return (
    (TYPE_RANK.get(a.typeKey ?? "") ?? 99) - (TYPE_RANK.get(b.typeKey ?? "") ?? 99) ||
    Number(b.jpReference) - Number(a.jpReference) ||
    Number(b.approved) - Number(a.approved) ||
    Number(b.top) - Number(a.top) ||
    (b.average ?? -1) - (a.average ?? -1) ||
    a.title.localeCompare(b.title, "fr")
  );
}

export interface BookChapter {
  key: string;
  number: number;
  title: string;
  exercises: BookExercise[];
  approved: number;
  /** Catégories (types d'exercice) présentes, dans l'ordre. */
  types: string[];
}

/** Un chapitre par thème, dans l'ordre des gestes et thèmes de la banque ; « Autre » à la fin ; aucun chapitre vide. */
export function bookChapters(list: BookExercise[]): BookChapter[] {
  const groups = new Map<string, BookExercise[]>();
  for (const e of list) groups.set(e.chapter, [...(groups.get(e.chapter) ?? []), e]);
  const known = EXERCISE_CATEGORIES.filter((c) => c !== OTHER_CHAPTER) as readonly string[];
  const keys = [...groups.keys()].sort((a, b) => {
    const rank = (k: string) => (k === OTHER_CHAPTER ? 1000 : known.includes(k) ? known.indexOf(k) : 500);
    return rank(a) - rank(b) || a.localeCompare(b, "fr");
  });
  return keys.map((key, i) => {
    const exercises = [...groups.get(key)!].sort(compareInChapter);
    return {
      key,
      number: i + 1,
      title: key,
      exercises,
      approved: exercises.filter((e) => e.approved).length,
      types: [...new Set(exercises.map((e) => e.type ?? "Autre"))]
    };
  });
}

/** Les meilleurs exercices : approuvés seulement, les tops d'abord, puis la note. */
export function bestExercises(list: BookExercise[], limit = 12): BookExercise[] {
  return list
    .filter((e) => e.approved)
    .sort((a, b) => Number(b.top) - Number(a.top) || (b.average ?? -1) - (a.average ?? -1) || a.title.localeCompare(b.title, "fr"))
    .slice(0, limit);
}

/** Exercices JP référence : les phares de JP, rangés par thème (dans l'ordre des chapitres), puis par titre. */
export function jpReferenceExercises(list: BookExercise[]): BookExercise[] {
  const known = EXERCISE_CATEGORIES.filter((c) => c !== OTHER_CHAPTER) as readonly string[];
  const rank = (k: string) => (k === OTHER_CHAPTER ? 1000 : known.includes(k) ? known.indexOf(k) : 500);
  return list.filter((e) => e.jpReference).sort((a, b) => rank(a.chapter) - rank(b.chapter) || a.chapter.localeCompare(b.chapter, "fr") || a.title.localeCompare(b.title, "fr"));
}

export type BookPage =
  | { kind: "cover"; number: number }
  | { kind: "contents"; number: number }
  | { kind: "chapter"; number: number; chapter: BookChapter }
  | { kind: "exercise"; number: number; exercise: BookExercise; chapter: BookChapter; indexInChapter: number };

/** Les pages du livre : couverture, sommaire, puis chaque chapitre (page d'ouverture + une page par exercice). */
export function bookPages(chapters: BookChapter[]): BookPage[] {
  const pages: BookPage[] = [{ kind: "cover", number: 0 }, { kind: "contents", number: 1 }];
  for (const chapter of chapters) {
    pages.push({ kind: "chapter", number: pages.length, chapter });
    chapter.exercises.forEach((exercise, indexInChapter) => pages.push({ kind: "exercise", number: pages.length, exercise, chapter, indexInChapter }));
  }
  return pages;
}

/** Page où commence chaque chapitre (pour le sommaire). */
export function chapterStarts(pages: BookPage[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of pages) if (p.kind === "chapter") m.set(p.chapter.key, p.number);
  return m;
}

export function pageOfExercise(pages: BookPage[], id: string): number {
  return pages.findIndex((p) => p.kind === "exercise" && p.exercise.id === id);
}

/** Double page sur grand écran : la couverture est seule, puis les pages vont par deux (1-2, 3-4…). */
export function spreadStart(index: number, double: boolean): number {
  if (!double || index <= 0) return Math.max(0, index);
  return index % 2 === 1 ? index : index - 1;
}

/** Page (ou double page) suivante ou précédente, bornée au livre. */
export function turnPage(index: number, dir: 1 | -1, double: boolean, total: number): number {
  const last = Math.max(0, total - 1);
  if (!double) return Math.max(0, Math.min(last, index + dir));
  const start = spreadStart(index, true);
  if (dir === 1) {
    const next = start === 0 ? 1 : start + 2;
    return next > last ? start : next;
  }
  return start <= 1 ? 0 : start - 2;
}

/** Recherche de la grille : titre, thème, type, objectif, âges, « le meilleur pour » ; filtres de chapitre, meilleurs et JP référence. */
export function matchesGrid(e: BookExercise, f: { q?: string; chapter?: string; best?: boolean; jp?: boolean }): boolean {
  const versions = e.versions ?? [];
  if (f.chapter && e.chapter !== f.chapter && !versions.some((v) => v.chapter === f.chapter)) return false;
  if (f.best && !e.approved) return false;
  if (f.jp && !e.jpReference) return false;
  if (f.q) {
    const hay = norm(`${e.title} ${e.chapter} ${e.type ?? ""} ${e.objective ?? ""} ${e.ages.join(" ")} ${e.jpReferenceNote ?? ""} ${versions.map((v) => `${v.title} ${v.chapter}`).join(" ")}`);
    return norm(f.q)
      .split(/\s+/)
      .filter(Boolean)
      .every((w) => hay.includes(w));
  }
  return true;
}
