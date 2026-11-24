import Link from "next/link";

import { GoogleReviewsForm, ManualProspectsForm } from "@/app/(admin)/admin/acquisition/acquisition-actions";
import { Bar } from "@/components/mandalart/ui";
import { ADS_START, COST_TARGETS, frDay, METRIC_DEFS, METRICS, type Metric, type Pace } from "@/lib/acquisition-goals";
import type { AcquisitionGoals, GoalPeriodView } from "@/lib/acquisition-goals-repo";
import { sourceLabel } from "@/lib/acquisition-core";

const PACE_COLOR: Record<Pace, string> = { atteint: "var(--adm-good)", "en-route": "var(--adm-text)", "en-retard": "var(--adm-bad)", "a-venir": "var(--adm-text-2)" };
const money = (c: number | null) => (c === null ? "—" : `${Math.round(c / 100).toLocaleString("fr-CA")} $`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

function Cell({ p, m }: { p: GoalPeriodView; m: Metric }) {
  const actual = p.measures[m];
  const goal = p.goals?.[m] ?? null;
  const pace = p.paces[m];
  return (
    <td className="r" style={{ whiteSpace: "nowrap" }}>
      <span style={{ fontWeight: 600, color: pace ? PACE_COLOR[pace] : undefined }}>{actual === null ? "à noter" : actual}</span>
      {goal !== null ? <span className="mda-muted"> / {goal}</span> : null}
    </td>
  );
}

function CostTable({ p }: { p: GoalPeriodView }) {
  const rows = p.channels;
  if (rows.length <= 1) return <p className="mda-muted" style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>Aucun prospect, essai ni inscription pendant cette période.</p>;
  return (
    <div className="mda-scroll">
      <table className="mda-table" style={{ minWidth: 640 }}>
        <thead>
          <tr>
            <th>Canal</th>
            <th className="r">Prospects</th>
            <th className="r">Essais</th>
            <th className="r">Inscriptions</th>
            <th className="r">Dépensé</th>
            <th className="r">Par prospect</th>
            <th className="r">Par essai</th>
            <th className="r">Par inscription</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const total = r.source === "total";
            const trialBad = r.costPerTrial !== null && r.costPerTrial > COST_TARGETS.perTrialCents;
            const inscBad = r.costPerInscription !== null && r.costPerInscription > COST_TARGETS.perInscriptionCents;
            return (
              <tr key={r.source ?? "inconnue"} style={total ? { fontWeight: 600 } : r.source === null ? { opacity: 0.7 } : undefined}>
                <td>{r.label}</td>
                <td className="r">{r.prospects}</td>
                <td className="r">{r.trials}</td>
                <td className="r">{r.inscriptions}</td>
                <td className="r">{r.spendCents ? money(r.spendCents) : total ? "0 $" : "gratuit"}</td>
                <td className="r">{money(r.costPerProspect)}</td>
                <td className="r" style={{ color: trialBad ? "var(--adm-bad)" : undefined }}>{money(r.costPerTrial)}</td>
                <td className="r" style={{ color: inscBad ? "var(--adm-bad)" : undefined }}>{money(r.costPerInscription)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Objectifs d'acquisition des 90 jours (P3.8.20), en haut de « D'où viennent nos familles ». Les coûts (argent dépensé
 *  en publicité) ne sont montrés qu'à l'admin. */
export function AcquisitionGoalsSection({ g, isAdmin }: { g: AcquisitionGoals; isAdmin: boolean }) {
  const [week, lastWeek, month, quarter] = g.periods;
  const booked = week.measures.trialsBooked ?? 0;
  const goal = week.goals?.trialsBooked ?? null;
  const preview = week.preview;
  const c24 = g.funnel.contact24h;
  return (
    <>
      <section className="mda-card" id="objectifs" style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ minWidth: 0, flex: "1 1 320px" }}>
            <p className="mda-eyebrow" style={{ margin: 0 }}>Machine d&apos;acquisition · 1er décembre au 28 février · revue chaque lundi</p>
            <h2 className="mda-h2" style={{ margin: "6px 0 0" }}>Essais réservés cette semaine</h2>
            <p className="mda-num-xl" style={{ margin: "8px 0 0" }}>
              {booked}
              {goal ? <span className="mda-muted" style={{ fontSize: "1.2rem", fontWeight: 500 }}> sur {goal}</span> : null}
            </p>
            {goal ? (
              <div style={{ marginTop: 10, maxWidth: 360 }}>
                <Bar value={Math.min(1, booked / goal)} marker={week.elapsed} thin />
              </div>
            ) : null}
            <p className="mda-label">
              {preview ? "Le plan commence le 1er décembre : objectifs de décembre montrés d'avance. " : ""}L&apos;essai est le moment qui fait signer : c&apos;est l&apos;indicateur roi.
            </p>
          </div>
          <Link
            href="/admin/relances/essais"
            className={g.funnel.dueToday ? "admin-btn-primary" : "admin-btn-ghost"}
            style={{ minHeight: 44, display: "inline-flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            {g.funnel.dueToday ? `${plural(g.funnel.dueToday, "famille")} à relancer aujourd'hui` : "Entonnoir des essais"}
          </Link>
        </div>

        <div className="mda-scroll">
          <table className="mda-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Objectif</th>
                {g.periods.map((p) => (
                  <th key={p.key} className="r" style={{ whiteSpace: "normal" }}>
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m}>
                  <td style={{ minWidth: 180 }}>
                    <span style={{ fontWeight: m === "trialsBooked" ? 600 : 500 }}>{METRIC_DEFS[m].label}</span>
                    <span className="mda-muted" style={{ display: "block", fontSize: "0.74rem", marginTop: 2, lineHeight: 1.35 }}>{METRIC_DEFS[m].help}</span>
                  </td>
                  {g.periods.map((p) => (
                    <Cell key={p.key} p={p} m={m} />
                  ))}
                </tr>
              ))}
              <tr>
                <td>
                  <span style={{ fontWeight: 500 }}>Contactées en moins de 24 h</span>
                  <span className="mda-muted" style={{ display: "block", fontSize: "0.74rem", marginTop: 2 }}>Demandes des 30 derniers jours · cible 100 %</span>
                </td>
                <td className="r" colSpan={4} style={{ fontWeight: 600, color: c24.total && c24.within === c24.total ? "var(--adm-good)" : c24.total ? "var(--adm-warn)" : undefined }}>
                  {c24.total ? `${c24.within} sur ${c24.total}` : "aucune demande"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mda-muted" style={{ margin: 0, fontSize: "0.8rem" }}>
          En vert : objectif atteint. En rouge : en retard sur le rythme de la période. Mois et trimestre : objectif de la semaine × le nombre de semaines.
          {lastWeek.goals ? "" : " La semaine dernière était avant le plan."}
        </p>
      </section>

      {isAdmin ? (
        <section className="mda-card" id="couts">
          <h2 className="mda-h2">Coût par prospect, par essai et par inscription</h2>
          <p className="mda-sub">
            Toute la publicité (publications boostées, Meta, Google : <Link href="/admin/reseaux" style={{ color: "var(--adm-accent)" }}>Réseaux sociaux</Link>) va au canal « Publicité ».
            Cibles : {money(COST_TARGETS.perTrialCents)} par essai, {money(COST_TARGETS.perInscriptionCents)} par inscription (en rouge au-dessus). Publicité dès le {frDay(ADS_START)} : on double ce qui ramène des essais, on coupe après 7 jours sans essai.
          </p>
          {[lastWeek, week, month, quarter].map((p, i) => (
            <details key={p.key} open={i === 0} style={{ borderTop: "1px solid var(--adm-line)", padding: "10px 0" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, minHeight: 32 }}>
                {p.label}
                <span className="mda-muted" style={{ fontWeight: 400 }}> · {money(p.measures.spendCents)} dépensés</span>
              </summary>
              <CostTable p={p} />
            </details>
          ))}
        </section>
      ) : null}

      <section className="mda-card" id="a-la-main">
        <h2 className="mda-h2">Ce que le site ne voit pas</h2>
        <p className="mda-sub">Le lundi, en 2 minutes : les familles intéressées qui ont écrit ou appelé sans remplir de formulaire, et le total d&apos;avis Google de la fiche.</p>
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <p className="mda-label" style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--adm-text)" }}>Prospects reçus hors du site</p>
            <ManualProspectsForm today={g.today} />
            {g.manual.length ? (
              <p className="mda-muted" style={{ margin: "6px 0 0", fontSize: "0.8rem" }}>
                30 derniers jours : {g.manual.map((m) => `${frDay(m.day)} ${m.count}${m.source ? ` (${sourceLabel(m.source)})` : ""}`).join(" · ")}
              </p>
            ) : null}
          </div>
          <div>
            <p className="mda-label" style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--adm-text)" }}>
              Avis Google
              <span className="mda-muted" style={{ fontWeight: 400 }}>
                {g.lastReviewTotal ? ` · ${g.lastReviewTotal.total} au ${frDay(g.lastReviewTotal.day)}` : " · aucun total noté"} · objectif 100 au 30 juin 2027
              </span>
            </p>
            <GoogleReviewsForm today={g.today} last={g.lastReviewTotal?.total ?? null} />
          </div>
        </div>
      </section>
    </>
  );
}
