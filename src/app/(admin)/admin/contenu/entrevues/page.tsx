import { CandidatePicker, InterviewTable, SlotDelete, SlotForm } from "@/components/content-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { FILMED_STATUSES, INTERVIEW_GOAL, INTERVIEW_GUIDE, INTERVIEW_SETUP, INTERVIEWS_START, interviewsPerWeek, slotRemaining } from "@/lib/content-core";
import { slotLabel } from "@/lib/content-format";
import { interviewCandidates, listInterviews, listSlots } from "@/lib/content-repo";

export const metadata = { title: "Entrevues — Création de contenu", robots: "noindex" };
export const dynamic = "force-dynamic";

const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

/** Espace Contenu › Entrevues : le projet avant/après (P8.1, P3.2.07, P3.2.08). Les journées d'entrevues, les filles
 *  choisies, l'invitation aux familles (lien personnel pour choisir l'heure) et le guide de questions. */
export default async function EntrevuesPage() {
  await requireAdmin();
  const today = todayIso();
  const [slots, interviews, candidates] = await Promise.all([listSlots(), listInterviews(), interviewCandidates()]);
  const filmed = interviews.filter((i) => FILMED_STATUSES.includes(i.status)).length;
  const upcoming = slots.filter((s) => s.day >= today);
  const slotOptions = slots.map((s) => ({ ...s, label: slotLabel(s) }));
  const rows = interviews.map((i) => ({ ...i, slotLabel: slots.find((s) => s.id === i.slot_id) ? slotLabel(slots.find((s) => s.id === i.slot_id)!) : null }));
  const taken = new Set(interviews.map((i) => i.registration_id));

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1100 }}>
        <header>
          <p className="mda-eyebrow">La preuve la plus forte : la joueuse et son parent, au début puis à la fin</p>
          <h1 className="mda-h1">Entrevues</h1>
          <p className="mda-lead">
            Objectif : {INTERVIEW_GOAL} filles d&apos;ici la fin de la saison, à partir de la semaine du 21 novembre. {filmed} filmée{filmed > 1 ? "s" : ""} jusqu&apos;ici ; rythme à tenir :{" "}
            {interviewsPerWeek(filmed, today)} par semaine. Les familles reçoivent une invitation et choisissent elles-mêmes leur moment : on sait qui vient quand.
          </p>
        </header>

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginTop: 0 }}>1. Les journées d&apos;entrevues</h2>
          {upcoming.length ? (
            <ul style={{ margin: "0 0 14px", paddingLeft: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {upcoming.map((s) => (
                <li key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: "0.9rem" }}>
                  <span>
                    {slotLabel(s)} · {slotRemaining(s, interviews)} place(s) sur {s.capacity}
                    {s.note ? <span style={{ color: "var(--adm-text-3)" }}> · {s.note}</span> : null}
                  </span>
                  <SlotDelete id={s.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: "0 0 12px", color: "var(--adm-text-2)", fontSize: "0.9rem" }}>Aucune journée prévue. Ajoute la première ci-dessous.</p>
          )}
          <SlotForm defaultDay={today > INTERVIEWS_START ? today : INTERVIEWS_START} defaultPlace="Club des recrues" />
        </section>

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginTop: 0 }}>2. Les filles à interviewer</h2>
          <CandidatePicker candidates={candidates.map((c) => ({ ...c, taken: taken.has(c.registrationId) }))} />
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">3. Invitations et suivi ({interviews.length})</h2>
          </div>
          <div style={{ padding: "0 16px 16px" }}>
            {rows.length ? <InterviewTable rows={rows} slots={slotOptions} /> : <p style={{ margin: 0, color: "var(--adm-text-2)" }}>Choisis d&apos;abord des filles ci-dessus.</p>}
          </div>
        </section>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
          {INTERVIEW_GUIDE.map((g) => (
            <section key={`${g.who}-${g.when}`} className="mda-card">
              <h2 className="mda-h2" style={{ marginTop: 0 }}>
                🎙️ {g.who} · {g.when}
              </h2>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: "0.88rem", display: "grid", gap: 5, lineHeight: 1.5 }}>
                {g.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </section>
          ))}
          <section className="mda-card">
            <h2 className="mda-h2" style={{ marginTop: 0 }}>🎬 Installer l&apos;entrevue</h2>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.88rem", display: "grid", gap: 5, lineHeight: 1.5 }}>
              {INTERVIEW_SETUP.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
