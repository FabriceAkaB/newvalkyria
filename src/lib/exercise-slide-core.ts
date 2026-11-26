/** Ajout d'un exercice par sa diapo (JP, 25 nov. 2026) : JP dépose l'image ou le PDF d'une diapo, le site la lit et
 *  range l'exercice dans le bon chapitre (thème) et la bonne catégorie (type), que JP peut corriger ensuite.
 *  Règles pures, testées (exercise-slide-core.test.ts) : lecture du texte de la diapo (sans IA) et nettoyage de la
 *  réponse de Claude quand la clé ANTHROPIC_API_KEY est en place (exercise-slide-reader.ts). */

import { DEFAULT_PLACE, EXERCISE_CATEGORIES, EXERCISE_LEVELS, EXERCISE_TYPES, AGE_GROUPS, type ExerciseType } from "@/lib/exercise-bank";

export interface SlideDraft {
  title: string;
  category: string;
  exerciseType: ExerciseType | null;
  sessionPlace: string | null;
  level: string | null;
  ageGroups: string[];
  objective: string | null;
  dimensions: string | null;
  instructions: string | null;
  coachingPoints: string | null;
  variantEasier: string | null;
  variantHarder: string | null;
  variants: string | null;
  progression: string | null;
  material: string | null;
  durationMinutes: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
}

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Mots qui trahissent le thème, du plus précis au plus général (le premier l'emporte à égalité). */
const CATEGORY_WORDS: [string, RegExp][] = [
  ["Ball mastery", /ball mastery|maitrise (du|de) ballon|semelle|gestes? techniques? au sol/g],
  ["Finition", /finition|frappe|\btirs?\b|devant le but|marquer de la tete|reprise de volee/g],
  ["1v1", /\b1\s*[cvx]\s*1\b|1 contre 1|duel|feinte|eliminer/g],
  ["Transition", /transition|changement de statut|contre-attaque|perte de balle/g],
  ["Jeu entre les lignes", /entre les lignes|intervalles?|troisieme ligne/g],
  ["Prise d'information", /prise d'info|prise d.information|scann?|regarder (par-dessus|avant)|vision/g],
  ["Défense", /defens|press(er|ez|ing|ion|e)\b|recuper|cadr(age|er|e)\b|couverture|harcel|bloc bas|inferiorit/g],
  ["Conduite", /conduite|dribbl|protection du ballon|proteger le ballon/g],
  ["Contrôle", /controle|orient[ée]|premiere touche|amorti/g],
  ["Physique", /physique|vitesse|coordination|agilite|endurance|appuis/g],
  ["Passe", /passe|remise|une-deux|rondo|conservation|possession|appui-soutien|jeu a 2|jeu a 3|deviation/g],
  ["Prise de décision", /decision|choix|superiorite|\b[2-4]\s*[cvx]\s*[1-3]\b|lire le jeu/g]
];

const TYPE_WORDS: [ExerciseType, RegExp][] = [
  ["ball-mastery", /ball mastery|maitrise (du|de) ballon/],
  ["echauffement", /echauffement|activation|jeu d'entree/],
  ["physique", /physique|circuit|vitesse|coordination/],
  ["forme-jouee", /forme jouee|\bmatch\b|[5-9]\s*[cvx]\s*[5-9]\b|1[01]\s*[cvx]\s*1[01]/],
  ["jeu-reduit", /rondo|jeu reduit|\b[1-4]\s*[cvx]\s*[1-4]\b|conservation|possession/],
  ["analytique", /analytique|atelier|parcours|en colonnes?|technique/]
];

/** Thème le plus probable d'après les mots de la diapo ; « Autre » si rien ne ressort. */
export function guessCategory(text: string): string {
  const t = norm(text);
  let best = { cat: "Autre", n: 0 };
  for (const [cat, re] of CATEGORY_WORDS) {
    const n = (t.match(re) ?? []).length;
    if (n > best.n) best = { cat, n };
  }
  return best.cat;
}

export function guessType(text: string): ExerciseType | null {
  const t = norm(text);
  return TYPE_WORDS.find(([, re]) => re.test(t))?.[0] ?? null;
}

const HEADINGS: [RegExp, keyof SlideDraft | "variantsBlock"][] = [
  [/^(organisation|dispositif|mise en place|terrain|espace|dimensions?)$/, "dimensions"],
  [/^(materiel)$/, "material"],
  [/^(consignes?|points? cles?|comportements? attendus?|coaching|a repeter)$/, "coachingPoints"],
  [/^(regles?|deroulement|but du jeu|fonctionnement|points|description)$/, "instructions"],
  [/^(objectifs?|but)$/, "objective"],
  [/^(variantes?|evolutions?)$/, "variantsBlock"],
  [/^(plus facile|simplifier|facile)$/, "variantEasier"],
  [/^(plus difficile|complexifier|difficile)$/, "variantHarder"],
  [/^(progressions?)$/, "progression"]
];

/** Un nom de fichier parlant devient le titre (« Diapositive3.png », « IMG_1234 » ne le sont pas). */
export function titleFromFileName(fileName: string): string | null {
  const base = fileName.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!base || /^(img|dsc|image|scan|capture|screenshot|diapo(sitive)?|slide|page|document|untitled|sans titre)[\s-]*\d*( \(\d+\))?( - page \d+)?$/i.test(base)) return null;
  if (/^[\d\s-]+$/.test(base)) return null;
  return base.replace(/ - page \d+$/i, "").slice(0, 90);
}

const firstInt = (m: RegExpMatchArray | null, i = 1) => (m ? parseInt(m[i], 10) : null);

/** Lecture sans IA : le texte de la diapo (PDF) et le nom du fichier. Titre, thème, type et rubriques reconnues. */
export function draftFromSlideText(text: string, fileName: string): SlideDraft {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const buckets: Partial<Record<keyof SlideDraft | "variantsBlock", string[]>> = {};
  let current: keyof SlideDraft | "variantsBlock" | null = null;
  const loose: string[] = [];
  for (const line of lines) {
    // Durée, nombre de joueuses, âge : lus dans tout le texte plus bas, ils ferment la rubrique en cours.
    if (/^(duree|temps total|nombre de joueuses|ages?|niveau)\b/.test(norm(line))) {
      current = null;
      continue;
    }
    const m = line.match(/^([^:]{2,30})\s*:\s*(.*)$/);
    const head = norm(m ? m[1] : line).replace(/[^a-z' -]/g, "").trim();
    const hit = HEADINGS.find(([re]) => re.test(head));
    if (hit) {
      current = hit[1];
      const rest = m ? m[2].trim() : "";
      if (rest) (buckets[current] ??= []).push(rest);
      continue;
    }
    if (current) (buckets[current] ??= []).push(line.replace(/^[•\-–]\s*/, ""));
    else loose.push(line);
  }
  const join = (k: keyof SlideDraft | "variantsBlock") => (buckets[k]?.length ? buckets[k]!.join("\n") : null);

  let variantEasier = join("variantEasier");
  let variantHarder = join("variantHarder");
  const variantsBlock = buckets.variantsBlock ?? [];
  const rest: string[] = [];
  for (const v of variantsBlock) {
    const n = norm(v);
    if (!variantEasier && /facile|simplifi/.test(n)) variantEasier = v.replace(/^[^:]*:\s*/, "");
    else if (!variantHarder && /difficile|complexifi/.test(n)) variantHarder = v.replace(/^[^:]*:\s*/, "");
    else rest.push(v);
  }

  const titleLine = loose.find((l) => l.length >= 3 && l.length <= 90 && !/^\d+$/.test(l));
  const title = titleFromFileName(fileName) ?? titleLine ?? "Nouvel exercice (diapo)";
  const all = `${title}\n${lines.join("\n")}`;
  const exerciseType = guessType(all);
  const range = all.match(/(\d{1,2})\s*(?:à|a|-)\s*(\d{1,2})\s*joueuses/i);
  const single = all.match(/(\d{1,2})\s*joueuses/i);
  const duration = firstInt(all.match(/(\d{1,2})\s*(?:min\b|minutes)/i));
  const ages = AGE_GROUPS.filter((a) => new RegExp(`\\b${a.replace("+", "\\+")}`, "i").test(all));

  return {
    title,
    category: guessCategory(all),
    exerciseType,
    sessionPlace: exerciseType ? (DEFAULT_PLACE[exerciseType] ?? null) : null,
    level: null,
    ageGroups: [...ages],
    objective: join("objective"),
    dimensions: join("dimensions"),
    instructions: join("instructions") ?? (loose.length > 1 ? loose.filter((l) => l !== titleLine).join("\n") || null : null),
    coachingPoints: join("coachingPoints"),
    variantEasier,
    variantHarder,
    variants: rest.length ? rest.join("\n") : null,
    progression: join("progression"),
    material: join("material"),
    durationMinutes: duration && duration > 0 && duration <= 90 ? duration : null,
    minPlayers: range ? parseInt(range[1], 10) : firstInt(single),
    maxPlayers: range ? parseInt(range[2], 10) : firstInt(single)
  };
}

const str = (v: unknown, max = 4000) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const int = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v) : null);

/** Nettoie ce que l'IA renvoie : thème et type ramenés aux listes de la banque, nombres bornés, textes coupés. */
export function sanitizeDraft(raw: unknown, fallback: SlideDraft): SlideDraft {
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Record<string, unknown>;
  const cat = str(r.category, 60);
  const category = EXERCISE_CATEGORIES.find((c) => norm(c) === norm(cat)) ?? (cat ? guessCategory(cat) : fallback.category);
  const typeRaw = str(r.exerciseType, 40);
  const exerciseType = (EXERCISE_TYPES.find((t) => t.key === typeRaw || norm(t.label) === norm(typeRaw))?.key ?? fallback.exerciseType) as ExerciseType | null;
  const level = EXERCISE_LEVELS.find((l) => norm(l) === norm(r.level)) ?? null;
  const ages = Array.isArray(r.ageGroups) ? AGE_GROUPS.filter((a) => (r.ageGroups as unknown[]).some((x) => norm(x) === norm(a))) : [];
  const minPlayers = int(r.minPlayers, 1, 40);
  const maxPlayers = int(r.maxPlayers, 1, 40);
  return {
    title: str(r.title, 90) ?? fallback.title,
    category,
    exerciseType,
    sessionPlace: exerciseType ? (DEFAULT_PLACE[exerciseType] ?? null) : null,
    level,
    ageGroups: ages.length ? [...ages] : fallback.ageGroups,
    objective: str(r.objective),
    dimensions: str(r.dimensions),
    instructions: str(r.instructions),
    coachingPoints: str(r.coachingPoints),
    variantEasier: str(r.variantEasier),
    variantHarder: str(r.variantHarder),
    variants: str(r.variants),
    progression: str(r.progression),
    material: str(r.material),
    durationMinutes: int(r.durationMinutes, 1, 90),
    minPlayers: minPlayers && maxPlayers && minPlayers > maxPlayers ? maxPlayers : minPlayers,
    maxPlayers: minPlayers && maxPlayers && minPlayers > maxPlayers ? minPlayers : maxPlayers
  };
}

/** Schéma JSON demandé à Claude (sorties structurées). */
export const SLIDE_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title", "category", "exerciseType", "level", "ageGroups", "objective", "dimensions", "instructions", "coachingPoints",
    "variantEasier", "variantHarder", "variants", "progression", "material", "durationMinutes", "minPlayers", "maxPlayers"
  ],
  properties: {
    title: { type: "string" },
    category: { type: "string", enum: [...EXERCISE_CATEGORIES] },
    exerciseType: { type: ["string", "null"], enum: [...EXERCISE_TYPES.map((t) => t.key), null] },
    level: { type: ["string", "null"], enum: [...EXERCISE_LEVELS, null] },
    ageGroups: { type: "array", items: { type: "string", enum: [...AGE_GROUPS] } },
    objective: { type: ["string", "null"] },
    dimensions: { type: ["string", "null"] },
    instructions: { type: ["string", "null"] },
    coachingPoints: { type: ["string", "null"] },
    variantEasier: { type: ["string", "null"] },
    variantHarder: { type: ["string", "null"] },
    variants: { type: ["string", "null"] },
    progression: { type: ["string", "null"] },
    material: { type: ["string", "null"] },
    durationMinutes: { type: ["integer", "null"] },
    minPlayers: { type: ["integer", "null"] },
    maxPlayers: { type: ["integer", "null"] }
  }
} as const;

/** Un exercice déjà dans la banque avec la même diapo (empreinte) ou le même titre (accents, majuscules et
 *  ponctuation ignorés) : l'ajout par diapo le refuse pour ne pas créer de doublon. Les exercices retirés comptent aussi. */
export function findDuplicateExercise<T extends { id: string; title: string; image_hash?: string | null }>(
  candidate: { title: string | null | undefined; imageHash: string | null | undefined },
  existing: T[]
): T | null {
  const key = (t: string | null | undefined) => norm(t).replace(/[^a-z0-9]+/g, " ").trim();
  const title = key(candidate.title);
  return (
    (candidate.imageHash ? existing.find((e) => e.image_hash === candidate.imageHash) : undefined) ??
    (title && title !== key("Nouvel exercice (diapo)") ? existing.find((e) => key(e.title) === title) : undefined) ??
    null
  );
}
