import { LaunchCalculator } from "@/components/launch-calculator";
import { requireAdmin } from "@/lib/admin-auth";
import { getLaunchAlerts, getPrefillSources, listScenarios, torontoToday, type LaunchAlert, type LaunchScenario } from "@/lib/launch-scenarios-repo";

export const metadata = { title: "Calculateur de lancement — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

/** « Ce nouveau programme est-il rentable avant de le lancer ? » (Mandalart P7.2.02, AU11).
 *  ?programme=session:garcons-2014 ou ?programme=saison:automne-hiver-2026:TV ouvre le calcul prérempli ;
 *  ?scenario=<id> rouvre un scénario enregistré. Le menu et les onglets du hub Revenus viennent de la mise en page. */
export default async function LaunchCalculatorPage({ searchParams }: { searchParams: Promise<{ programme?: string; scenario?: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const sp = await searchParams;
  const today = torontoToday();

  let scenarios: LaunchScenario[] = [];
  let alerts: LaunchAlert[] = [];
  let loadError: string | null = null;
  const sourcesPromise = getPrefillSources();
  try {
    [scenarios, alerts] = await Promise.all([listScenarios(100, today), getLaunchAlerts(today)]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Erreur";
  }
  const sources = await sourcesPromise;

  return (
    <div className="admin-content">
      <div className="admin-section mda">
        <LaunchCalculator
          today={today}
          sources={sources}
          scenarios={scenarios}
          alerts={alerts}
          loadError={loadError}
          initialProgramKey={sp.programme ?? null}
          initialScenarioId={sp.scenario ?? null}
        />
      </div>
    </div>
  );
}
