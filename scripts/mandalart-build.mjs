// Génère data/mandalart.json à partir de docs/MANDALART_VALKYRIA.md (le plan écrit avec JP).
// Le plan (piliers, objectifs, tâches, niveaux, indicateurs, agents) vit dans le JSON versionné ;
// l'état des cases cochées vit en base (tables mandalart_*). Relancer après chaque nouvelle version du .md :
//   node scripts/mandalart-build.mjs
// Codes stables : une tâche garde son code pour toujours ; le module ne supprime jamais un état existant.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = process.argv[2] ?? path.join(root, "docs/MANDALART_VALKYRIA.md");
const out = path.join(root, "data/mandalart.json");
const md = fs.readFileSync(src, "utf8");
const lines = md.split("\n");

const MONTHS = { "janv.": 1, "févr.": 2, mars: 3, "avr.": 4, mai: 5, juin: 6, "juil.": 7, août: 8, "sept.": 9, "oct.": 10, "nov.": 11, "déc.": 12 };
function frDate(s) {
  const m = String(s).trim().match(/^(\d{1,2})(?:er)? ([a-zéû.]+) (\d{4})$/i);
  if (!m || !MONTHS[m[2]]) return null;
  return `${m[3]}-${String(MONTHS[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
const money = (s) => {
  const n = String(s).replace(/\s| /g, "").match(/^(-?\d+)\$/);
  return n ? Number(n[1]) : null;
};
const strip = (s) => s.replace(/\*\*/g, "").replace(/`/g, "").trim();

/** Lignes d'un tableau Markdown qui suit l'en-tête donné. */
function table(afterHeading) {
  const i = lines.findIndex((l) => l.trim() === afterHeading);
  if (i < 0) throw new Error(`Section introuvable : ${afterHeading}`);
  let j = i + 1;
  while (j < lines.length && !lines[j].startsWith("|")) j++;
  const rows = [];
  for (let k = j + 2; k < lines.length && lines[k].startsWith("|"); k++) {
    rows.push(lines[k].slice(1, -1).split(" | ").map((c) => c.trim()));
  }
  return rows;
}
function section(start, endPrefix) {
  const i = lines.findIndex((l) => l.trim() === start);
  let j = i + 1;
  while (j < lines.length && !(endPrefix.some((p) => lines[j].startsWith(p)))) j++;
  return lines.slice(i + 1, j);
}

// ── Case centrale ──
const centerLines = section("## 1. La case centrale", ["### ", "## "]);
const center = {
  statement: strip(centerLines.find((l) => l.startsWith("**")) ?? ""),
  goalCents: 150000000,
  milestoneCents: 100000000,
  year: 2028,
  jpYearlyCents: 40000000,
  notes: centerLines.filter((l) => /^\s*- /.test(l)).map((l) => ({ indent: l.startsWith("  "), text: strip(l.replace(/^\s*- /, "")) }))
};

