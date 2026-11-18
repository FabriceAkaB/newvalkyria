import { CLUB_ID } from "@/lib/club";
import { projectRequirements, taxCollected, taxThreshold, type Requirement, type TaxThreshold } from "@/lib/finance-officer";
import { torontoToday } from "@/lib/launch-scenarios-repo";
import { getProjectBoard, type ProjectRow } from "@/lib/project-pipeline-repo";
import { computeFinancialDashboard, computeRevenueSummary, getUpcomingMovements, type FinancialDashboard } from "@/lib/revenue-calc";
import { getRevenueSettings } from "@/lib/revenue-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Données du responsable financier : la santé de l'argent (trésorerie existante), ce qui est à payer, les taxes,
 *  les projets avec leurs conditions, et les dossiers d'argent en cours (comptable, subventions, Azimut) tirés des tâches de JP. */

export interface FinanceTask {
  id: string;
  title: string;
  due: string | null;
  ref: string | null;
  mandalartCode: string | null;
}

export interface FinanceOfficer {
  today: string;
  dashboard: FinancialDashboard;
  billsSoon: { date: string; amountCents: number; description: string }[];
  tax: { rate: number; from: string | null; threshold: TaxThreshold; collectedCents: number };
  projects: (ProjectRow & { requirements: Requirement[] })[];
  surveyInfo: { id: string; title: string; status: string; invited: number; responded: number } | null;
  tasks: FinanceTask[];
}

const FINANCE_REFS = ["azimut:%", "compta:%", "subventions:%", "projet:%"];

export async function getFinanceOfficer(): Promise<FinanceOfficer> {
  const today = torontoToday();
  const db = getSupabaseAdminClient() as any;
  const [dashboard, movements, board, summary, settings, { data: tasks }] = await Promise.all([
    computeFinancialDashboard(),
    getUpcomingMovements(),
    getProjectBoard(),
    computeRevenueSummary(),
    getRevenueSettings(),
    db
      .from("team_tasks")
      .select("id, title, due, ref, mandalart_code")
      .eq("club_id", CLUB_ID)
      .in("status", ["a_faire", "en_cours"])
      .or([...FINANCE_REFS.map((r) => `ref.like.${r}`), "mandalart_code.like.P7.%"].join(","))
      .order("due", { ascending: true, nullsFirst: false })
  ]);
  const in60 = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
  return {
    today,
    dashboard,
    billsSoon: movements.outgoing.filter((m) => m.date <= in60).sort((a, b) => a.date.localeCompare(b.date)),
    tax: {
      rate: settings.revenue_tax_rate,
      from: settings.revenue_tax_from,
      threshold: taxThreshold(summary.months, today),
      collectedCents: taxCollected(summary.months)
    },
    projects: board.rows.map((row) => ({ ...row, requirements: projectRequirements(row.scenario, row.evaluation) })),
    surveyInfo: board.surveys[0] ?? null,
    tasks: ((tasks ?? []) as any[]).map((t) => ({ id: t.id, title: t.title, due: t.due ? String(t.due).slice(0, 10) : null, ref: t.ref ?? null, mandalartCode: t.mandalart_code ?? null }))
  };
}
