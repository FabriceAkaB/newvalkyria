import { AdminTopbar } from "@/components/admin-topbar";
import { GestureLibrary } from "@/components/coaching-method";
import { requireAdmin } from "@/lib/admin-auth";
import { gestureChecklist, gesturesPerLevel } from "@/lib/coaching-method";
import { getGestures } from "@/lib/coaching-method-repo";
import { LEVEL_LABEL } from "@/lib/skill-tests";

export const metadata = { title: "Gestes — Méthode Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** « Quels gestes une fille doit-elle maîtriser à chaque niveau, et comment les enseigner ? » (P1.1.02 à P1.1.05) */
export default async function GesturesPage() {
  await requireAdmin({ roles: ["admin"] });
  const gestures = await getGestures();
  const active = gestures.filter((g) => g.active);
  const complete = active.filter((g) => { const c = gestureChecklist(g); return c.done === c.total; }).length;
  const perLevel = gesturesPerLevel(gestures);
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · bibliothèque des gestes</p>
            <h1 className="mda-h1">{active.length ? `Fiche complète : ${complete} geste${complete > 1 ? "s" : ""} sur ${active.length}` : "La bibliothèque des gestes est à remplir"}</h1>
            <p className="mda-lead">Classés par famille (semelle, intérieur et extérieur, changements de direction, feintes, contrôles orientés). Chaque fiche : exécution, 3 points clés, erreurs fréquentes, vidéo de démonstration et progression en 4 étapes.</p>
          </header>
          <section className="mda-cols-4">
            {perLevel.map((l) => (
              <div key={l.level} className="mda-card">
                <p className="mda-num" style={{ color: l.complete ? "var(--adm-good)" : undefined }}>{l.count}<span style={{ fontSize: "0.9rem", color: "var(--adm-text-3)" }}>/{l.target}</span></p>
                <p className="mda-label">Gestes de base {LEVEL_LABEL[l.level]}</p>
              </div>
            ))}
          </section>
          <section className="mda-card">
            <GestureLibrary gestures={gestures} />
          </section>
        </div>
      </div>
    </>
  );
}
