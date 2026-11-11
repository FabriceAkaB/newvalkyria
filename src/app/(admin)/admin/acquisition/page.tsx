import Link from "next/link";

import { Bar, Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { getAcquisitionStats } from "@/lib/acquisition";
import type { BusinessFamily, FamilyGroup } from "@/lib/acquisition-core";

import { AddSponsorButton, SetSourceForm } from "./acquisition-actions";

export const metadata = { title: "D'où viennent nos familles — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Toronto" });
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
const SHOWN_WITHOUT_SOURCE = 10;

function FamilyLine({ f }: { f: FamilyGroup }) {
  return (
    <>
      <p className="mda-task-title" style={{ fontWeight: 600 }}>{f.parentName || f.parentEmail || "Famille"}</p>
      <div className="mda-task-meta">
        {f.players.length ? <span>{f.players.join(", ")}</span> : null}
        {f.programs.length ? <span>{f.programs.join(" · ")}</span> : null}
        <span>Inscrite le {day(f.firstAt)}</span>
      </div>
    </>
  );
}

function Contact({ f }: { f: FamilyGroup }) {
  return (
    <div className="mda-task-meta">
      {f.parentPhone ? <a href={telHref(f.parentPhone)} style={{ color: "var(--adm-accent)" }}>{f.parentPhone}</a> : null}
      {f.parentEmail ? <a href={`mailto:${f.parentEmail}`} style={{ color: "var(--adm-text-2)" }}>{f.parentEmail}</a> : null}
    </div>
  );
}

function BusinessRow({ b }: { b: BusinessFamily }) {
  return (
    <li className="mda-task" style={{ flexWrap: "wrap" }}>
      <div className="mda-task-body" style={{ minWidth: 220 }}>
        <p className="mda-task-title" style={{ fontWeight: 600 }}>{b.businessName}</p>
        <div className="mda-task-meta">
          <span>{b.parentName || b.parentEmail}</span>
          {b.players.length ? <span>parent de {b.players.join(", ")}</span> : null}
          {b.programs.length ? <span>{b.programs.join(" · ")}</span> : null}
        </div>
        <Contact f={b} />
      </div>
      {b.inSponsors ? (
        <Pill tone="good">Dans le suivi des commanditaires</Pill>
      ) : (
        <AddSponsorButton business={{ businessName: b.businessName, parentName: b.parentName, parentEmail: b.parentEmail, parentPhone: b.parentPhone, players: b.players }} />
      )}
    </li>
  );
}

/** « D'où viennent nos familles ? » : canaux des inscriptions et des essais, conversion essai → inscription par canal,
 *  codes de référence utilisés, familles qui ont une entreprise (commandites) et familles dont la source manque. */
