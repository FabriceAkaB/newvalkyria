import Link from "next/link";
import { Check, ChevronRight, Minus, X } from "lucide-react";

import { wantsLabel } from "@/lib/practice-survey";
import type { BlockSummary, HelperRank, ResultRow } from "@/lib/practice-survey-results-core";
import type { SurveyBlock } from "@/lib/practice-survey-results-repo";

/** Résultats du sondage des filles, partagés par l'admin et le portail des éducateurs (JP, 25 nov. 2026) :
 *  classement des éducateurs, résumé, réponses individuelles, filtre de période. Jetons --adm-*, Lucide, sans émoji. */

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export const surveyDayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  const day = DAYS[d.getUTCDay()];
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const shortDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const hour = (t: string) => t.replace(":", " h ");
const fr = (n: number | null) => (n === null ? "—" : n.toLocaleString("fr-CA", { maximumFractionDigits: 1 }));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

const muted: React.CSSProperties = { margin: 0, color: "var(--adm-text-2)", fontSize: "0.875rem" };
const num: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

/** Le classement : qui a aidé ou encouragé le plus de filles (rang, nom, nombre, part du groupe). */
export function HelperRanking({ ranking, viewerId, period = false, limit }: { ranking: HelperRank[]; viewerId?: string; period?: boolean; limit?: number }) {
  if (!ranking.length) return <p style={muted}>Pas encore d&apos;éducateur sur le terrain ni de réponse à « Ta coach t&apos;a-t-elle aidée ou encouragée ? ».</p>;
  const top = Math.max(1, ...ranking.map((r) => r.helped));
  const list = limit ? ranking.slice(0, limit) : ranking;
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
      {list.map((r) => {
        const me = viewerId === r.coachId;
        const first = r.rank === 1 && r.helped > 0;
        return (
          <li
            key={r.coachId}
            style={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr) auto", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: "var(--adm-radius-sm)", background: me ? "var(--adm-accent-soft)" : undefined }}
            aria-label={`Rang ${r.rank} : ${r.name}, ${plural(r.helped, "fille")}`}
          >
            <span
              style={{ ...num, display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: "50%", fontSize: "0.8125rem", fontWeight: 600, background: first ? "var(--adm-accent-strong)" : "var(--adm-surface-2)", color: first ? "var(--adm-on-accent)" : "var(--adm-text-2)" }}
            >
              {r.rank}
            </span>
            <span style={{ minWidth: 0, display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600, color: "var(--adm-text)", fontSize: "0.9375rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.name}
                {me ? <span style={{ fontWeight: 500, color: "var(--adm-accent)", fontSize: "0.8125rem" }}> · toi</span> : null}
                {r.tied && r.helped > 0 ? <span style={{ fontWeight: 400, color: "var(--adm-text-3)", fontSize: "0.75rem" }}> · égalité</span> : null}
                {period ? <span style={{ fontWeight: 400, color: "var(--adm-text-3)", fontSize: "0.75rem" }}> · {plural(r.practices, "pratique")}</span> : null}
              </span>
              <span aria-hidden style={{ height: 6, borderRadius: 999, background: "var(--adm-surface-3)", overflow: "hidden", maxWidth: 420 }}>
                <span style={{ display: "block", height: "100%", width: `${(r.helped / top) * 100}%`, borderRadius: 999, background: "var(--adm-series-1)" }} />
              </span>
            </span>
            <span style={{ ...num, textAlign: "right", whiteSpace: "nowrap" }}>
              <strong style={{ color: "var(--adm-text)", fontSize: "0.9375rem" }}>{plural(r.helped, "fille")}</strong>
              <small style={{ display: "block", color: "var(--adm-text-3)", fontSize: "0.75rem" }}>{r.pct === null ? "—" : `${r.pct} % ${period ? "des réponses" : "du groupe"}`}</small>
            </span>
          </li>
        );
      })}
      {limit && ranking.length > limit ? <li style={{ ...muted, fontSize: "0.8125rem", padding: "2px 10px" }}>et {plural(ranking.length - limit, "autre")}</li> : null}
    </ol>
  );
}

/** Les chiffres d'une pratique ou d'une période, en tuiles. */
export function SummaryTiles({ summary }: { summary: BlockSummary }) {
  const tiles: { value: string; label: string; detail: string }[] = [
    { value: String(summary.respondents), label: "Filles qui ont répondu", detail: "sur la borne" },
    { value: fr(summary.pleasure), label: "Plaisir moyen", detail: "sur 10" },
    { value: fr(summary.fatigue), label: "Fatigue moyenne", detail: "1 = pleine d'énergie, 10 = épuisée" },
    { value: summary.coachHelp.pct === null ? "—" : `${summary.coachHelp.pct} %`, label: "Aidées ou encouragées par une coach", detail: summary.coachHelp.answered ? `${summary.coachHelp.yes} sur ${summary.coachHelp.answered}` : "pas de réponse" },
    { value: summary.peerHelp.pct === null ? "—" : `${summary.peerHelp.pct} %`, label: "Aidées par une autre fille", detail: summary.peerHelp.answered ? `${summary.peerHelp.yes} sur ${summary.peerHelp.answered}` : "pas de réponse" },
    { value: summary.theme.pct === null ? "—" : `${summary.theme.pct} %`, label: "Ont compris le thème", detail: summary.theme.answered ? `${summary.theme.understood} sur ${summary.theme.answered}` : "question pas posée" }
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
      {tiles.map((t) => (
        <div key={t.label} className="mda-card" style={{ padding: 16, display: "grid", gap: 2, alignContent: "start" }}>
          <span style={{ ...num, fontSize: "1.5rem", fontWeight: 600, color: "var(--adm-text)", letterSpacing: "-0.01em" }}>{t.value}</span>
          <span style={{ fontSize: "0.8125rem", color: "var(--adm-text)", fontWeight: 500 }}>{t.label}</span>
          <span style={{ fontSize: "0.75rem", color: "var(--adm-text-3)" }}>{t.detail}</span>
        </div>
      ))}
    </div>
  );
}

const YesNo = ({ value, names }: { value: boolean | null; names: string[] }) =>
  value === true ? (
    <span style={{ color: "var(--adm-text)" }}>
      Oui{names.length ? <span style={{ color: "var(--adm-text-2)" }}> · {names.join(", ")}</span> : null}
    </span>
  ) : value === false ? (
    <span style={{ color: "var(--adm-text-2)" }}>Non</span>
  ) : (
    <span style={{ color: "var(--adm-text-3)" }}>—</span>
  );

/** La réponse de chaque fille, une ligne par fille. */
export function ResponsesTable({ rows, coachNames, girlNames }: { rows: ResultRow[]; coachNames: Map<string, string>; girlNames: Map<string, string> }) {
  if (!rows.length) return <p style={muted}>Aucune réponse pour cette pratique.</p>;
  const anyTheme = rows.some((r) => r.themeCorrect !== null);
  const anyWants = rows.some((r) => r.wantsMore.length > 0);
  return (
    <div className="mda-scroll">
      <table className="mda-table" style={{ minWidth: 640 }}>
        <thead>
          <tr>
            <th>Joueuse</th>
            <th className="r">Plaisir</th>
            <th className="r">Fatigue</th>
            <th>Aidée par une coach</th>
            <th>Aidée par une amie</th>
            {anyTheme ? <th>Thème</th> : null}
            {anyWants ? <th>Veut plus de</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.registrationId}>
              <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{r.name}</td>
              <td className="r" style={{ color: r.practiceRating !== null && r.practiceRating <= 4 ? "var(--adm-bad)" : undefined, fontWeight: r.practiceRating !== null && r.practiceRating <= 4 ? 600 : undefined }}>{r.practiceRating ?? "—"}</td>
              <td className="r" style={{ color: r.fatigue !== null && r.fatigue >= 9 ? "var(--adm-warn)" : undefined, fontWeight: r.fatigue !== null && r.fatigue >= 9 ? 600 : undefined }}>{r.fatigue ?? "—"}</td>
              <td><YesNo value={r.coachHelped} names={r.coachHelpers.map((id) => coachNames.get(id) ?? "Éducateur")} /></td>
              <td><YesNo value={r.peerHelped} names={r.peerHelpers.map((id) => girlNames.get(id)).filter((n): n is string => Boolean(n))} /></td>
              {anyTheme ? (
                <td>
                  {r.themeCorrect === true ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--adm-good)", fontWeight: 500 }}><Check size={15} strokeWidth={1.75} aria-hidden />Compris</span>
                  ) : r.themeCorrect === false ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--adm-bad)", fontWeight: 500 }} title={r.themeAnswer ? `A choisi : ${r.themeAnswer}` : undefined}>
                      <X size={15} strokeWidth={1.75} aria-hidden />Pas compris{r.themeAnswer ? <span style={{ color: "var(--adm-text-3)", fontWeight: 400 }}> · {r.themeAnswer}</span> : null}
                    </span>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", color: "var(--adm-text-3)" }}><Minus size={15} strokeWidth={1.75} aria-label="Pas répondu" /></span>
                  )}
                </td>
              ) : null}
              {anyWants ? <td style={{ color: "var(--adm-text-2)" }}>{r.wantsMore.map(wantsLabel).join(", ") || "—"}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Une pratique dans la liste : le podium et les chiffres clés, lien vers le détail. */
export function SurveyBlockRow({ block, href, viewerId }: { block: SurveyBlock; href: string; viewerId?: string }) {
  const s = block.summary;
  const podium = block.ranking.filter((r) => r.helped > 0).slice(0, 3);
  return (
    <li style={{ borderTop: "1px solid var(--adm-line)" }}>
      <Link href={href} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: "14px 20px", textDecoration: "none", color: "inherit" }}>
        <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: "var(--adm-text)" }}>
            {surveyDayLabel(block.date)} · {hour(block.start)} · {block.label}
          </span>
          <span style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: "0.8125rem", color: "var(--adm-text-2)", ...num }}>
            <span>{plural(s.respondents, "réponse")}</span>
            <span>Plaisir {fr(s.pleasure)}</span>
            <span>Fatigue {fr(s.fatigue)}</span>
            {s.coachHelp.pct !== null ? <span>Aidées par une coach {s.coachHelp.pct} %</span> : null}
            {s.theme.pct !== null ? <span>Thème compris {s.theme.pct} %</span> : null}
          </span>
          <span style={{ fontSize: "0.8125rem", color: "var(--adm-text-3)" }}>
            {podium.length ? (
              podium.map((r, i) => (
                <span key={r.coachId} style={{ color: viewerId === r.coachId ? "var(--adm-accent)" : undefined }}>
                  {i ? " · " : ""}
                  {r.rank}. {r.name} ({r.helped})
                </span>
              ))
            ) : (
              <span>{s.coachHelp.answered ? "Personne n'a nommé d'éducateur" : "Question de la coach pas posée à cette pratique"}</span>
            )}
          </span>
        </span>
        <ChevronRight size={18} strokeWidth={1.75} aria-hidden style={{ color: "var(--adm-text-3)" }} />
      </Link>
    </li>
  );
}

