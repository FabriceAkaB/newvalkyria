import { AdminTopbar } from "@/components/admin-topbar";
import { BoysRegistrationsTable } from "@/components/admin-boys-registrations";
import { requireAdmin } from "@/lib/admin-auth";
import { getAllBoysRegistrations } from "@/lib/boys-registrations";

export const metadata = { title: "Inscriptions garçons — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminBoysRegistrationsPage() {
  await requireAdmin();
  const rows = await getAllBoysRegistrations();
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <BoysRegistrationsTable initialRows={rows} />
        </div>
      </div>
    </>
  );
}
