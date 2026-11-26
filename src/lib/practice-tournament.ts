/** Tournoi de fin de pratique (JP, 26 nov. 2026) : 3 contre 3 à 6 contre 6, équipes formées par le site avec les
 *  filles présentes (pas toujours les mêmes ensemble, forces équilibrées par les évaluations), une joker quand le
 *  compte ne tombe pas juste, capitaines à tour de rôle avec la tâche du thème, horaire (qui contre qui, combien de
 *  temps), classement en direct (victoire 2, nul 1, défaite 0) puis finale ou demi-finales.
 *  Règles pures, testées (practice-tournament.test.ts). Base : `practice_tournaments` (practice-tournament-repo.ts),
 *  équipes aussi gardées dans `practice_teams` (historique de qui était avec qui et des capitaines). */

import { captainTaskFor, makeGroups, matchups, pickCaptains, TEAM_COLORS, type PastTeam } from "@/lib/practice-teams-core";

export const TOURNAMENT_FORMATS = [3, 4, 5, 6] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];
export const formatLabel = (f: number) => `${f} contre ${f}`;

export const FINISHES = [
  { key: "poule", label: "Classement seulement" },
  { key: "finale", label: "Finale : 1re contre 2e" },
  { key: "demi-finales", label: "Demi-finales et finale" }
] as const;
export type TournamentFinish = (typeof FINISHES)[number]["key"];

/** Victoire 2 points, nul 1, défaite 0 (JP). */
export const POINTS = { win: 2, draw: 1, loss: 0 } as const;

/** Couleurs des dossards dans l'ordre où le site les donne (le nom de l'équipe est sa couleur). */
export const TOURNAMENT_COLORS = ["Rouges", "Jaunes", "Violettes", "Noires", "Blanches", "Bleues", "Vertes", "Oranges", "Roses"].filter((c) => TEAM_COLORS.some((t) => t.name === c));

export interface TournamentSettings {
  format: TournamentFormat;
  finish: TournamentFinish;
  /** Durée totale du tournoi, en minutes. */
  durationMin: number;
  /** Matchs joués en même temps (terrains). */
  fields: number;
  /** Temps de changement entre deux matchs, en minutes. */
  changeoverMin: number;
  /** 1 = chaque équipe affronte chaque autre une fois ; 2 = aller-retour. */
  rounds: 1 | 2;
}

export interface TournamentTeam {
  label: string;
  color: string;
  members: string[];
  captain: string | null;
  /** Une fille de plus que le format (joker) : l'équipe a une remplaçante de plus. */
  joker: boolean;
}

export interface TournamentPlayer {
  id: string;
  /** Moyenne des évaluations (1 à 5) ; null = pas encore évaluée (prend la moyenne du groupe). */
  rating: number | null;
}

/* ── Formation des équipes ───────────────────────────────────────── */

/** Combien d'équipes et combien de jokers : autant d'équipes complètes que possible, chaque fille en trop devient la
 *  joker d'une équipe (une par équipe). S'il reste plus de filles que d'équipes, on fait une équipe de plus. */
export function teamPlan(players: number, format: number): { teams: number; jokers: number; short: number } {
  if (players < 2) return { teams: 0, jokers: 0, short: 0 };
  let teams = Math.max(2, Math.floor(players / format));
  if (teams * format > players) {
    // Pas assez pour 2 équipes complètes : 2 équipes, une avec une fille de moins au besoin.
    return { teams: 2, jokers: 0, short: 2 * Math.ceil(players / 2) - players };
  }
  let rest = players - teams * format;
  if (rest > teams) {
    teams += 1;
    const base = Math.floor(players / teams);
    return base >= format ? { teams, jokers: players - teams * format, short: 0 } : { teams, jokers: 0, short: teams * Math.ceil(players / teams) - players };
  }
  return { teams, jokers: rest, short: 0 };
}

/** Part des paires de filles présentes qui ont déjà été ensemble (0 = toutes nouvelles, 1 = toutes déjà faites). */
export function pairSaturation(players: string[], history: PastTeam[]): number {
  if (players.length < 2) return 0;
  const here = new Set(players);
  const seen = new Set<string>();
  for (const t of history) {
    const m = t.members.filter((x) => here.has(x));
    for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) seen.add(m[i] < m[j] ? `${m[i]}|${m[j]}` : `${m[j]}|${m[i]}`);
  }
  return seen.size / ((players.length * (players.length - 1)) / 2);
}

/** Poids de l'équilibre des forces : toujours présent, et plus fort quand les équipes nouvelles sont épuisées (JP :
 *  « si ces équipes-là ont déjà toutes été faites, tiens plus compte des notes »). */