/** Le filtre : 7 jours, 4 semaines, 10 semaines, ou des dates ; un groupe. Formulaire GET, sans JavaScript. */
export function SurveyPeriodFilter({ action, from, to, days, groups, group }: { action: string; from: string; to: string; days: number | null; groups: string[]; group: string | null }) {
  const q = (d: number) => `${action}?jours=${d}${group ? `&groupe=${encodeURIComponent(group)}` : ""}`;
  return (
    <form method="get" action={action} style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 12 }}>
      <div className="admin-tabs" style={{ margin: 0, padding: 0 }} role="group" aria-label="Période">
        {[
          [7, "7 jours"],
          [28, "4 semaines"],
          [70, "10 semaines"]
        ].map(([d, label]) => (
          <Link key={d} href={q(d as number)} className="admin-tab" data-active={String(days === d)} style={{ textDecoration: "none" }}>
            {label}
          </Link>
        ))}
      </div>
      <label style={{ display: "grid", gap: 4, fontSize: "0.75rem", color: "var(--adm-text-3)" }}>
        Du
        <input type="date" name="du" defaultValue={from} className="admin-input" style={{ minHeight: 40 }} />
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: "0.75rem", color: "var(--adm-text-3)" }}>
        Au
        <input type="date" name="au" defaultValue={to} className="admin-input" style={{ minHeight: 40 }} />
      </label>
      {groups.length > 1 ? (
        <label style={{ display: "grid", gap: 4, fontSize: "0.75rem", color: "var(--adm-text-3)" }}>
          Groupe
          <select name="groupe" defaultValue={group ?? ""} className="admin-input" style={{ minHeight: 40 }}>
            <option value="">Tous les groupes</option>
            {groups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
      ) : null}
      <button type="submit" className="admin-btn-ghost" style={{ minHeight: 40 }}>Afficher</button>
      <span style={{ fontSize: "0.75rem", color: "var(--adm-text-3)", alignSelf: "center" }}>
        {shortDay(from)} au {shortDay(to)}
      </span>
    </form>
  );
}

