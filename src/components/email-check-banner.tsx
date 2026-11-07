"use client";

import { useState } from "react";

/** Courriel du compte parent pas encore confirmé : explication + bouton pour renvoyer le lien. */
export function EmailCheckBanner() {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "wait" | "error">("idle");
  return (
    <div style={{ background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.4)", borderRadius: 12, padding: "0.9rem 1rem", display: "grid", gap: "0.5rem", color: "#f1e3b0", fontSize: "0.9rem" }}>
      <p style={{ margin: 0 }}>
        <strong>Confirmez votre courriel</strong> pour voir le bulletin, les inscriptions et les matchs filmés de votre fille. C&apos;est ce qui nous assure que c&apos;est bien vous.
      </p>
      <div>
        <button
          type="button"
          disabled={state === "busy" || state === "sent"}
          onClick={async () => {
            setState("busy");
            const res = await fetch("/api/compte/confirmer", { method: "POST" }).catch(() => null);
            const json = await res?.json().catch(() => null);
            setState(!res?.ok ? "error" : json?.sent ? "sent" : "wait");
          }}
          style={{ minHeight: 40, padding: "0 14px", borderRadius: 10, border: "none", background: "#c9a227", color: "#1d1730", fontWeight: 700, cursor: "pointer" }}
        >
          {state === "busy" ? "Envoi…" : state === "sent" ? "Lien envoyé : regardez vos courriels" : "Envoyer le lien de confirmation"}
        </button>
      </div>
      {state === "wait" ? <p style={{ margin: 0 }}>Un lien vient d&apos;être envoyé : regardez vos courriels (et les indésirables).</p> : null}
      {state === "error" ? <p style={{ margin: 0 }}>Erreur : réessayez dans un instant.</p> : null}
    </div>
  );
}
