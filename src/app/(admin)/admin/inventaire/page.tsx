import { InventoryAddForm, InventoryItemRow, ReplacedButton, type ItemView, type ReplacementView } from "@/components/inventory-admin";
import { Bar, moneyCents } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { CONDITIONS, CONDITION_LABEL, INVENTORY_CATEGORIES, getInventoryOverview, monthFr, type PlannedItem } from "@/lib/inventory-repo";

export const metadata = { title: "Inventaire du matériel — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

const s = (n: number) => (n > 1 ? "s" : "");

function view(p: PlannedItem): ItemView {
  const i = p.item;
  return {
    id: i.id,
    name: i.name,
    category: i.category,
    quantity: i.quantity,
    location: i.location,
    assignedTo: i.assigned_to,
    condition: i.condition,
    purchasedOn: i.purchased_on,
    unitCostCents: i.unit_cost_cents,
    customLifespan: i.lifespan_months,
    notes: i.notes
  };
}

function replacementView(p: PlannedItem, thisYear: number): ReplacementView {
  const r = p.replacement;
  const label = r.due
    ? "À remplacer maintenant"
    : r.year === thisYear
      ? `À remplacer en ${monthFr(r.date)}`
      : `Remplacement en ${r.year}${r.estimated ? " (estimé)" : ""}`;
  return { label, reason: r.reason, due: r.due };
}

/** « Quel matériel avons-nous, où, et quoi remplacer ? » */
export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const [{ site }, o] = await Promise.all([searchParams, getInventoryOverview()]);
  const year = Number(o.today.slice(0, 4));
  const empty = o.items.length === 0;
  const shared = { categories: INVENTORY_CATEGORIES, conditions: CONDITIONS, locations: o.locations, assignees: o.assignees };
  const due = o.thisYear;
  const next = o.fund[1];
  const dueNowCents = o.dueNow.reduce((sum, p) => sum + (p.costCents ?? 0), 0);
  const siteFilter = site && o.locations.includes(site) ? site : null;
  const shown = siteFilter ? o.items.filter((p) => p.item.location?.trim() === siteFilter) : o.items;
  const groups = INVENTORY_CATEGORIES.map((c) => ({
    c,
    items: shown.filter((p) => p.item.category === c.value).sort((a, b) => a.item.name.localeCompare(b.item.name, "fr") || (a.item.location ?? "").localeCompare(b.item.location ?? "", "fr"))
  })).filter((g) => g.items.length > 0);
  const maxFund = Math.max(1, ...o.fund.map((f) => f.costCents));
  const pill: React.CSSProperties = { minHeight: 44, padding: "0 16px", textDecoration: "none", alignSelf: "center" };

  return (
    <div className="admin-content">
      <div className="admin-section mda">
        <header>
          <p className="mda-eyebrow">
            {empty
              ? "Inventaire du matériel"
              : `Inventaire du matériel · ${o.units.toLocaleString("fr-CA")} article${s(o.units)} en ${o.items.length} lot${s(o.items.length)} · ${o.locations.length} emplacement${s(o.locations.length)}`}
          </p>
          <h1 className="mda-h1">
            {empty
              ? "L'inventaire est vide"
              : due.items.length
                ? `${due.items.length} lot${s(due.items.length)} à remplacer d'ici la fin de ${year} : ${due.costCents ? `${moneyCents(due.costCents)}${due.unknownCost ? " et plus" : ""}` : "coût à préciser"}`
                : `Rien à remplacer d'ici la fin de ${year}`}
          </h1>
          <p className="mda-lead">
            {empty
              ? "Ajoutez chaque lot de matériel une fois : ballons, dossards bicolores, cônes, mini-buts, tapis, cibles, caméra, trousse de premiers soins. L'année de remplacement et le fonds à prévoir se calculent ensuite tout seuls."
              : "L'année de remplacement se calcule toute seule : date d'achat + durée de vie. Un article noté « usé » se remplace dans les 12 mois, « à remplacer » tout de suite. Le total devient le fonds de remplacement du budget."}
          </p>
        </header>

        {!empty && (
          <section className="mda-cols-3">
            <div className="mda-card" style={o.dueNow.length ? { boxShadow: "inset 3px 0 0 var(--adm-bad)" } : undefined}>
              <p className="mda-num">{o.dueNow.length}</p>
              <p className="mda-label">
                Lot{s(o.dueNow.length)} à remplacer maintenant{dueNowCents ? ` · ${moneyCents(dueNowCents)}` : ""}
                <span className="mda-muted" style={{ display: "block" }}>
                  Marqués « à remplacer » ou durée de vie dépassée
                </span>
              </p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{moneyCents(next.costCents)}</p>
              <p className="mda-label">
                À prévoir en {next.year}
                {next.unknownCost ? ` (+ ${next.unknownCost} lot${s(next.unknownCost)} sans coût)` : ""}
                <span className="mda-muted" style={{ display: "block" }}>
                  {next.costCents ? `Soit ${moneyCents(next.costCents / 12)} par mois à mettre de côté` : "Aucun remplacement prévu"}
                </span>
              </p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{moneyCents(o.valueCents)}</p>
              <p className="mda-label">
                Valeur du matériel
                <span className="mda-muted" style={{ display: "block" }}>
                  Au prix d’achat{o.items.some((p) => p.costCents === null) ? ", lots sans coût exclus" : ""}
                </span>
              </p>
            </div>
          </section>
        )}

        <InventoryAddForm startOpen={empty} {...shared} />

        {due.items.length > 0 && (
          <section className="mda-card-flush" aria-labelledby="a-remplacer">
            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2" id="a-remplacer">
                  À remplacer d’ici le 31 décembre
                </h2>
                <p className="mda-sub" style={{ margin: 0 }}>
                  Touchez « Remplacé » quand le lot est racheté : il redevient neuf, acheté aujourd’hui.
                </p>
              </div>
              <span className="mda-tnum" style={{ fontWeight: 600, fontSize: "1.05rem" }}>
                {moneyCents(due.costCents)}
              </span>
            </div>
            <ul className="mda-tasks">
              {due.items.map((p) => (
                <li key={p.item.id} className="mda-task" style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <p className="mda-task-title" style={{ fontWeight: 600 }}>
                      <a href={`#i-${p.item.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                        {p.item.quantity} × {p.item.name}
                      </a>
                    </p>
                    <div className="mda-task-meta">
                      <span style={p.replacement.due ? { color: "var(--adm-bad)", fontWeight: 600 } : undefined}>{p.replacement.due ? "Maintenant" : `En ${monthFr(p.replacement.date)}`}</span>
                      <span>{p.replacement.reason}</span>
                      {p.item.location ? <span>{p.item.location}</span> : null}
                    </div>
                  </div>
                  <span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>
                    <span className="mda-tnum" style={{ fontWeight: 600, color: p.costCents === null ? "var(--adm-text-3)" : "var(--adm-text)" }}>
                      {p.costCents === null ? "Coût à préciser" : moneyCents(p.costCents)}
                    </span>
                    <ReplacedButton id={p.item.id} name={p.item.name} quantity={p.item.quantity} unitCostCents={p.item.unit_cost_cents} />
                  </span>
                </li>
              ))}
              <li className="mda-task" style={{ justifyContent: "space-between", background: "var(--adm-surface-2)" }}>
                <span style={{ fontWeight: 600 }}>Fonds de remplacement {year}</span>
                <span className="mda-tnum" style={{ fontWeight: 700 }}>
                  {moneyCents(due.costCents)}
                  {due.unknownCost ? <span className="mda-muted" style={{ display: "block", fontWeight: 400, fontSize: "0.75rem" }}>minimum : {due.unknownCost} lot{s(due.unknownCost)} sans coût</span> : null}
                </span>
              </li>
            </ul>
          </section>
        )}

        {!empty && (
          <section className="mda-card-flush" aria-labelledby="tout">
            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2" id="tout">
                  {siteFilter ? `Matériel à ${siteFilter}` : "Tout le matériel"} · {shown.reduce((sum, p) => sum + p.item.quantity, 0).toLocaleString("fr-CA")}
                </h2>
                <p className="mda-sub" style={{ margin: 0 }}>
                  − et + pour corriger une quantité après un décompte ; « Modifier » pour l’état, l’endroit ou la personne.
                </p>
              </div>
            </div>
            {o.locations.length > 1 ? (
              <nav aria-label="Filtrer par emplacement" style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "12px 20px", borderBottom: "1px solid var(--adm-line)" }}>
                <a href="/admin/inventaire#tout" className="mda-pill" data-tone={siteFilter ? undefined : "accent"} style={pill} aria-current={siteFilter ? undefined : "page"}>
                  Tous les emplacements
                </a>
                {o.locations.map((l) => (
                  <a key={l} href={`/admin/inventaire?site=${encodeURIComponent(l)}#tout`} className="mda-pill" data-tone={siteFilter === l ? "accent" : undefined} style={pill} aria-current={siteFilter === l ? "page" : undefined}>
                    {l}
                  </a>
                ))}
              </nav>
            ) : null}
            {groups.map((g) => (
              <div key={g.c.value}>
                <p className="mda-group-title" style={{ margin: 0 }}>
                  {g.c.label} · {g.items.length} lot{s(g.items.length)} · {g.items.reduce((sum, p) => sum + p.item.quantity, 0).toLocaleString("fr-CA")} article{s(g.items.reduce((sum, p) => sum + p.item.quantity, 0))}
                </p>
                <ul className="mda-tasks">
                  {g.items.map((p) => (
                    <InventoryItemRow
                      key={p.item.id}
                      item={view(p)}
                      replacement={replacementView(p, year)}
                      conditionLabel={CONDITION_LABEL[p.item.condition]}
                      unitCostLabel={p.item.unit_cost_cents !== null ? `${moneyCents(p.item.unit_cost_cents)} l'unité` : null}
                      {...shared}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {!empty && (
          <section className="mda-card" aria-labelledby="fonds">
            <h2 className="mda-h2" id="fonds">
              Fonds de remplacement sur 3 ans
            </h2>
            <p className="mda-sub">À mettre au budget lors de la revue annuelle des dépenses. Les dates dépassées comptent dans l’année en cours.</p>
            <div style={{ display: "grid", gap: 14 }}>
              {o.fund.map((f) => (
                <div key={f.year} style={{ display: "grid", gridTemplateColumns: "48px minmax(0, 1fr) auto", gap: 12, alignItems: "center" }}>
                  <span className="mda-tnum" style={{ fontWeight: 600 }}>
                    {f.year}
                  </span>
                  <Bar value={f.costCents / maxFund} thin color={f.year === year && f.costCents ? "var(--adm-warn)" : undefined} />
                  <span className="mda-tnum" style={{ textAlign: "right", minWidth: 96 }}>
                    <span style={{ fontWeight: 600 }}>{moneyCents(f.costCents)}</span>
                    <span className="mda-muted" style={{ display: "block", fontSize: "0.75rem" }}>
                      {f.items.length} lot{s(f.items.length)}
                      {f.unknownCost ? ` · ${f.unknownCost} sans coût` : ""}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
