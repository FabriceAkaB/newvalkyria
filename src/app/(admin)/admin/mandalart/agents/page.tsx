import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { AgentBlueprintView } from "@/components/mandalart/agent-blueprint";
import { AgentStateForm } from "@/components/mandalart/forms";
import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { AGENT_FOUNDATION, blueprintOf, blueprintSummary } from "@/lib/agents-blueprint";
import { PLAN } from "@/lib/mandalart-plan";
import { getAgentStates, getLiveTasks, initialAutomationStatus } from "@/lib/mandalart-repo";

export const metadata = { title: "Mandalart — Agents IA et automatisations", robots: "noindex" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone?: "good" | "warn" | "info" | "accent" }> = {
  a_creer: { label: "À créer" },
  en_construction: { label: "En construction", tone: "warn" },
  actif: { label: "Actif", tone: "good" },
  pause: { label: "En pause", tone: "info" }
};

const ADVICE = [
  { t: "Les données avant l'agent", d: "Un agent ne vaut que ses données. On bâtit d'abord l'automatisation qui les produit (présences, sources, banque d'exercices), puis l'agent qui les lit." },
  { t: "Une tâche précise, mesurée avant", d: "Choisir une tâche répétitive et noter combien de minutes elle prend chaque semaine. Sans ce chiffre, on ne saura jamais si l'agent vaut la peine." },
  { t: "Toujours commencer en mode assistant", d: "L'agent prépare des brouillons, un humain corrige et envoie. On monte d'un mode seulement après 4 semaines sans erreur importante." },
  { t: "Des règles écrites et des modèles approuvés", d: "FAQ, ton, politique d'annulation, signature « Équipe Valkyria ». L'agent applique ce que JP a approuvé ; il n'invente pas de règle." },
  { t: "Accès minimum et journal", d: "Chaque agent lit seulement ce dont il a besoin. Chaque action est notée : date, agent, données touchées, humain qui a validé." },
  { t: "Argent, plaintes, santé : un humain décide", d: "Remboursement, rabais, prix, plainte, sécurité, conflit, situation familiale délicate : jamais sans validation humaine." },
  { t: "Côté serveur seulement", d: "Les appels à l'IA passent par une route API du site, jamais par le navigateur ; la clé reste dans les variables d'environnement de Vercel." },
  { t: "Une application sans API (ex. MonClubSportif)", d: "1) Demander une API ou une importation. 2) Sinon, un robot qui pilote un navigateur, avec un compte dédié dont JP garde le mot de passe. 3) On teste d'abord avec JP, une action à la fois, puis on automatise." },
  { t: "Un agent à la fois", d: "On mesure les heures sauvées avant de construire le suivant. L'ordre ci-dessous suit les niveaux du plan." }
];

