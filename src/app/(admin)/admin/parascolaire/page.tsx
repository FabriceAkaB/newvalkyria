import { AdminKindSection } from "@/components/admin-kind-section";
import { AdminTopbar } from "@/components/admin-topbar";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata = { title: "Parascolaire — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const role = await requireAdmin();
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <AdminKindSection kind="parascolaire" canCreate={role === "admin"} />
      </div>
    </>
  );
}
