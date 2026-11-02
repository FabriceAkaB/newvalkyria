import Link from "next/link";

/** En-tête commun d'une section admin : titre, une phrase d'explication,
 *  puis éventuellement ses onglets (`AdminTabs`). */
export function AdminPageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <header className="admin-page-header">
      <h1 className="admin-page-header-title">{title}</h1>
      {description && <p className="admin-page-header-desc">{description}</p>}
      {children}
    </header>
  );
}

/** Onglets d'une section : des liens vers des pages, l'actif surligné. */
export function AdminTabs({ tabs, activeHref }: { tabs: { href: string; label: string }[]; activeHref?: string | null }) {
  return (
    <nav className="admin-tabs" aria-label="Onglets de la section">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className="admin-tab" data-active={String(tab.href === activeHref)} aria-current={tab.href === activeHref ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
