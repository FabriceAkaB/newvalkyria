import { Pill } from "@/components/mandalart/ui";
import type { AgentBlueprint, MissionMode, MissionState } from "@/lib/agents-blueprint";

const STATE: Record<MissionState, { label: string; tone?: "good" | "warn" }> = {
  existe: { label: "Existe", tone: "good" },
  partiel: { label: "Partiel", tone: "warn" },
  a_construire: { label: "À construire" }
};
const MODE: Record<MissionMode, string> = { regle: "Règle fixe", brouillon: "Brouillon validé", autonome: "Autonome" };

const label: React.CSSProperties = { margin: "0 0 4px", fontWeight: 600, fontSize: "0.82rem", color: "var(--adm-text)" };
const chips: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 4 };
const chip = (tone: "read" | "write" | "no"): React.CSSProperties => ({
  fontSize: "0.72rem",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  padding: "2px 7px",
  borderRadius: 6,
  background: tone === "write" ? "color-mix(in srgb, var(--adm-good) 16%, transparent)" : tone === "no" ? "color-mix(in srgb, var(--adm-bad) 14%, transparent)" : "var(--adm-surface-2)",
  color: tone === "no" ? "var(--adm-bad)" : "var(--adm-text-2)",
  textDecoration: tone === "no" ? "line-through" : undefined
});

/** Le cahier de charges d'un agent : ses missions (ce qui existe, ce qui manque), ses accès exacts et ses outils. */
export function AgentBlueprintView({ b }: { b: AgentBlueprint }) {
  const done = b.missions.filter((m) => m.state === "existe").length;
  return (
    <div style={{ borderTop: "1px solid var(--adm-border)", paddingTop: 14, display: "grid", gap: 14 }}>
      <div>
        <p className="mda-eyebrow" style={{ margin: 0 }}>Cahier de charges</p>
        <p className="mda-label" style={{ margin: "2px 0 0" }}>
          <strong style={{ color: "var(--adm-text)" }}>Sa case :</strong> {b.scope}
        </p>
      </div>

      <div>
        <p style={label}>
          Missions · {done}/{b.missions.length} existent déjà
        </p>
        <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
          {b.missions.map((m) => (
            <li key={m.title} style={{ fontSize: "0.85rem", color: "var(--adm-text-2)", lineHeight: 1.5 }}>
              <span style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                <strong style={{ color: "var(--adm-text)", fontWeight: 600 }}>{m.title}</strong>
                <Pill tone={STATE[m.state].tone}>{STATE[m.state].label}</Pill>
                <Pill tone="info">{MODE[m.mode]}</Pill>
                {m.automation ? <a href={`#${m.automation}`} style={{ fontSize: "0.75rem", color: "var(--adm-accent)" }}>{m.automation}</a> : null}
              </span>
              <span style={{ display: "block" }}>Quand : {m.when}{m.validation ? ` · Valide : ${m.validation}` : ""}</span>
              {m.existing ? <span style={{ display: "block" }}>Déjà là : {m.existing}</span> : null}
              {m.missing ? <span style={{ display: "block", color: "var(--adm-warn)" }}>À construire : {m.missing}</span> : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="mda-cols-2">
        <div>
          <p style={label}>Lit</p>
          <div style={chips}>{b.reads.map((t) => <span key={t} style={chip("read")}>{t}</span>)}</div>
        </div>
        <div>
          <p style={label}>Peut écrire</p>
          <div style={chips}>{b.writes.map((t) => <span key={t} style={chip("write")}>{t}</span>)}</div>
        </div>
        <div>
          <p style={label}>Interdit</p>
          <div style={chips}>{b.forbidden.map((t) => <span key={t} style={chip("no")}>{t}</span>)}</div>
        </div>
        <div>
          <p style={label}>Outils du site qu&apos;il peut appeler</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.8rem", color: "var(--adm-text-2)", lineHeight: 1.5 }}>
            {b.tools.map((t) => (
              <li key={`${t.module}.${t.fn}`}>
                <code style={{ fontSize: "0.76rem" }}>{t.fn}</code> : {t.why}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p style={label}>Canaux et clés</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.8rem", color: "var(--adm-text-2)", lineHeight: 1.5 }}>
            {b.channels.map((c) => <li key={c}>{c}</li>)}
            {b.secrets.map((s) => <li key={s}>🔑 {s}</li>)}
          </ul>
        </div>
        <div>
          <p style={label}>Ce qu&apos;il doit connaître</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.8rem", color: "var(--adm-text-2)", lineHeight: 1.5 }}>
            {b.knowledge.map((k) => <li key={k}>{k}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
