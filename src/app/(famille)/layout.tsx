import type { Metadata, Viewport } from "next";
import Link from "next/link";

import { FamilyAppNav } from "@/components/family-app-nav";
import { getParentUserId } from "@/lib/parent-auth";

/** L'espace famille, une application à part du site (JP, 17 nov. 2026) : sa propre barre, ses onglets, installable
 *  sur l'écran d'accueil du téléphone. Les adresses restent /compte/… */

export const metadata: Metadata = {
  manifest: "/famille.webmanifest",
  appleWebApp: { capable: true, title: "New Valkyria", statusBarStyle: "black-translucent" },
  robots: "noindex"
};
export const viewport: Viewport = { themeColor: "#09070e" };

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const signedIn = Boolean(await getParentUserId());
  return (
    <div className="fam-app" data-signed-in={signedIn || undefined}>
      <div className="page-background" aria-hidden />
      <header className="fam-bar">
        <Link href={signedIn ? "/compte/espace" : "/"} className="fam-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={30} height={36} />
          <span>
            <strong>New Valkyria</strong>
            <small>Espace famille</small>
          </span>
        </Link>
        <Link href="/" className="fam-site">Site de l&apos;académie</Link>
      </header>
      {signedIn ? <FamilyAppNav /> : null}
      <main className="fam-main">{children}</main>
    </div>
  );
}
