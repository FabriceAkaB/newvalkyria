// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PLAN } from "@/lib/mandalart-plan";
import { AGENT_BLUEPRINTS, agentCan, blueprintSummary } from "@/lib/agents-blueprint";

/** Toutes les tables connues du site : créées dans une migration ou lues dans le code (`.from("…")`). */
function knownTables(): Set<string> {
  const out = new Set<string>();
  for (const f of readdirSync("supabase/migrations")) {
    for (const m of readFileSync(join("supabase/migrations", f), "utf8").matchAll(/create table (?:if not exists )?(?:public\.)?"?([a-z_0-9]+)/gi)) out.add(m[1].toLowerCase());
  }
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name)) for (const m of readFileSync(p, "utf8").matchAll(/\.from\("([a-z_0-9]+)"\)/g)) out.add(m[1]);
    }
  };
  walk("src");
  return out;
}

describe("cahier de charges des agents", () => {
  it("couvre chaque agent du plan, une seule fois", () => {
    expect(AGENT_BLUEPRINTS.map((b) => b.id).sort()).toEqual(PLAN.agents.map((a) => a.id).sort());
  });

  it("ne cite que des tables qui existent", () => {
    const known = knownTables();
    const unknown = AGENT_BLUEPRINTS.flatMap((b) => [...b.reads, ...b.writes, ...b.forbidden].filter((t) => !known.has(t)).map((t) => `${b.id}:${t}`));
    expect(unknown).toEqual([]);
  });

  it("ne cite que des fonctions exportées par le site", () => {
    const missing = AGENT_BLUEPRINTS.flatMap((b) =>
      b.tools
        .filter((t) => !new RegExp(`export (async )?(function|const) ${t.fn}\\b`).test(readFileSync(`src/lib/${t.module}.ts`, "utf8")))
        .map((t) => `${b.id}:${t.module}.${t.fn}`)
    );
    expect(missing).toEqual([]);
  });

  it("une table n'est jamais à la fois permise et interdite", () => {
    const clash = AGENT_BLUEPRINTS.flatMap((b) => [...b.reads, ...b.writes].filter((t) => b.forbidden.includes(t)).map((t) => `${b.id}:${t}`));
    expect(clash).toEqual([]);
  });

  it("chaque automatisation citée existe dans le plan", () => {
    const ids = new Set(PLAN.automations.map((a) => a.id));
    const bad = AGENT_BLUEPRINTS.flatMap((b) => b.missions.filter((m) => m.automation && !ids.has(m.automation)).map((m) => `${b.id}:${m.automation}`));
    expect(bad).toEqual([]);
  });

  it("garde d'accès : lecture, écriture, interdit", () => {
    expect(agentCan("A01", "registrations", "read")).toBe(true);
    expect(agentCan("A01", "registrations", "write")).toBe(false);
    expect(agentCan("A01", "outreach_log", "write")).toBe(true);
    expect(agentCan("A01", "lab_submissions", "read")).toBe(false);
    expect(agentCan("A02", "registrations", "read")).toBe(false);
    expect(agentCan("A99", "registrations", "read")).toBe(false);
  });

  it("les missions d'argent ou de famille sensible passent par JP", () => {
    const money = AGENT_BLUEPRINTS.flatMap((b) => b.missions).filter((m) => /rembours|paie |payer|prix|rabais/i.test(m.title));
    expect(money.every((m) => m.mode !== "autonome")).toBe(true);
    expect(blueprintSummary().missions).toBeGreaterThan(50);
  });
});
