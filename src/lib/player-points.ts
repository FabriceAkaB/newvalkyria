/** Points des joueuses (JP, 2 nov. 2026 ; refait le 17 nov. 2026 ; P4.6 Appartenance) : règles pures, testées.
 *
 *  Gagner : points de bienvenue dès l'inscription (tout le monde commence la saison avec des points), présence à
 *  chaque pratique (comptée toute seule à partir des présences, même saisies en retard), championnes du jour
 *  publiées par l'éducateur (une gagnante, un groupe, l'attitude, ou une partie spéciale à points ajustés).
 *  Le barème est réglable par l'admin (app_settings « points_bareme ») : présence et bienvenue se recalculent pour
 *  toutes ; les points d'une championne sont gardés tels que donnés.
 *
 *  Dépenser : un cadeau, un rabais en boutique ou un crédit sur la prochaine saison, avant la fin de la saison.
 *  À la fin de la saison, le solde qui reste devient le cadeau par défaut et la cagnotte repart à zéro.
 *  Le niveau (Recrue → Légende) suit les points gagnés et ne baisse jamais, même quand on dépense.
 *  Pas de classement entre les filles. */

export interface PointsRules {
  /** Par pratique où elle est présente. */
  presence: number;
  /** Donnés une fois, dès l'inscription à la saison. */
  bienvenue: number;
  /** Une gagnante seule. */
  individuel: number;
  /** Chaque fille d'un groupe gagnant (ex. une équipe de 4). */
  groupe: number;
  /** Attitude remarquée par l'éducateur. */
  attitude: number;
  /** Plafond d'une partie spéciale (l'éducateur choisit les points, jusqu'à ce maximum). */
  specialMax: number;
  /** Plafond des points de championne qu'une fille peut gagner à une même pratique (pour garder leur valeur). */
  maxParPratique: number;
}

export const DEFAULT_RULES: PointsRules = { presence: 5, bienvenue: 25, individuel: 10, groupe: 5, attitude: 10, specialMax: 30, maxParPratique: 30 };

export const RULE_LABELS: Record<keyof PointsRules, string> = {
  bienvenue: "Bienvenue (à l'inscription)",
  presence: "Présence à une pratique",
  individuel: "Gagnante seule",
  groupe: "Chaque fille d'un groupe gagnant",
  attitude: "Attitude",
  specialMax: "Partie spéciale : maximum",
  maxParPratique: "Maximum par fille et par pratique"
};

/** Lit le barème enregistré (texte JSON ou objet) ; une valeur manquante ou invalide reprend celle par défaut. */
export function normalizeRules(raw: unknown): PointsRules {
  let obj: Record<string, unknown> = {};
  try {
    obj = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
  } catch {
    obj = {};
  }
  const out = { ...DEFAULT_RULES };
  for (const k of Object.keys(DEFAULT_RULES) as (keyof PointsRules)[]) {
    const v = Number(obj?.[k]);
    if (Number.isFinite(v) && v >= 0 && v <= 1000) out[k] = Math.round(v);
  }
  if (out.maxParPratique < Math.max(out.individuel, out.attitude)) out.maxParPratique = Math.max(out.individuel, out.attitude);
  return out;
}

/* ── Championnes du jour ───────────────────────────────────────────── */

export type ChampionKind = "individuel" | "groupe" | "attitude" | "special";

export const CHAMPION_KINDS: { kind: ChampionKind; label: string; emoji: string; hint: string }[] = [
  { kind: "individuel", label: "Gagnante", emoji: "🏆", hint: "Une seule fille a gagné le jeu" },
  { kind: "groupe", label: "Groupe gagnant", emoji: "🤝", hint: "Une équipe ou un duo a gagné : chaque fille reçoit les points" },
  { kind: "attitude", label: "Attitude", emoji: "⭐", hint: "Effort, écoute, entraide remarqués" },
  { kind: "special", label: "Partie spéciale", emoji: "🎯", hint: "Un défi spécial : tu choisis les points" }
];

export const championLabel = (kind: ChampionKind) => CHAMPION_KINDS.find((k) => k.kind === kind)!;

