import { CoachForgotForm } from "@/components/coach-password-forms";

export const metadata = { title: "Mot de passe oublié — Espace Technique", robots: "noindex" };

export default function CoachForgotPage() {
  return (
    <div className="admin-login-shell">
      <div className="admin-login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={44} height={53} className="admin-login-logo" />
        <h1 className="admin-login-brand">Mot de passe oublié</h1>
        <p className="admin-login-sub">Espace Technique</p>
        <CoachForgotForm />
      </div>
    </div>
  );
}
