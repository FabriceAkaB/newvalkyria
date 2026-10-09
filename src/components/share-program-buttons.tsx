"use client";

import { useState } from "react";

import { buildShareMessage, privateProgramUrl, shareLinks } from "@/lib/private-programs";

export interface ShareProgram {
  slug: string;
  shortName: string;
  priceCents: number;
  practices: number;
  matches: number;
  capacity: number;
  feeCents: number;
  referralDiscountCents: number;
}

/** Boutons de partage (copier, WhatsApp, courriel, SMS) — utilise le lien
 *  personnel de référencement quand le parent est connecté (refCode fourni),
 *  sinon le lien normal du programme. Le message est généré à partir des
 *  vraies données du programme : impossible de partager le mauvais lien. */
export function ShareProgramButtons({ program, refCode, origin }: { program: ShareProgram; refCode?: string | null; origin: string }) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  const link = privateProgramUrl(origin, program.slug, refCode);
  const message = buildShareMessage({
    program: { slug: program.slug, shortName: program.shortName, priceCents: program.priceCents },
    link,
    practices: program.practices,
    matches: program.matches,
    capacity: program.capacity,
    feeCents: program.feeCents,
    referralDiscountCents: program.referralDiscountCents,
    withReferralMention: Boolean(refCode)
  });
  const links = shareLinks(message, link, `Programme de soccer New Valkyria — ${program.shortName}`);

  const copy = async (what: "link" | "message") => {
    const text = what === "link" ? link : message;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copiez ce texte :", text);
    }
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  const btn: React.CSSProperties = {
    padding: "0.5rem 0.8rem",
    borderRadius: "8px",
    border: "1px solid #302e36",
    background: "#17151e",
    color: "#fff",
    fontSize: "0.78rem",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-block"
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" style={btn} onClick={() => copy("link")}>{copied === "link" ? "✓ Lien copié" : "Copier le lien"}</button>
        <a style={btn} href={links.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
        <a style={btn} href={links.email}>Courriel</a>
        <a style={btn} href={links.sms}>SMS</a>
        <button type="button" style={btn} onClick={() => copy("message")}>{copied === "message" ? "✓ Message copié" : "Copier le message"}</button>
      </div>
      <details style={{ marginTop: "0.6rem" }}>
        <summary style={{ fontSize: "0.72rem", color: "#9d9da0", cursor: "pointer" }}>Voir le message partagé</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.75rem", color: "#c3c2c8", background: "#100e17", border: "1px solid #251f30", borderRadius: "8px", padding: "0.7rem", marginTop: "0.4rem", fontFamily: "inherit" }}>{message}</pre>
      </details>
    </div>
  );
}
