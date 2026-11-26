"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Onglets du dossier d'une joueuse : chaque section est préparée par le serveur, l'onglet ouvert est gardé dans
 *  l'adresse (#rapports, #sondages…) pour qu'un lien ouvre directement la bonne section. */
export interface DossierTab {
  key: string;
  label: string;
  count?: number | null;
  tone?: "bad" | "warn";
  content: ReactNode;
}

export function DossierTabs({ tabs }: { tabs: DossierTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (tabs.some((t) => t.key === h)) setActive(h);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [tabs]);

  const open = (key: string) => {
    setActive(key);
    history.replaceState(null, "", `#${key}`);
  };

  return (
    <>
      <nav className="pd-tabs" aria-label="Sections du dossier" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={active === t.key} data-active={active === t.key || undefined} onClick={() => open(t.key)}>
            {t.label}
            {t.count ? <span className="pd-tabs__count" data-tone={t.tone}>{t.count}</span> : null}
          </button>
        ))}
      </nav>
      {tabs.map((t) => (
        <section key={t.key} role="tabpanel" aria-label={t.label} hidden={active !== t.key} className="pd-panel">
          {t.content}
        </section>
      ))}
    </>
  );
}
