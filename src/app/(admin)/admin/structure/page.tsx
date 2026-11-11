import Link from "next/link";

import { Pill } from "@/components/mandalart/ui";
import {
  CandidateActions,
  CandidateEditor,
  DeleteNeedButton,
  EMPTY_CANDIDATE,
  EMPTY_STAFF,
  GrowthScenario,
  NeedEditor,
  NeedStatusSelect,
  StaffActiveButton,
  StaffEditor,
  type StaffFormValue
} from "@/components/structure-admin";
import { requireAdmin } from "@/lib/admin-auth";
import {
  CERT_KIND_LABEL,
  EMPLOYMENT_LABEL,
  NEED_STATUS_LABEL,
  PIPELINE,
  REQUIRED_ON_FIELD,
  STAGE_HINT,
  STAGE_LABEL,
  TEAMS,
  TEAM_LABEL,
  WEEKDAY_LABEL,
  WEEKDAY_SHORT,
  dayLabelShort,
  hoursLabel,
  isCovered,
  isOpenNeed,
  nextRecruitDue,
  samePerson,
  shortDays,
  timeLabel,
  weekdayOfIso,
  type CertView,
  type Flag,
  type Person
} from "@/lib/structure-core";
import { getStructure, shortPlace } from "@/lib/structure-repo";