export const balanceWeight = (saturation: number) => 3 + 12 * Math.min(1, Math.max(0, saturation));

/** Forme les équipes du tournoi : nouvelles (le moins de filles déjà ensemble), forces équilibrées par les notes,
 *  une capitaine par équipe (celle qui l'a été le moins), couleur de dossard. */
export function formTournamentTeams(players: TournamentPlayer[], format: number, history: PastTeam[], seed = Date.now()): TournamentTeam[] {
  const plan = teamPlan(players.length, format);
  if (!plan.teams) return [];
  const ids = players.map((p) => p.id);
  const known = players.filter((p) => p.rating != null).map((p) => p.rating as number);
  const mean = known.length ? known.reduce((s, v) => s + v, 0) / known.length : 3;
  const ratings = new Map(players.map((p) => [p.id, p.rating ?? mean]));
  const groups = makeGroups(ids, plan.teams, history, seed, { ratings, balanceWeight: balanceWeight(pairSaturation(ids, history)) });
  const captains = pickCaptains(groups, history);
  return groups.map((members, i) => ({
    label: TOURNAMENT_COLORS[i] ?? `Équipe ${i + 1}`,
    color: TOURNAMENT_COLORS[i] ?? TOURNAMENT_COLORS[i % TOURNAMENT_COLORS.length],
    members,
    captain: captains[i],
    joker: members.length > format
  }));
}

/** Force moyenne d'une équipe (pour l'écran : on voit que c'est équilibré). */
export function teamStrength(members: string[], ratings: Map<string, number | null>): number | null {
  const v = members.map((m) => ratings.get(m)).filter((x): x is number => typeof x === "number");
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
}

export { captainTaskFor };

/* ── Horaire ─────────────────────────────────────────────────────── */

export type MatchPhase = "poule" | "demi" | "petite-finale" | "finale";

/** Une équipe dans un match : son numéro (poule) ou une place à trouver (rang au classement, gagnante d'un match). */
export type Slot = { team: number } | { rank: number } | { winnerOf: string } | { loserOf: string };

export interface ScheduledMatch {
  id: string;
  phase: MatchPhase;
  a: Slot;
  b: Slot;
  /** Vague : les matchs d'une même vague se jouent en même temps, sur des terrains différents. */
  wave: number;
  field: number;
  /** Minutes depuis le début du tournoi. */
  start: number;
  end: number;
}

export interface Schedule {
  matches: ScheduledMatch[];
  waves: number;
  matchMin: number;
  /** Équipes au repos à chaque vague de la poule. */
  rest: Record<number, number[]>;
  /** Le tournoi ne tient pas dans le temps donné (matchs de moins de 2 minutes). */
  tooShort: boolean;
}

/** La fin choisie possible avec ce nombre d'équipes (demi-finales : 4 équipes et plus ; finale : 3 et plus). */
export function finishFor(teams: number, finish: TournamentFinish): TournamentFinish {
  if (finish === "demi-finales" && teams < 4) return teams >= 3 ? "finale" : "poule";
  if (finish === "finale" && teams < 3) return "poule";
  return finish;
}

/** Qui contre qui et pendant combien de temps : la poule (chaque équipe contre chaque autre, tour par tour, sur
 *  les terrains disponibles), puis la finale ou les demi-finales. La durée d'un match = le temps total partagé
 *  entre les vagues, moins les changements. */
