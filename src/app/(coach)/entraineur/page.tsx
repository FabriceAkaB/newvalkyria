import { redirect } from "next/navigation";

import { CoachLoginForm } from "@/components/coach-login-form";
import { getCurrentCoachId } from "@/lib/coach-auth";

export const metadata = { title: "Espace Technique — New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function CoachLoginPage() {
  if (await getCurrentCoachId()) {
    redirect("/entraineur/dashboard");
  }

  return (
    <div className="admin-login-shell">
      <div className="admin-login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={44} height={53} className="admin-login-logo" />
        <h1 className="admin-login-brand">New Valkyria</h1>
        <p className="admin-login-sub">Espace Technique</p>
        <CoachLoginForm />
      </div>
    </div>
  );
}
