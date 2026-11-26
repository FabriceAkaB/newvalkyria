import { CoachTopbar } from "@/components/coach-topbar";
import { TrainingModuleCard } from "@/components/coach-training";
import { requireCoach } from "@/lib/coach-auth";
import { trainingProgress } from "@/lib/coach-training";
import { getOpenModules, getTraining } from "@/lib/coach-training-repo";
import { getCoach } from "@/lib/coaches-repo";

export const metadata = { title: "Ma formation — Espace Technique" };
export const dynamic = "force-dynamic";

/** Ma formation (JP, 17 nov. 2026) : le parcours pour coacher à la façon Valkyria, module par module. */
export default async function CoachTrainingPage() {
  const coachId = await requireCoach();
  const [coach, training, open] = await Promise.all([getCoach(coachId), getTraining([coachId]), getOpenModules()]);
  const p = trainingProgress(training.get(coachId) ?? []);
  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="admin-section coach-page">
          <p className="coach-eyebrow">Ma formation</p>
          <h1 className="coach-title coach-title--xl">{p.certified ? "Prête à diriger un groupe ✓" : `${p.validated} module${p.validated > 1 ? "s" : ""} validé${p.validated > 1 ? "s" : ""} sur ${p.total}`}</h1>
          <p className="coach-sub coach-prose">
            Le parcours pour coacher à la façon Valkyria. Les modules s&apos;ouvrent un à un : lis chaque module ouvert, confirme que tu l&apos;as compris, puis JP le valide après t&apos;avoir observée sur le terrain. Quand tout est validé, tu peux diriger un groupe seule.{open.length ? "" : " Aucun module n'est encore ouvert : ils arrivent bientôt."}
          </p>
          <div className="coach-card" style={{ marginTop: 16 }}>
            <div style={{ height: 8, borderRadius: 999, background: "var(--adm-surface-3)", overflow: "hidden" }} role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.validated}>
              <div style={{ width: `${Math.max(3, (p.validated / p.total) * 100)}%`, height: "100%", background: "var(--adm-accent-strong)" }} />
            </div>
            <p className="coach-muted" style={{ margin: "8px 0 0" }}>{p.read} lu{p.read > 1 ? "s" : ""} · {p.validated} validé{p.validated > 1 ? "s" : ""}{p.next ? ` · prochain : ${p.next.title}` : ""}</p>
          </div>
          <div className="coach-grid2" style={{ marginTop: 16 }}>
            {p.states.map((s, i) => (
              <TrainingModuleCard key={s.module.key} module={s.module} state={s.state} index={i} open={open.includes(s.module.key)} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
