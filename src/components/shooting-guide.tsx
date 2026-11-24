import { Backpack, Camera, Clapperboard, ListChecks, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { ShotDiagram } from "@/components/shot-diagrams";
import { CAMERA_KIT, clipCount, CTA, FORMATS, PRACTICE_MOMENTS, PRACTICE_SHOTS, SHOOT_RULES, SHOT_TYPES, shotLabel, shotListFor } from "@/lib/shooting-guide-core";

/** Le guide de tournage (P3.2.24), le même pour l'admin (/admin/contenu/guide) et le portail des éducateurs
 *  (/entraineur/guide-tournage) : la personne caméra, puis Will, filment « comme chez nous » sans JP. */

const icon = { size: 18, strokeWidth: 1.75, "aria-hidden": true } as const;
const p: React.CSSProperties = { margin: 0, fontSize: "0.88rem", color: "var(--adm-text-2)", lineHeight: 1.5 };

function Section({ id, title, ic, lead, children }: { id: string; title: string; ic: ReactNode; lead?: string; children: ReactNode }) {
  return (
    <section className="mda-card" id={id} style={{ scrollMarginTop: 80 }}>
      <h2 className="mda-h2" style={{ marginTop: 0, display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ color: "var(--adm-accent)", display: "inline-flex" }}>{ic}</span>
        {title}
      </h2>
      {lead ? <p style={{ ...p, margin: "0 0 14px" }}>{lead}</p> : null}
      {children}
    </section>
  );
}

export function ShootingGuide({ consent }: { consent?: { given: number; total: number } | null }) {
  const gymClips = clipCount(shotListFor({ gym: true }));
  const fieldClips = clipCount(shotListFor({ gym: false }));
  return (
    <>
      <nav aria-label="Sections du guide" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[
          ["regles", "Les règles"],
          ["plans", "Les 9 plans"],
          ["pratique", "À chaque pratique"],
          ["formats", "Les formats"],
          ["materiel", "Le matériel"]
        ].map(([id, l]) => (
          <a key={id} href={`#${id}`} className="mda-pill" style={{ textDecoration: "none", padding: "6px 12px", fontSize: "0.8rem" }}>
            {l}
          </a>
        ))}
      </nav>

      <Section id="regles" title="Les règles, avant tout" ic={<ShieldCheck {...icon} />}>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" }}>
          {SHOOT_RULES.map((r) => (
            <div key={r.title} style={{ border: "1px solid var(--adm-line)", borderLeft: r.strict ? "3px solid var(--adm-bad)" : "1px solid var(--adm-line)", borderRadius: 10, padding: "10px 12px" }}>
              <strong style={{ fontSize: "0.9rem", color: "var(--adm-text)" }}>{r.title}</strong>
              <p style={{ ...p, marginTop: 4, fontSize: "0.85rem" }}>{r.text}</p>
            </div>
          ))}
        </div>
        {consent ? (
          <p className="mda-pill" data-tone={consent.given < consent.total / 2 ? "warn" : "good"} style={{ marginTop: 12, whiteSpace: "normal", lineHeight: 1.4, padding: "6px 12px" }}>
            Consentement photo : {consent.given} joueuse{consent.given > 1 ? "s" : ""} sur {consent.total} cette saison. Pour toutes les autres, on filme de dos, les pieds ou le ballon.
          </p>
        ) : null}
      </Section>

      <Section id="plans" title="Les 9 types de plans" ic={<Camera {...icon} />} lead="Toujours à la verticale, comme on regarde un téléphone. Chaque dessin montre ce qu'on voit dans l'écran.">
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
          {SHOT_TYPES.map((s) => (
            <article key={s.id} style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: 12, border: "1px solid var(--adm-line)", borderRadius: 12, padding: 12, alignItems: "start" }}>
              <ShotDiagram id={s.id} title={s.label} />
              <div style={{ display: "grid", gap: 4, fontSize: "0.84rem", lineHeight: 1.45, color: "var(--adm-text-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "baseline" }}>
                  <strong style={{ fontSize: "0.95rem", color: "var(--adm-text)" }}>{s.label}</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--adm-text-3)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{s.seconds} s</span>
                </div>
                <span>{s.what}</span>
                <span>
                  <strong style={{ color: "var(--adm-text)" }}>Comment :</strong> {s.how}
                </span>
                <span>
                  <strong style={{ color: "var(--adm-text)" }}>Sert à :</strong> {s.use}
                </span>
                <span style={{ color: "var(--adm-bad)" }}>À éviter : {s.avoid}</span>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section
        id="pratique"
        title="La liste des plans à chaque pratique"
        ic={<ListChecks {...icon} />}
        lead={`Dans l'ordre de la pratique : environ ${gymClips} clips en gymnase, ${fieldClips} sur le terrain. Les blocs Valkyria Lab et l'entrevue s'ajoutent les jours où ils sont prévus.`}
      >
        <div style={{ display: "grid", gap: 14 }}>
          {PRACTICE_MOMENTS.map((m) => {
            const items = PRACTICE_SHOTS.filter((s) => s.moment === m.id);
            return (
              <div key={m.id}>
                <h3 style={{ margin: "0 0 6px", fontSize: "0.9rem", fontWeight: 600, color: "var(--adm-text)" }}>{m.label}</h3>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                  {items.map((s) => (
                    <li key={s.key} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "baseline", fontSize: "0.86rem", padding: "6px 0", borderBottom: "1px solid var(--adm-line)" }}>
                      <span style={{ color: "var(--adm-text)" }}>
                        <span className="mda-pill" style={{ fontSize: "0.72rem", marginRight: 8, verticalAlign: "1px" }}>
                          {shotLabel(s.shot)}
                        </span>
                        {s.what}
                        {s.gymOnly ? <span style={{ color: "var(--adm-text-3)" }}> (gymnase seulement)</span> : null}
                      </span>
                      <span style={{ color: "var(--adm-text-3)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>× {s.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="formats" title="La recette de chaque format" ic={<Clapperboard {...icon} />} lead={`Chaque contenu finit par le même appel à l'action : « ${CTA} ».`}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
          {FORMATS.map((f) => (
            <article key={f.id} style={{ border: "1px solid var(--adm-line)", borderRadius: 12, padding: 14, display: "grid", gap: 8, alignContent: "start" }}>
              <div>
                <strong style={{ fontSize: "1rem", color: "var(--adm-text)" }}>{f.label}</strong>
                <div style={{ fontSize: "0.78rem", color: "var(--adm-text-3)", marginTop: 2 }}>{f.length}</div>
              </div>
              <p style={{ ...p, fontSize: "0.85rem" }}>{f.goal}</p>
              <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                {f.steps.map((st) => (
                  <li key={st.at} style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 8, fontSize: "0.84rem", lineHeight: 1.45 }}>
                    <span style={{ color: "var(--adm-accent)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{st.at}</span>
                    <span style={{ color: "var(--adm-text)" }}>{st.what}</span>
                  </li>
                ))}
              </ol>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {f.shots.map((s) => (
                  <span key={s} className="mda-pill" data-tone="accent" style={{ fontSize: "0.72rem" }}>
                    {shotLabel(s)}
                  </span>
                ))}
              </div>
              <p style={{ ...p, fontSize: "0.82rem" }}>
                <strong style={{ color: "var(--adm-text)" }}>Texte à l&apos;écran :</strong> {f.text}
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.82rem", color: "var(--adm-text-2)", display: "grid", gap: 3 }}>
                {f.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section id="materiel" title="Le matériel, vérifié la veille" ic={<Backpack {...icon} />}>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.88rem", display: "grid", gap: 4, color: "var(--adm-text)" }}>
          {CAMERA_KIT.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </Section>
    </>
  );
}