/** Points donnés à chaque championne. Partie spéciale : les points choisis, ramenés entre 1 et le maximum. */
export function championPoints(kind: ChampionKind, rules: PointsRules, special?: number | null): number {
  if (kind === "individuel") return rules.individuel;
  if (kind === "groupe") return rules.groupe;
  if (kind === "attitude") return rules.attitude;
  const v = Math.round(Number(special));
  return Number.isFinite(v) ? Math.min(rules.specialMax, Math.max(1, v)) : Math.min(rules.specialMax, rules.individuel);
}

/** La ligne de points d'une championne : « attitude » ou « victoire » (gagnante, groupe, partie spéciale). */
export const lineKindOf = (kind: ChampionKind): "victoire" | "attitude" => (kind === "attitude" ? "attitude" : "victoire");

/** Vérifie une publication de championnes avant de l'enregistrer. `already` : points de championne déjà gagnés à
 *  cette pratique, par fille. Renvoie le problème à montrer à l'éducateur, ou null. */
export function checkChampions(input: {
  kind: ChampionKind;
  ids: string[];
  points: number;
  rules: PointsRules;
  already: Map<string, number>;
  nameOf: (id: string) => string;
}): string | null {
  const ids = [...new Set(input.ids)];
  if (!ids.length) return "Choisis au moins une fille.";
  if (input.kind === "individuel" && ids.length > 1) return "Une gagnante seule : choisis une fille. Pour plusieurs filles, prends « Groupe gagnant ».";
  if (input.kind === "groupe" && ids.length < 2) return "Un groupe gagnant compte au moins 2 filles. Pour une seule, prends « Gagnante ».";
  if (ids.length > 12) return "Au plus 12 filles par publication.";
  for (const id of ids) {
    const before = input.already.get(id) ?? 0;
    if (before + input.points > input.rules.maxParPratique) {
      return `${input.nameOf(id)} a déjà ${before} points de championne à cette pratique (maximum ${input.rules.maxParPratique}).`;
    }
  }
  return null;
}

/** Une photo de championnes ne se publie que si chaque fille de la photo a l'autorisation photo de sa famille. */
export function photoAllowed(consents: (boolean | null | undefined)[]): boolean {
  return consents.length > 0 && consents.every((c) => c === true);
}

/** Nom affiché aux autres familles : prénom et initiale seulement. */
export const shortName = (first: string, last: string) => `${first.trim()}${last.trim() ? ` ${last.trim()[0].toUpperCase()}.` : ""}`;

/* ── Solde ─────────────────────────────────────────────────────────── */

export interface PointsLine {
  kind: "victoire" | "attitude" | "bonus" | "echange" | "expiration";
  points: number;
  status?: string | null;
}

/** Solde d'une joueuse pour une saison. `earned` (bienvenue + présences + championne + bonus) fait monter de niveau
 *  et ne baisse jamais ; `balance` = ce qui reste à dépenser (gagné − dépensé − expiré). Une demande annulée ne
 *  compte pas. */
export function pointsBalance(presences: number, lines: PointsLine[], rules: PointsRules = DEFAULT_RULES, welcome = true) {
  const presence = presences * rules.presence;
  const bienvenue = welcome ? rules.bienvenue : 0;
  const won = lines.filter((l) => l.kind === "victoire" || l.kind === "attitude" || l.kind === "bonus").reduce((s, l) => s + l.points, 0);
  const spent = Math.abs(lines.filter((l) => l.kind === "echange" && l.status !== "annulee").reduce((s, l) => s + Math.min(0, l.points), 0));
  const expired = Math.abs(lines.filter((l) => l.kind === "expiration").reduce((s, l) => s + Math.min(0, l.points), 0));
  const earned = presence + bienvenue + won;
  return {
    presence,
    bienvenue,
    victoires: lines.filter((l) => l.kind === "victoire").length,
    attitudes: lines.filter((l) => l.kind === "attitude").length,
    earned,
    spent,
    expired,
    balance: Math.max(0, earned - spent - expired)
  };
}

