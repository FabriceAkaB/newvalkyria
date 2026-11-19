import Link from "next/link";

import { CoachSetPasswordForm } from "@/components/coach-password-forms";
import { checkPasswordLink } from "@/lib/coach-auth";

export const metadata = { title: "Choisir mon mot de passe — Espace Technique", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Lien personnel (invitation de 7 jours ou « mot de passe oublié » de 2 h) pour choisir son mot de passe. */
export default async function CoachSetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = /^[A-Za-z0-9_-]{20,60}$/.test(token) ? await checkPasswordLink(token) : null;
  return (
    <div className="admin-login-shell">
      <div className="admin-login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={44} height={53} className="admin-login-logo" />
        <h1 className="admin-login-brand">Mon mot de passe</h1>
        <p className="admin-login-sub">Espace Technique</p>
        {link ? (
          <CoachSetPasswordForm token={token} firstName={link.firstName} />
        ) : (
          <div className="admin-login-form">
            <p className="admin-login-sub" style={{ margin: 0 }}>Ce lien n&apos;est plus valide (déjà utilisé ou expiré).</p>
            <Link href="/entraineur/mot-de-passe-oublie" className="admin-btn-primary" style={{ textAlign: "center" }}>Recevoir un nouveau lien</Link>
          </div>
        )}
      </div>
    </div>
  );
}
