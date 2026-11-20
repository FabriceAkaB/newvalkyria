/** Sondage de fin de pratique (demande de JP, 3 nov. 2026 ; Mandalart P1.5.06, indicateur appreciation_joueuses).
 *  Chaque fille présente dit son plaisir et sa fatigue ; sur la borne, aussi si sa coach et les autres l'ont aidée.
 *  Règles pures, partagées par le portail des éducateurs et l'espace Coaching.
 *
 *  Le plaisir et la fatigue sont notés sur 10 (practice_rating, fatigue) : le plaisir alimente l'indicateur. */

/** Plaisir et fatigue notés de 1 à 10 (demande de JP, 3 nov. 2026). Les mots aux deux bouts aident les plus jeunes. */
export interface Scale {
  key: "plaisir" | "fatigue" | "apprentissage" | "comprehension" | "confiance";
  label: string;
  low: string;
  high: string;
}

export const SCALE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const PLEASURE: Scale = { key: "plaisir", label: "Plaisir", low: "😞 Pas aimé", high: "Adoré 😍" };
/** 1 = pleine d'énergie, 10 = épuisée. */
export const FATIGUE: Scale = { key: "fatigue", label: "Fatigue", low: "⚡ Pleine d'énergie", high: "Épuisée 🥵" };

export const LEARNING: Scale = { key: "apprentissage", label: "Apprentissage", low: "🤷 Rien de nouveau", high: "Plein de choses 🧠" };
export const UNDERSTANDING: Scale = { key: "comprehension", label: "Compréhension", low: "😕 Pas compris", high: "Tout compris 💡" };
export const CONFIDENCE: Scale = { key: "confiance", label: "Confiance", low: "😬 Pas confiante", high: "Super confiante 💪" };

/** La borne (iPad au bord du terrain, demande de JP du 13 nov. 2026) : la joueuse touche sa photo et répond seule,
 *  une question par écran, en mots d'enfant. Les mêmes 4 questions à chaque pratique (JP, 20 nov. 2026) : plaisir,
 *  fatigue, l'aide de la coach (oui / non, puis laquelle) et l'aide des autres (oui / non, puis qui).
 *  Apprentissage, compréhension et confiance ne sont plus posées ; les anciennes réponses restent gardées. */
export type KioskQuestion =
  | { kind: "scale"; field: "practiceRating" | "fatigue"; question: string; scale: Scale }
  | { kind: "help"; field: "coach" | "peer"; question: string; pick: string };

export const KIOSK_QUESTIONS: KioskQuestion[] = [
  { kind: "scale", field: "practiceRating", question: "As-tu eu du plaisir aujourd'hui\u00a0?", scale: PLEASURE },
  { kind: "scale", field: "fatigue", question: "Es-tu fatiguée\u00a0?", scale: FATIGUE },
  { kind: "help", field: "coach", question: "Ta coach t'a-t-elle aidée ou encouragée aujourd'hui\u00a0?", pick: "Qui t'a aidée ou encouragée\u00a0?" },
  { kind: "help", field: "peer", question: "Est-ce que quelqu'un t'a aidée aujourd'hui\u00a0?", pick: "Touche les filles qui t'ont aidée" }
];

/** Au plus 30 personnes cochées par question (une pratique n'en compte pas plus). */
export const HELPERS_MAX = 30;

export const WANTS_MORE = [
  { key: "matchs", label: "Matchs" },
  { key: "jeux", label: "Jeux" },
  { key: "dribbles", label: "Dribbles et 1 contre 1" },
  { key: "tirs", label: "Tirs au but" },
  { key: "passes", label: "Passes" },
  { key: "ball-mastery", label: "Ball mastery et jongles" },
  { key: "defis", label: "Défis et compétitions" },
  { key: "gardienne", label: "Gardienne de but" },
  { key: "defense", label: "Défense" }
] as const;
export type WantsMoreKey = (typeof WANTS_MORE)[number]["key"];

export const wantsLabel = (k: string) => WANTS_MORE.find((w) => w.key === k)?.label ?? k;
export const NOTE_MAX = 80;