export default async function AcquisitionPage() {
  await requireAdmin();
  const s = await getAcquisitionStats();
  const toApproach = s.businesses.filter((b) => !b.inSponsors);
  const conversion = s.trialsCount ? s.convertedTrials / s.trialsCount : null;
  const hasAnswers = s.channels.some((c) => c.source !== null);
  const r = s.referrals;
  const shown = s.withoutSource.slice(0, SHOWN_WITHOUT_SOURCE);
  const rest = s.withoutSource.slice(SHOWN_WITHOUT_SOURCE);

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">
            Saison en cours · {plural(s.inscriptionsCount, "inscription payée", "inscriptions payées")} · {plural(s.trialsCount, "essai")} · depuis le {day(s.seasonStart)}
          </p>
          <h1 className="mda-h1">{s.headline}</h1>
          <p className="mda-lead">
            « Comment nous avez-vous connus ? » est obligatoire dans chaque formulaire d&apos;inscription et d&apos;essai. « Avez-vous une entreprise ? » est
            facultatif : ce sont nos commandites possibles.
          </p>
        </header>

        <section className="mda-cols-4">
          <div className="mda-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p className="mda-num" style={{ color: s.share.pct !== null && s.share.pct >= 90 ? "var(--adm-good)" : undefined }}>{s.share.pct === null ? "—" : `${Math.round(s.share.pct)} %`}</p>
            <Bar value={(s.share.pct ?? 0) / 100} thin />
            <p className="mda-label" style={{ marginTop: 0 }}>
              Familles inscrites avec une source connue ({s.share.known} sur {s.share.families}) · cible 100 %
            </p>
          </div>
          <div className="mda-card">
            <p className="mda-num">{pct(conversion)}</p>
            <p className="mda-label">
              Essais devenus inscriptions payées ({s.convertedTrials} sur {s.trialsCount})
            </p>
          </div>
          <div className="mda-card" style={toApproach.length ? { boxShadow: "inset 3px 0 0 var(--adm-warn)" } : undefined}>
            <p className="mda-num">{s.businesses.length}</p>
            <p className="mda-label">
              Famille{s.businesses.length > 1 ? "s" : ""} avec une entreprise{toApproach.length ? ` · ${toApproach.length} à approcher` : ""}
            </p>
          </div>
          <div className="mda-card">
            <p className="mda-num">
              {r.codesUsed} <span className="mda-muted" style={{ fontSize: "1rem", fontWeight: 500 }}>/ {r.codesTotal}</span>
            </p>
            <p className="mda-label">Codes de référence qui ont amené une inscription ({plural(r.inscriptionsFromCodes, "inscription")})</p>
          </div>
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <div>
              <h2 className="mda-h2">Par canal</h2>
              <p className="mda-sub" style={{ margin: 0 }}>
                Inscriptions payées de la saison (part parmi celles dont la source est connue) et essais filles, garçons et Sport-Études. Un essai est « devenu
                inscription » quand la même joueuse a payé le jour de l&apos;essai ou après.
              </p>
            </div>
          </div>
          {s.channels.length === 0 ? (
            <p style={{ padding: "16px 20px", margin: 0, color: "var(--adm-text-3)" }}>Aucune inscription ni aucun essai cette saison.</p>
          ) : (
            <ul className="mda-tasks">
              {s.channels.map((c) => (
                <li key={c.source ?? "inconnue"} className="mda-task" style={{ display: "block", opacity: c.source === null ? 0.75 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                    <span className="mda-task-title" style={{ fontWeight: 600 }}>{c.label}</span>
                    <span className="mda-tnum" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{plural(c.inscriptions, "inscription")}</span>
                  </div>
                  {c.share !== null ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                      <span style={{ flex: 1 }}>
                        <Bar value={c.share} thin />
                      </span>
                      <span className="mda-tnum mda-muted" style={{ minWidth: 44, textAlign: "right", fontSize: "0.85rem" }}>{pct(c.share)}</span>
                    </div>
                  ) : null}
                  <div className="mda-task-meta">
                    <span>
                      {c.trials
                        ? `${plural(c.trials, "essai")}, ${c.convertedTrials} devenu${c.convertedTrials > 1 ? "s" : ""} inscription${c.convertedTrials > 1 ? "s" : ""} (${pct(c.conversion)})`
                        : "Aucun essai"}
                    </span>
                    {c.topDetails.length ? <span>{c.topDetails.map((d) => `${d.label} (${d.count})`).join(", ")}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!hasAnswers && s.channels.length > 0 ? (
            <p style={{ padding: "12px 20px", margin: 0, fontSize: "0.85rem", color: "var(--adm-text-3)", borderTop: "1px solid var(--adm-line)" }}>
              Aucune famille n&apos;a encore répondu : les réponses arrivent avec chaque nouvelle inscription et chaque nouvel essai. Les familles déjà inscrites se complètent plus bas.
            </p>
          ) : null}
        </section>

        <section className="mda-card">
          <h2 className="mda-h2">Codes de référence</h2>
          <p className="mda-sub">
            Les {r.codesTotal} codes remis aux familles : recommandations validées des programmes garçons, et codes (ou familles) écrits par les parents dans « Parrainage ».
          </p>
          <div className="mda-cols-3">
            <div>
              <p className="mda-num">{r.inscriptionsFromCodes}</p>
              <p className="mda-label">
                Inscription{r.inscriptionsFromCodes > 1 ? "s" : ""} venue{r.inscriptionsFromCodes > 1 ? "s" : ""} d&apos;un code ({r.fromProgramReferrals} recommandation
                {r.fromProgramReferrals > 1 ? "s" : ""} garçons, {r.fromFormMentions} écrite{r.fromFormMentions > 1 ? "s" : ""} dans le formulaire)
              </p>
            </div>
            <div>
              <p className="mda-num">{r.parrainageDeclared}</p>
              <p className="mda-label">Inscriptions de la saison qui ont répondu « Parrainage » (avec ou sans code reconnu)</p>
            </div>
            <div>
              <p className="mda-num">{r.rewardsGiven}</p>
              <p className="mda-label">
                Récompense{r.rewardsGiven > 1 ? "s" : ""} donnée{r.rewardsGiven > 1 ? "s" : ""} (sac ou crédit)
                {r.toVerify ? (
                  <>
                    {" · "}
                    <Link href="/admin/references" style={{ color: "var(--adm-warn)" }}>{plural(r.toVerify, "recommandation")} à vérifier</Link>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          {r.topReferrers.length ? (
            <p className="mda-label" style={{ marginTop: 16 }}>
              Familles qui nous amènent le plus de monde : {r.topReferrers.map((t) => `${t.name} (${t.count})`).join(", ")}
            </p>
          ) : null}
          <p style={{ margin: "16px 0 0", fontSize: "0.85rem" }}>
            <Link href="/admin/references" style={{ color: "var(--adm-accent)" }}>Voir les codes et les crédits →</Link>
          </p>
        </section>

        <section className="mda-card-flush" id="entreprises">
          <div className="mda-card-head">
            <div>
              <h2 className="mda-h2">Familles avec une entreprise</h2>
              <p className="mda-sub" style={{ margin: 0 }}>
                Commandites possibles : chaque famille a dit oui à « Avez-vous une entreprise ? ». Ajoutez-la au suivi des commanditaires pour la contacter.
              </p>
            </div>
            <Link href="/admin/commandites" className="admin-btn-ghost" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>
              Suivi des commanditaires
            </Link>
          </div>
          {s.businesses.length === 0 ? (
            <p style={{ padding: "16px 20px", margin: 0, color: "var(--adm-text-3)" }}>
              Aucune famille n&apos;a encore déclaré d&apos;entreprise. La question est posée dans chaque formulaire d&apos;inscription et d&apos;essai.
            </p>
          ) : (
            <ul className="mda-tasks">
              {s.businesses.map((b) => (
                <BusinessRow key={`${b.key}#${b.businessName}`} b={b} />
              ))}
            </ul>
          )}
        </section>

        <section className="mda-card-flush" id="sans-source">
          <div className="mda-card-head">
            <div>
              <h2 className="mda-h2">
                {s.withoutSource.length ? `${plural(s.withoutSource.length, "famille inscrite", "familles inscrites")} sans source` : "Toutes les familles inscrites ont une source"}
              </h2>
              <p className="mda-sub" style={{ margin: 0 }}>
                Surtout des familles inscrites avant la question. Si vous savez d&apos;où elles viennent, choisissez le canal : il s&apos;ajoute à leurs inscriptions de la
                saison (une réponse d&apos;un parent n&apos;est jamais remplacée).
              </p>
            </div>
          </div>
          {s.withoutSource.length ? (
            <ul className="mda-tasks">
              {shown.map((f) => (
                <li key={f.key} className="mda-task">
                  <div className="mda-task-body">
                    <FamilyLine f={f} />
                    <SetSourceForm refs={f.refs} familyLabel={f.parentName || f.parentEmail} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {rest.length ? (
            <details style={{ borderTop: "1px solid var(--adm-line)" }}>
              <summary style={{ padding: "14px 20px", cursor: "pointer", fontSize: "0.88rem", color: "var(--adm-text-2)", minHeight: 44 }}>
                Voir les {plural(rest.length, "autre famille", "autres familles")}
              </summary>
              <ul className="mda-tasks" style={{ borderTop: "1px solid var(--adm-line)" }}>
                {rest.map((f) => (
                  <li key={f.key} className="mda-task">
                    <div className="mda-task-body">
                      <FamilyLine f={f} />
                      <SetSourceForm refs={f.refs} familyLabel={f.parentName || f.parentEmail} />
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      </div>
    </div>
  );
}