export function buildSchedule(teamCount: number, s: TournamentSettings): Schedule {
  const fields = Math.max(1, Math.min(4, Math.round(s.fields) || 1));
  const rounds = matchups(Array.from({ length: teamCount }, (_, i) => String(i)));
  const pool: { a: number; b: number; round: number }[] = [];
  for (let leg = 0; leg < (s.rounds === 2 ? 2 : 1); leg++)
    rounds.forEach((r, ri) => r.games.forEach(([a, b]) => pool.push({ a: Number(leg ? b : a), b: Number(leg ? a : b), round: leg * rounds.length + ri })));

  // Vagues de la poule : un tour à la fois, en paquets de `fields` matchs.
  const waves: { a: Slot; b: Slot; id: string; phase: MatchPhase }[][] = [];
  const rest: Record<number, number[]> = {};
  const byRound = new Map<number, typeof pool>();
  for (const g of pool) byRound.set(g.round, [...(byRound.get(g.round) ?? []), g]);
  let n = 0;
  for (const [, games] of [...byRound.entries()].sort(([x], [y]) => x - y)) {
    for (let i = 0; i < games.length; i += fields) {
      const chunk = games.slice(i, i + fields);
      const playing = new Set(chunk.flatMap((g) => [g.a, g.b]));
      rest[waves.length] = Array.from({ length: teamCount }, (_, t) => t).filter((t) => !playing.has(t));
      waves.push(chunk.map((g) => ({ id: `p${++n}`, phase: "poule" as const, a: { team: g.a }, b: { team: g.b } })));
    }
  }
  const finish = finishFor(teamCount, s.finish);
  if (finish === "demi-finales") {
    const semis = [
      { id: "d1", phase: "demi" as const, a: { rank: 1 }, b: { rank: 4 } },
      { id: "d2", phase: "demi" as const, a: { rank: 2 }, b: { rank: 3 } }
    ];
    if (fields >= 2) waves.push(semis);
    else semis.forEach((m) => waves.push([m]));
    const final = { id: "f", phase: "finale" as const, a: { winnerOf: "d1" }, b: { winnerOf: "d2" } };
    const small = { id: "pf", phase: "petite-finale" as const, a: { loserOf: "d1" }, b: { loserOf: "d2" } };
    waves.push(fields >= 2 ? [final, small] : [final]);
  } else if (finish === "finale") {
    waves.push([{ id: "f", phase: "finale", a: { rank: 1 }, b: { rank: 2 } }]);
  }

  const changeover = Math.max(0, Math.round(s.changeoverMin) || 0);
  const total = Math.max(1, Math.round(s.durationMin) || 0);
  const matchMin = waves.length ? Math.max(1, Math.floor((total - changeover * (waves.length - 1)) / waves.length)) : 0;
  const matches: ScheduledMatch[] = [];
  waves.forEach((w, wi) => {
    const start = wi * (matchMin + changeover);
    w.forEach((m, fi) => matches.push({ ...m, wave: wi, field: fi + 1, start, end: start + matchMin }));
  });
  return { matches, waves: waves.length, matchMin, rest, tooShort: waves.length > 0 && (total - changeover * (waves.length - 1)) / waves.length < 2 };
}

/* ── Résultats et classement ─────────────────────────────────────── */

export interface MatchResult {
  a: number | null;
  b: number | null;
  /** Touché sur l'écran (sans score) ou choisi aux tirs au but après une égalité en finale. */
  winner: "a" | "b" | "nul" | null;
}
export type Results = Record<string, MatchResult>;

/** Le résultat d'un match : la gagnante touchée, sinon le score ; null tant que rien n'est entré. */
export function outcome(r: MatchResult | undefined): "a" | "b" | "nul" | null {
  if (!r) return null;
  if (r.winner) return r.winner;
  if (r.a == null || r.b == null) return null;
  return r.a > r.b ? "a" : r.b > r.a ? "b" : "nul";
}

/** Nettoie un résultat envoyé par l'écran (buts de 0 à 99). */
export function parseResult(raw: unknown): MatchResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const goal = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 99 ? Number(v) : undefined);
  const a = goal(r.a);
  const b = goal(r.b);
  if (a === undefined || b === undefined) return null;
  const winner = r.winner === "a" || r.winner === "b" || r.winner === "nul" ? r.winner : null;
  return { a, b, winner };
}

export interface StandingRow {
  team: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  diff: number;
  points: number;
}

/** Classement en direct de la poule : points (2, 1, 0), puis différence de buts, puis buts marqués. */
export function standings(teamCount: number, matches: ScheduledMatch[], results: Results): StandingRow[] {
  const rows: StandingRow[] = Array.from({ length: teamCount }, (_, team) => ({ team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, points: 0 }));
  for (const m of matches) {
    if (m.phase !== "poule" || !("team" in m.a) || !("team" in m.b)) continue;
    const r = results[m.id];
    const o = outcome(r);
    if (!o) continue;
    const A = rows[m.a.team];
    const B = rows[m.b.team];
    if (!A || !B) continue;
    A.played++;
    B.played++;
    if (r && r.a != null && r.b != null) {
      A.goalsFor += r.a;
      A.goalsAgainst += r.b;
      B.goalsFor += r.b;
      B.goalsAgainst += r.a;
    }
    if (o === "nul") {
      A.drawn++;
      B.drawn++;
      A.points += POINTS.draw;
      B.points += POINTS.draw;
    } else {
      const [W, L] = o === "a" ? [A, B] : [B, A];
      W.won++;
      L.lost++;
      W.points += POINTS.win;
      L.points += POINTS.loss;
    }
  }
  for (const r of rows) r.diff = r.goalsFor - r.goalsAgainst;
  return rows.sort((x, y) => y.points - x.points || y.diff - x.diff || y.goalsFor - x.goalsFor || x.team - y.team);
}