export interface SurveyAnswer {
  practiceRating: number | null;
  fatigue: number | null;
  wantsMore: string[];
  wantsMoreNote: string | null;
  /** Borne : apprentissage, compréhension de la pratique, confiance (sur 10). Absents = pas touchés. */
  learning?: number | null;
  understanding?: number | null;
  confidence?: number | null;
  /** Borne : la coach l'a aidée ou encouragée (oui / non) et lesquelles (id des coachs). Absents = pas touchés. */
  coachHelped?: boolean | null;
  coachHelpers?: string[];
  /** Borne : quelqu'un l'a aidée (oui / non) et qui (id d'inscription des filles). */
  peerHelped?: boolean | null;
  peerHelpers?: string[];
}

/** Une réponse est complète quand le plaisir et la fatigue sont donnés (« plus de… » est facultatif). */
export const isAnswered = (a: Pick<SurveyAnswer, "practiceRating" | "fatigue"> | null | undefined) => a?.practiceRating != null && a?.fatigue != null;

/** Nettoie une réponse envoyée par le formulaire ; retourne un message d'erreur si elle est invalide. */
export function parseSurveyAnswer(body: Record<string, unknown>): SurveyAnswer | string {
  const score = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 10 ? Number(v) : undefined);
  const practiceRating = score(body.practiceRating);
  const fatigue = score(body.fatigue);
  if (practiceRating === undefined || fatigue === undefined) return "Le plaisir et la fatigue vont de 0 à 10.";
  const keys = new Set<string>(WANTS_MORE.map((w) => w.key));
  const raw = Array.isArray(body.wantsMore) ? body.wantsMore : [];
  if (raw.some((k) => !keys.has(String(k)))) return "Choix « plus de… » inconnu.";
  const note = String(body.wantsMoreNote ?? "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX);
  const out: SurveyAnswer = { practiceRating, fatigue, wantsMore: [...new Set(raw.map(String))], wantsMoreNote: note || null };
  for (const k of ["learning", "understanding", "confidence"] as const) {
    if (!(k in body)) continue;
    const v = score(body[k]);
    if (v === undefined) return "Les réponses vont de 0 à 10.";
    out[k] = v;
  }
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const [flag, list] of [["coachHelped", "coachHelpers"], ["peerHelped", "peerHelpers"]] as const) {
    if (!(flag in body)) continue;
    const v = body[flag];
    if (v !== true && v !== false && v !== null) return "Réponse oui / non attendue.";
    const ids = Array.isArray(body[list]) ? (body[list] as unknown[]).map(String) : [];
    if (ids.length > HELPERS_MAX || ids.some((id) => !UUID.test(id))) return "Liste de personnes invalide.";
    out[flag] = v;
    // « Non » : personne de cochée.
    out[list] = v === true ? [...new Set(ids)] : [];
  }
  return out;
}

export interface SurveySummary {
  answered: number;
  pleasure: number | null;
  fatigue: number | null;
  learning: number | null;
  understanding: number | null;
  confidence: number | null;
  /** Borne : combien ont répondu à la question de l'aide de la coach et combien ont dit oui. */
  coachHelp: { answered: number; yes: number };
  peerHelp: { answered: number; yes: number };
  /** Combien de fois chaque coach (id) ou chaque fille (id d'inscription) a été nommée. */
  coachMentions: Record<string, number>;
  peerMentions: Record<string, number>;
  /** Les demandes les plus fréquentes d'abord. */
  wants: { key: string; label: string; count: number }[];
  notes: string[];
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);

