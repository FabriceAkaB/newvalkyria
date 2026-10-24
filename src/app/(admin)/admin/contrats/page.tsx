import { AdminContracts } from "@/components/admin-contracts";
import { requireAdmin } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { getAllContracts } from "@/lib/employee-contracts";

export const metadata = { title: "Contrats — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminContractsPage() {
  // Données confidentielles (NAS, chèque) : administrateur seulement.
  await requireAdmin({ roles: ["admin"] });
  const contracts = await getAllContracts();
  return (
    <AdminContracts
      origin={env.publicSiteUrl}
      contracts={contracts.map((c) => ({
        id: c.id,
        token: c.token,
        employeeName: c.employee_name,
        title: c.title,
        status: c.status,
        signedAt: c.signed_at,
        employerSignedAt: c.employer_signed_at,
        hasCheque: Boolean(c.cheque_path),
        schedule: c.pay_schedule,
        summary: c.summary,
        contact: c.employee_data
          ? { email: c.employee_data.email, mobile: c.employee_data.mobile, address: `${c.employee_data.address}, ${c.employee_data.city} ${c.employee_data.postalCode}` }
          : null
      }))}
    />
  );
}
