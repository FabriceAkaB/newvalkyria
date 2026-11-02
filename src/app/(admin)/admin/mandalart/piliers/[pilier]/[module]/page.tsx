import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminTopbar } from "@/components/admin-topbar";
import { ChannelStatForm } from "@/components/mandalart/forms";
import { TaskList } from "@/components/mandalart/task-list";
import { Bar, Pill, STATUS_TONE, capitalize, monthLabel, moneyCents, pctLabel, shortDay } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { addMonths, isOpen } from "@/lib/mandalart-core";
import { formatKpi } from "@/lib/mandalart-kpis";
import { CHANNELS, getChannelStats } from "@/lib/marketing-stats";
import { MODULE_STATUS_LABEL, PILLAR_MODULES, moduleHref } from "@/lib/mandalart-modules";
import { getPedagogyMonth } from "@/lib/mandalart-pedagogy";
import { linkLabel, pillarBySlug } from "@/lib/mandalart-plan";
import { getMandalartOverview } from "@/lib/mandalart-repo";
import { toItems } from "@/lib/mandalart-view";

export const dynamic = "force-dynamic";

const findModule = (pilier: string, slug: string) => PILLAR_MODULES.find((m) => m.pillar.toLowerCase() === pilier.toLowerCase() && m.slug === slug) ?? null;

export async function generateMetadata({ params }: { params: Promise<{ pilier: string; module: string }> }) {
  const { pilier, module } = await params;
  return { title: `Mandalart — ${findModule(pilier, module)?.title ?? "Section"}`, robots: "noindex" };
}

/** Une section d'un pilier. Les sections déjà bâties ailleurs dans l'admin y mènent directement ;
 *  ici : les sections propres au Mandalart (saison pédagogique, rétention, réseaux) et les chantiers
 *  à construire, avec ce qu'ils contiendront, leurs tâches et la prochaine étape. */
