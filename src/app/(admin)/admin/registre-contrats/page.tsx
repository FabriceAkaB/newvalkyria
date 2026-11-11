import { Pill, moneyCents } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import {
  AMOUNT_PERIOD_LABEL,
  CONTRACT_KINDS,
  KIND_LABEL,
  actionHint,
  amountLabel,
  anchorId,
  dayFr,
  deadlineLabel,
  defaultAlertDays,
  getRegistryOverview,
  torontoDay,
  type AmountPeriod,
  type ContractKind,
  type ContractTimeline,
  type RenewalMode
} from "@/lib/contracts-registry";

import { AddContract, ContractActions, type ContractView, type Options, type Preset } from "./contracts-client";

export const metadata = { title: "Échéances des contrats — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

const s = (n: number) => (n > 1 ? "s" : "");

/** Libellés courts pour le choix à trois boutons (lisible à 375 px). */
const OPTIONS: Options = {
  kinds: CONTRACT_KINDS,
  renewals: [
    { value: "manuel" as RenewalMode, label: "À renégocier" },
    { value: "automatique" as RenewalMode, label: "Automatique" },
    { value: "aucun" as RenewalMode, label: "Se termine" }
  ],
  periods: (Object.keys(AMOUNT_PERIOD_LABEL) as AmountPeriod[]).map((value) => ({ value, label: AMOUNT_PERIOD_LABEL[value] }))
};

/** Contrats qui n'existent nulle part ailleurs dans le site : un geste pour commencer la saisie. */
const PRESETS: Preset[] = [
  { kind: "assurance", title: "Assurance responsabilité civile", renewal: "manuel", amountPeriod: "annuel" },
  { kind: "logiciel", title: "MonClubSportif", renewal: "automatique", amountPeriod: "annuel" },
  { kind: "logiciel", title: "Google Workspace", renewal: "automatique", amountPeriod: "mensuel" },
  { kind: "logiciel", title: "Nom de domaine newvalkyria.com", renewal: "automatique", amountPeriod: "annuel" },
  { kind: "logiciel", title: "Hébergement du site (Vercel)", renewal: "automatique", amountPeriod: "mensuel" }
];

function view(c: ContractTimeline): ContractView {
  return {
    key: c.key,
    registryId: c.registryId,
    source: c.source,
    sourceId: c.sourceId,
    kind: c.kind,
    title: c.title,
    supplier: c.supplier,
    startDate: c.startDate,
    endDate: c.endDate,
    effectiveEnd: c.effectiveEnd,
    renewal: c.renewal,
    noticeDays: c.noticeDays,
    customAlertDays: c.alertDays !== defaultAlertDays(c.kind) ? c.alertDays : null,
    amountCents: c.amountCents,
    amountPeriod: c.amountPeriod,
    notes: c.notes,
    state: c.state,
    status: c.status,
    // « Remettre dans le suivi » seulement si c'est une décision notée ici (« Ne pas renouveler ») :
    // un contrat d'embauche annulé ou une commandite terminée le restent dans leur module.
    reopenable: c.status === "termine" && c.decidedAt !== null,
    origin: c.origin,
    href: c.href
  };
}

/** D'où vient la date de fin, pour que JP sache s'il peut s'y fier. */
function dateSource(c: ContractTimeline): string | null {
  if (c.dateOrigin === "texte") return `Date lue dans le contrat : « ${c.dateHint} »`;
  if (c.dateOrigin === "estimee") return `Date estimée : ${c.dateHint}`;
  if (c.dateOrigin === "aucune" && c.dateHint) return `Rien de lisible dans : « ${c.dateHint} »`;
  return null;
}

/** « 2 gymnases », « 1 contrat d'embauche » : pour la ligne du haut. */
function kindCount(kind: ContractKind, n: number): string {
  const word: Record<ContractKind, [string, string]> = {
    terrain: ["terrain", "terrains"],
    gymnase: ["gymnase", "gymnases"],
    embauche: ["contrat d’embauche", "contrats d’embauche"],
    commandite: ["commandite", "commandites"],
    assurance: ["assurance", "assurances"],
    logiciel: ["logiciel", "logiciels"],
    fournisseur: ["fournisseur", "fournisseurs"],
    autre: ["autre contrat", "autres contrats"]
  };
  return `${n} ${word[kind][n > 1 ? 1 : 0]}`;
}

const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

const urgent = (c: ContractTimeline) => c.state === "echu" || (c.daysLeft !== null && c.daysLeft <= 30);

function Row({ c, decide, editLabel }: { c: ContractTimeline; decide?: boolean; editLabel?: string }) {
  const amount = amountLabel(c);
  const tone = c.state === "echu" ? "var(--adm-bad)" : c.state === "alerte" ? (urgent(c) ? "var(--adm-bad)" : "var(--adm-warn)") : undefined;
  const source = dateSource(c);
  return (
    <li
      id={anchorId(c.key)}
      className="mda-task"
      style={{ display: "block", scrollMarginTop: 96, boxShadow: decide ? `inset 3px 0 0 ${urgent(c) ? "var(--adm-bad)" : "var(--adm-warn)"}` : undefined }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <p className="mda-task-title" style={{ fontWeight: 600 }}>
            {c.title}
          </p>
          <div className="mda-task-meta">
            <Pill tone={c.isRevenue ? "good" : undefined}>{KIND_LABEL[c.kind]}</Pill>
            <span style={tone ? { color: tone, fontWeight: 600 } : undefined}>{deadlineLabel(c)}</span>
            {c.state === "a-venir" && c.alertFrom ? <span>Alerte le {dayFr(c.alertFrom)}</span> : null}
            {c.detail ? <span>{c.detail}</span> : null}
            {c.supplier && !c.title.startsWith(c.supplier) ? <span>{c.supplier}</span> : null}
          </div>
        </div>
        {amount ? (
          <span className="mda-tnum" style={{ fontWeight: 600, textAlign: "right" }}>
            {amount}
            <span className="mda-muted" style={{ display: "block", fontWeight: 400, fontSize: "0.75rem" }}>
              {c.isRevenue ? "revenu" : "dépense"}
            </span>
          </span>
        ) : null}
      </div>
      {decide ? (
        <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "var(--adm-text)" }}>
          {actionHint(c)}
          {c.state === "alerte" && c.alertFrom ? <span className="mda-muted"> · alerte depuis le {dayFr(c.alertFrom)}</span> : null}
        </p>
      ) : null}
      {c.decisionNote ? (
        <p className="mda-muted" style={{ margin: "6px 0 0", fontSize: "0.8rem" }}>
          {c.decisionNote}
          {c.decidedAt ? ` · noté le ${dayFr(torontoDay(c.decidedAt))}` : ""}
        </p>
      ) : null}
      {c.notes ? (
        <p className="mda-muted" style={{ margin: "6px 0 0", fontSize: "0.8rem", whiteSpace: "pre-line" }}>
          {c.notes}
        </p>
      ) : null}
      {source ? (
        <p className="mda-muted" style={{ margin: "6px 0 0", fontSize: "0.78rem" }}>
          {source}
        </p>
      ) : null}
      {c.rolled > 0 ? (
        <p className="mda-muted" style={{ margin: "6px 0 0", fontSize: "0.78rem" }}>
          Renouvelé automatiquement {c.rolled} fois depuis le {dayFr(c.endDate)}
        </p>
      ) : null}
      <ContractActions c={view(c)} options={OPTIONS} decide={decide} editLabel={editLabel} />
    </li>
  );
}