export function summarizeSurvey(rows: { practice_rating: number | null; fatigue: number | null; learning?: number | null; understanding?: number | null; confidence?: number | null; coach_helped?: boolean | null; coach_helpers?: string[] | null; peer_helped?: boolean | null; peer_helpers?: string[] | null; wants_more?: string[] | null; wants_more_note?: string | null }[]): SurveySummary {
  const help = (key: "coach_helped" | "peer_helped") => ({ answered: rows.filter((r) => r[key] === true || r[key] === false).length, yes: rows.filter((r) => r[key] === true).length });
  const mentions = (key: "coach_helpers" | "peer_helpers") => {
    const m: Record<string, number> = {};
    for (const r of rows) for (const id of r[key] ?? []) m[id] = (m[id] ?? 0) + 1;
    return m;
  };
  const answered = rows.filter((r) => r.practice_rating != null || r.fatigue != null || (r.wants_more ?? []).length > 0);
  const counts = new Map<string, number>();
  for (const r of rows) for (const k of r.wants_more ?? []) counts.set(k, (counts.get(k) ?? 0) + 1);
  return {
    answered: answered.length,
    pleasure: avg(rows.map((r) => r.practice_rating).filter((v): v is number => v != null)),
    fatigue: avg(rows.map((r) => r.fatigue).filter((v): v is number => v != null)),
    learning: avg(rows.map((r) => r.learning).filter((v): v is number => v != null)),
    understanding: avg(rows.map((r) => r.understanding).filter((v): v is number => v != null)),
    confidence: avg(rows.map((r) => r.confidence).filter((v): v is number => v != null)),
    coachHelp: help("coach_helped"),
    peerHelp: help("peer_helped"),
    coachMentions: mentions("coach_helpers"),
    peerMentions: mentions("peer_helpers"),
    wants: [...counts.entries()].map(([key, count]) => ({ key, label: wantsLabel(key), count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr")),
    notes: rows.map((r) => r.wants_more_note?.trim()).filter((n): n is string => Boolean(n))
  };
}

/* ── Tableau de bord du sondage (JP, 20 nov. 2026 : courbes, cercles, l'aide des éducateurs chiffrée) ── */

export interface SurveyRow {
  date: string;
  activity_id: string;
  practice_rating: number | null;
  fatigue: number | null;
  coach_helped?: boolean | null;
  coach_helpers?: string[] | null;
  peer_helped?: boolean | null;
}

/** Le lundi de la semaine d'une date (AAAA-MM-JJ). */
export function weekOf(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export interface SurveyWeek {
  week: string;
  answered: number;
  pleasure: number | null;
  fatigue: number | null;
  /** Part des filles qui disent que leur coach les a aidées ou encouragées (0 à 100), null sans réponse. */
  coachHelpPct: number | null;
}

/** Une ligne par semaine, de la plus ancienne à la plus récente (semaines sans réponse omises). */
export function weeklySeries(rows: SurveyRow[]): SurveyWeek[] {
  const by = new Map<string, SurveyRow[]>();
  for (const r of rows) {
    if (r.practice_rating == null && r.fatigue == null) continue;
    const w = weekOf(r.date);
    by.set(w, [...(by.get(w) ?? []), r]);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, rs]) => {
      const asked = rs.filter((r) => r.coach_helped === true || r.coach_helped === false);
      return {
        week,
        answered: rs.length,
        pleasure: avg(rs.map((r) => r.practice_rating).filter((v): v is number => v != null)),
        fatigue: avg(rs.map((r) => r.fatigue).filter((v): v is number => v != null)),
        coachHelpPct: asked.length ? Math.round((asked.filter((r) => r.coach_helped === true).length / asked.length) * 100) : null
      };
    });
}

export interface CoachHelpRate {
  coachId: string;
  /** Pratiques où elle était sur le terrain et où des filles ont répondu à la question. */
  practices: number;
  /** Filles qui ont répondu à la question dans ses pratiques. */
  asked: number;
  /** Filles qui l'ont nommée. */
  named: number;
  /** named / asked, de 0 à 100. */
  pct: number;
}

/** Pour chaque coach : sur toutes les filles qui ont répondu « Ta coach t'a-t-elle aidée ? » dans ses pratiques,
 *  combien l'ont nommée. Le pourcentage compare des coachs qui n'ont pas le même nombre de pratiques. */
export function coachHelpRates(rows: SurveyRow[], coachesByActivity: Map<string, string[]>): CoachHelpRate[] {
  const acc = new Map<string, { practices: Set<string>; asked: number; named: number }>();
  for (const r of rows) {
    if (r.coach_helped !== true && r.coach_helped !== false) continue;
    for (const id of coachesByActivity.get(r.activity_id) ?? []) {
      const a = acc.get(id) ?? { practices: new Set<string>(), asked: 0, named: 0 };
      a.practices.add(r.activity_id);
      a.asked += 1;
      if ((r.coach_helpers ?? []).includes(id)) a.named += 1;
      acc.set(id, a);
    }
  }
  return [...acc.entries()]
    .map(([coachId, a]) => ({ coachId, practices: a.practices.size, asked: a.asked, named: a.named, pct: a.asked ? Math.round((a.named / a.asked) * 100) : 0 }))
    .sort((x, y) => y.pct - x.pct || y.named - x.named);
}
