import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { Crest, LessonsView } from "@/components/match-results-admin";
import { requireAdmin } from "@/lib/admin-auth";
import {
  OUTCOME_LABEL,
  OUTCOME_TONE,
  dayNumber,
  hasScore,
  matchDayLabel,
  missingFor,
  monthShort,
  outcomeOf,
  phaseOf,
  recordHeadline,
  seasonLabel,
  seasonRange,
  seasonRecord,
  seasonStartYear,
  shortPlace,
  timeLabel,
  type MatchCard
} from "@/lib/match-results-core";
import { getRecentLessons, inScope, listMatchCards, type MatchScope } from "@/lib/match-results";

export const metadata = { title: "Nos matchs — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

function TeamLine({ name, logo, ours, score, bold }: { name: string; logo?: string | null; ours?: boolean; score: number | null; bold: boolean }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <Crest name={name} logo={logo} ours={ours} size={24} />
      <span style={{ flex: 1, minWidth: 0, fontSize: "0.95rem", fontWeight: bold ? 700 : 500, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      {score !== null ? <span style={{ fontSize: "1.05rem", fontWeight: bold ? 700 : 500, color: bold ? "var(--adm-text)" : "var(--adm-text-2)", fontVariantNumeric: "tabular-nums", minWidth: 20, textAlign: "right" }}>{score}</span> : null}
    </span>
  );
}

function MatchRow({ m, today }: { m: MatchCard; today: string }) {
  const phase = phaseOf(m, today);
  const outcome = outcomeOf(m.scoreUs, m.scoreThem);
  const miss = missingFor(m, today);
  const opp = m.opponent ?? "Adversaire à confirmer";
  const scored = hasScore(m);
  return (
    <li>
      <Link
        href={`/admin/matchs/resultats/${m.id}`}
        style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 20px", textDecoration: "none", color: "inherit", borderTop: "1px solid var(--adm-line)" }}
      >
        <span style={{ width: 36, textAlign: "center", flexShrink: 0, paddingTop: 2 }}>
          <span style={{ display: "block", fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{dayNumber(m.date)}</span>
          <span style={{ display: "block", fontSize: "0.72rem", color: "var(--adm-text-3)" }}>{monthShort(m.date)}</span>
        </span>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <TeamLine name={m.ourName} ours score={scored ? m.scoreUs : null} bold={outcome === "V"} />
          <TeamLine name={opp} logo={m.opponentLogo} score={scored ? m.scoreThem : null} bold={outcome === "D"} />
          <span style={{ fontSize: "0.8rem", color: "var(--adm-text-3)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px", marginTop: 2 }}>
            {phase === "annule" ? <Pill>Annulé</Pill> : outcome ? <Pill tone={OUTCOME_TONE[outcome]}>{OUTCOME_LABEL[outcome]}</Pill> : phase === "aujourdhui" ? <Pill tone="accent">Aujourd&apos;hui</Pill> : phase === "a_venir" ? <Pill>À venir</Pill> : null}
            {m.start ? <span>{timeLabel(m.start)}</span> : null}
            {m.category ? <span>{m.category}</span> : null}
            {shortPlace(m.location) ? <span>{shortPlace(m.location)}</span> : null}
            {m.homeAway === "away" ? <span>à l&apos;extérieur</span> : null}
            {miss.length ? <span style={{ color: "var(--adm-warn)" }}>Manque : {miss.join(", ")}</span> : null}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** « Comment vont nos matchs cette saison, et qu'est-ce qu'on doit travailler en pratique ? » */
export default async function OurMatchesPage({ searchParams }: { searchParams: Promise<{ vue?: string; saison?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const current = seasonStartYear(today);
  const season = /^\d{4}$/.test(sp.saison ?? "") ? Number(sp.saison) : current;
  const scope: MatchScope = sp.vue === "hors" ? "hors" : "academie";
  const { from, to } = seasonRange(season);

  const all = await listMatchCards();
  const inSeason = all.filter((c) => c.date >= from && c.date <= to);
  const counts = { academie: inSeason.filter((c) => inScope(c, "academie")).length, hors: inSeason.filter((c) => inScope(c, "hors")).length };
  const cards = inSeason.filter((c) => inScope(c, scope));
  const record = seasonRecord(cards, today);
  const upcoming = cards.filter((c) => ["a_venir", "aujourdhui"].includes(phaseOf(c, today)));
  const played = cards.filter((c) => !["a_venir", "aujourdhui"].includes(phaseOf(c, today))).reverse();
  const toComplete = played.filter((c) => missingFor(c, today).some((x) => x !== "vidéo")).length;
  const recent = await getRecentLessons(cards, 5, today);
  const teams = [...new Set(cards.map((c) => c.ourName))];
  const hasPrev = all.some((c) => c.date < from);
  const href = (q: { vue?: MatchScope; saison?: number }) => {
    const p = new URLSearchParams();
    if ((q.vue ?? scope) === "hors") p.set("vue", "hors");
    if ((q.saison ?? season) !== current) p.set("saison", String(q.saison ?? season));
    const s = p.toString();
    return `/admin/matchs/resultats${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">
              {seasonLabel(season)} · {scope === "hors" ? `Hors Académie${teams.length ? ` (${teams.join(", ")})` : ""}` : "New Valkyria"}
            </p>
            <h1 className="mda-h1">{recordHeadline(record)}</h1>
            <p className="mda-lead">
              {record.scored ? `${record.goalsFor} but${record.goalsFor > 1 ? "s" : ""} pour, ${record.goalsAgainst} contre` : "Chaque match : le score, ce qui s'est passé, qui a joué et combien de minutes."}
              {upcoming.length ? ` · ${upcoming.length} match${upcoming.length > 1 ? "s" : ""} à venir` : ""}
              {record.cancelled ? ` · ${record.cancelled} annulé${record.cancelled > 1 ? "s" : ""}` : ""}
            </p>
          </header>

          {counts.hors || scope === "hors" ? (
            <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }} aria-label="Équipes">
              <Link href={href({ vue: "academie" })} className={scope === "academie" ? "admin-btn-primary" : "admin-btn-ghost"} style={{ textDecoration: "none", minHeight: 40, display: "inline-flex", alignItems: "center" }}>
                Académie · {counts.academie}
              </Link>
              <Link href={href({ vue: "hors" })} className={scope === "hors" ? "admin-btn-primary" : "admin-btn-ghost"} style={{ textDecoration: "none", minHeight: 40, display: "inline-flex", alignItems: "center" }}>
                Hors Académie · {counts.hors}
              </Link>
            </nav>
          ) : null}

          <section className="mda-cols-4">
            <div className="mda-card">
              <p className="mda-num">{record.played}</p>
              <p className="mda-label">Matchs joués</p>
            </div>
            <div className="mda-card">
              <p className="mda-num mda-tnum">
                {record.wins}-{record.draws}-{record.losses}
              </p>
              <p className="mda-label">Victoires-nuls-défaites</p>
            </div>
            <div className="mda-card">
              <p className="mda-num mda-tnum">
                {record.goalsFor} : {record.goalsAgainst}
              </p>
              <p className="mda-label">Buts pour : contre{record.scored ? ` (${record.goalsFor - record.goalsAgainst >= 0 ? "+" : "−"}${Math.abs(record.goalsFor - record.goalsAgainst)})` : ""}</p>
            </div>
            <div className="mda-card" style={toComplete ? { boxShadow: "inset 3px 0 0 var(--adm-warn)" } : undefined}>
              <p className="mda-num" style={{ color: toComplete ? "var(--adm-warn)" : undefined }}>{toComplete}</p>
              <p className="mda-label">Fiche à compléter (score ou résumé)</p>
            </div>
          </section>

          <section className="mda-card">
            <LessonsView
              lessons={recent.lessons}
              title="Leçons des derniers matchs"
              footnote={
                recent.matches.length ? (
                  <>
                    {recent.matches.length} dernier{recent.matches.length > 1 ? "s" : ""} match{recent.matches.length > 1 ? "s" : ""} avec des notes :{" "}
                    {recent.matches.map((m, i) => (
                      <span key={m.id}>
                        {i ? ", " : ""}
                        <Link href={`/admin/matchs/resultats/${m.id}`} style={{ color: "var(--adm-accent)" }}>
                          {matchDayLabel(m.date)} contre {m.opponent ?? "adversaire"}
                        </Link>
                      </span>
                    ))}
                    . Pour mettre les priorités d&apos;un match dans le thème de la semaine, ouvre sa fiche.
                  </>
                ) : null
              }
            />
          </section>

          {upcoming.length ? (
            <section className="mda-card-flush">
              <div className="mda-card-head">
                <h2 className="mda-h2">Aujourd&apos;hui et à venir</h2>
                <Pill>{upcoming.length}</Pill>
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {upcoming.map((m) => (
                  <MatchRow key={m.id} m={m} today={today} />
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Matchs joués</h2>
              <Pill tone={toComplete ? "warn" : undefined}>{played.length}</Pill>
            </div>
            {played.length ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {played.map((m) => (
                  <MatchRow key={m.id} m={m} today={today} />
                ))}
              </ul>
            ) : (
              <p className="mda-sub" style={{ padding: "0 20px 16px", margin: 0 }}>
                Aucun match joué encore cette saison. Un match entré dans{" "}
                <Link href="/admin/entraineurs/activites" style={{ color: "var(--adm-accent)" }}>
                  Entraînements
                </Link>{" "}
                (type Match ou Tournoi) ou une plage vendue dans{" "}
                <Link href="/admin/matchs" style={{ color: "var(--adm-accent)" }}>
                  Vente de matchs
                </Link>{" "}
                apparaît ici tout seul.
              </p>
            )}
          </section>

          <p className="mda-sub" style={{ margin: 0 }}>
            Statistiques de chaque joueuse (matchs, minutes, notes) :{" "}
            <Link href="/admin/matchs/resultats/joueuses" style={{ color: "var(--adm-accent)" }}>
              Joueuses en match
            </Link>
            .{hasPrev && season === current ? (
              <>
                {" "}
                <Link href={href({ saison: current - 1 })} style={{ color: "var(--adm-accent)" }}>
                  {seasonLabel(current - 1)}
                </Link>
                .
              </>
            ) : null}
            {season !== current ? (
              <>
                {" "}
                <Link href={href({ saison: current })} style={{ color: "var(--adm-accent)" }}>
                  Revenir à la saison en cours
                </Link>
                .
              </>
            ) : null}
          </p>
        </div>
      </div>
    </>
  );
}
