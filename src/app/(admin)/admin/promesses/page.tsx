import { DeliveryRefresh } from "@/components/delivery-refresh";
import { Bar, Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { GROUP_KIND_LABEL } from "@/lib/delivery-core";
import { getDeliveryReport } from "@/lib/delivery-repo";

export const metadata = { title: "Promesses tenues — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-CA", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }) : "jamais");
const day = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "date inconnue");

/** « Est-ce qu'on donne tout ce qu'on a vendu ? » : groupe par groupe, joueuse par joueuse, pratiques promises contre
 *  pratiques données, à venir et annulées ; un écart = des séances à remettre. */
export default async function PromessesPage() {
  await requireAdmin();
  const r = await getDeliveryReport();
  const short = r.groups.filter((g) => g.shortfall > 0);
  const cancelled = r.groups.flatMap((g) => g.cancelled.map((c) => ({ ...c, team: g.teamName })));
  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">Tout ce qui a été vendu doit être donné</p>
          <h1 className="mda-h1">{r.groups.length === 0 ? "Promesses tenues" : r.toGive === 0 ? "Toutes les promesses sont couvertes" : `${r.toGive} séance${r.toGive > 1 ? "s" : ""} à remettre`}</h1>
          <p className="mda-lead">Pour chaque groupe : les pratiques promises par le programme de chaque joueuse (demi-saison comprise) contre celles données, prévues et annulées dans MonClubSportif. Une pratique annulée sans reprise crée un écart. Relu chaque matin ; dernière lecture : {when(r.lastSync)}.</p>
          <DeliveryRefresh />
        </header>

        {r.groups.length === 0 ? (
          <section className="mda-card"><p className="mda-sub" style={{ margin: 0 }}>Pas encore de lecture du calendrier de la saison : clique « Recalculer maintenant ».</p></section>
        ) : (
          <>
            <section className="mda-cols-3">
              <div className="mda-card">
                <p className="mda-num" style={{ color: r.toGive ? "var(--adm-warn)" : "var(--adm-good)" }}>{r.toGive}</p>
                <p className="mda-label">Séance{r.toGive > 1 ? "s" : ""} à remettre (reprise, rabais ou crédit)</p>
              </div>
              <div className="mda-card">
                <p className="mda-num">{short.length} / {r.groups.length}</p>
                <p className="mda-label">Groupe{short.length > 1 ? "s" : ""} sous la promesse</p>
              </div>
              <div className="mda-card">
                <p className="mda-num">{cancelled.length}</p>
                <p className="mda-label">Pratique{cancelled.length > 1 ? "s" : ""} annulée{cancelled.length > 1 ? "s" : ""} cette saison</p>
              </div>
            </section>

            <section className="mda-card-flush">
              <div className="mda-card-head"><h2 className="mda-h2">Groupe par groupe</h2></div>
              <ul className="mda-tasks">
                {r.groups.map((g) => {
                  const total = g.given + g.upcoming;
                  return (
                    <li key={g.teamId} className="mda-task" style={{ display: "block" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <span className="mda-task-title" style={{ fontWeight: 600 }}>{g.teamName}</span>
                        {g.shortfall > 0 ? <Pill tone="warn">{g.shortfall} à remettre</Pill> : <Pill tone="good">Promesse couverte</Pill>}
                      </div>
                      <div className="mda-task-meta">
                        <span>{GROUP_KIND_LABEL[g.kind]}</span>
                        <span className="mda-tnum">Promis {g.promised} · donné {g.given} · à venir {g.upcoming}{g.cancelled.length ? ` · annulé ${g.cancelled.length}` : ""}</span>
                        <span>{g.players.length} joueuse{g.players.length > 1 ? "s" : ""}</span>
                      </div>
                      <div style={{ marginTop: 8, maxWidth: 420 }}>
                        <Bar value={g.promised ? Math.min(1, total / g.promised) : 1} marker={g.promised ? Math.min(1, g.given / g.promised) : undefined} thin color={g.shortfall ? "var(--adm-warn)" : "var(--adm-good)"} />
                      </div>
                      {g.players.some((p) => p.shortfall > 0) && (
                        <p className="mda-sub" style={{ margin: "8px 0 0" }}>
                          À remettre : {g.players.filter((p) => p.shortfall > 0).map((p) => `${p.name} (${p.program}${p.until ? ", demi-saison" : ""}) ${p.shortfall}`).join(" · ")}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {cancelled.length > 0 && (
              <section className="mda-card-flush">
                <div className="mda-card-head"><h2 className="mda-h2">Pratiques annulées</h2></div>
                <ul className="mda-tasks">
                  {cancelled.map((c, i) => (
                    <li key={i} className="mda-task">
                      <span className="mda-muted mda-tnum" style={{ minWidth: 120 }}>{day(c.date)}</span>
                      <span className="mda-task-title">{c.team} · {c.title}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
