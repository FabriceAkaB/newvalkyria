import type { Metadata, Viewport } from "next";
import Link from "next/link";

import { AdminThemeToggle } from "@/components/admin-theme-toggle";
import { FamilyAppNav } from "@/components/family-app-nav";
import { adminFont } from "@/lib/admin-font";
import { getAdminTheme } from "@/lib/admin-theme";
import { getParentUserId } from "@/lib/parent-auth";

/** L'espace famille, une application à part du site (JP, 17 nov. 2026) : sa propre barre, ses onglets, installable
 *  sur l'écran d'accueil du téléphone. Les adresses restent /compte/… */

export const metadata: Metadata = {
  manifest: "/famille.webmanifest",
  appleWebApp: { capable: true, title: "New Valkyria", statusBarStyle: "black-translucent" },
  robots: "noindex"
};
export const viewport: Viewport = { themeColor: "#fafaf9" };

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const [signedIn, theme] = await Promise.all([getParentUserId().then(Boolean), getAdminTheme()]);
  // Même style que l'admin (JP, 19 nov. 2026) : jetons --adm-*, Inter, mode Jour / Nuit retenu dans le même cookie.
  return (
    <div className={`fam-app admin-shell ${adminFont.variable}`} data-theme={theme} data-signed-in={signedIn || undefined}>
      <header className="fam-bar">
        <Link href={signedIn ? "/compte/espace" : "/"} className="fam-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={30} height={36} />
          <span>
            <strong>New Valkyria</strong>
            <small>Espace famille</small>
          </span>
        </Link>
        <div className="fam-bar__right">
          <AdminThemeToggle compact />
          <Link href="/" className="fam-site">Site de l&apos;académie</Link>
        </div>
      </header>
      {signedIn ? <FamilyAppNav /> : null}
      <main className="fam-main">{children}</main>
    </div>
  );
}
