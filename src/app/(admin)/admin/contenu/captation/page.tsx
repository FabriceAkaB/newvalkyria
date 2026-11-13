import Link from "next/link";

import { CaptureToggle } from "@/components/content-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { addDaysIso, BALL_MASTERY_360, MATCH_PHOTOS, weekStart } from "@/lib/content-core";
import { hm, shortDate } from "@/lib/content-format";
import { getWeekPractices } from "@/lib/content-repo";

export const metadata = { title: "Captation — Création de contenu", robots: "noindex" };
export const dynamic = "force-dynamic";

const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

/** Espace Contenu › Captation : le protocole (ball mastery à 360°, photos de match, Veo) et le suivi de la semaine,
 *  activité par activité. Semaine précédente / suivante par ?semaine=AAAA-MM-JJ. */
export default async function CaptationPage({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const from = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(sp.semaine ?? "") ? sp.semaine! : todayIso());
  const items = await getWeekPractices(from);
  const shown = items.filter((p) => p.gym || p.type === "Match");
  const other = items.filter((p) => !p.gym && p.type === "Pratique");

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1100 }}>
        <header>
          <p className="mda-eyebrow">Filmer pour voir les progrès, et pour le raconter</p>
          <h1 className="mda-h1">Captation</h1>
          <p className="mda-lead">
            À chaque pratique en gymnase, le ball mastery se filme à 360°. À chaque match, chaque joueuse est prise en photo. La Veo filme l&apos;ensemble de la pratique pour
            l&apos;analyse. La personne caméra s&apos;occupe de tout ça ; les coachs coachent.
          </p>
        </header>

        <section className="mda-card-flush">
          <div className="mda-card-head" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <h2 className="mda-h2">
              Semaine du {shortDate(from)} au {shortDate(addDaysIso(from, 6))}
            </h2>
            <span style={{ display: "flex", gap: 12, fontSize: "0.85rem" }}>
              <Link href={`/admin/contenu/captation?semaine=${addDaysIso(from, -7)}`}>← Semaine d&apos;avant</Link>
              <Link href={`/admin/contenu/captation?semaine=${addDaysIso(from, 7)}`}>Semaine d&apos;après →</Link>
            </span>
          </div>
          <div style={{ padding: "0 16px 16px", display: "grid", gap: 10 }}>
            {shown.length === 0 ? <p style={{ margin: 0, color: "var(--adm-text-2)" }}>Aucune pratique en gymnase ni aucun match cette semaine.</p> : null}
            {shown.map((p) => (
              <div key={p.activityId} style={{ border: "1px solid var(--adm-line)", borderRadius: 12, padding: 12, display: "grid", gap: 8, background: p.captured ? "rgba(95,211,138,0.06)" : "transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ color: "var(--adm-text)" }}>
                    {p.captured ? "✓ " : ""}
                    {shortDate(p.date)} · {hm(p.start)} · {p.title}
                  </strong>
                  <span style={{ fontSize: "0.78rem", color: "var(--adm-text-3)" }}>
                    {p.type === "Match" ? "📸 Photos des joueuses" : "🔄 Ball mastery 360°"}
                    {p.veo ? " · 🎥 Veo reçue" : ""}
                  </span>
                </div>
                {p.location ? <span style={{ fontSize: "0.78rem", color: "var(--adm-text-3)" }}>{p.location}</span> : null}
                <CaptureToggle activityId={p.activityId} kind={p.kind} captured={p.captured} url={p.url} filmedBy={p.filmedBy} />
              </div>
            ))}
            {other.length ? (
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--adm-text-3)" }}>
                Pratiques sur synthétique cette semaine (pas de 360°, la Veo suffit) : {other.map((p) => `${shortDate(p.date)} ${p.title}`).join(" · ")}.
              </p>
            ) : null}
          </div>
        </section>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
          <section className="mda-card">
            <h2 className="mda-h2" style={{ marginTop: 0 }}>🔄 Tutoriel : le ball mastery à 360°</h2>
            <p style={{ margin: "0 0 6px", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>Matériel</p>
            <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: "0.88rem", display: "grid", gap: 3 }}>
              {BALL_MASTERY_360.gear.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: "0.88rem", display: "grid", gap: 6, lineHeight: 1.5 }}>
              {BALL_MASTERY_360.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>

          <section className="mda-card">
            <h2 className="mda-h2" style={{ marginTop: 0 }}>📸 Jours de match : les joueuses en photo</h2>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: "0.88rem", display: "grid", gap: 6, lineHeight: 1.5 }}>
              {MATCH_PHOTOS.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>

          <section className="mda-card">
            <h2 className="mda-h2" style={{ marginTop: 0 }}>🎥 La pratique au complet avec la Veo</h2>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.88rem", display: "grid", gap: 6, lineHeight: 1.5 }}>
              {BALL_MASTERY_360.veo.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p style={{ margin: "10px 0 0" }}>
              <Link href="/admin/matchs/videos">Matchs et pratiques filmés →</Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