export const metadata = { title: "Structure et recrutement — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

const rate = (c: number) => `${(c / 100).toLocaleString("fr-CA", { maximumFractionDigits: 2 })} $/h`;
const toDollars = (c: number | null) => (c === null ? "" : String(c / 100).replace(".", ","));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const daysText = (days: Person["availableDays"]) => days.map((d) => WEEKDAY_SHORT[d].toLowerCase() + ".").join(", ");
const daysLong = (days: Person["availableDays"]) => {
  const names = days.map((d) => WEEKDAY_LABEL[d].toLowerCase());
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}` : (names[0] ?? "");
};
const SOURCE: Record<string, string> = { fiche: "fiche", contrat: "contrat", portail: "portail" };
const TONE_COLOR: Record<Flag["tone"], string> = { bad: "var(--adm-bad)", warn: "var(--adm-warn)", info: "var(--adm-info)" };
const TONE_ORDER: Record<Flag["tone"], number> = { bad: 0, warn: 1, info: 2 };

function certTone(c: CertView): "good" | "warn" | "bad" | undefined {
  return c.state === "expiree" ? "bad" : c.state === "bientot" ? "warn" : c.state === "valide" ? "good" : undefined;
}
function certText(c: CertView, today: string) {
  if (!c.expiresOn) return c.name;
  return `${c.name} · ${c.state === "expiree" ? "expirée le" : "expire le"} ${dayLabelShort(c.expiresOn, today)}`;
}

function staffInitial(p: Person): StaffFormValue {
  return {
    staffId: p.staffId,
    coachId: p.coachId,
    fullName: p.name,
    role: p.role,
    team: p.team,
    employment: p.employmentFrom === "fiche" && p.employment ? p.employment : "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    diplomas: p.diplomas ?? "",
    certifications: p.staffCerts.map((c) => ({ name: c.name, issuedOn: c.issued_on ?? "", expiresOn: c.expires_on ?? "" })),
    startedOn: p.startedOn ?? "",
    notes: p.notes ?? "",
    onField: p.onField,
    availableDays: p.daysFrom === "fiche" ? p.availableDays : [],
    rate: p.rateFrom === "fiche" ? toDollars(p.rateCents) : "",
    sortOrder: p.staffId ? p.sortOrder : null
  };
}
function staffHints(p: Person) {
  return {
    employment: p.employmentFrom && p.employmentFrom !== "fiche" && p.employment ? `${EMPLOYMENT_LABEL[p.employment]} (${SOURCE[p.employmentFrom]})` : null,
    days: p.daysFrom && p.daysFrom !== "fiche" && p.availableDays.length ? `${daysText(p.availableDays)} (${p.daysFrom === "portail" ? "d'après ses assignations" : "contrat"})` : null,
    rate: p.rateFrom && p.rateFrom !== "fiche" && p.rateCents !== null ? `${rate(p.rateCents)} (${SOURCE[p.rateFrom]})` : null
  };
}

function PersonRow({ p, today }: { p: Person; today: string }) {
  const coachHref = p.coachId ? `/admin/entraineurs/${p.coachId}` : null;
  return (
    <li id={`p-${p.key}`} className="mda-task" style={{ display: "block" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <p className="mda-task-title" style={{ fontWeight: 600 }}>
            {p.name}
            <span className="mda-muted" style={{ fontWeight: 400 }}> · {p.role || "Rôle à préciser"}</span>
          </p>
          <div className="mda-task-meta">
            {p.employment ? <Pill>{EMPLOYMENT_LABEL[p.employment]}</Pill> : <span>Statut à préciser</span>}
            {p.onField ? <span>Sur le terrain{p.availableDays.length ? ` : ${daysText(p.availableDays)}` : ""}</span> : null}
            {p.contract ? (
              <span style={{ color: p.contract.status === "signed" ? undefined : "var(--adm-warn)" }}>
                Contrat {p.contract.status === "signed" ? `signé${p.contract.signedAt ? ` le ${dayLabelShort(p.contract.signedAt, today)}` : ""}` : p.contract.status === "cancelled" ? "annulé" : "envoyé, pas signé"}
              </span>
            ) : p.team === "terrain" ? (
              <span>Aucun contrat</span>
            ) : null}
            {p.coachId ? (
              p.next30.count ? (
                <span>
                  {plural(p.next30.count, "séance")} d’ici 30 jours · {hoursLabel(p.next30.minutes)}
                  {p.next30.next ? ` · prochaine le ${dayLabelShort(p.next30.next, today)}` : ""}
                </span>
              ) : (
                <span>Aucune séance assignée d’ici 30 jours</span>
              )
            ) : null}
            {p.next30.outside ? <span>+ {p.next30.outside} hors Académie</span> : null}
            {p.phone ? (
              <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} style={{ color: "var(--adm-accent)" }}>
                {p.phone}
              </a>
            ) : null}
            {p.email ? (
              <a href={`mailto:${p.email}`} style={{ color: "var(--adm-text-3)" }}>
                {p.email}
              </a>
            ) : null}
          </div>
          {p.certifications.length ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {p.certifications.map((c, i) => (
                <span key={i} className="mda-pill" data-tone={certTone(c)} style={{ whiteSpace: "normal", lineHeight: 1.35 }}>
                  {certText(c, today)}
                </span>
              ))}
            </div>
          ) : null}
          {p.diplomas ? <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "var(--adm-text-2)" }}>Diplômes : {p.diplomas}</p> : null}
          {p.notes ? <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--adm-text-3)" }}>{p.notes}</p> : null}
        </div>
        {p.rateCents !== null ? (
          <div style={{ textAlign: "right", flexShrink: 0, whiteSpace: "nowrap" }}>
            <p className="mda-tnum" style={{ margin: 0, fontWeight: 600 }}>{rate(p.rateCents)}</p>
            <p style={{ margin: 0, fontSize: "0.74rem", color: "var(--adm-text-3)" }}>{p.rateFrom ? SOURCE[p.rateFrom] : ""}</p>
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
        <StaffEditor label="Modifier la fiche" initial={staffInitial(p)} hints={staffHints(p)} coachHref={coachHref} />
        {coachHref ? (
          <Link href={coachHref} className="mda-task-more">
            Fiche entraîneur et certifications
          </Link>
        ) : null}
        {p.contract ? (
          <Link href="/admin/contrats" className="mda-task-more">
            Contrat
          </Link>
        ) : null}
        {p.staffId && !p.coachId ? <StaffActiveButton staffId={p.staffId} active={p.active} name={p.name} /> : null}
      </div>
    </li>
  );
}

/** « Qui travaille avec nous, et qui dois-je recruter ? » : organigramme, diplômes et certifications, contrats,
 *  taux et assignations ; plan de recrutement calculé à partir des vrais groupes ; suivi des candidats. */
export default async function StructurePage() {
  await requireAdmin({ roles: ["admin"] });
  const s = await getStructure();
  const active = s.people.filter((p) => p.active);
  const inactive = s.people.filter((p) => !p.active);
  const onField = active.filter((p) => p.onField && p.team !== "a_venir");
  const team = active.filter((p) => p.team !== "a_venir");

  const certs = team.flatMap((p) => p.certifications);
  const expired = certs.filter((c) => c.state === "expiree").length;
  const soon = certs.filter((c) => c.state === "bientot").length;
  const missing = onField.reduce((n, p) => n + REQUIRED_ON_FIELD.filter((k) => !p.certifications.some((c) => c.kind === k)).length, 0);
  const certProblems = expired + soon + missing;

  const toFix = team
    .filter((p) => p.flags.length)
    .map((p) => ({ p, flags: [...p.flags].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]) }))
    .sort((a, b) => TONE_ORDER[a.flags[0].tone] - TONE_ORDER[b.flags[0].tone] || a.p.sortOrder - b.p.sortOrder);
  const uncovered = s.sessions30.filter((x) => !isCovered(x));
  const short = shortDays(s.plan);
  const shortFull = shortDays(s.plan, true);
  const openNeeds = s.needs.filter((n) => isOpenNeed(n.status));
  const closedNeeds = s.needs.filter((n) => !isOpenNeed(n.status));
  const openToRecruit = openNeeds.reduce((n, x) => n + x.headcount, 0);
  // Embauché : contrat signé et fiche entraîneur créée (même nom) ; rangé à part pour que le suivi ne s'allonge pas de saison en saison.
  const isHired = (c: (typeof s.candidates)[number]) => c.stage === "contrat" && s.people.some((p) => p.coachId && samePerson(p.name, c.fullName));
  const hired = s.candidates.filter(isHired);
  const liveCandidates = s.candidates.filter((c) => c.stage !== "refuse" && !isHired(c));
  const refused = s.candidates.filter((c) => c.stage === "refuse");
  const needOptions = openNeeds.map((n) => ({ id: n.id, position: n.position }));
  const onCallNames = [...new Set(s.plan.flatMap((d) => d.onCall))];

  const headline =
    s.recruits > 0
      ? `Il manque ${plural(s.recruits, "éducateur")} pour couvrir la semaine`
      : uncovered.length
        ? `${plural(uncovered.length, "séance")} sans 2 adultes prévus d'ici 30 jours`
        : "L'équipe couvre toutes les séances de la semaine";

  return (
    <div className="admin-content">
      <div className="admin-section mda">
        <header>
          <p className="mda-eyebrow">
            {s.seasonLabel} · {plural(s.weeklySessions, "séance")} par semaine · {plural(s.players, "inscription")} · {plural(team.length, "personne")} dans l’équipe
          </p>
          <h1 className="mda-h1">{headline}</h1>
          <p className="mda-lead">
            Règle : 1 adulte pour 10 joueuses, au moins 1 par groupe, jamais moins de 2 adultes par séance. L’équipe réunit les fiches entraîneurs, les contrats d’embauche et les fiches ajoutées ici ; les groupes viennent des inscriptions payées.
          </p>
        </header>

        <section className="mda-cols-4">
          <a href="#equipe" className="mda-card" style={{ textDecoration: "none" }}>
            <p className="mda-num">{team.length}</p>
            <p className="mda-label">Personnes dans l’équipe · {onField.length} sur le terrain</p>
          </a>
          <a href="#recrutement" className="mda-card" style={{ textDecoration: "none", boxShadow: s.recruits ? "inset 3px 0 0 var(--adm-warn)" : undefined }}>
            <p className="mda-num" style={{ color: s.recruits ? "var(--adm-warn)" : "var(--adm-good)" }}>{s.recruits}</p>
            <p className="mda-label">
              À recruter pour couvrir la semaine{s.recruitsFull !== s.recruits ? ` · ${s.recruitsFull} si les groupes se remplissent` : ""}
            </p>
          </a>
          <a href="#a-regler" className="mda-card" style={{ textDecoration: "none", boxShadow: expired ? "inset 3px 0 0 var(--adm-bad)" : certProblems ? "inset 3px 0 0 var(--adm-warn)" : undefined }}>
            <p className="mda-num" style={{ color: expired ? "var(--adm-bad)" : certProblems ? "var(--adm-warn)" : "var(--adm-good)" }}>{certProblems}</p>
            <p className="mda-label">
              Certifications à régler
              {certProblems ? ` · ${[expired ? `${expired} expirée${expired > 1 ? "s" : ""}` : "", soon ? `${soon} bientôt (60 j)` : "", missing ? `${missing} preuve${missing > 1 ? "s" : ""} manquante${missing > 1 ? "s" : ""}` : ""].filter(Boolean).join(", ")}` : ""}
            </p>
          </a>
          <a href="#seances" className="mda-card" style={{ textDecoration: "none", boxShadow: uncovered.length ? "inset 3px 0 0 var(--adm-warn)" : undefined }}>
            <p className="mda-num" style={{ color: uncovered.length ? "var(--adm-warn)" : "var(--adm-good)" }}>
              {uncovered.length}
              <span className="mda-muted" style={{ fontSize: "1rem", fontWeight: 500 }}> / {s.sessions30.length}</span>
            </p>
            <p className="mda-label">Séances d’ici 30 jours sans 2 adultes prévus</p>
          </a>
        </section>

        {toFix.length ? (
          <section id="a-regler" className="mda-card-flush">
            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2">À régler · {toFix.length} personne{toFix.length > 1 ? "s" : ""}</h2>
                <p className="mda-sub" style={{ margin: 0 }}>
                  Toute personne sur le terrain avec des enfants : antécédents judiciaires vérifiés et formation Sport sécuritaire au dossier. Une certification qui expire dans 30 jours apparaît aussi dans Aujourd’hui.
                </p>
              </div>
            </div>
            <ul className="mda-tasks">
              {toFix.map(({ p, flags }) => (
                <li key={p.key} className="mda-task" style={{ display: "block" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                    <a href={`#p-${p.key}`} className="mda-task-title" style={{ fontWeight: 600, textDecoration: "none" }}>
                      {p.name}
                    </a>
                    {p.coachId ? (
                      <Link href={`/admin/entraineurs/${p.coachId}`} className="mda-task-more">
                        Ajouter une preuve dans sa fiche
                      </Link>
                    ) : null}
                  </div>
                  <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "grid", gap: 4 }}>
                    {flags.map((f, i) => (
                      <li key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: "0.84rem", color: f.tone === "info" ? "var(--adm-text-2)" : "var(--adm-text)" }}>
                        <span className="mda-dot" style={{ background: TONE_COLOR[f.tone], transform: "translateY(-1px)" }} aria-hidden />
                        {f.text}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section id="equipe" className="mda-card-flush">
          <div className="mda-card-head">
            <div>
              <h2 className="mda-h2">Organigramme · {plural(team.length, "personne")}</h2>
              <p className="mda-sub" style={{ margin: 0 }}>
                Le statut, le taux et les jours viennent du contrat, sinon de la fiche entraîneur ; ce qui est inscrit dans « Modifier la fiche » a le dernier mot.
              </p>
            </div>
            <StaffEditor label="Ajouter une personne" initial={EMPTY_STAFF} />
          </div>
          {TEAMS.map((t) => {
            const members = active.filter((p) => p.team === t);
            return (
              <div key={t}>
                {members.length ? (
                  <>
                    <p className="mda-group-title" style={{ margin: 0 }}>
                      {TEAM_LABEL[t]} · {members.length}
                    </p>
                    <ul className="mda-tasks">
                      {members.map((p) => (
                        <PersonRow key={p.key} p={p} today={s.today} />
                      ))}
                    </ul>
                  </>
                ) : null}
                {t === "terrain" ? (
                  <>
                    <p className="mda-group-title" style={{ margin: 0 }}>
                      Arbitres · {s.referees.active} actif{s.referees.active > 1 ? "s" : ""}
                      {s.referees.pending ? ` · ${s.referees.pending} à approuver` : ""}
                    </p>
                    <div className="mda-task" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                      <div className="mda-task-meta" style={{ marginTop: 0 }}>
                        {s.referees.names.length ? (
                          s.referees.names.map((r) => (
                            <span key={r.name} style={{ color: "var(--adm-text-2)" }}>
                              {r.name}
                              {r.level ? ` (${r.level})` : ""}
                            </span>
                          ))
                        ) : (
                          <span>Aucun arbitre actif.</span>
                        )}
                      </div>
                      <Link href="/admin/arbitres" className="mda-task-more">
                        Arbitres et bilan des matchs
                      </Link>
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
          {inactive.length ? (
            <details style={{ borderTop: "1px solid var(--adm-line)" }}>
              <summary style={{ cursor: "pointer", padding: "12px 20px", fontSize: "0.82rem", color: "var(--adm-text-3)" }}>Anciens et inactifs · {inactive.length}</summary>
              <ul className="mda-tasks">
                {inactive.map((p) => (
                  <PersonRow key={p.key} p={p} today={s.today} />
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        <section id="recrutement" className="mda-card-flush">
          <div className="mda-card-head">
            <div>
              <h2 className="mda-h2">Plan de recrutement · {s.seasonLabel}</h2>
              <p className="mda-sub" style={{ margin: 0 }}>
                Chaque jour : adultes requis en même temps (les séances qui se chevauchent à des endroits différents s’additionnent) contre l’équipe prévue ce jour-là. Une même recrue peut couvrir plusieurs jours.
              </p>
            </div>
          </div>
          <div className="mda-scroll">
            <table className="mda-table" style={{ minWidth: 360 }}>
              <thead>
                <tr>
                  <th>Jour</th>
                  <th className="r">Inscrits</th>
                  <th className="r">Requis</th>
                  <th className="r">Manque</th>
                  <th>Équipe prévue</th>
                </tr>
              </thead>
              <tbody>
                {s.plan.map((d) => {
                  const players = d.blocks.reduce((n, b) => n + b.players, 0);
                  const capacity = d.blocks.reduce((n, b) => n + b.capacity, 0);
                  return (
                    <tr key={d.day}>
                      <td style={{ fontWeight: 600 }}>
                        {WEEKDAY_LABEL[d.day]}
                        <span className="mda-muted" style={{ display: "block", fontSize: "0.75rem", fontWeight: 400 }}>
                          {plural(d.blocks.length, "séance")}
                        </span>
                      </td>
                      <td className="r" style={{ whiteSpace: "nowrap" }}>
                        {players}
                        <span className="mda-muted"> / {capacity}</span>
                      </td>
                      <td className="r" title="Adultes requis en même temps (si les groupes se remplissent, entre parenthèses)" style={{ whiteSpace: "nowrap" }}>
                        {d.need}
                        {d.needFull !== d.need ? <span className="mda-muted"> ({d.needFull})</span> : null}
                      </td>
                      <td className="r" style={{ fontWeight: 700, color: d.gap ? "var(--adm-warn)" : "var(--adm-good)" }}>
                        {d.gap ? `−${d.gap}` : "✓"}
                        {d.gapFull > d.gap ? <span className="mda-muted" style={{ display: "block", fontSize: "0.75rem", fontWeight: 400 }}>−{d.gapFull} si plein</span> : null}
                      </td>
                      <td>{d.team.length ? d.team.join(", ") : <span className="mda-muted">Personne</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "16px 20px", borderTop: "1px solid var(--adm-line)", display: "grid", gap: 8 }}>
            <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.5 }}>
              {s.recruits ? (
                <>
                  <strong>À recruter : au moins {plural(s.recruits, "personne")}</strong> sur le terrain ({daysLong(short)}), soit {hoursLabel(s.uncoveredMinutes)} par semaine que l’équipe actuelle ne couvre pas (arrivée 30 min avant comprise).
                </>
              ) : (
                <strong>L’équipe prévue couvre chaque jour de la semaine.</strong>
              )}
              {s.recruitsFull > s.recruits ? ` Si tous les groupes se remplissent : ${plural(s.recruitsFull, "personne")} (${daysLong(shortFull)}).` : ""}
            </p>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--adm-text-3)" }}>
              Requis entre parenthèses : si tous les groupes se remplissent. {onCallNames.length ? `Sur appel, pas comptée${onCallNames.length > 1 ? "s" : ""} : ${onCallNames.join(", ")} (comble un trou, ne remplace pas un poste). ` : ""}Les jours de chacun se règlent dans « Modifier la fiche ».
            </p>
            <details>
              <summary style={{ cursor: "pointer", fontSize: "0.82rem", color: "var(--adm-text-3)" }}>Voir les séances de chaque jour</summary>
              <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 6 }}>
                {s.blocks.map((b) => (
                  <li key={b.key} style={{ fontSize: "0.82rem", color: b.need ? "var(--adm-text-2)" : "var(--adm-text-3)" }}>
                    <span style={{ color: "var(--adm-text)" }}>
                      {WEEKDAY_SHORT[b.day]} {timeLabel(b.start)} à {timeLabel(b.end)}
                    </span>{" "}
                    · {shortPlace(b.location)} · {b.groups.map((g) => `${g.label} (${g.players}${g.capacity ? `/${g.capacity}` : ""})`).join(" + ")} · {b.need ? plural(b.need, "adulte") : "aucune inscription"}
                    {b.until ? ` · jusqu'au ${dayLabelShort(b.until, s.today)}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          </div>

          <p className="mda-group-title" style={{ margin: 0 }}>
            Postes à combler · {openNeeds.length ? `${plural(openToRecruit, "personne")} à trouver` : "aucun ouvert"}
          </p>
          {openNeeds.length ? (
            <ul className="mda-tasks">
              {openNeeds.map((n) => {
                const cands = s.candidates.filter((c) => c.needId === n.id && c.stage !== "refuse");
                const late = n.dueOn && n.dueOn < s.today;
                return (
                  <li key={n.id} className="mda-task" style={{ display: "block" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                        <p className="mda-task-title" style={{ fontWeight: 600 }}>
                          {n.headcount > 1 ? `${n.headcount} × ` : ""}
                          {n.position}
                        </p>
                        <div className="mda-task-meta">
                          <span>{EMPLOYMENT_LABEL[n.employment]}</span>
                          {n.dueOn ? <span className={late ? "mda-late" : undefined}>À combler avant le {dayLabelShort(n.dueOn, s.today)}</span> : null}
                          {n.season ? <span>{n.season}</span> : null}
                          <span>{cands.length ? `${plural(cands.length, "candidat")} en cours` : "Aucun candidat"}</span>
                        </div>
                        {n.notes ? <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "var(--adm-text-3)" }}>{n.notes}</p> : null}
                      </div>
                      <NeedStatusSelect id={n.id} status={n.status} />
                    </div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                      <NeedEditor label="Modifier" initial={{ id: n.id, position: n.position, employment: n.employment, headcount: n.headcount, dueOn: n.dueOn ?? "", status: n.status, season: n.season ?? "", notes: n.notes ?? "" }} />
                      <DeleteNeedButton id={n.id} position={n.position} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <div style={{ padding: "12px 20px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", borderTop: openNeeds.length ? "1px solid var(--adm-line)" : undefined }}>
            {s.recruits > openToRecruit ? (
              <NeedEditor
                primary
                label={`Ouvrir le poste calculé : ${plural(s.recruits - openToRecruit, "éducateur")}`}
                initial={{
                  id: null,
                  position: `Éducateur ou éducatrice (${daysLong(short)})`,
                  employment: "temps_partiel",
                  headcount: Math.min(50, s.recruits - openToRecruit),
                  dueOn: nextRecruitDue(s.today),
                  status: "a_ouvrir",
                  season: s.seasonLabel.replace(/^Saison\s+/i, ""),
                  notes: "Antécédents judiciaires et formation Sport sécuritaire obligatoires avant la première séance."
                }}
              />
            ) : null}
            <NeedEditor label="Ajouter un poste" initial={{ id: null, position: "", employment: "temps_partiel", headcount: 1, dueOn: nextRecruitDue(s.today), status: "a_ouvrir", season: "", notes: "" }} />
            {closedNeeds.length ? (
              <span style={{ fontSize: "0.8rem", color: "var(--adm-text-3)" }}>
                {closedNeeds.map((n) => `${n.position} (${NEED_STATUS_LABEL[n.status].toLowerCase()})`).join(" · ")}
              </span>
            ) : null}
          </div>
        </section>

        <section className="mda-card">
          <h2 className="mda-h2">Et si j’ajoute des groupes ?</h2>
          <p className="mda-sub">Combien d’éducateurs de plus il faudrait, et ce qu’il reste une fois les éducateurs et le terrain payés. Les valeurs de départ viennent de la saison en cours.</p>
          <GrowthScenario plan={s.plan} teamByDay={s.teamByDay} defaults={s.defaults} />
        </section>

        <section id="seances" className="mda-card-flush">
          <div className="mda-card-head">
            <div>
              <h2 className="mda-h2">Séances des 30 prochains jours · {uncovered.length ? `${uncovered.length} à compléter` : "toutes couvertes"}</h2>
              <p className="mda-sub" style={{ margin: 0 }}>
                Adultes prévus = éducateurs assignés dans Entraînements + équipe qui travaille ce jour-là. Assigner chaque éducateur dans Entraînements sert aussi à sa paie et à ses rapports.
              </p>
            </div>
            <Link href="/admin/entraineurs/activites" className="mda-task-more">
              Entraînements
            </Link>
          </div>
          {uncovered.length ? (
            <ul className="mda-tasks">
              {uncovered.slice(0, 15).map((x) => (
                <li key={`${x.date}-${x.start}-${x.location}`} className="mda-task" style={{ justifyContent: "space-between", flexWrap: "wrap", boxShadow: x.expected === 0 ? "inset 3px 0 0 var(--adm-bad)" : "inset 3px 0 0 var(--adm-warn)" }}>
                  <div style={{ minWidth: 0 }}>
                    <p className="mda-task-title" style={{ fontWeight: 600 }}>
                      {WEEKDAY_SHORT[weekdayOfIso(x.date)]} {dayLabelShort(x.date, s.today)} · {timeLabel(x.start)} · {x.groups || "Groupe"}
                    </p>
                    <div className="mda-task-meta">
                      <span>{shortPlace(x.location)}</span>
                      <span>{x.assigned ? plural(x.assigned, "éducateur assigné", "éducateurs assignés") : "Aucun éducateur assigné dans Entraînements"}</span>
                    </div>
                  </div>
                  <span className="mda-tnum" style={{ fontSize: "0.88rem", fontWeight: 600, color: x.expected === 0 ? "var(--adm-bad)" : "var(--adm-warn)" }}>
                    {x.expected} / {x.need} adultes
                  </span>
                </li>
              ))}
              {uncovered.length > 15 ? <li className="mda-task mda-muted" style={{ fontSize: "0.82rem" }}>+ {uncovered.length - 15} autres séances à compléter</li> : null}
            </ul>
          ) : (
            <p style={{ padding: "16px 20px", margin: 0, color: "var(--adm-text-3)" }}>
              {s.sessions30.length ? "Chaque séance des 30 prochains jours a au moins 2 adultes prévus." : "Aucune séance avec des inscrites dans les 30 prochains jours."}
            </p>
          )}
        </section>

        <section id="candidats" className="mda-card-flush">
          <div className="mda-card-head">
            <div>
              <h2 className="mda-h2">Candidats · {liveCandidates.length} en cours</h2>
              <p className="mda-sub" style={{ margin: 0 }}>Chaque personne avance d’une étape à la fois, jusqu’au contrat signé. Un poste est marqué comblé dès que ses candidats ont signé.</p>
            </div>
            <CandidateEditor label="Ajouter un candidat" initial={EMPTY_CANDIDATE} needs={needOptions} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 1, background: "var(--adm-line)", borderBottom: "1px solid var(--adm-line)" }}>
            {PIPELINE.map((st) => {
              const n = liveCandidates.filter((c) => c.stage === st).length;
              return (
                <div key={st} style={{ background: "var(--adm-surface)", padding: "12px 14px" }}>
                  <p className="mda-tnum" style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, color: n ? "var(--adm-text)" : "var(--adm-text-3)" }}>{n}</p>
                  <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--adm-text-3)" }}>{STAGE_LABEL[st]}</p>
                </div>
              );
            })}
          </div>
          {liveCandidates.length ? (
            PIPELINE.map((st) => {
              const list = liveCandidates.filter((c) => c.stage === st);
              if (!list.length) return null;
              return (
                <div key={st}>
                  <p className="mda-group-title" style={{ margin: 0 }}>
                    {STAGE_LABEL[st]} · {list.length}
                    <span style={{ fontWeight: 400, color: "var(--adm-text-3)" }}> — {STAGE_HINT[st]}</span>
                  </p>
                  <ul className="mda-tasks">
                    {list.map((c) => {
                      const since = c.stageDates[c.stage] ?? c.createdOn;
                      return (
                        <li key={c.id} className="mda-task" style={{ display: "block" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                              <p className="mda-task-title" style={{ fontWeight: 600 }}>
                                {c.fullName}
                                <span className="mda-muted" style={{ fontWeight: 400 }}> · {c.position}</span>
                              </p>
                              <div className="mda-task-meta">
                                {c.phone ? (
                                  <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} style={{ color: "var(--adm-accent)" }}>
                                    {c.phone}
                                  </a>
                                ) : null}
                                {c.email ? (
                                  <a href={`mailto:${c.email}`} style={{ color: "var(--adm-text-3)" }}>
                                    {c.email}
                                  </a>
                                ) : null}
                                <span>Depuis le {dayLabelShort(since, s.today)}</span>
                                {c.interviewOn ? <span style={{ color: c.interviewOn >= s.today ? "var(--adm-accent)" : undefined }}>Entrevue le {dayLabelShort(c.interviewOn, s.today)}</span> : null}
                                {c.stage === "contrat" ? (
                                  <>
                                    <Link href="/admin/contrats" className="mda-task-more">
                                      Contrats
                                    </Link>
                                    <Link href="/admin/entraineurs" className="mda-task-more">
                                      Créer sa fiche entraîneur
                                    </Link>
                                  </>
                                ) : null}
                              </div>
                              {c.notes ? <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "var(--adm-text-3)" }}>{c.notes}</p> : null}
                            </div>
                            <CandidateActions id={c.id} name={c.fullName} stage={c.stage} />
                          </div>
                          <div style={{ marginTop: 6 }}>
                            <CandidateEditor
                              label="Modifier"
                              needs={needOptions.some((n) => n.id === c.needId) || !c.needId ? needOptions : [...needOptions, { id: c.needId, position: c.position }]}
                              initial={{ id: c.id, needId: c.needId ?? "", position: c.position, fullName: c.fullName, email: c.email ?? "", phone: c.phone ?? "", stage: c.stage, interviewOn: c.interviewOn ?? "", notes: c.notes ?? "" }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          ) : (
            <p style={{ padding: "16px 20px", margin: 0, color: "var(--adm-text-3)" }}>Aucun candidat pour l’instant. Ajoutez la première personne approchée ou qui a postulé ; elle avancera ensuite d’une étape à la fois.</p>
          )}
          {hired.length ? (
            <details style={{ borderTop: "1px solid var(--adm-line)" }}>
              <summary style={{ cursor: "pointer", padding: "12px 20px", fontSize: "0.82rem", color: "var(--adm-text-3)" }}>Embauchés · {hired.length} (contrat signé, fiche entraîneur créée)</summary>
              <ul className="mda-tasks">
                {hired.map((c) => (
                  <li key={c.id} className="mda-task" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                    <p className="mda-task-title">
                      {c.fullName} <span className="mda-muted">· {c.position}</span>
                    </p>
                    <span style={{ fontSize: "0.8rem", color: "var(--adm-text-3)" }}>Contrat signé le {dayLabelShort(c.stageDates.contrat ?? c.createdOn, s.today)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {refused.length ? (
            <details style={{ borderTop: "1px solid var(--adm-line)" }}>
              <summary style={{ cursor: "pointer", padding: "12px 20px", fontSize: "0.82rem", color: "var(--adm-text-3)" }}>Candidatures refusées · {refused.length} (à effacer quand elles ne servent plus, Loi 25)</summary>
              <ul className="mda-tasks">
                {refused.map((c) => (
                  <li key={c.id} className="mda-task" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                    <p className="mda-task-title">
                      {c.fullName} <span className="mda-muted">· {c.position}</span>
                    </p>
                    <CandidateActions id={c.id} name={c.fullName} stage={c.stage} />
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        <p className="mda-sub" style={{ margin: 0 }}>
          Données RH : visibles par l’administrateur seulement. Les certifications des éducateurs ({Object.values(CERT_KIND_LABEL).slice(0, 4).join(", ").toLowerCase()}) se gèrent dans leur fiche entraîneur ; celles des autres personnes, dans « Modifier la fiche ».
        </p>
      </div>
    </div>
  );
}
