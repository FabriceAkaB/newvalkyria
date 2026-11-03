import { AdminTopbar } from "@/components/admin-topbar";
import { ComponentsEditor, PrinciplesEditor, StructureEditor } from "@/components/coaching-method";
import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { COMPONENT_IDEAS } from "@/lib/coaching-method";
import { getComponents, getPrinciples, getStructure } from "@/lib/coaching-method-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const metadata = { title: "Méthode Valkyria — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Durée la plus fréquente des plages de la saison (la plupart des pratiques font 1 h 25). */
async function usualPracticeMinutes(): Promise<number> {
  const { data } = await (getSupabaseAdminClient() as any).from("time_slot_templates").select("start_time, end_time").eq("active", true);
  const mins = ((data ?? []) as any[]).map((s) => {
    const [h1, m1] = String(s.start_time).split(":").map(Number);
    const [h2, m2] = String(s.end_time).split(":").map(Number);
    return h2 * 60 + m2 - (h1 * 60 + m1);
  });
  const count = new Map<number, number>();
  for (const m of mins) count.set(m, (count.get(m) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 85;
}

/** « Comment se déroule une séance Valkyria, et sur quels principes ? » (P1.1.01, P1.5.01, P1.4.05) */
export default async function MethodPage() {
  await requireAdmin({ roles: ["admin"] });
  const [components, structure, principles, minutes] = await Promise.all([getComponents(), getStructure(), getPrinciples(), usualPracticeMinutes()]);
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · la méthode écrite noir sur blanc</p>
            <h1 className="mda-h1">Une séance Valkyria, du début à la fin</h1>
            <p className="mda-lead">Les éducateurs voient cette page dans leur portail (Méthode). Les blocs reprennent les places de la banque d&apos;exercices : jeu d&apos;entrée, ball mastery, technique, forme jouée.</p>
          </header>

          <section className="mda-card">
            <div className="mda-card-head" style={{ padding: 0, marginBottom: 8 }}>
              <div>
                <h2 className="mda-h2" style={{ margin: 0 }}>Ce que chaque entraînement doit avoir</h2>
                <p className="mda-sub" style={{ margin: "2px 0 0" }}>Ta ligne directrice, point par point : les composantes obligatoires de toute pratique Valkyria. Les éducateurs la voient avant chaque pratique.</p>
              </div>
              <Pill tone={components.validatedAt ? "good" : components.items.length ? "warn" : undefined}>{components.validatedAt ? "Validée par JP" : components.items.length ? `${components.items.length} point${components.items.length > 1 ? "s" : ""} · à valider` : "À écrire"}</Pill>
            </div>
            <ComponentsEditor initial={components.items} validated={Boolean(components.validatedAt)} ideas={COMPONENT_IDEAS} />
          </section>

          <section className="mda-card">
            <div className="mda-card-head" style={{ padding: 0, marginBottom: 8 }}>
              <h2 className="mda-h2">Structure de séance</h2>
              <Pill tone={structure.validatedAt ? "good" : "warn"}>{structure.validatedAt ? "Validée par JP" : structure.isProposal ? "Proposition tirée du plan" : "À valider"}</Pill>
            </div>
            <StructureEditor initial={structure.blocks} validated={Boolean(structure.validatedAt)} practiceMinutes={minutes} />
          </section>

          <section className="mda-card">
            <div className="mda-card-head" style={{ padding: 0, marginBottom: 8 }}>
              <h2 className="mda-h2">Principes de la pédagogie Valkyria</h2>
              <Pill tone={principles.validatedAt ? "good" : "warn"}>{principles.validatedAt ? "Validés par JP" : "Repris du plan, à compléter"}</Pill>
            </div>
            <PrinciplesEditor initial={principles.items} validated={Boolean(principles.validatedAt)} />
          </section>
        </div>
      </div>
    </>
  );
}
