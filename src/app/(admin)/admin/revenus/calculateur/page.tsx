import { LaunchCalculator } from "@/components/launch-calculator";
import { requireAdmin } from "@/lib/admin-auth";
import { getAccountingSeasons, getLaunchAlerts, getPrefillSources, getSeasonSettings, listScenarios, torontoToday, type LaunchAlert, type LaunchScenario } from "@/lib/launch-scenarios-repo";
import type { SeasonSettings } from "@/lib/season-budget";

export const metadata = { title: "Calculateur de lancement — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

/** « Ce nouveau programme est-il rentable avant de le lancer ? » (Mandalart P7.2.02, AU11).
 *  ?programme=session:garcons-2014 ou ?programme=saison:automne-hiver-2026:TV ouvre le calcul prérempli ;
 *  ?scenario=<id> rouvre un scénario enregistré. Le menu et les onglets du hub Revenus viennent de la mise en page. */
export default async function LaunchCalculatorPage({ searchParams }: { searchParams: Promise<{ programme?: string; scenario?: string; saison?: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const sp = await searchParams;
  const today = torontoToday();

  let scenarios: LaunchScenario[] = [];
  let alerts: LaunchAlert[] = [];
  let seasons: Record<string, SeasonSettings> = {};
  let loadError: string | null = null;
  const sourcesPromise = getPrefillSources();
  try {
    [scenarios, alerts, seasons] = await Promise.all([listScenarios(100, today), getLaunchAlerts(today), getSeasonSettings()]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Erreur";
  }
  const [sources, accountingSeasons] = await Promise.all([sourcesPromise, getAccountingSeasons().catch(() => [])]);

  return (
    <div className="admin-content">
      <div className="admin-section mda">
        <LaunchCalculator
          today={today}
          sources={sources}
          scenarios={scenarios}
          alerts={alerts}
          seasons={seasons}
          accountingSeasons={accountingSeasons}
          initialSeason={sp.saison ?? null}
          loadError={loadError}
          initialProgramKey={sp.programme ?? null}
          initialScenarioId={sp.scenario ?? null}
        />
      </div>
    </div>
  );
}
