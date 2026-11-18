"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FAMILY_COMMENT_MAX, FAMILY_COMMENT_MIN } from "@/lib/bulletin-report";

/** Le mot de l'éducatrice pour la famille, sur le bulletin (mi-saison ou fin de saison). Visible par la famille dès
 *  que le bulletin est remis ; à part des notes internes. Toujours constructif : une force, un point à travailler. */
export function CoachBulletinComment({ registrationId, period, firstName, initial }: { registrationId: string; period: "mi-saison" | "fin-saison"; firstName: string; initial: string }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setState("saving");
    setError(null);
    const res = await fetch("/api/coach/bulletin-commentaire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registrationId, period, text }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setState("idle");
      return setError(data?.error ?? "Pas enregistré : réessaie.");
    }
    setState("saved");
    router.refresh();
  };
  const n = text.trim().length;
  return (
    <div className="coach-card" style={{ marginBottom: 16 }}>
      <p className="coach-card__label">Mon mot pour la famille · {period === "mi-saison" ? "bulletin de mi-saison" : "bulletin de fin de saison"}</p>
      <p className="coach-sub" style={{ marginTop: 0 }}>
        La famille le lit dans son espace quand le bulletin est remis. Une force de {firstName}, puis un point à travailler et comment on va l&apos;aider. Jamais de comparaison avec une autre fille.
      </p>
      <textarea
        className="admin-input"
        rows={4}
        value={text}
        maxLength={FAMILY_COMMENT_MAX}
        onChange={(e) => {
          setText(e.target.value);
          setState("idle");
        }}
        placeholder={`Ex. ${firstName} garde la tête levée avec le ballon et encourage ses coéquipières. On travaille maintenant son pied gauche en conduite : 5 minutes par jour avec la routine du Lab.`}
        style={{ width: "100%", marginTop: 10, resize: "vertical" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" className="coach-primary" style={{ width: "auto", padding: "0 18px" }} disabled={state === "saving" || n < FAMILY_COMMENT_MIN} onClick={save}>
          {state === "saving" ? "Enregistrement…" : initial ? "Mettre à jour" : "Enregistrer"}
        </button>
        <span className="coach-muted">{n < FAMILY_COMMENT_MIN ? `Encore ${FAMILY_COMMENT_MIN - n} caractères` : state === "saved" ? "Enregistré ✓" : `${n} caractères`}</span>
      </div>
      {error ? <p className="coach-error" role="alert">{error}</p> : null}
    </div>
  );
}