function Group({ id, title, sub, items, decide, editLabel }: { id: string; title: string; sub: string; items: ContractTimeline[]; decide?: boolean; editLabel?: string }) {
  if (!items.length) return null;
  return (
    <section className="mda-card-flush" aria-labelledby={id}>
      <div className="mda-card-head">
        <div>
          <h2 className="mda-h2" id={id}>
            {title} · {items.length}
          </h2>
          <p className="mda-sub" style={{ margin: 0 }}>
            {sub}
          </p>
        </div>
      </div>
      <ul className="mda-tasks">
        {items.map((c) => (
          <Row key={c.key} c={c} decide={decide} editLabel={editLabel} />
        ))}
      </ul>
    </section>
  );
}

/** « Quelles échéances s'en viennent ? » : gymnases et terrains, contrats d'embauche, commandites,
 *  assurances et logiciels, dans une seule liste triée par échéance. Alerte 90 jours avant (60 pour une commandite). */
export default async function ContractRegistryPage() {
  await requireAdmin({ roles: ["admin"] });
  const o = await getRegistryOverview();
  const running = o.all.filter((c) => c.state !== "termine");
  const completeKeys = new Set(o.toComplete.map((c) => c.key));
  const upcoming = o.upcoming.filter((c) => !completeKeys.has(c.key));
  const urgentCount = o.toDecide.filter(urgent).length;
  const next = o.toDecide[0] ?? o.upcoming[0] ?? null;
  const byKind = CONTRACT_KINDS.map((k) => ({ k, n: running.filter((c) => c.kind === k.value).length })).filter((x) => x.n > 0);
  const presets = PRESETS.filter((p) => !o.all.some((c) => c.title.toLowerCase() === p.title.toLowerCase()));

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">
            Registre des contrats · {running.length} contrat{s(running.length)} en cours
            {byKind.length ? ` · ${byKind.map((x) => kindCount(x.k.value, x.n)).join(", ")}` : ""}
          </p>
          <h1 className="mda-h1">
            {o.toDecide.length
              ? `${o.toDecide.length} échéance${s(o.toDecide.length)} à décider d'ici 90 jours`
              : running.length
                ? "Aucune échéance dans les 90 prochains jours"
                : "Le registre des contrats est vide"}
          </h1>
          <p className="mda-lead">
            {next ? `Prochaine : ${next.title}, ${lower(deadlineLabel(next))}. ` : ""}
            Alerte 90 jours avant la fin (60 pour une commandite), aussi dans Aujourd’hui. Gymnases, terrains, embauche et commandites s’ajoutent tout seuls.
          </p>
        </header>

        <section className="mda-cols-3">
          <div className="mda-card" style={o.toDecide.length ? { boxShadow: `inset 3px 0 0 ${urgentCount ? "var(--adm-bad)" : "var(--adm-warn)"}` } : undefined}>
            <p className="mda-num">{o.toDecide.length}</p>
            <p className="mda-label">
              À décider maintenant
              <span className="mda-muted" style={{ display: "block" }}>
                {urgentCount ? `${urgentCount} dans moins de 30 jours ou déjà terminé${s(urgentCount)}` : "Renouveler, renégocier ou laisser finir"}
              </span>
            </p>
          </div>
          <div className="mda-card">
            <p className="mda-num">{moneyCents(o.committedCents)}</p>
            <p className="mda-label">
              Engagé dans les contrats en cours
              <span className="mda-muted" style={{ display: "block" }}>
                Terrains, gymnases, embauche, fournisseurs ; abonnements sur 12 mois
              </span>
            </p>
          </div>
          <div className="mda-card">
            <p className="mda-num">{moneyCents(o.sponsorCents)}</p>
            <p className="mda-label">
              Commandites en cours
              <span className="mda-muted" style={{ display: "block" }}>
                Revenu ; rencontre de renouvellement 60 jours avant la fin
              </span>
            </p>
          </div>
        </section>

        <Group
          id="a-decider"
          title="À décider"
          sub="Dans la fenêtre d'alerte, ou terminé depuis moins de 30 jours. « Renouvelé » ou « Ne pas renouveler » le sort de la liste."
          items={o.toDecide}
          decide
        />

        <AddContract options={OPTIONS} presets={presets} />

        <Group
          id="a-completer"
          title="Dates à confirmer"
          sub="La date de fin manque ou n'est qu'estimée : l'alerte ne sera juste qu'une fois la vraie date saisie."
          items={o.toComplete}
          editLabel="Confirmer les dates"
        />

        <Group id="a-venir" title="À venir" sub="Triés par échéance. Chaque contrat passe dans « À décider » le jour où son alerte commence." items={upcoming} />

        {o.ended.length ? (
          <details className="mda-card">
            <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", fontWeight: 600 }}>
              Terminés ou non renouvelés · {o.ended.length}
            </summary>
            <ul className="mda-tasks" style={{ marginTop: 12 }}>
              {o.ended.map((c) => (
                <Row key={c.key} c={c} />
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  );
}
