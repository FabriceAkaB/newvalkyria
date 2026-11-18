import { CLUB_ID } from "@/lib/club";
import { listScenarios, saveScenario, torontoToday, type LaunchScenario } from "@/lib/launch-scenarios-repo";
import { PROJECTS_2027, agendaSteps, countInterest, evaluateProject, sortByDecision, type Interest, type Project, type ProjectEvaluation } from "@/lib/project-pipeline";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { syncRefTask } from "@/lib/team-tasks-repo";

/** Projets à lancer : réponses du sondage d'intérêt (surveys de type « interet » qui contiennent les questions des
 *  projets), scénarios du calculateur reliés (launch_scenarios.project_key) et étapes déjà placées dans les tâches de JP
 *  (team_tasks.ref = « projet:<clé>:<étape> »). Lecture seule, sauf la création d'un scénario et le placement des étapes. */

const db = () => getSupabaseAdminClient() as any;

export interface ProjectRow {
  project: Project;
  interest: Interest;
  interestedNames: string[];
  scenario: LaunchScenario | null;
  evaluation: ProjectEvaluation;
  scheduled: number;
}

export interface ProjectBoard {
  rows: ProjectRow[];
  surveys: { id: string; title: string; status: string; invited: number; responded: number }[];
}

export async function getProjectBoard(): Promise<ProjectBoard> {
  const keys = new Set(PROJECTS_2027.map((p) => p.key));
  const [{ data: surveys }, scenarios, { data: tasks }] = await Promise.all([
    db().from("surveys").select("id, title, status, questions").eq("club_id", CLUB_ID).eq("kind", "interet").order("created_at", { ascending: false }),
    listScenarios(200),
    db().from("team_tasks").select("ref").eq("club_id", CLUB_ID).like("ref", "projet:%").in("status", ["a_faire", "en_cours", "fait"])
  ]);
  const projectSurveys = ((surveys ?? []) as any[]).filter((s) => (s.questions ?? []).some((q: any) => keys.has(q.id)));
  const ids = projectSurveys.map((s) => s.id);
  const [{ data: responses }, { data: invites }] = ids.length
    ? await Promise.all([
        db().from("survey_responses").select("survey_id, invite_id, answers, created_at").in("survey_id", ids).order("created_at", { ascending: false }),
        db().from("survey_invites").select("id, survey_id, parent_email, player_names, parent_name, responded_at").in("survey_id", ids)
      ])
    : [{ data: [] }, { data: [] }];
  const inviteById = new Map(((invites ?? []) as any[]).map((i) => [i.id, i]));

  const rows: ProjectRow[] = PROJECTS_2027.map((project) => {
    const answers: unknown[] = [];
    const names: string[] = [];
    // Une famille qui répond à deux sondages (ex. projets 2027 puis préparatoire Sport-Études) compte une fois : sa réponse la plus récente.
    const seen = new Set<string>();
    for (const r of (responses ?? []) as any[]) {
      const a = r.answers?.[project.key];
      if (a === undefined) continue;
      const fam = String((r.invite_id ? inviteById.get(r.invite_id)?.parent_email : null) ?? `réponse:${r.invite_id ?? Math.random()}`).toLowerCase();
      if (seen.has(fam)) continue;
      seen.add(fam);
      answers.push(a);
      if (/^(oui|peut)/i.test(String(Array.isArray(a) ? a[0] : a))) {
        const inv = r.invite_id ? inviteById.get(r.invite_id) : null;
        const who = inv?.player_names || inv?.parent_name;
        if (who) names.push(`${who}${/^peut/i.test(String(a)) ? " (peut-être)" : ""}`);
      }
    }
    const interest = countInterest(answers);
    const scenario = scenarios.find((s) => s.projectKey === project.key) ?? null;
    const scheduled = ((tasks ?? []) as any[]).filter((t) => String(t.ref).startsWith(`projet:${project.key}:`)).length;
    return { project, interest, interestedNames: names, scenario, evaluation: evaluateProject(interest, scenario), scheduled };
  });

  return {
    rows: sortByDecision(rows),
    surveys: projectSurveys.map((s) => {
      const inv = ((invites ?? []) as any[]).filter((i) => i.survey_id === s.id);
      return { id: s.id, title: s.title, status: s.status, invited: inv.length, responded: inv.filter((i) => i.responded_at).length };
    })
  };
}

/** Crée le scénario du calculateur d'un projet (nom et date de début proposés), ou rend celui qui existe déjà. */
export async function ensureProjectScenario(key: string): Promise<string> {
  const project = PROJECTS_2027.find((p) => p.key === key);
  if (!project) throw new Error("Projet inconnu");
  const existing = (await listScenarios(200)).find((s) => s.projectKey === key);
  if (existing) return existing.id;
  const s = await saveScenario({ name: project.label, sourceKind: null, sourceId: null, inputs: { startDate: project.start }, projectKey: key });
  if (!s) throw new Error("Scénario non créé");
  return s.id;
}

/** Place les trois étapes du projet (préparer, ouvrir la vente, vérifier les préventes) dans les tâches de JP. */
export async function scheduleProject(key: string): Promise<number> {
  const project = PROJECTS_2027.find((p) => p.key === key);
  if (!project) throw new Error("Projet inconnu");
  const scenario = (await listScenarios(200)).find((s) => s.projectKey === key);
  const start = scenario?.inputs.startDate ?? project.start;
  if (!start) throw new Error("Mettre d'abord la date de début dans le calculateur");
  const steps = agendaSteps(project.label, start, torontoToday());
  for (const step of steps) await syncRefTask(`projet:${key}:${step.key}`, { title: step.title, details: step.details, due: step.due });
  return steps.length;
}
