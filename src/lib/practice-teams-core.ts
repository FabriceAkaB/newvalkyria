/** Équipes, duos et capitaines de chaque pratique (JP, 17 nov. 2026) : on garde qui était avec qui et qui a été
 *  capitaine, pour que la fois suivante les équipes et les duos soient nouveaux et que chaque fille soit capitaine à
 *  son tour. La capitaine reçoit une tâche liée au thème de la semaine ; l'éducateur note son leadership.
 *  Règles pures, testées (practice-teams-core.test.ts). Base : `practice_teams` (practice-teams-repo.ts). */

export type TeamKind = "equipe" | "duo";

export interface PastTeam {
  kind: TeamKind;
  members: string[];
  captain: string | null;
  date: string;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Combien de fois chaque paire de joueuses a déjà été ensemble (équipe ou duo ; un duo compte double : on se parle plus). */
export function pairCounts(history: PastTeam[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of history) {
    const w = t.kind === "duo" ? 2 : 1;
    for (let i = 0; i < t.members.length; i++)
      for (let j = i + 1; j < t.members.length; j++) {
        const k = pairKey(t.members[i], t.members[j]);
        out.set(k, (out.get(k) ?? 0) + w);
      }
  }
  return out;
}

/** Générateur pseudo-aléatoire reproductible (même graine = mêmes équipes). */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Le « coût » d'un groupe : nombre de fois où ses membres ont déjà été ensemble. */
export function groupCost(members: string[], pairs: Map<string, number>): number {
  let c = 0;
  for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) c += pairs.get(pairKey(members[i], members[j])) ?? 0;
  return c;
}

/** Répartit les joueuses en `n` groupes de tailles égales (à 1 près) en évitant les filles déjà ensemble :
 *  plusieurs essais au hasard, puis des échanges qui réduisent les répétitions ; on garde le meilleur. */
export function makeGroups(players: string[], n: number, history: PastTeam[], seed = Date.now()): string[][] {
  const groups = Math.max(1, Math.min(n, players.length));
  if (!players.length) return [];
  const pairs = pairCounts(history);
  const rand = rng(seed);
  const total = (gs: string[][]) => gs.reduce((s, g) => s + groupCost(g, pairs), 0);
  let best: string[][] = [];
  let bestCost = Infinity;
  for (let attempt = 0; attempt < 40; attempt++) {
    const order = shuffle(players, rand);
    const gs: string[][] = Array.from({ length: groups }, () => []);
    order.forEach((p, i) => gs[i % groups].push(p));
    // Échanges entre groupes tant qu'ils diminuent les répétitions.
    let improved = true;
    for (let pass = 0; improved && pass < 20; pass++) {
      improved = false;
      for (let a = 0; a < groups; a++)
        for (let b = a + 1; b < groups; b++)
          for (let i = 0; i < gs[a].length; i++)
            for (let j = 0; j < gs[b].length; j++) {
              const before = groupCost(gs[a], pairs) + groupCost(gs[b], pairs);
              [gs[a][i], gs[b][j]] = [gs[b][j], gs[a][i]];
              const after = groupCost(gs[a], pairs) + groupCost(gs[b], pairs);
              if (after < before) improved = true;
              else [gs[a][i], gs[b][j]] = [gs[b][j], gs[a][i]];
            }
    }
    const c = total(gs);
    if (c < bestCost) {
      best = gs.map((g) => [...g]);
      bestCost = c;
      if (c === 0) break;
    }
  }
  return best;
}

/** Duos (ateliers) : groupes de 2 ; s'il reste une fille, elle forme un trio avec le dernier duo. */
export function makeDuos(players: string[], history: PastTeam[], seed = Date.now()): string[][] {
  if (players.length < 2) return players.length ? [players] : [];
  const groups = makeGroups(players, Math.floor(players.length / 2), history, seed);
  return groups;
}

/** Capitaine de chaque équipe : celle qui l'a été le moins souvent, puis le moins récemment (jamais = en premier). */
export function pickCaptains(groups: string[][], history: PastTeam[]): (string | null)[] {
  const times = new Map<string, number>();
  const last = new Map<string, string>();
  for (const t of history) {
    if (!t.captain) continue;
    times.set(t.captain, (times.get(t.captain) ?? 0) + 1);
    if ((last.get(t.captain) ?? "") < t.date) last.set(t.captain, t.date);
  }
  return groups.map((g) =>
    g.length
      ? [...g].sort((a, b) => (times.get(a) ?? 0) - (times.get(b) ?? 0) || (last.get(a) ?? "").localeCompare(last.get(b) ?? ""))[0]
      : null
  );
}