/** Les 12 agents IA et les 20 automatisations du plan, leur état et leurs tâches liées. */
export default async function MandalartAgentsPage() {
  await requireAdmin({ roles: ["admin"] });
  const [states, tasks] = await Promise.all([getAgentStates(), getLiveTasks()]);
  const stateOf = (id: string, initial: string) => states.find((s) => s.item_id === id) ?? { item_id: id, status: initial as any, mode: null, hours_saved_week: null, note: null, updated_at: "" };
  const taskDone = (code: string) => tasks.find((t) => t.code === code)?.status === "fait";
  const activeAgents = PLAN.agents.filter((a) => stateOf(a.id, "a_creer").status === "actif").length;
  const activeAutos = PLAN.automations.filter((a) => stateOf(a.id, initialAutomationStatus(a.state)).status === "actif").length;
  const hours = states.reduce((s, x) => s + (Number(x.hours_saved_week) || 0), 0);
  const sum = blueprintSummary();

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Pilier 8 · Organisation, équipe et agents IA</p>
            <h1 className="mda-h1">Agents IA et automatisations</h1>
            <p className="mda-lead">{PLAN.agentsIntro[0]}</p>
          </header>

          <section className="mda-cols-3">
            <div className="mda-card">
              <p className="mda-num">{activeAutos}/{PLAN.automations.length}</p>
              <p className="mda-label">Automatisations actives (règles fixes du site, sans IA)</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{activeAgents}/{PLAN.agents.length}</p>
              <p className="mda-label">Agents IA actifs (lisent, rédigent, proposent ; un humain valide)</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{hours.toLocaleString("fr-CA")} h</p>
              <p className="mda-label">Heures sauvées par semaine (déclarées par agent)</p>
            </div>
          </section>

          <section className="mda-card">
            <h2 className="mda-h2">Comment on construit un agent</h2>
            <div className="mda-cols-3" style={{ marginTop: 12 }}>
              {ADVICE.map((a, i) => (
                <div key={a.t}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem", color: "var(--adm-text)" }}>
                    {i + 1}. {a.t}
                  </p>
                  <p className="mda-label">{a.d}</p>
                </div>
              ))}
            </div>
            <div className="mda-cols-3" style={{ marginTop: 20 }}>
              {PLAN.agentModes.map((m, i) => (
                <div key={m.name} style={{ padding: 14, borderRadius: 10, background: "var(--adm-surface-2)" }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.88rem" }}>Mode {i + 1} : {m.name}</p>
                  <p className="mda-label">{m.text}</p>
                </div>
              ))}
            </div>
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer", color: "var(--adm-text-2)", fontSize: "0.88rem" }}>Les règles communes à tous les agents ({PLAN.agentRules.length})</summary>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--adm-text-2)", fontSize: "0.86rem", lineHeight: 1.6 }}>
                {PLAN.agentRules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </details>
          </section>

          <section className="mda-card">
            <h2 className="mda-h2">Le cahier de charges : chaque tâche de l&apos;académie dans la case d&apos;un agent</h2>
            <p className="mda-sub">
              {sum.missions} missions rangées dans les 12 agents : {sum.existe} existent déjà, {sum.partiel} sont partielles, {sum.aConstruire} sont à construire. {sum.regle} sont des règles fixes (sans IA), {sum.brouillon} des brouillons validés par un humain, {sum.autonome} autonomes sur règles. Chaque agent a ses tables permises et interdites et les fonctions du site qu&apos;il peut appeler : ouvrez un agent ci-dessous.
            </p>
            <p style={{ margin: "12px 0 6px", fontWeight: 600, fontSize: "0.88rem" }}>À bâtir une seule fois, avant le premier agent</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.85rem", color: "var(--adm-text-2)", lineHeight: 1.6 }}>
              {AGENT_FOUNDATION.map((f) => (
                <li key={f.title}>
                  <strong style={{ color: "var(--adm-text)" }}>{f.title}</strong> <Pill tone={f.state === "partiel" ? "warn" : undefined}>{f.state === "partiel" ? "Partiel" : "À construire"}</Pill> {f.detail}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mda-h2">Les agents IA, dans l&apos;ordre de construction</h2>
            <p className="mda-sub">Chaque agent a son déclencheur, ses données, ce qu&apos;il fait et qui valide. Les prérequis cochés sont les tâches du plan déjà faites.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[...PLAN.agents]
                .sort((a, b) => a.order - b.order)
                .map((a) => {
                  const st = stateOf(a.id, "a_creer");
                  const ready = a.tasks.filter(taskDone).length;
                  return (
                    <details key={a.id} className="mda-card-flush" id={a.id}>
                      <summary style={{ cursor: "pointer", padding: "16px 20px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", listStyle: "none" }}>
                        <span style={{ minWidth: 0 }}>
                          <span className="mda-eyebrow">
                            {a.order}. {a.id} · construit au niveau {a.level}
                            {a.objective ? ` · objectif ${a.objective}` : ""}
                          </span>
                          <span className="mda-h2" style={{ display: "block" }}>{a.name}</span>
                          <span className="mda-label" style={{ display: "block" }}>{a.role}</span>
                        </span>
                        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          {st.mode ? <Pill tone="accent">{st.mode}</Pill> : null}
                          <Pill tone={STATUS[st.status].tone}>{STATUS[st.status].label}</Pill>
                        </span>
                      </summary>
                      <div style={{ padding: "0 20px 20px", display: "grid", gap: 14 }}>
                        <div className="mda-cols-2">
                          <div>
                            <p className="mda-label" style={{ fontWeight: 600, color: "var(--adm-text)" }}>Se déclenche quand</p>
                            <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: "0.85rem", color: "var(--adm-text-2)", lineHeight: 1.55 }}>{a.triggers.map((x) => <li key={x}>{x}</li>)}</ul>
                          </div>
                          <div>
                            <p className="mda-label" style={{ fontWeight: 600, color: "var(--adm-text)" }}>Fait</p>
                            <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: "0.85rem", color: "var(--adm-text-2)", lineHeight: 1.55 }}>{a.does.map((x) => <li key={x}>{x}</li>)}</ul>
                          </div>
                          <div>
                            <p className="mda-label" style={{ fontWeight: 600, color: "var(--adm-text)" }}>Lit</p>
                            <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: "0.85rem", color: "var(--adm-text-2)", lineHeight: 1.55 }}>{a.reads.map((x) => <li key={x}>{x}</li>)}</ul>
                          </div>
                          <div>
                            <p className="mda-label" style={{ fontWeight: 600, color: "var(--adm-text)" }}>Prérequis</p>
                            <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: "0.85rem", color: "var(--adm-text-2)", lineHeight: 1.55 }}>{a.prerequisites.map((x) => <li key={x}>{x}</li>)}</ul>
                          </div>
                        </div>
                        <p className="mda-label"><strong style={{ color: "var(--adm-text)" }}>Validation humaine :</strong> {a.humanValidation}</p>
                        <p className="mda-label"><strong style={{ color: "var(--adm-text)" }}>Accès :</strong> {a.access}</p>
                        <p className="mda-label"><strong style={{ color: "var(--adm-text)" }}>Comment savoir s&apos;il fonctionne :</strong> {a.metrics}</p>
                        <p className="mda-label">
                          <strong style={{ color: "var(--adm-text)" }}>Tâches du plan :</strong>{" "}
                          {a.tasks.map((c, i) => (
                            <span key={c}>
                              {i ? ", " : ""}
                              <span style={{ color: taskDone(c) ? "var(--adm-good)" : undefined }}>{c}{taskDone(c) ? " ✓" : ""}</span>
                            </span>
                          ))}{" "}
                          ({ready}/{a.tasks.length} faites)
                        </p>
                        {blueprintOf(a.id) ? <AgentBlueprintView b={blueprintOf(a.id)!} /> : null}
                        <AgentStateForm itemId={a.id} status={st.status} mode={st.mode} hours={st.hours_saved_week} isAgent />
                      </div>
                    </details>
                  );
                })}
            </div>
          </section>

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2">Les automatisations</h2>
                <p className="mda-sub" style={{ margin: 0 }}>Règles fixes programmées dans le site (cron, formulaires, alertes, pages). On les construit avant les agents.</p>
              </div>
            </div>
            <ul className="mda-tasks">
              {PLAN.automations.map((a) => {
                const st = stateOf(a.id, initialAutomationStatus(a.state));
                return (
                  <li key={a.id} id={a.id} className="mda-task" style={{ display: "block" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                        <p className="mda-task-title" style={{ fontWeight: 600 }}>
                          <span className="mda-muted mda-tnum">{a.id}</span> {a.name}
                        </p>
                        <p className="mda-label">{a.does}</p>
                        <div className="mda-task-meta">
                          <span>{a.type}</span>
                          <span>Quand : {a.trigger}</span>
                          <span>Pour : {a.forWho}</span>
                          <span>N{a.level}</span>
                          <span>
                            Tâches :{" "}
                            {a.tasks.map((c, i) => (
                              <span key={c} style={{ color: taskDone(c) ? "var(--adm-good)" : undefined }}>
                                {i ? ", " : ""}
                                {c}
                              </span>
                            ))}
                          </span>
                        </div>
                        {a.note ? <p className="mda-label mda-muted">{a.note}</p> : null}
                        {a.id === "AU17" ? (
                          <p className="mda-label">
                            <Link href="/admin/sondages" style={{ color: "var(--adm-accent)" }}>Ouvrir Voix des familles →</Link>
                          </p>
                        ) : null}
                        {a.id === "AU01" ? <p className="mda-label" style={{ color: "var(--adm-good)" }}>Ce module.</p> : null}
                      </div>
                      <Pill tone={STATUS[st.status].tone}>{STATUS[st.status].label}</Pill>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <AgentStateForm itemId={a.id} status={st.status} mode={null} hours={null} isAgent={false} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