/** Tous les matchs de la poule ont un résultat. */
export const poolDone = (matches: ScheduledMatch[], results: Results) => matches.filter((m) => m.phase === "poule").every((m) => outcome(results[m.id]) !== null);

/** L'équipe d'une place de match : directe, d'après le classement (provisoire tant que la poule n'est pas finie)
 *  ou d'après le résultat d'un autre match (null tant qu'il n'est pas joué ou que c'est une égalité). */
export function resolveSlot(slot: Slot, matches: ScheduledMatch[], results: Results, table: StandingRow[]): number | null {
  if ("team" in slot) return slot.team;
  if ("rank" in slot) return table[slot.rank - 1]?.team ?? null;
  const id = "winnerOf" in slot ? slot.winnerOf : slot.loserOf;
  const m = matches.find((x) => x.id === id);
  if (!m) return null;
  const o = outcome(results[id]);
  if (!o || o === "nul") return null;
  const a = resolveSlot(m.a, matches, results, table);
  const b = resolveSlot(m.b, matches, results, table);
  const winA = o === "a";
  return "winnerOf" in slot ? (winA ? a : b) : winA ? b : a;
}

/** La championne du tournoi : gagnante de la finale, sinon 1re du classement quand la poule est finie et qu'il
 *  n'y a pas de finale. */
export function champion(matches: ScheduledMatch[], results: Results, table: StandingRow[]): number | null {
  const final = matches.find((m) => m.phase === "finale");
  if (final) {
    const o = outcome(results[final.id]);
    if (!o || o === "nul") return null;
    return resolveSlot(o === "a" ? final.a : final.b, matches, results, table);
  }
  return poolDone(matches, results) && matches.length ? table[0]?.team ?? null : null;
}

/** Nettoie des réglages envoyés par l'écran. */
export function parseSettings(raw: unknown): TournamentSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const format = Number(r.format);
  if (!(TOURNAMENT_FORMATS as readonly number[]).includes(format)) return null;
  const finish = FINISHES.some((f) => f.key === r.finish) ? (r.finish as TournamentFinish) : "poule";
  const durationMin = Math.round(Number(r.durationMin));
  if (!Number.isFinite(durationMin) || durationMin < 4 || durationMin > 180) return null;
  return {
    format: format as TournamentFormat,
    finish,
    durationMin,
    fields: Math.max(1, Math.min(4, Math.round(Number(r.fields)) || 1)),
    changeoverMin: Math.max(0, Math.min(5, Math.round(Number(r.changeoverMin)) || 0)),
    rounds: Number(r.rounds) === 2 ? 2 : 1
  };
}

/** Terrains proposés par défaut : toutes les équipes jouent en même temps (une au repos si impair), 3 au plus. */
export const defaultFields = (teams: number) => Math.max(1, Math.min(3, Math.floor(teams / 2)));

/** « 0 h 04 » → « 4 min », minutes depuis le début en « 12:00 » style chrono. */
export const clock = (min: number) => `${Math.floor(min / 60) ? `${Math.floor(min / 60)} h ` : ""}${String(min % 60).padStart(Math.floor(min / 60) ? 2 : 1, "0")} min`;

/** « Équipes déjà faites » (JP, 26 nov. 2026) : les équipes des dernières pratiques où jouaient des filles présentes
 *  aujourd'hui, par date (la plus récente d'abord), avec leur capitaine. Seules les filles connues sont nommées. */
export function pastTeamsByDate(history: PastTeam[], present: Iterable<string>, limit = 5): { date: string; teams: { members: string[]; captain: string | null }[] }[] {
  const here = new Set(present);
  const byDate = new Map<string, { members: string[]; captain: string | null }[]>();
  for (const t of history) {
    if (t.kind !== "equipe" || !t.date || !t.members.some((m) => here.has(m))) continue;
    byDate.set(t.date, [...(byDate.get(t.date) ?? []), { members: t.members, captain: t.captain }]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, limit)
    .map(([date, teams]) => ({ date, teams }));
}

/** Combien de fois chaque fille présente a été capitaine dans l'historique. */
export function captainCounts(history: PastTeam[], present: Iterable<string>): Map<string, number> {
  const here = new Set(present);
  const out = new Map<string, number>();
  for (const t of history) if (t.kind === "equipe" && t.captain && here.has(t.captain)) out.set(t.captain, (out.get(t.captain) ?? 0) + 1);
  return out;
}
