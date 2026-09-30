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
        <p className="admin-login-brand">New Valkyria</p>
        <p className="admin-login-sub">Espace Technique</p>
        <CoachLoginForm />
      </div>
    </div>
  );
}
