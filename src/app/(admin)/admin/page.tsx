import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin-login-form";
import { ADMIN_COOKIE_NAME, ADMIN_COOKIE_VALUE } from "@/lib/admin-auth";

export const metadata = { title: "Administration — New Valkyria", robots: "noindex" };

export default async function AdminLoginPage() {
  const cookieStore = await cookies();
  if (cookieStore.get(ADMIN_COOKIE_NAME)?.value === ADMIN_COOKIE_VALUE) {
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
