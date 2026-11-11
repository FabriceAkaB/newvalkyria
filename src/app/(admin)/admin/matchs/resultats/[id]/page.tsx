import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { ApplyLessonsButton, CreateMatchActivity, Crest, LessonsView, MatchSheetForm, VideoUpload } from "@/components/match-results-admin";
import { requireAdmin } from "@/lib/admin-auth";
import {
  OUTCOME_LABEL,
  OUTCOME_TONE,
  evalLabel,
  guessCategoryId,
  hasScore,
  matchDayLabel,
  minutesLabel,
  missingFor,
  outcomeOf,
  phaseOf,
  parseVideoLink,
  timeLabel
} from "@/lib/match-results-core";
import { getMatchSheet, listMatchCategories } from "@/lib/match-results";

export const metadata = { title: "Fiche du match — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

const POSITION_LABELS: Record<string, string> = {
  GB: "Gardienne",
  AD: "Arrière droite",
  DC: "Défenseure centrale",
  AG: "Arrière gauche",
  MDC: "Milieu défensive",
  MC: "Milieu centrale",
  MOC: "Milieu offensive",
  AiD: "Ailière droite",
  AiG: "Ailière gauche",
  AT: "Attaquante"
};

function VideoPlayer({ url, signedUrl }: { url: string | null; signedUrl: string | null }) {
  const link = parseVideoLink(url);
  const frame: React.CSSProperties = { width: "100%", aspectRatio: "16 / 9", border: 0, borderRadius: "var(--adm-radius-sm)", background: "#000" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {signedUrl ? <video src={signedUrl} controls preload="metadata" playsInline style={frame} /> : null}
      {link?.embed ? <iframe src={link.embed} title="Vidéo du match" style={frame} allow="encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : null}
      {link ? (
        <a href={link.href} target="_blank" rel="noreferrer" className="admin-btn-ghost" style={{ alignSelf: "flex-start", textDecoration: "none", minHeight: 40, display: "inline-flex", alignItems: "center" }}>
          Ouvrir dans {link.label} ↗
        </a>
      ) : null}
    </div>
  );
}

/** « Qu'est-ce qui s'est passé dans ce match, qui a joué, et qu'est-ce qu'on travaille en pratique ? » */
export default async function MatchSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const role = await requireAdmin();
  const { id } = await params;
  const sheet = await getMatchSheet(id);
  if (!sheet) notFound();
  const { card: m, roster, timed, videoSignedUrl, referees, lessons, lessonTarget } = sheet;
  const canEdit = role === "admin";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const phase = phaseOf(m, today);
  const outcome = outcomeOf(m.scoreUs, m.scoreThem);
  const miss = missingFor(m, today);
  // Score ou résumé manquant : la fiche passe en haut (la vidéo seule ne presse pas).
  const urgent = miss.filter((x) => x !== "vidéo");
  const opp = m.opponent ?? "Adversaire à confirmer";
  // « Dollard SC F2016 · Dollard CDC F2016 » : le club en gros, l'équipe en dessous.
  const [oppClub, ...oppTeam] = opp.split(/\s+·\s+/);
  const played = roster.filter((r) => r.played);
  const videoLink = m.videoUrl ?? m.activityVideoUrl;
  const hasVideo = !!(videoLink || videoSignedUrl);
  // Plage vendue sans activité : on propose de créer l'activité du match pour noter les joueuses.
  const canCreateActivity = canEdit && !m.activityId && m.status !== "cancelled";
  const categories = canCreateActivity ? await listMatchCategories().catch(() => []) : [];

  const editor = canEdit ? (
    <section className="mda-card">
      <h2 className="mda-h2">{urgent.length ? `À compléter : ${urgent.join(", ")}` : "Fiche du match"}</h2>
      <p className="mda-sub">Score, ce qui s&apos;est passé et l&apos;analyse. L&apos;analyse alimente le résumé « à travailler en pratique ».</p>
      <MatchSheetForm
        id={m.id}
        ourName={m.ourName}
        canEditHome={!!m.activityId}
        initial={{
          scoreUs: m.scoreUs,
          scoreThem: m.scoreThem,
          cancelled: m.status === "cancelled",
          opponentName: m.opponent ?? "",
          homeAway: m.homeAway,
          opponentLogo: m.opponentLogo ?? "",
          summary: m.summary ?? "",
          analysis: m.analysis,
          videoUrl: m.videoUrl ?? ""
        }}
      />
    </section>
  ) : null;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <p className="mda-eyebrow">
            <Link href="/admin/matchs/resultats" style={{ color: "var(--adm-text-3)" }}>
              Nos matchs
            </Link>{" "}
            · {m.kind} · {matchDayLabel(m.date, true)}
            {m.start ? ` · ${timeLabel(m.start)}` : ""}
          </p>

          <section className="mda-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", minWidth: 0 }}>
                <Crest name={m.ourName} ours size={56} />
                <span style={{ fontWeight: 600, color: "var(--adm-text)", fontSize: "0.95rem" }}>{m.ourName}</span>
                {m.category ? <span className="mda-muted" style={{ fontSize: "0.78rem" }}>{m.category}</span> : null}
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "2.4rem", fontWeight: 700, margin: 0, color: "var(--adm-text)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
                  {hasScore(m) ? `${m.scoreUs} – ${m.scoreThem}` : phase === "a_venir" || phase === "aujourdhui" ? timeLabel(m.start) || "—" : "– : –"}
                </p>
                <div style={{ marginTop: 6 }}>
                  {phase === "annule" ? <Pill>Annulé</Pill> : outcome ? <Pill tone={OUTCOME_TONE[outcome]}>{OUTCOME_LABEL[outcome]}</Pill> : phase === "joue" ? <Pill tone="warn">Score à entrer</Pill> : phase === "aujourdhui" ? <Pill tone="accent">Aujourd&apos;hui</Pill> : <Pill>À venir</Pill>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", minWidth: 0 }}>
                <Crest name={opp} logo={m.opponentLogo} size={56} />
                <span style={{ fontWeight: 600, color: "var(--adm-text)", fontSize: "0.95rem", overflowWrap: "anywhere" }}>{oppClub}</span>
                <span className="mda-muted" style={{ fontSize: "0.78rem" }}>
                  {oppTeam.length ? `${oppTeam.join(" · ")} · ` : ""}
                  {m.homeAway === "away" ? "on joue chez eux" : "on reçoit"}
                </span>
              </div>
            </div>
            <p className="mda-sub" style={{ margin: 0, textAlign: "center" }}>
              {[m.location, m.field].filter(Boolean).join(" · ")}
              {referees.length ? ` · Arbitre${referees.length > 1 ? "s" : ""} : ${referees.join(", ")}` : ""}
            </p>
            {m.summary ? <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.55, color: "var(--adm-text)", whiteSpace: "pre-line" }}>{m.summary}</p> : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {m.activityId && canEdit ? (
                <Link href={`/admin/entraineurs/activites/${m.activityId}`} className="admin-btn-ghost" style={{ textDecoration: "none", minHeight: 40, display: "inline-flex", alignItems: "center" }}>
                  Convocations, alignement, temps de jeu
                </Link>
              ) : null}
              {m.slotId && canEdit ? (
                <Link href="/admin/arbitres" className="admin-btn-ghost" style={{ textDecoration: "none", minHeight: 40, display: "inline-flex", alignItems: "center" }}>
                  Arbitres et bilan du match
                </Link>
              ) : null}
            </div>
          </section>

          {urgent.length ? editor : null}

          <section className="mda-card">
            <LessonsView
              lessons={lessons}
              action={
                canEdit && m.status !== "cancelled" ? <ApplyLessonsButton matchId={m.id} weekStart={lessonTarget.weekStart} theme={lessonTarget.theme} added={lessonTarget.added} /> : null
              }
              footnote={
                m.activityId
                  ? "Les commentaires viennent des évaluations d'après-match (portail des éducateurs, étape du match) ; l'analyse vient de la fiche ci-dessous."
                  : "Plage vendue sans activité : seuls le résumé et l'analyse de la fiche sont lus. Pour noter les joueuses, crée l'activité du match (section Joueuses présentes)."
              }
            />
          </section>

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2">Joueuses présentes</h2>
                <p className="mda-sub" style={{ margin: 0 }}>
                  {roster.length
                    ? timed
                      ? "Temps de jeu noté avec le chronomètre du match (entrées et sorties)."
                      : "Temps de jeu pas noté pour ce match : présentes = alignement ou évaluation."
                    : m.activityId
                      ? "Personne de noté encore : convocations, alignement et chronomètre se font dans l'activité du match."
                      : "Plage vendue sans activité : aucune joueuse rattachée. Crée l'activité du match pour convoquer les joueuses, noter le temps de jeu et les évaluer."}
                </p>
              </div>
              <Pill>{played.length}</Pill>
            </div>
            {canCreateActivity ? (
              <div style={{ padding: "0 20px 16px" }}>
                <CreateMatchActivity id={m.id} categories={categories} suggested={guessCategoryId(m.category, categories)} />
              </div>
            ) : null}
            {roster.length ? (
              <div className="admin-table-wrap" style={{ margin: 0 }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Joueuse</th>
                      <th>Rôle</th>
                      <th style={{ textAlign: "right" }}>Minutes</th>
                      <th style={{ textAlign: "right" }}>Note</th>
                      <th>Commentaire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((r) => (
                      <tr key={r.registrationId} style={r.played ? undefined : { opacity: 0.55 }}>
                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                        <td>
                          {r.starter === true ? "Titulaire" : r.starter === false ? "Remplaçante" : r.played ? "A joué" : "N'a pas joué"}
                          {r.position ? <span className="mda-muted"> · {POSITION_LABELS[r.position] ?? r.position}</span> : null}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{minutesLabel(r.minutes)}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: r.evalAvg !== null && r.evalAvg <= 5 ? "var(--adm-bad)" : undefined }}>{evalLabel(r.evalAvg)}</td>
                        <td style={{ maxWidth: 360, whiteSpace: "normal", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>{r.comments.join(" / ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="mda-card">
            <h2 className="mda-h2">Vidéo du match</h2>
            {hasVideo ? <VideoPlayer url={videoLink} signedUrl={videoSignedUrl} /> : <p className="mda-sub">Pas encore de vidéo. Colle un lien (YouTube non répertorié, Veo, Drive) dans la fiche{canEdit ? ", ou dépose le fichier ici" : ""}.</p>}
            {!m.videoUrl && m.activityVideoUrl ? <p className="mda-sub" style={{ marginTop: 8 }}>Lien noté dans l&apos;activité du match (Entraînements).</p> : null}
            {canEdit ? (
              <div style={{ marginTop: 12 }}>
                <VideoUpload id={m.id} hasFile={!!m.videoPath} />
              </div>
            ) : null}
          </section>

          {urgent.length ? null : editor}
        </div>
      </div>
    </>
  );
}
