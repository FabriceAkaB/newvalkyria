import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin-login-form";
import { isAdminRequest } from "@/lib/admin-auth";

export const metadata = { title: "Administration — New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminRequest()) {
    redirect("/admin/aujourdhui");
  }

  return (
    <div className="admin-login-shell">
      <div className="admin-login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={44} height={53} className="admin-login-logo" />
        <h1 className="admin-login-brand">New Valkyria</h1>
        <p className="admin-login-sub">Administration</p>
        <AdminLoginForm />
      </div>
    </div>
  );
}
