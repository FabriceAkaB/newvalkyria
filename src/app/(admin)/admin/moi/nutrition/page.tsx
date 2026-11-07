import { MealDelete, MealForm } from "@/components/jp-space";
import { requireAdmin } from "@/lib/admin-auth";
import { addDays, MEAL_LABEL, nutritionDay, QUALITY_LABEL } from "@/lib/jp-core";
import { getMeals } from "@/lib/jp-repo";
import { todayIso } from "@/lib/mandalart-repo";

export const metadata = { title: "Ma nutrition — Espace JP", robots: "noindex" };
export const dynamic = "force-dynamic";

const longDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Journal de nutrition de JP : chaque repas, ses protéines et une note simple (bien, moyen, à améliorer), 14 jours. */
export default async function NutritionPage() {
  await requireAdmin({ roles: ["admin"] });
  const today = todayIso();
  const meals = await getMeals(addDays(today, -13), today);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i));
  const t = nutritionDay(meals, today);
  const week = days.slice(0, 7).map((d) => nutritionDay(meals, d)).filter((d) => d.meals.length);
  const avgProtein = week.length ? Math.round(week.reduce((s, d) => s + d.protein, 0) / week.length) : null;
  const rated = meals.filter((m) => m.day >= days[6] && m.quality);
  const good = rated.length ? Math.round((rated.filter((m) => m.quality === "bien").length / rated.length) * 100) : null;
  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">Du carburant pour les journées de terrain</p>
          <h1 className="mda-h1">Ma nutrition</h1>
          <p className="mda-lead">Note chaque repas en 10 secondes : ce que tu as mangé, les protéines si tu les connais, et si c&apos;était bien. Le but : 3 vrais repas par jour, un repas avant chaque pratique, assez de protéines.</p>
        </header>

        <section className="mda-cols-3">
          <div className="mda-card">
            <p className="mda-num" style={{ color: t.mainMeals < 3 ? "var(--adm-warn)" : "var(--adm-good)" }}>{t.mainMeals}/3</p>
            <p className="mda-label">Vrais repas aujourd&apos;hui · {t.protein} g de protéines</p>
          </div>
          <div className="mda-card">
            <p className="mda-num">{avgProtein ?? "—"} g</p>
            <p className="mda-label">Protéines par jour (moyenne des 7 derniers jours notés)</p>
          </div>
          <div className="mda-card">
            <p className="mda-num">{good === null ? "—" : `${good} %`}</p>
            <p className="mda-label">Repas « bien » sur 7 jours</p>
          </div>
        </section>

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginTop: 0 }}>Noter un repas</h2>
          <MealForm today={today} />
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">Les 14 derniers jours</h2>
          </div>
          <ul className="mda-tasks">
            {days
              .filter((d) => meals.some((m) => m.day === d))
              .map((d) => {
                const n = nutritionDay(meals, d);
                return (
                  <li key={d} className="mda-task" style={{ display: "block" }}>
                    <p className="mda-task-title" style={{ fontWeight: 600 }}>
                      {longDay(d)} <span style={{ fontWeight: 400, color: "var(--adm-text-3)" }}>· {n.mainMeals}/3 repas · {n.protein} g de protéines</span>
                    </p>
                    <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "grid", gap: 4 }}>
                      {n.meals.map((m) => (
                        <li key={m.id} className="mda-task-meta" style={{ fontSize: "0.85rem" }}>
                          <span style={{ fontWeight: 600 }}>{MEAL_LABEL[m.moment]}</span>
                          <span>{m.description}</span>
                          {m.protein_g ? <span>{m.protein_g} g</span> : null}
                          {m.quality ? <span style={{ color: m.quality === "bien" ? "var(--adm-good)" : m.quality === "moyen" ? "var(--adm-warn)" : "var(--adm-bad)" }}>{QUALITY_LABEL[m.quality]}</span> : null}
                          <MealDelete id={m.id} />
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
          </ul>
          {!meals.length ? <p style={{ padding: "14px 20px", margin: 0, fontSize: "0.88rem", color: "var(--adm-text-3)" }}>Aucun repas noté depuis 2 semaines.</p> : null}
        </section>
      </div>
    </div>
  );
}
