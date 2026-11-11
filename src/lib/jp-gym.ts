/** « Mon gym » (espace JP) : le programme de musculation de JP et ses charges.
 *  3 séances complètes d'une heure par semaine (mardi A, mercredi B, vendredi C, bloc 🏋️ de 7 h 45 du calendrier),
 *  chaque muscle travaillé 2 à 3 fois par semaine, en double progression : on reste à la même charge jusqu'à faire
 *  le haut de la fourchette à toutes les séries, puis on monte la charge et on repart du bas.
 *  Cycle de 6 semaines : semaine 1 = repères (3 répétitions en réserve), 2 à 5 = progression (1 à 2 en réserve),
 *  6 = allègement (une série de moins, mêmes charges) avant le cycle suivant.
 *  Règles pures ici ; les charges notées vivent dans `app_settings` « jp_gym_log » (`jp-repo.ts`). */

export interface GymExercise {
  id: string;
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  /** « s » : secondes (gainage), sinon répétitions. */
  unit?: "reps" | "s";
  perSide?: boolean;
  /** Repos entre les séries, en secondes. */
  rest: number;
  /** Le point technique à ne pas oublier. */
  cue: string;
  /** Si l'appareil est pris ou si ça fait mal. */
  swap: string;
  /** Hausse de charge quand la fourchette est atteinte (kg ; 0 = sans charge). */
  step: number;
  /** Fait en alternance avec l'exercice suivant (superset). */
  superset?: boolean;
}

export interface GymSession {
  key: "A" | "B" | "C";
  day: 2 | 3 | 5;
  dayLabel: string;
  title: string;
  focus: string;
  exercises: GymExercise[];
  finisher?: string;
}

export const WARMUP = "6 min : 3 min de vélo ou rameur, puis 10 squats au poids du corps, 10 pompes inclinées, 10 rotations d'épaules, 5 fentes de chaque côté. Ensuite 2 séries légères du premier exercice.";