/** Ce que la capitaine fait pendant la pratique, selon le thème de la semaine (sinon : la tâche de base). */
const CAPTAIN_TASKS: { match: RegExp; task: string }[] = [
  { match: /évaluation/i, task: "Encourage chaque coéquipière avant son test et rappelle-lui la consigne ; à la fin, dis à l'éducatrice qui s'est le plus améliorée." },
  { match: /transition offensive/i, task: "À chaque récupération, crie « But ! » et montre le but : ton équipe attaque tout de suite, en moins de 6 secondes." },
  { match: /transition défensive|changement de statut/i, task: "À chaque perte du ballon, crie « Presse ! » : la plus proche presse, les autres reviennent entre le ballon et le but." },
  { match: /appui|soutien/i, task: "Avant chaque relance, place une coéquipière devant (appui) et une à côté (soutien) : « Qui est mon appui ? Qui est mon soutien ? »." },
  { match: /largeur/i, task: "Avant chaque relance, vérifie qu'il y a une coéquipière de chaque côté : « Une à gauche, une à droite ! »." },
  { match: /profondeur/i, task: "Assure-toi qu'une coéquipière est toujours loin devant ; dis « Dans le dos ! » quand l'appel est possible." },
  { match: /cadrage|couverture/i, task: "En défense, nomme la cadreuse et la couvreuse à chaque attaque adverse : « Toi tu cadres, moi je couvre ! »." },
  { match: /réduction des espaces|compact/i, task: "En défense, garde ton équipe groupée : « Serrez ! » quand l'espace entre vous devient trop grand." },
  { match: /protection du but/i, task: "En défense, rappelle à ton équipe de rester entre le ballon et le but et de fermer l'axe : « Ferme le milieu ! »." },
  { match: /conservation|garde/i, task: "Quand ton équipe a le ballon, compte les passes à voix haute et encourage à garder le ballon au sol." }
];
export const BASE_CAPTAIN_TASK = "Rassemble ton équipe à chaque arrêt, donne une consigne claire et nomme une bonne action d'une coéquipière à la fin de chaque match.";

export function captainTaskFor(theme: string | null | undefined): string {
  if (!theme) return BASE_CAPTAIN_TASK;
  return CAPTAIN_TASKS.find((t) => t.match.test(theme))?.task ?? BASE_CAPTAIN_TASK;
}

/** Suivi du leadership de la capitaine : 1 à 5, avec un mot pour chaque note. */
export const LEADERSHIP_SCALE: Record<number, string> = {
  1: "N'a pas pris le rôle",
  2: "A essayé, timide",
  3: "A fait sa tâche",
  4: "A guidé son équipe",
  5: "Vraie leader : voix, exemple, encouragement"
};

/** Couleurs des dossards (JP, 20 nov. 2026 : l'éducateur choisit la couleur de chaque équipe). Le nom de l'équipe
 *  est sa couleur ; la pastille montre la couleur du dossard. */
export const TEAM_COLORS: { name: string; hex: string }[] = [
  { name: "Violettes", hex: "#6d28d9" },
  { name: "Noires", hex: "#18181b" },
  { name: "Jaunes", hex: "#facc15" },
  { name: "Blanches", hex: "#ffffff" },
  { name: "Rouges", hex: "#dc2626" },
  { name: "Bleues", hex: "#2563eb" },
  { name: "Vertes", hex: "#16a34a" },
  { name: "Oranges", hex: "#f97316" },
  { name: "Roses", hex: "#ec4899" }
];
export const colorHex = (name: string | null | undefined) => TEAM_COLORS.find((c) => c.name === name)?.hex ?? null;

/** Noms des équipes (couleurs des dossards), puis « Équipe 5 », etc. */
export const TEAM_NAMES = ["Violettes", "Noires", "Jaunes", "Blanches"];
export const teamName = (i: number, kind: TeamKind) => (kind === "duo" ? `Duo ${i + 1}` : TEAM_NAMES[i] ?? `Équipe ${i + 1}`);

/** Thème « Appui-soutien (2014-2015) · Transition offensive (2016-2017) » : la partie du groupe de la pratique. */
export function themeForGroup(theme: string | null | undefined, group: string | null | undefined): string | null {
  if (!theme) return null;
  const parts = theme.split(" · ");
  if (parts.length < 2 || !group) return theme;
  const years = group.match(/\d{4}/g) ?? [];
  const hit = parts.find((p) => years.some((y) => p.includes(y)));
  return (hit ?? parts[0]).replace(/\s*\(\d{4}(?:-\d{4})?\)\s*$/, "");
}

/** Combien d'équipes préparer d'avance selon le nombre de filles attendues : 2 jusqu'à 11, 3 jusqu'à 17, puis 4. */
export const teamCountFor = (players: number) => (players <= 11 ? 2 : players <= 17 ? 3 : 4);

/** Qui affronte qui (JP, 20 nov. 2026) : chaque équipe rencontre chaque autre une fois, tour par tour (méthode du
 *  cercle). Avec un nombre impair d'équipes, une équipe se repose à chaque tour. */
export function matchups(labels: string[]): { games: [string, string][]; rest: string | null }[] {
  if (labels.length < 2) return [];
  const list: (string | null)[] = labels.length % 2 ? [...labels, null] : [...labels];
  const n = list.length;
  const rounds: { games: [string, string][]; rest: string | null }[] = [];
  for (let r = 0; r < n - 1; r++) {
    const games: [string, string][] = [];
    let rest: string | null = null;
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a && b) games.push([a, b]);
      else rest = a ?? b;
    }
    rounds.push({ games, rest });
    // Le premier reste en place, les autres tournent.
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}
