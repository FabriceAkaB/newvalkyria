"use client";

import { useEffect, useState } from "react";

/** Connexion expirée pendant qu'un éducateur remplit son rapport (JP, 20 nov. 2026 : « Non autorisé » en
 *  enregistrant une note) : au lieu d'une erreur muette, un bandeau dit quoi faire. Ce qui est écrit reste à l'écran ;
 *  on se reconnecte dans un nouvel onglet, puis on touche Enregistrer de nouveau. Le bandeau part tout seul quand la
 *  connexion est revenue. */
export function CoachSessionGuard() {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const original = window.fetch;
    // Toute réponse 401 d'une route du portail = connexion expirée.
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await original(...args);
      const url = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
      if (res.status === 401 && url.includes("/api/coach/") && !url.includes("/api/coach/auth")) setExpired(true);
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, []);

  useEffect(() => {
    if (!expired) return;
    // De retour sur l'onglet après s'être reconnecté : le bandeau disparaît.
    const check = () =>
      fetch("/api/coach/moi")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.connected && setExpired(false))
        .catch(() => null);
    window.addEventListener("focus", check);
    const t = setInterval(check, 10000);
    return () => {
      window.removeEventListener("focus", check);
      clearInterval(t);
    };
  }, [expired]);

  if (!expired) return null;
  return (
    <div role="alert" style={{ position: "fixed", left: 16, right: 16, bottom: "calc(16px + var(--coach-tabbar-space, 0px))", zIndex: 50, maxWidth: 640, margin: "0 auto", background: "var(--adm-surface)", border: "1px solid var(--adm-warn)", boxShadow: "var(--adm-shadow)", borderRadius: 12, padding: "14px 16px", display: "grid", gap: 10, color: "var(--adm-text)" }}>
      <p style={{ margin: 0, fontWeight: 600 }}>Ta connexion au portail a expiré : rien n&apos;a été enregistré.</p>
      <p style={{ margin: 0, color: "var(--adm-text-2)", fontSize: "0.9rem" }}>
        Ce que tu as écrit est encore à l&apos;écran, ne ferme pas cette page. Touche « Me reconnecter » (un nouvel onglet s&apos;ouvre), connecte-toi, puis reviens ici et touche Enregistrer de nouveau.
      </p>
      <a href="/entraineur" target="_blank" rel="noreferrer" className="coach-primary" style={{ textAlign: "center", textDecoration: "none", marginTop: 0 }}>
        Me reconnecter
      </a>
    </div>
  );
}