export const GYM: GymSession[] = [
  {
    key: "A",
    day: 2,
    dayLabel: "Mardi",
    title: "Séance A · Jambes (squat) et poussée",
    focus: "Force des jambes et du haut du corps.",
    exercises: [
      { id: "squat", name: "Squat (barre ou goblet)", sets: 3, repsMin: 5, repsMax: 8, rest: 150, cue: "Pieds largeur d'épaules, descends hanches sous les genoux, dos droit.", swap: "Presse à cuisses", step: 2.5 },
      { id: "dc-halteres", name: "Développé couché haltères", sets: 3, repsMin: 6, repsMax: 10, rest: 120, cue: "Omoplates serrées, coudes à 45°, descends jusqu'à la poitrine.", swap: "Pompes lestées ou machine", step: 2 },
      { id: "rowing-1-bras", name: "Rowing un bras haltère", sets: 3, repsMin: 8, repsMax: 12, perSide: true, rest: 90, cue: "Tire le coude vers la hanche, pas vers l'épaule.", swap: "Rowing poulie basse", step: 2 },
      { id: "fente-bulgare", name: "Fente bulgare", sets: 2, repsMin: 8, repsMax: 12, perSide: true, rest: 90, cue: "Genou avant au-dessus du pied, tronc un peu penché.", swap: "Fentes marchées", step: 2 },
      { id: "face-pull", name: "Face pull (poulie)", sets: 2, repsMin: 12, repsMax: 15, rest: 45, cue: "Tire vers le front, coudes hauts, pouces vers l'arrière.", swap: "Oiseau haltères", step: 2.5, superset: true },
      { id: "planche", name: "Planche (gainage)", sets: 2, repsMin: 30, repsMax: 45, unit: "s", rest: 60, cue: "Fesses serrées, ligne droite des épaules aux talons.", swap: "Dead bug 10 par côté", step: 0 }
    ]
  },
  {
    key: "B",
    day: 3,
    dayLabel: "Mercredi",
    title: "Séance B · Arrière des jambes et tirage",
    focus: "Ischios, fessiers, dos : la base pour courir et se protéger.",
    exercises: [
      { id: "sdt-roumain", name: "Soulevé de terre roumain", sets: 3, repsMin: 6, repsMax: 10, rest: 150, cue: "Pousse les hanches vers l'arrière, barre collée aux jambes, dos plat.", swap: "Soulevé roumain haltères", step: 2.5 },
      { id: "tirage-vertical", name: "Tirage vertical (ou tractions)", sets: 3, repsMin: 6, repsMax: 10, rest: 120, cue: "Poitrine vers la barre, coudes vers les poches.", swap: "Tractions assistées", step: 2.5 },
      { id: "dm-halteres", name: "Développé épaules haltères assis", sets: 3, repsMin: 8, repsMax: 10, rest: 90, cue: "Côtes basses, ne cambre pas le dos.", swap: "Machine épaules", step: 2 },
      { id: "hip-thrust", name: "Hip thrust", sets: 2, repsMin: 8, repsMax: 12, rest: 90, cue: "Menton rentré, pause 1 s en haut, fessiers serrés.", swap: "Pont fessier au sol", step: 5 },
      { id: "curl-incline", name: "Curl incliné haltères", sets: 2, repsMin: 10, repsMax: 12, rest: 45, cue: "Coudes immobiles, descente lente.", swap: "Curl poulie", step: 1, superset: true },
      { id: "triceps-poulie", name: "Extension triceps poulie", sets: 2, repsMin: 10, repsMax: 12, rest: 60, cue: "Coudes collés au corps.", swap: "Dips sur banc", step: 2.5 },
      { id: "pallof", name: "Pallof press (anti-rotation)", sets: 2, repsMin: 10, repsMax: 10, perSide: true, rest: 45, cue: "Bras tendus 2 s, le tronc ne tourne pas.", swap: "Planche latérale 30 s", step: 2.5 }
    ]
  },
  {
    key: "C",
    day: 5,
    dayLabel: "Vendredi",
    title: "Séance C · Complet et athlétique",
    focus: "Puissance, épaules en santé et cardio pour tenir les journées de terrain.",
    exercises: [
      { id: "trap-bar", name: "Soulevé de terre trap bar (ou presse)", sets: 3, repsMin: 5, repsMax: 8, rest: 150, cue: "Pousse le sol avec les jambes, poitrine haute.", swap: "Presse à cuisses", step: 5 },
      { id: "dc-incline", name: "Développé incliné haltères", sets: 3, repsMin: 8, repsMax: 10, rest: 120, cue: "Banc à 30°, descends lentement.", swap: "Machine poitrine inclinée", step: 2 },
      { id: "rowing-appui", name: "Rowing poitrine appuyée", sets: 3, repsMin: 8, repsMax: 12, rest: 90, cue: "Serre les omoplates 1 s en fin de mouvement.", swap: "Rowing machine", step: 2 },
      { id: "step-up", name: "Montée sur banc (step-up)", sets: 2, repsMin: 10, repsMax: 10, perSide: true, rest: 75, cue: "Pousse avec la jambe du haut seulement.", swap: "Fentes arrière", step: 2 },
      { id: "elevations", name: "Élévations latérales", sets: 2, repsMin: 12, repsMax: 15, rest: 45, cue: "Monte jusqu'aux épaules, petits doigts légèrement hauts.", swap: "Élévations poulie", step: 1, superset: true },
      { id: "mollets", name: "Mollets debout", sets: 2, repsMin: 12, repsMax: 15, rest: 60, cue: "Pause 1 s en haut, descente complète.", swap: "Mollets à la presse", step: 5 }
    ],
    finisher: "Cardio 6 min sur vélo : 6 fois (20 s à fond, 40 s facile)."
  }
];

/** Premier lundi du programme. */
export const GYM_START = "2026-11-09";

const dayMs = 86400000;
const parse = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
const dow = (iso: string) => new Date(parse(iso)).getUTCDay();
const addDays = (iso: string, n: number) => new Date(parse(iso) + n * dayMs).toISOString().slice(0, 10);

export type GymPhase = "reperes" | "progression" | "allegement";

/** La semaine du cycle de 6 semaines (1 à 6) et ce qu'elle demande. */
export function cycleWeek(today: string): { week: number; cycle: number; phase: GymPhase; label: string; reserve: string } {
  const weeks = Math.max(0, Math.floor((parse(today) - parse(GYM_START)) / (7 * dayMs)));
  const week = (weeks % 6) + 1;
  const cycle = Math.floor(weeks / 6) + 1;
  if (week === 1) return { week, cycle, phase: "reperes", label: "Semaine de repères", reserve: "Arrête chaque série quand il te reste 3 répétitions dans le réservoir. Note tes charges." };
  if (week === 6) return { week, cycle, phase: "allegement", label: "Semaine d'allègement", reserve: "Une série de moins partout, mêmes charges. Le corps récupère et revient plus fort." };
  return { week, cycle, phase: "progression", label: "Semaine de progression", reserve: "Arrête chaque série quand il te reste 1 ou 2 répétitions dans le réservoir." };
}