/** Le résultat d'une pratique, dans l'ordre demandé par JP : classement, résumé, puis chaque fille. */
export function SurveyBlockDetail({ block, coachNames, girlNames, viewerId, children }: { block: SurveyBlock; coachNames: Map<string, string>; girlNames: Map<string, string>; viewerId?: string; children?: React.ReactNode }) {
  const s = block.summary;
  return (
    <>
      <section className="mda-card" style={{ display: "grid", gap: 12 }}>
        <div>
          <h2 className="mda-h2" style={{ margin: 0 }}>Qui a aidé ou encouragé le plus de filles</h2>
          <p style={{ ...muted, marginTop: 4 }}>
            Le nombre de filles qui ont nommé chaque éducateur à « Ta coach t&apos;a-t-elle aidée ou encouragée ? »
            {s.coachHelp.answered ? `, sur ${s.coachHelp.answered} qui ont répondu à la question.` : "."}
          </p>
        </div>
        {s.coachHelp.answered || block.ranking.some((r) => r.helped > 0) ? (
          <HelperRanking ranking={block.ranking} viewerId={viewerId} />
        ) : (
          <p style={muted}>La question n&apos;a pas été posée à cette pratique (la borne la pose depuis le 20 novembre 2026).</p>
        )}
      </section>
      <section style={{ display: "grid", gap: 12 }}>
        <h2 className="mda-h2" style={{ margin: 0 }}>Le résumé</h2>
        <SummaryTiles summary={s} />
        {block.theme ? <p style={muted}>Thème de la semaine : <strong style={{ color: "var(--adm-text)" }}>{block.theme}</strong></p> : null}
        {s.wants.length ? <p style={muted}>Elles veulent plus de : <span style={{ color: "var(--adm-text)" }}>{s.wants.slice(0, 5).map((w) => `${w.label} (${w.count})`).join(" · ")}</span></p> : null}
      </section>
      {children}
      <section className="mda-card-flush">
        <div className="mda-card-head">
          <h2 className="mda-h2">La réponse de chaque fille</h2>
        </div>
        <div style={{ padding: "0 8px 8px" }}>
          <ResponsesTable rows={block.rows} coachNames={coachNames} girlNames={girlNames} />
        </div>
      </section>
    </>
  );
}
