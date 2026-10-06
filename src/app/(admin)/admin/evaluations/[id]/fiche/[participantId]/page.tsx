import { notFound } from "next/navigation";

import { FichePrintButton } from "@/components/fiche-print-button";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getCriteriaConfigForEvent,
  getEvaluationsForParticipant,
  getEvaluatorsForEvent,
  getEventById,
  getParticipantsForEvent
} from "@/lib/tryout-repo";
import { FICHE_SECTIONS, RATING_VALUES, ratingBand, summarizeSections } from "@/lib/tryout-scoring";

export const metadata = { title: "Fiche d'évaluation de l'athlète — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

function formatDate(value: string | null): string {
  return value ? new Date(value + "T00:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) : "";
}

/** La fiche d'évaluation de l'athlète — mise en page du modèle officiel,
 *  imprimable / exportable en PDF depuis le navigateur. */
export default async function FicheEvaluationPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string; participantId: string }>;
  searchParams: Promise<{ evaluateur?: string }>;
}) {
  await requireAdmin();
  const { id, participantId } = await params;
  const { evaluateur } = await searchParams;

  const event = await getEventById(id);
  if (!event) notFound();

  const [participants, config, evaluations, evaluators] = await Promise.all([
    getParticipantsForEvent(id),
    getCriteriaConfigForEvent(id),
    getEvaluationsForParticipant(participantId),
    getEvaluatorsForEvent(id)
  ]);
  const participant = participants.find((p) => p.id === participantId);
  if (!participant) notFound();

  const evaluation =
    evaluations.find((e) => e.evaluator_id === evaluateur) ??
    evaluations.find((e) => e.completed_at) ??
    evaluations[0] ??
    null;
  const evaluator = evaluators.find((e) => e.id === evaluation?.evaluator_id);
  const evaluatorName = evaluator ? evaluator.guest_name ?? `${evaluator.coach_first_name ?? ""} ${evaluator.coach_last_name ?? ""}`.trim() : "";
  const scores = evaluation?.criteria_scores ?? {};
  const summaries = summarizeSections(config.criteria, scores);

  const headerFields: [string, string][] = [
    ["Nom complet", `${participant.player_first_name} ${participant.player_last_name}`.trim()],
    ["Position jouée", participant.primary_position_observed ?? ""],
    ["Position préférée", participant.preferred_position ?? ""],
    ["Pied fort", participant.strong_foot ?? ""],
    ["Groupe", participant.group_label ?? event.age_category ?? (participant.player_dob ? participant.player_dob.slice(0, 4) : "")],
    ["Date de naissance", formatDate(participant.player_dob)],
    ["Courriel", participant.contact_email ?? ""],
    ["Téléphone", participant.contact_phone ?? ""],
    ["Club actuel", participant.current_club ?? ""],
    ["Niveau actuel", participant.current_level ?? ""]
  ];

  const selectedValue = (criterionId: string): number | null => {
    const raw = scores[criterionId];
    if (!raw) return null;
    return "score" in raw ? raw.score : Math.min(raw.isole, raw.match);
  };

  return (
    <div className="fiche-page">
      <style>{`
        .fiche-page { background: #e9e8ee; min-height: 100vh; padding: 1rem; color: #1c1830; font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; }
        .fiche-sheet { background: #fff; max-width: 820px; margin: 0 auto; padding: 28px 34px; border-radius: 6px; box-shadow: 0 2px 14px rgba(0,0,0,.15); }
        .fiche-bar { max-width: 820px; margin: 0 auto 0.8rem; display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; flex-wrap: wrap; font-size: 0.8rem; }
        .fiche-bar a { color: #4c2d70; }
        .fiche-title { margin: 0 0 14px; font-size: 20px; letter-spacing: .08em; color: #2a1a45; border-bottom: 3px solid #72499a; padding-bottom: 8px; }
        .fiche-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 22px; margin-bottom: 14px; }
        .fiche-field { display: flex; gap: 6px; align-items: baseline; border-bottom: 1px solid #cfcad9; padding-bottom: 2px; font-size: 12.5px; min-height: 22px; }
        .fiche-field b { font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: #5b5670; white-space: nowrap; }
        .fiche-section { margin-top: 14px; break-inside: avoid; }
        .fiche-section h3 { margin: 0 0 4px; font-size: 13px; letter-spacing: .1em; color: #fff; background: #72499a; padding: 4px 8px; display: flex; justify-content: space-between; }
        .fiche-row { display: grid; grid-template-columns: 1fr repeat(5, 28px); gap: 4px; align-items: center; padding: 2px 0; border-bottom: 1px dotted #d9d4e3; font-size: 12.5px; }
        .fiche-row .head { text-align: center; font-size: 10px; font-weight: 700; color: #5b5670; }
        .fiche-dot { width: 24px; height: 24px; border-radius: 50%; border: 1px solid #9a93ab; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #5b5670; margin: 0 auto; }
        .fiche-dot.on { background: #2a1a45; color: #fff; border-color: #2a1a45; font-weight: 700; }
        .fiche-remarks { border: 1px solid #cfcad9; border-radius: 4px; padding: 6px 8px; min-height: 44px; margin-top: 6px; font-size: 12px; white-space: pre-wrap; }
        .fiche-remarks b { display: block; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: #5b5670; margin-bottom: 2px; }
        .fiche-foot { display: grid; grid-template-columns: 2fr 1fr; gap: 10px 22px; margin-top: 10px; }
        @media print {
          .fiche-page { background: #fff; padding: 0; }
          .fiche-sheet { box-shadow: none; padding: 0; max-width: none; }
          .fiche-bar { display: none; }
          @page { size: Letter; margin: 12mm; }
        }
      `}</style>

      <div className="fiche-bar">
        <a href={`/admin/evaluations/${id}`}>← {event.name}</a>
        <span style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          {evaluations.length > 1 && (
            <span>
              Évaluateur :{" "}
              {evaluations.map((e) => {
                const ev = evaluators.find((x) => x.id === e.evaluator_id);
                const name = ev ? ev.guest_name ?? `${ev.coach_first_name ?? ""} ${ev.coach_last_name ?? ""}`.trim() : "—";
                return (
                  <a key={e.id} href={`?evaluateur=${e.evaluator_id}`} style={{ marginRight: "0.5rem", fontWeight: e.id === evaluation?.id ? 700 : 400 }}>{name}</a>
                );
              })}
            </span>
          )}
          <FichePrintButton />
        </span>
      </div>

      <div className="fiche-sheet">
        <h1 className="fiche-title">FICHE D&apos;ÉVALUATION DE L&apos;ATHLÈTE</h1>
        <div className="fiche-grid">
          {headerFields.map(([label, value]) => (
            <div className="fiche-field" key={label}><b>{label} :</b><span>{value}</span></div>
          ))}
        </div>

        {FICHE_SECTIONS.map(({ block, title }) => {
          const summary = summaries.find((s) => s.block === block);
          return (
            <div className="fiche-section" key={block}>
              <h3>
                <span>{title.toUpperCase()}</span>
                <span style={{ fontWeight: 400, letterSpacing: 0 }}>
                  {summary?.average != null ? `moy. ${summary.average.toFixed(1)}/5 · ${summary.band}` : ""}
                </span>
              </h3>
              <div className="fiche-row" style={{ borderBottom: "none" }}>
                <span />
                {RATING_VALUES.map((v) => <span className="head" key={v}>{ratingBand(v)}</span>)}
              </div>
              {config.criteria.filter((c) => c.block === block).map((c) => {
                const sel = selectedValue(c.id);
                return (
                  <div className="fiche-row" key={c.id}>
                    <span>{c.label}</span>
                    {RATING_VALUES.map((v) => (
                      <span className={`fiche-dot${sel === v ? " on" : ""}`} key={v}>{v}</span>
                    ))}
                  </div>
                );
              })}
              <div className="fiche-remarks"><b>Remarques</b>{evaluation?.section_remarks?.[block] ?? ""}</div>
            </div>
          );
        })}

        <div className="fiche-section">
          <h3><span>ÉVALUATION</span></h3>
          <div className="fiche-remarks" style={{ minHeight: "90px" }}><b>Commentaires généraux</b>{evaluation?.comment ?? ""}</div>
          <div className="fiche-foot">
            <div className="fiche-field"><b>Évaluateur :</b><span>{evaluatorName}</span></div>
            <div className="fiche-field"><b>Date :</b><span>{formatDate(evaluation?.evaluated_on ?? null)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
