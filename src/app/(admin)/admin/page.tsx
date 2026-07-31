import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin-login-form";
import { isAdminRequest } from "@/lib/admin-auth";

export const metadata = { title: "Administration — New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminRequest()) {
    redirect("/admin/dashboard");
  }

  return (
    <div className="admin-login-shell">
      <div className="admin-login-card">
        <p className="admin-login-brand">New Valkyria</p>
        <p className="admin-login-sub">Administration</p>
        <AdminLoginForm />
      </div>
    </div>
  );
}
