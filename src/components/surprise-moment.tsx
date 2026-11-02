"use client";

import { useState } from "react";

/** Moment surprise prévu pour la pratique (briefing de 5 minutes, P1.4.01). Même champ dans l'admin et le portail. */
export function SurpriseMomentEditor({ apiUrl, initial, inputClass, buttonClass }: { apiUrl: string; initial: string | null; inputClass: string; buttonClass: string }) {
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const save = async () => {
    setState("saving");
    const res = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }).catch(() => null);
    if (res?.ok) {
      setSaved(text);
      setState("idle");
    } else setState("error");
  };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <textarea
        className={inputClass}
        rows={2}
        value={text}
        placeholder="Ex. un défi surprise avec le ballon doré, une invitée, un jeu choisi par les filles…"
        onChange={(e) => setText(e.target.value)}
        aria-label="Moment surprise prévu"
        style={{ width: "100%", boxSizing: "border-box", minHeight: 64 }}
      />
      {text !== saved && (
        <button type="button" className={buttonClass} onClick={save} disabled={state === "saving"} style={{ justifySelf: "start" }}>
          {state === "saving" ? "Enregistrement…" : "Enregistrer le moment surprise"}
        </button>
      )}
      {state === "error" && <span style={{ color: "var(--adm-bad)", fontSize: "0.82rem" }}>Pas enregistré : réessaie.</span>}
    </div>
  );
}