export default async function MandalartModulePage({ params, searchParams }: { params: Promise<{ pilier: string; module: string }>; searchParams: Promise<{ mois?: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const { pilier, module } = await params;
  const plan = pillarBySlug(pilier);
  const mod = findModule(pilier, module);
  if (!plan || !mod) notFound();
  const o = await getMandalartOverview();
  const tasks = o.tasks.filter((t) => mod.objectives.includes(t.objective)).sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || (a.due ?? "").localeCompare(b.due ?? ""));
  const openTasks = tasks.filter(isOpen);
  const kpis = o.kpis.filter((k) => mod.kpis?.includes(k.id));
  const sp = await searchParams;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">
              <Link href={`/admin/mandalart/piliers/${plan.code.toLowerCase()}`} style={{ color: "var(--adm-text-3)" }}>
                Pilier {plan.code.slice(1)} · {plan.name}
              </Link>
            </p>
            <h1 className="mda-h1" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {mod.title} <Pill tone={STATUS_TONE[mod.status]}>{MODULE_STATUS_LABEL[mod.status]}</Pill>
            </h1>
            <p className="mda-lead">{mod.question}</p>
            {mod.href ? (
              <p style={{ marginTop: 12 }}>
                <Link href={mod.href} className="admin-btn-primary" style={{ textDecoration: "none", padding: "10px 16px", display: "inline-block" }}>
                  Ouvrir l'écran
                </Link>
              </p>
            ) : null}
          </header>

          {mod.slug === "mois-pedagogique" ? await PedagogyBlock(sp.mois && /^\d{4}-\d{2}$/.test(sp.mois) ? sp.mois : o.today.slice(0, 7), plan.code.toLowerCase()) : null}
          {mod.slug === "retention" ? <RetentionBlock o={o} /> : null}
          {mod.slug === "reseaux" ? await ChannelsBlock() : null}

          {kpis.length > 0 && (
            <section className="mda-cols-3">
              {kpis.map((k) => (
                <div key={k.id} className="mda-card">
                  <p className="mda-num">{formatKpi(k.current, k.targetN.unit || k.startN.unit)}</p>
                  <p className="mda-label">{k.label}</p>
                  <div style={{ marginTop: 10 }}>
                    <Bar value={k.progress ?? 0} thin color={k.met ? "var(--adm-good)" : undefined} />
                    <p className="mda-label">Cible {k.target} · {k.currentNote ?? (k.source === "manuel" ? "Saisie manuelle dans Indicateurs" : "")}</p>
                  </div>
                </div>
              ))}
            </section>
          )}

          {mod.planned?.length ? (
            <section className="mda-card">
              <h2 className="mda-h2">{mod.status === "actif" ? "Ce que la section contient" : "Ce que la section contiendra"}</h2>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--adm-text-2)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                {mod.planned.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              {mod.next ? (
                <p style={{ margin: "14px 0 0", fontSize: "0.9rem", color: "var(--adm-text)" }}>
                  <strong>Prochaine étape :</strong> {mod.next}
                </p>
              ) : null}
              {mod.links?.length ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                  {mod.links.map((id) => (
                    <Link key={id} href="/admin/mandalart/agents" className="mda-pill" style={{ textDecoration: "none" }}>
                      {linkLabel(id)}
                    </Link>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2">Tâches liées · {openTasks.length} ouvertes</h2>
                <p className="mda-sub" style={{ margin: 0 }}>Objectifs {mod.objectives.join(", ")}.</p>
              </div>
            </div>
            <TaskList tasks={toItems(tasks)} currentLevel={o.currentLevel} showObjective />
          </section>

          <p className="mda-sub">
            Autres sections du pilier :{" "}
            {PILLAR_MODULES.filter((m) => m.pillar === mod.pillar && m.slug !== mod.slug).map((m, i) => (
              <span key={m.slug}>
                {i ? " · " : ""}
                <Link href={moduleHref(m)} style={{ color: "var(--adm-text-2)" }}>
                  {m.title}
                </Link>
              </span>
            ))}
          </p>
        </div>
      </div>
    </>
  );
}

async function PedagogyBlock(month: string, pilier: string) {
  const d = await getPedagogyMonth(month);
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);
  const base = `/admin/mandalart/piliers/${pilier}/mois-pedagogique`;
  const matches = d.activities.filter((a) => a.type === "Match");
  const special = d.activities.filter((a) => !["Pratique", "Match"].includes(a.type));
  return (
    <>
      <section className="mda-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link href={`${base}?mois=${prev}`} className="admin-btn-ghost" style={{ textDecoration: "none", padding: "8px 12px" }}>← {monthLabel(prev, false)}</Link>
        <h2 className="mda-h2" style={{ margin: 0 }}>{capitalize(monthLabel(month))}</h2>
        <Link href={`${base}?mois=${next}`} className="admin-btn-ghost" style={{ textDecoration: "none", padding: "8px 12px" }}>{monthLabel(next, false)} →</Link>
      </section>
      <section className="mda-cols-4">
        <div className="mda-card">
          <p className="mda-num">{d.activities.filter((a) => a.type === "Pratique").length}</p>
          <p className="mda-label">Pratiques entrées · {d.hours} h au total</p>
        </div>
        <div className="mda-card">
          <p className="mda-num">{matches.length}</p>
          <p className="mda-label">Matchs · {special.length} autre{special.length > 1 ? "s" : ""} (tournoi, camp, évaluation…)</p>
        </div>
        <div className="mda-card">
          <p className="mda-num">{d.activities.length ? pctLabel(d.withPlan / d.activities.length) : "—"}</p>
          <p className="mda-label">Activités avec un plan de séance (blocs)</p>
        </div>
        <div className="mda-card" style={d.unconfirmedCoaches ? { boxShadow: "inset 3px 0 0 var(--adm-warn)" } : undefined}>
          <p className="mda-num">{d.activities.length ? pctLabel(d.withEvaluations / d.activities.length) : "—"}</p>
          <p className="mda-label">Activités avec évaluations de joueuses{d.unconfirmedCoaches ? ` · ${d.unconfirmedCoaches} présence(s) d'éducateur non confirmée(s)` : ""}</p>
        </div>
      </section>
      <section className="mda-card-flush">
        <div className="mda-card-head">
          <div>
            <h2 className="mda-h2">Toutes les activités du mois · {d.activities.length}</h2>
            <p className="mda-sub" style={{ margin: 0 }}>Pratiques, matchs (adversaire, score), tournois et événements. On les entre dans Équipe → Entraînements.</p>
          </div>
          <Link href="/admin/entraineurs/activites" className="admin-btn-primary" style={{ textDecoration: "none", padding: "8px 14px" }}>Ajouter une activité</Link>
        </div>
        {d.activities.length === 0 ? (
          <p style={{ padding: "16px 20px", margin: 0, color: "var(--adm-text-3)", fontSize: "0.9rem" }}>Aucune activité entrée pour ce mois. Commencez par les pratiques de la semaine.</p>
        ) : (
          <div className="mda-scroll">
            <table className="mda-table" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Activité</th>
                  <th>Groupe</th>
                  <th>Match</th>
                  <th className="r">Blocs</th>
                  <th className="r">Évaluations</th>
                  <th className="r">Éducateurs</th>
                </tr>
              </thead>
              <tbody>
                {d.activities.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {shortDay(a.date)}
                      {a.start ? <span className="mda-muted"> · {a.start}</span> : null}
                    </td>
                    <td>
                      <Link href={`/admin/entraineurs/activites/${a.id}`} style={{ color: "var(--adm-text)" }}>{a.title}</Link>
                      {a.type !== "Pratique" ? <span className="mda-muted"> · {a.type}</span> : null}
                    </td>
                    <td>{a.category ?? "—"}</td>
                    <td>{a.opponent ? `${a.homeAway === "away" ? "à " : "contre "}${a.opponent}${a.score ? ` (${a.score})` : ""}` : "—"}</td>
                    <td className="r">{a.blocks || "—"}</td>
                    <td className="r">{a.evaluations || "—"}</td>
                    <td className="r" style={{ color: a.coaches > a.coachesConfirmed ? "var(--adm-warn)" : undefined }}>{a.coaches ? `${a.coachesConfirmed}/${a.coaches}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="mda-card">
        <h2 className="mda-h2">Thèmes des semaines</h2>
        {d.themes.length === 0 ? (
          <p className="mda-sub" style={{ margin: 0 }}>
            Aucun thème entré pour ce mois. <Link href="/admin/themes" style={{ color: "var(--adm-accent)" }}>Entrer les thèmes</Link> (gymnase : technique et ball mastery · synthétique : tactique et prise de décision).
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--adm-text-2)", fontSize: "0.9rem", lineHeight: 1.7 }}>
            {d.themes.map((t) => (
              <li key={t.week}>
                Semaine du {shortDay(t.week)} : <strong style={{ color: "var(--adm-text)" }}>{t.theme}</strong>
                {t.notes ? ` — ${t.notes}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function RetentionBlock({ o }: { o: Awaited<ReturnType<typeof getMandalartOverview>> }) {
  const f = o.figures;
  const r = f.retention;
  return (
    <>
      <section className="mda-cols-3">
        <div className="mda-card">
          <p className="mda-num">{r.previousFamilies ? pctLabel(r.returned / r.previousFamilies) : "—"}</p>
          <p className="mda-label">
            Familles revenues de l'été à la saison en cours ({r.returned} sur {r.previousFamilies}) · cible 85 %
          </p>
        </div>
        <div className="mda-card">
          <p className="mda-num">{r.previousFamilies - r.returned}</p>
          <p className="mda-label">Familles perdues depuis l'été (taux de perte {r.previousFamilies ? pctLabel(1 - r.returned / r.previousFamilies) : "—"})</p>
        </div>
        <div className="mda-card">
          <p className="mda-num">{f.cohorts.filter((c) => c.year >= 2017).reduce((s, c) => s + c.players, 0)}</p>
          <p className="mda-label">Joueuses nées en 2017, 2018 et 2019 · cible 120 (40 par génération) avant le départ des 2015 en U13</p>
        </div>
      </section>
      <section className="mda-card-flush">
        <div className="mda-card-head">
          <div>
            <h2 className="mda-h2">Recrutement par génération</h2>
            <p className="mda-sub" style={{ margin: 0 }}>Joueuses inscrites cette saison, et combien il en manque pour atteindre environ 40 par génération.</p>
          </div>
        </div>
        <div className="mda-scroll">
          <table className="mda-table" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th>Génération</th>
                <th className="r">Inscrites</th>
                <th>Vers 40</th>
                <th className="r">À recruter</th>
              </tr>
            </thead>
            <tbody>
              {f.cohorts.map((c) => (
                <tr key={c.year}>
                  <td>
                    {c.label} <span className="mda-muted">· U{Number(o.today.slice(0, 4)) + 1 - c.year}</span>
                  </td>
                  <td className="r">{c.players}</td>
                  <td style={{ width: "40%" }}>{c.target ? <Bar value={c.players / c.target} thin color={c.players >= c.target ? "var(--adm-good)" : c.players < c.target / 3 ? "var(--adm-bad)" : undefined} /> : <span className="mda-muted">Part en U13 bientôt</span>}</td>
                  <td className="r" style={{ color: c.missing ? "var(--adm-warn)" : "var(--adm-good)", fontWeight: 600 }}>{c.missing === null ? "—" : c.missing === 0 ? "Complet" : c.missing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {r.lost.length > 0 && (
        <details className="mda-card-flush">
          <summary style={{ cursor: "pointer", padding: "16px 20px" }}>
            <span className="mda-h2">Familles de l'été pas revenues · {r.lost.length}</span>
            <span className="mda-sub" style={{ display: "block", margin: "4px 0 0" }}>Comparaison par courriel : avant toute relance, vérifier par le nom de la joueuse (l'autre parent a pu l'inscrire). Voir Relances et suivi.</span>
          </summary>
          <ul style={{ margin: 0, padding: "0 20px 16px 38px", fontSize: "0.85rem", color: "var(--adm-text-2)", lineHeight: 1.7 }}>
            {r.lost.map((l) => (
              <li key={l.email}>{l.name}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="mda-sub" style={{ margin: 0 }}>
        Places remplies dans l'horaire filles : {formatKpi(o.kpis.find((k) => k.id === "remplissage")?.current ?? null, "%")} · joueuses actives : {o.kpis.find((k) => k.id === "membres_actifs")?.current ?? "—"} (cible 200 en septembre 2028) · encaissé en {o.results.year} : {moneyCents(o.results.caYearCents)}.
      </p>
    </>
  );
}

async function ChannelsBlock() {
  const stats = await getChannelStats();
  return (
    <>
      <section className="mda-cols-3">
        {CHANNELS.map((c) => {
          const rows = stats.filter((s) => s.channel === c.id);
          const last = rows[0];
          const prev = rows[1];
          const delta = last && prev && last.followers !== null && prev.followers !== null ? last.followers - prev.followers : null;
          return (
            <div key={c.id} className="mda-card">
              <p className="mda-label" style={{ marginTop: 0 }}>{c.label}</p>
              {last ? (
                <>
                  <p className="mda-num">{c.ads ? moneyCents(last.spend_cents) : (last.followers ?? "—").toLocaleString("fr-CA")}</p>
                  <p className="mda-label">
                    {c.ads ? `dépensé · ${last.leads ?? 0} contacts` : `abonnés${delta !== null ? ` (${delta >= 0 ? "+" : ""}${delta})` : ""} · ${last.posts ?? 0} publications · ${(last.views ?? 0).toLocaleString("fr-CA")} vues`}
                    {c.ads && last.leads && last.spend_cents ? ` · ${moneyCents(last.spend_cents / last.leads)} par contact` : ""}
                  </p>
                  <p className="mda-label mda-muted">Au {shortDay(last.measured_at)}</p>
                </>
              ) : (
                <p className="mda-label">Aucun chiffre entré.</p>
              )}
            </div>
          );
        })}
      </section>
      <section className="mda-card">
        <h2 className="mda-h2">Entrer les chiffres</h2>
        <p className="mda-sub">Aux 2 semaines : abonnés, publications, vues ; pour la pub, le montant dépensé et les contacts obtenus. Plus tard, l'agent statistiques (A06) le fera seul.</p>
        <ChannelStatForm />
      </section>
    </>
  );
}