/* ── Récompenses ───────────────────────────────────────────────────── */

export type RewardKind = "cadeau" | "rabais-boutique" | "credit-saison";

export const REWARD_KINDS: Record<RewardKind, { label: string; emoji: string; how: string }> = {
  cadeau: { label: "Cadeau", emoji: "🎁", how: "Remis à la joueuse à une pratique" },
  "rabais-boutique": { label: "Rabais en boutique", emoji: "🛍️", how: "Appliqué à votre prochaine commande en boutique" },
  "credit-saison": { label: "Crédit sur la prochaine saison", emoji: "🎟️", how: "Retiré du prix de la prochaine inscription" }
};

/** Récompenses qu'elle peut prendre avec son solde, et la plus proche qu'elle n'a pas encore les moyens de prendre. */
export function rewardsFor<T extends { id: string; name: string; cost: number }>(balance: number, rewards: T[]) {
  const sorted = [...rewards].sort((a, b) => a.cost - b.cost);
  return { available: sorted.filter((r) => r.cost <= balance), next: sorted.find((r) => r.cost > balance) ?? null };
}

/** Peut-elle demander cette récompense ? (solde suffisant, saison pas terminée). */
export function canRedeem(input: { balance: number; cost: number; expired: boolean }): string | null {
  if (input.expired) return "La saison est terminée : les points restants sont devenus le cadeau de fin de saison.";
  if (input.cost > input.balance) return `Il manque ${input.cost - input.balance} points.`;
  return null;
}

/* ── Fin de saison ─────────────────────────────────────────────────── */

const DAY = 86_400_000;

/** Où en est la saison pour les points : `bientot` (30 jours ou moins : on rappelle de les dépenser),
 *  `dernier` (7 jours ou moins), `expire` (après la dernière journée). */
export function expiryStatus(seasonEnd: string, today: string): { daysLeft: number; phase: "loin" | "bientot" | "dernier" | "expire" } {
  const daysLeft = Math.round((Date.parse(`${seasonEnd}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY);
  const phase = daysLeft < 0 ? "expire" : daysLeft <= 7 ? "dernier" : daysLeft <= 30 ? "bientot" : "loin";
  return { daysLeft, phase };
}

/* ── Progression comme dans un jeu (JP, 3 nov. 2026) ───────────────── */

export const LEVELS = [
  { n: 1, name: "Recrue", min: 0 },
  { n: 2, name: "Apprentie", min: 25 },
  { n: 3, name: "Joueuse", min: 60 },
  { n: 4, name: "Guerrière", min: 100 },
  { n: 5, name: "Capitaine", min: 150 },
  { n: 6, name: "Étoile", min: 220 },
  { n: 7, name: "Valkyrie", min: 300 },
  { n: 8, name: "Légende", min: 400 }
] as const;
export type Level = (typeof LEVELS)[number];

export interface Progress {
  xp: number;
  balance: number;
  level: Level;
  next: Level | null;
  /** Part du chemin vers le niveau suivant (0 à 1 ; 1 au dernier niveau). */
  pct: number;
  toNext: number;
  /** Récompenses qu'elle peut déjà prendre avec son solde. */
  affordable: { id: string; name: string; cost: number }[];
  nextReward: { id: string; name: string; cost: number; toGo: number } | null;
}

export function progressOf(xp: number, rewards: { id: string; name: string; cost: number }[] = [], balance = xp): Progress {
  const points = Math.max(0, Math.floor(xp));
  const idx = LEVELS.reduce((best, l, i) => (points >= l.min ? i : best), 0);
  const level = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const pct = next ? (points - level.min) / (next.min - level.min) : 1;
  const { available, next: nr } = rewardsFor(balance, rewards);
  return {
    xp: points,
    balance,
    level,
    next,
    pct: Math.max(0, Math.min(1, pct)),
    toNext: next ? next.min - points : 0,
    affordable: available.map((r) => ({ id: r.id, name: r.name, cost: r.cost })),
    nextReward: nr ? { id: nr.id, name: nr.name, cost: nr.cost, toGo: nr.cost - balance } : null
  };
}
