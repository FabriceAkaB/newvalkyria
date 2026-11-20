import { AdminCodeResetForm } from "@/components/admin-code-reset";
import { checkAdminCodeReset } from "@/lib/admin-auth";

export const metadata = { title: "Nouveau code — New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Le lien « code oublié » reçu par courriel : JP choisit un nouveau code administrateur. */
export default async function AdminCodeResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await checkAdminCodeReset(token);
  return (
    <div className="admin-login-shell">
      <div className="admin-login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={44} height={53} className="admin-login-logo" />
        <h1 className="admin-login-brand">Nouveau code</h1>
        {valid ? (
          <AdminCodeResetForm token={token} />
        ) : (
          <>
            <p className="admin-login-sub">Ce lien n&apos;est plus valable (30 minutes, un seul usage).</p>
            <a href="/admin" className="admin-btn-primary" style={{ textDecoration: "none", textAlign: "center" }}>Demander un nouveau lien</a>
          </>
        )}
      </div>
    </div>
  );
}