// ── Indicateurs ──
const kpis = table("### Indicateurs : point de départ et cible").map(([id, label, start, target, due, source, how]) => ({
  id: id.replace(/`/g, ""),
  label,
  start,
  target,
  due: frDate(due),
  source,
  how
}));

// ── Règles de calcul (texte) ──
const progressRules = section("## 2. Comment la progression est calculée", ["## "]).filter((l) => l.startsWith("- ")).map((l) => strip(l.slice(2)));

// ── Niveaux ──
const levels = table("## 3. Les 6 niveaux").map(([id, name, period, goal, tasks, stars]) => {
  const [a, b] = period.split("→").map((s) => frDate(s.trim()));
  return { id: Number(id.slice(1)), code: id, name, start: a, end: b, goal, plannedTasks: Number(tasks), plannedStars: Number(stars) };
});

// ── Trajectoire ──
const trajectoryIntro = section("## 3 bis. Trajectoire d'encaissements, mois par mois (novembre 2026 à décembre 2028)", ["### "]).filter((l) => l.trim());
const salary = section("### Salaire de JP : 10 000 $ brut par mois dès février 2027", ["### "]).filter((l) => l.startsWith("- ")).map((l) => strip(l.slice(2)));
const years = table("### Par année").map((r) => ({
  year: r[0],
  target: money(r[1]),
  floor: money(r[2]),
  lines: {
    academie: money(r[3]),
    valkyriaEte: money(r[4]),
    camps: money(r[5]),
    parascolaire: money(r[6]),
    commandites: money(r[7]),
    autres: money(r[8]),
    conseil: money(r[9])
  }
}));
const periods = table("### Par 6 mois et par trimestre").map((r) => ({ period: strip(r[0]), target: money(strip(r[1])), floor: money(strip(r[2])), half: r[0].startsWith("**") }));
const months = table("### Par mois").map(([month, kind, target, floor, cumul, how]) => ({ month, kind, target: money(target), floor: money(floor), cumulTarget: money(cumul), how }));

// ── Piliers et objectifs (vue d'ensemble) ──
const overview = table("## 4. Le Mandalart en un coup d'œil").map(([p, objs]) => {
  const m = strip(p).match(/^(P\d) (.+)$/);
  return { code: m[1], name: m[2], objectives: objs.split(" · ").map((o) => o.replace(/^\d+ /, "")) };
});

// ── Agents ──
const agentsIntro = section("## 5. Agents IA et automatisations à créer", ["### "]).filter((l) => l.trim()).map(strip);
const agentRules = section("### Règles communes à tous les agents", ["### "]).filter((l) => l.startsWith("- ")).map((l) => strip(l.slice(2)));
const agentModes = section("### Les 3 modes d'un agent", ["### "])
  .filter((l) => /^\d\. /.test(l))
  .map((l) => {
    const m = l.match(/^\d\. \*\*(.+?)\*\* : (.+)$/);
    return { name: m[1], text: m[2] };
  });
const order = table("### Ordre de construction");
const agents = order.map(([ord, agent, level, prereq, tasks]) => {
  const id = agent.split(" ")[0];
  const block = section(lines.find((l) => l.startsWith(`#### ${id} — `)), ["#### ", "### "]);
  const field = (label) => {
    const l = block.find((x) => x.startsWith(`- **${label}** : `));
    return l ? l.replace(`- **${label}** : `, "").trim() : "";
  };
  const list = (label) => field(label).split(" ; ").map((s) => s.trim()).filter(Boolean);
  const built = block.find((x) => x.startsWith("- **Construit au niveau**")) ?? "";
  return {
    id,
    order: Number(ord),
    name: agent.replace(`${id} `, ""),
    level: Number(level.slice(1)),
    prerequisites: prereq.split(" ; ").map((s) => s.trim()),
    tasks: tasks.split(", ").map((s) => s.trim()),
    objective: built.match(/objectif (P\d\.\d)/)?.[1] ?? null,
    role: field("Rôle"),
    triggers: list("Se déclenche quand"),
    reads: list("Lit"),
    does: list("Fait"),
    humanValidation: field("Validation humaine"),
    access: field("Accès"),
    metrics: field("Comment savoir s'il fonctionne")
  };
});
const notesLine = lines.find((l) => l.startsWith("Notes : **AU01**")) ?? "";
const autoNotes = {};
for (const m of notesLine.matchAll(/\*\*(AU\d\d)\*\* — (.*?)(?= \*\*AU\d\d\*\* —|$)/g)) autoNotes[m[1]] = m[2].trim();
const automations = table("### Automatisations").map(([id, name, type, trigger, does, forWho, state, level, tasks]) => ({
  id,
  name,
  type,
  trigger,
  does,
  forWho,
  state,
  level: Number(level.slice(1)),
  tasks: tasks.split(", ").map((s) => s.trim()),
  note: autoNotes[id] ?? null
}));

// ── Tâches détaillées (section 8) ──
const s8 = lines.findIndex((l) => l.startsWith("## 8. "));
const s9 = lines.findIndex((l) => l.startsWith("## 9. "));
const pillars = [];
let pillar = null;
let objective = null;
for (let i = s8 + 1; i < s9; i++) {
  const l = lines[i];
  let m;
  if ((m = l.match(/^### (P\d) — (.+)$/))) {
    pillar = { code: m[1], name: m[2], intro: [], focus: null, objectives: [] };
    pillars.push(pillar);
    objective = null;
  } else if ((m = l.match(/^#### (P\d\.\d) (.+)$/))) {
    objective = { code: m[1], name: m[2], description: "", kpis: [], tasks: [] };
    pillar.objectives.push(objective);
  } else if ((m = l.match(/^- \[( |x|~)\] `([^`]+)` (⭐|➜) N(\d) — (.+)$/))) {
    const parts = m[5].split(" — ");
    const tail = parts.length > 1 ? parts.pop() : "";
    const title = parts.join(" — ");
    const seg = tail.split(" · ").map((s) => s.trim());
    const due = frDate(seg[0] ?? "");
    const rest = due ? seg.slice(1) : seg;
    const links = rest.filter((s) => /^(AU\d\d|A\d\d)\b/.test(s)).map((s) => s.split(" ")[0]);
    const owner = rest.filter((s) => !/^(AU\d\d|A\d\d)\b/.test(s)).join(" · ") || null;
    objective.tasks.push({
      code: m[2],
      priority: m[3] === "⭐" ? "star" : "progressive",
      level: Number(m[4]),
      title,
      due,
      owner,
      links,
      initialStatus: m[1] === "x" ? "fait" : m[1] === "~" ? "en_cours" : "a_faire"
    });
  } else if (pillar && !objective && l.trim() && !l.startsWith("Légende")) {
    if (l.startsWith("**")) pillar.focus = strip(l);
    else pillar.intro.push(strip(l));
  } else if (objective && l.trim() && !l.startsWith("- ")) {
    objective.description = objective.description ? `${objective.description} ${l.trim()}` : l.trim();
    objective.kpis = [...objective.description.matchAll(/`([a-z0-9_]+)`/g)].map((x) => x[1]);
    objective.description = objective.description.replace(/ ?Indicateurs? : [^.]*\.?$/, "").replace(/`/g, "").trim();
  }
}

// ── Ajouts de JP (section 11) : tâches à la suite de leur objectif, indicateurs et automatisations ──
const s11 = lines.findIndex((l) => l.startsWith("## 11. "));
const additions = { title: null, rules: [], themes: [] };
if (s11 >= 0) {
  additions.title = lines[s11].replace(/^## 11\. /, "");
  additions.rules = section("### Règle d'anticipation", ["### ", "## "]).filter((l) => l.startsWith("- ")).map((l) => strip(l.slice(2)));
  let theme = null;
  let target = null;
  for (let i = s11 + 1; i < lines.length; i++) {
    const l = lines[i];
    let m;
    if ((m = l.match(/^### (.+)$/))) {
      theme = { title: m[1], text: "" };
      if (!/^(Règle|Indicateurs|Automatisations|Agents)/.test(m[1])) additions.themes.push(theme);
      target = null;
    } else if (/^#### A\d\d — /.test(l)) {
      target = null;
      theme = null;
    } else if ((m = l.match(/^#### (P\d\.\d) /))) {
      target = pillars.flatMap((p) => p.objectives).find((o) => o.code === m[1]);
      if (!target) throw new Error(`Objectif inconnu dans les ajouts : ${m[1]}`);
    } else if (target && (m = l.match(/^- \[( |x|~)\] `([^`]+)` (⭐|➜) N(\d) — (.+)$/))) {
      const parts = m[5].split(" — ");
      const tail = parts.length > 1 ? parts.pop() : "";
      const seg = tail.split(" · ").map((x) => x.trim());
      const due = frDate(seg[0] ?? "");
      const rest = due ? seg.slice(1) : seg;
      target.tasks.push({
        code: m[2],
        priority: m[3] === "⭐" ? "star" : "progressive",
        level: Number(m[4]),
        title: parts.join(" — "),
        due,
        owner: rest.filter((x) => !/^(AU\d\d|A\d\d)\b/.test(x)).join(" · ") || null,
        links: rest.filter((x) => /^(AU\d\d|A\d\d)\b/.test(x)).map((x) => x.split(" ")[0]),
        initialStatus: m[1] === "x" ? "fait" : m[1] === "~" ? "en_cours" : "a_faire",
        addedOn: "2026-11-02",
        theme: theme?.title ?? null
      });
    } else if (theme && !target && l.trim() && !l.startsWith("|") && !l.startsWith("- ")) {
      theme.text = theme.text ? `${theme.text} ${l.trim()}` : l.trim();
    }
  }
  for (const [ord, agent, level, prereq, tasks] of table("### Agents ajoutés")) {
    const id = agent.split(" ")[0];
    const block = section(lines.find((l) => l.startsWith(`#### ${id} — `)), ["#### ", "### "]);
    const field = (label) => (block.find((x) => x.startsWith(`- **${label}** : `)) ?? "").replace(`- **${label}** : `, "").trim();
    const list = (label) => field(label).split(" ; ").map((x) => x.trim()).filter(Boolean);
    agents.push({
      id,
      order: Number(ord),
      name: agent.replace(`${id} `, ""),
      level: Number(level.slice(1)),
      prerequisites: prereq.split(" ; ").map((x) => x.trim()),
      tasks: tasks.split(", ").map((x) => x.trim()),
      objective: (block.find((x) => x.startsWith("- **Construit au niveau**")) ?? "").match(/objectif (P\d\.\d)/)?.[1] ?? null,
      role: field("Rôle"),
      triggers: list("Se déclenche quand"),
      reads: list("Lit"),
      does: list("Fait"),
      humanValidation: field("Validation humaine"),
      access: field("Accès"),
      metrics: field("Comment savoir s'il fonctionne"),
      addedOn: "2026-11-02"
    });
  }
  for (const [id, label, start, tgt, due, source, how] of table("### Indicateurs ajoutés")) kpis.push({ id: id.replace(/`/g, ""), label, start, target: tgt, due: frDate(due), source, how, addedOn: "2026-11-02" });
  for (const [id, name, type, trigger, does, forWho, state, level, tasks] of table("### Automatisations ajoutées"))
    automations.push({ id, name, type, trigger, does, forWho, state, level: Number(level.slice(1)), tasks: tasks.split(", ").map((x) => x.trim()), note: null, addedOn: "2026-11-02" });
}

// ── Points à trancher ──
const decisions = section("## 9. Points à trancher par JP", ["## "]).filter((l) => l.startsWith("- ")).map((l) => strip(l.slice(2)));

const allTasks = pillars.flatMap((p) => p.objectives.flatMap((o) => o.tasks));
const plan = {
  version: md.match(/Mis à jour le ([^.]+)\./)?.[1] ?? null,
  generatedFrom: path.relative(root, src),
  center,
  progressRules,
  kpis,
  levels,
  trajectory: { intro: trajectoryIntro.map(strip), salary, years, periods, months },
  pillars: pillars.map((p) => ({ ...p, intro: p.intro.join(" "), shortObjectives: overview.find((o) => o.code === p.code)?.objectives ?? [] })),
  agentsIntro,
  agentRules,
  agentModes,
  agents,
  automations,
  additions,
  decisions
};

const codes = new Set();
for (const t of allTasks) {
  if (codes.has(t.code)) throw new Error(`Code en double : ${t.code}`);
  codes.add(t.code);
}
fs.writeFileSync(out, `${JSON.stringify(plan, null, 1)}\n`);
console.log(
  `${pillars.length} piliers · ${pillars.reduce((s, p) => s + p.objectives.length, 0)} objectifs · ${allTasks.length} tâches (${allTasks.filter((t) => t.priority === "star").length} ⭐) · ${kpis.length} indicateurs · ${levels.length} niveaux · ${agents.length} agents · ${automations.length} automatisations · ${months.length} mois`
);
for (const lv of levels) {
  const t = allTasks.filter((x) => x.level === lv.id);
  console.log(`  ${lv.code} ${t.length}/${lv.plannedTasks} tâches (+ ajouts), ${t.filter((x) => x.priority === "star").length}/${lv.plannedStars} ⭐`);
}
const missingDue = allTasks.filter((t) => !t.due).map((t) => t.code);
if (missingDue.length) console.log("Sans échéance :", missingDue.join(", "));