/** La séance du jour, sinon la prochaine. */
export function sessionFor(today: string): { session: GymSession; date: string; isToday: boolean } {
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    const s = GYM.find((x) => x.day === dow(d));
    if (s) return { session: s, date: d, isToday: i === 0 };
  }
  return { session: GYM[0], date: today, isToday: false };
}

export const setsFor = (e: GymExercise, phase: GymPhase) => (phase === "allegement" ? Math.max(1, e.sets - 1) : e.sets);

/** Ce qui a été noté pour un exercice : charge (kg, null = poids du corps) et répétitions de chaque série. */
export interface GymEntry {
  w: number | null;
  r: number[];
}
/** { "AAAA-MM-JJ": { exerciseId: entrée } } */
export type GymLog = Record<string, Record<string, GymEntry>>;

export function lastEntry(log: GymLog, exerciseId: string, before: string): { date: string; entry: GymEntry } | null {
  const dates = Object.keys(log)
    .filter((d) => d < before && log[d]?.[exerciseId])
    .sort();
  const d = dates.at(-1);
  return d ? { date: d, entry: log[d][exerciseId] } : null;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
const unitOf = (e: GymExercise) => (e.unit === "s" ? " s" : "");

/** Ce qu'on vise aujourd'hui (double progression). */
export function targetFor(e: GymExercise, last: GymEntry | null, phase: GymPhase): { weight: number | null; text: string } {
  const range = e.repsMin === e.repsMax ? `${e.repsMax}${unitOf(e)}` : `${e.repsMin} à ${e.repsMax}${unitOf(e)}`;
  if (!last) return { weight: null, text: `Trouve une charge qui te permet ${range} avec 3 répétitions en réserve, et note-la.` };
  const hitTop = last.r.length >= Math.min(e.sets, setsFor(e, phase)) && last.r.every((r) => r >= e.repsMax);
  if (phase === "allegement") return { weight: last.w, text: `Même charge (${last.w ? `${fmt(last.w)} kg` : "poids du corps"}), une série de moins, sans forcer.` };
  if (hitTop) {
    if (e.step === 0 || last.w === null) {
      if (e.unit === "s") return { weight: null, text: `Tu as atteint ${e.repsMax} s : ajoute 10 s ou passe à une version plus dure.` };
      return { weight: null, text: `Tu fais ${e.repsMax} partout : ajoute une charge ou ralentis la descente (3 s).` };
    }
    const w = last.w + e.step;
    return { weight: w, text: `Monte à ${fmt(w)} kg et repars à ${e.repsMin}${unitOf(e)}.` };
  }
  const best = Math.max(...last.r, 0);
  return { weight: last.w, text: `Garde ${last.w !== null ? `${fmt(last.w)} kg` : "le poids du corps"} et vise une répétition de plus (dernière fois : ${last.r.join(", ")}${unitOf(e)}${best >= e.repsMax ? "" : `, but ${e.repsMax}`}).` };
}

export function restLabel(s: number): string {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r}` : `${m} min`;
}

/** La séance en une ligne, pour la description du calendrier. */
export function sessionLine(s: GymSession): string {
  return `${s.dayLabel} ${s.key} : ${s.exercises
    .map((e) => `${e.name.split(" (")[0].toLowerCase()} ${e.sets}×${e.repsMin === e.repsMax ? e.repsMax : `${e.repsMin}-${e.repsMax}`}${e.unit === "s" ? " s" : ""}`)
    .join(" · ")}${s.finisher ? " · cardio 6 min" : ""}`;
}

export function exerciseById(id: string): GymExercise | null {
  for (const s of GYM) for (const e of s.exercises) if (e.id === id) return e;
  return null;
}

/** Lit le journal enregistré sans jamais planter, en gardant seulement des valeurs propres. */
export function parseGymLog(raw: unknown): GymLog {
  if (!raw) return {};
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: GymLog = {};
    for (const [d, exs] of Object.entries(v as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !exs || typeof exs !== "object") continue;
      for (const [id, e] of Object.entries(exs as Record<string, any>)) {
        const r = Array.isArray(e?.r) ? e.r.filter((x: unknown) => typeof x === "number" && x >= 0 && x <= 300) : [];
        const w = typeof e?.w === "number" && e.w >= 0 && e.w <= 500 ? e.w : null;
        if (!r.length) continue;
        (out[d] ??= {})[id] = { w, r };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Garde les 120 derniers jours du journal (le réglage reste petit). */
export function trimGymLog(log: GymLog, today: string): GymLog {
  const from = addDays(today, -120);
  return Object.fromEntries(Object.entries(log).filter(([d]) => d >= from));
}
