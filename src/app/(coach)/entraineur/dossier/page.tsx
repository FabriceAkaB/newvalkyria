import { CoachDossierGoals } from "@/components/coach-dossier-goals";
import { CoachChangePasswordForm } from "@/components/coach-password-forms";
import { CoachTopbar } from "@/components/coach-topbar";
import { requireCoach } from "@/lib/coach-auth";
import { listObservations } from "@/lib/coach-observations-repo";
import { trainingProgress } from "@/lib/coach-training";
import { getTraining } from "@/lib/coach-training-repo";
import { getCoach } from "@/lib/coaches-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCoachSatisfaction } from "@/lib/surveys-repo";

export const metadata = { title: "Mon dossier — Espace Technique" };
export const dynamic = "force-dynamic";

const fr = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const num = (v: number | null) => (v === null ? "—" : v.toLocaleString("fr-CA", { maximumFractionDigits: 1 }));

/** Mon dossier (JP, 17 nov. 2026 ; plan des deux espaces, phase 3) : le profil de l'éducateur (diplômes, formations,
 *  objectifs), ses évaluations (observations de JP sur 10, satisfaction des parents, appréciation des joueuses) et
 *  ses points à travailler, toujours constructifs. */
export default async function CoachDossierPage() {
  const coachId = await requireCoach();
  const db = getSupabaseAdminClient() as any;
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const [coach, { data: row }, { data: staff }, { data: certs }, observations, satisfaction, { data: assigns }] = await Promise.all([
    getCoach(coachId),
    db.from("coaches").select("pro_goals, development_plan, hired_on").eq("id", coachId).maybeSingle(),
    db.from("staff_members").select("role, diplomas, certifications, started_on").eq("coach_id", coachId).maybeSingle(),
    db.from("coach_certifications").select("name, issued_date, expiry_date").eq("coach_id", coachId).order("expiry_date"),
    listObservations({ coachId, sharedOnly: true }).catch(() => []),
    getCoachSatisfaction().catch(() => new Map()),
    db.from("coach_assignments").select("activity_id, status, activity:coach_activities(activity_date)").eq("coach_id", coachId)
  ]);
  const training = trainingProgress((await getTraining([coachId]).catch(() => new Map())).get(coachId) ?? []);
  const recentIds = ((assigns ?? []) as any[]).filter((a) => a.status !== "absent" && String(a.activity?.activity_date ?? "").slice(0, 10) >= since).map((a) => a.activity_id);
  const { data: ratings } = recentIds.length ? await db.from("activity_player_attendance").select("practice_rating").in("activity_id", recentIds).not("practice_rating", "is", null) : { data: [] };
  const rs = ((ratings ?? []) as any[]).map((r) => Number(r.practice_rating)).filter((v) => v >= 1 && v <= 10);
  const girls = rs.length ? Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 10) / 10 : null;
  const sat = satisfaction.get(coachId) ?? null;
  const obsTotals = observations.map((o) => o.total).filter((t): t is number => typeof t === "number");
  const obsAvg = obsTotals.length ? Math.round((obsTotals.reduce((a, b) => a + b, 0) / obsTotals.length) * 10) / 10 : null;
  const latest = observations[0] ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);

  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="admin-section coach-page">
          <p className="coach-eyebrow">Mon dossier</p>
          <h1 className="coach-title coach-title--xl">{coach ? `${coach.first_name} ${coach.last_name}` : "Mon dossier"}</h1>
          <p className="coach-sub">
            {staff?.role ?? "Éducateur"}
            {staff?.started_on || row?.hired_on ? ` · avec New Valkyria depuis le ${fr(String(staff?.started_on ?? row?.hired_on))}` : ""}
          </p>

          <div className="coach-summary-grid" style={{ marginTop: 20 }}>
            <div className="coach-card">
              <p className="coach-card__label">Observations de JP</p>
              <p className="coach-figure">{num(obsAvg)}<span>/10</span></p>
              <p className="coach-muted" style={{ margin: 0 }}>{obsTotals.length} observation{obsTotals.length > 1 ? "s" : ""} partagée{obsTotals.length > 1 ? "s" : ""}</p>
            </div>
            <div className="coach-card">
              <p className="coach-card__label">Satisfaction des parents</p>
              <p className="coach-figure">{num(sat?.average ?? null)}<span>/10</span></p>
              <p className="coach-muted" style={{ margin: 0 }}>{sat?.count ? `${sat.count} réponse${sat.count > 1 ? "s" : ""} aux sondages` : "Au prochain sondage des familles"}</p>
            </div>
            <div className="coach-card">
              <p className="coach-card__label">Appréciation des joueuses</p>
              <p className="coach-figure">{num(girls)}<span>/10</span></p>
              <p className="coach-muted" style={{ margin: 0 }}>Sondage de fin de tes pratiques, 60 derniers jours</p>
            </div>
          </div>

          <a href="/api/coach/contrat" target="_blank" rel="noreferrer" className="coach-card" style={{ display: "block", marginTop: 16, textDecoration: "none", color: "inherit" }}>
            <p className="coach-card__label">Mon contrat</p>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>Ouvrir mon contrat signé (PDF) →</p>
            <p className="coach-muted" style={{ margin: "4px 0 0" }}>La copie signée, avec ton NAS masqué. Une question sur ton contrat : écris à JP.</p>
          </a>
          <a href="/entraineur/formation" className="coach-card" style={{ display: "block", marginTop: 16, textDecoration: "none", color: "inherit" }}>
            <p className="coach-card__label">Ma formation</p>
            <p className="coach-sub" style={{ margin: 0 }}>
              {training.certified ? "Tous les modules sont validés : prête à diriger un groupe ✓" : `${training.validated} module${training.validated > 1 ? "s" : ""} validé${training.validated > 1 ? "s" : ""} sur ${training.total}${training.next ? ` · prochain : ${training.next.title}` : ""} →`}
            </p>
          </a>

          {latest && (latest.to_improve || latest.next_focus || latest.strengths) ? (
            <div className="coach-card" style={{ marginTop: 16 }}>
              <p className="coach-card__label">Mes points à travailler · observation du {fr(latest.observed_on)}</p>
              {latest.strengths ? <p className="coach-sub"><strong>Ce que tu fais bien :</strong> {latest.strengths}</p> : null}
              {latest.to_improve ? <p className="coach-sub"><strong>À travailler :</strong> {latest.to_improve}</p> : null}
              {latest.next_focus ? <p className="coach-sub"><strong>Prochain focus :</strong> {latest.next_focus}</p> : null}
            </div>
          ) : null}

          {row?.development_plan ? (
            <div className="coach-card" style={{ marginTop: 16 }}>
              <p className="coach-card__label">Mon plan de développement (avec JP)</p>
              <p className="coach-sub" style={{ whiteSpace: "pre-line" }}>{row.development_plan}</p>
            </div>
          ) : null}

          {sat?.comments.length ? (
            <div className="coach-card" style={{ marginTop: 16 }}>
              <p className="coach-card__label">Ce que les parents disent (sans leur nom)</p>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                {sat.comments.slice(0, 8).map((c: string, i: number) => (
                  <li key={i} className="coach-sub" style={{ margin: 0 }}>« {c} »</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="coach-card" style={{ marginTop: 16 }}>
            <p className="coach-card__label">Mes diplômes et formations</p>
            {staff?.diplomas || staff?.certifications ? (
              <p className="coach-sub" style={{ whiteSpace: "pre-line" }}>{[staff?.diplomas, staff?.certifications].filter(Boolean).join("\n")}</p>
            ) : null}
            {((certs ?? []) as any[]).length ? (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "grid", gap: 4 }}>
                {((certs ?? []) as any[]).map((c, i) => {
                  const exp = c.expiry_date ? String(c.expiry_date).slice(0, 10) : null;
                  return (
                    <li key={i} className="coach-sub" style={{ margin: 0 }}>
                      {c.name}
                      {exp ? (
                        <span style={{ color: exp < today ? "var(--adm-bad)" : exp <= soon ? "var(--adm-warn)" : "var(--adm-text-3)" }}> · {exp < today ? "expirée le" : "expire le"} {fr(exp)}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : !(staff?.diplomas || staff?.certifications) ? (
              <p className="coach-muted" style={{ margin: 0 }}>Envoie tes diplômes et certifications à JP : ils seront rangés ici.</p>
            ) : null}
          </div>

          <div className="coach-card" style={{ marginTop: 16 }}>
            <p className="coach-card__label">Mes objectifs professionnels</p>
            <p className="coach-sub" style={{ marginTop: 0 }}>Où veux-tu être dans un an comme éducateur ? JP s&apos;en sert pour ton plan de développement.</p>
            <CoachDossierGoals initial={row?.pro_goals ?? ""} />
          </div>

          <div className="coach-card" style={{ marginTop: 16 }}>
            <p className="coach-card__label">Mon mot de passe</p>
            <CoachChangePasswordForm />
          </div>
        </div>
      </div>
    </>
  );
}
