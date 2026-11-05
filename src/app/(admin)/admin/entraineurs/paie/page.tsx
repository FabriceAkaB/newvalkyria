import { AdminEntraineursPaie } from "@/components/admin-entraineurs-paie";
import { requireAdmin } from "@/lib/admin-auth";
import { getPayrollRows, holdDetail, missingBeforePayroll } from "@/lib/coach-payroll-data";
import { getCoaches } from "@/lib/coaches-repo";
import { nextPayPeriod } from "@/lib/pay-periods";

export const metadata = { title: "Paie — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminEntraineursPaiePage() {
  await requireAdmin({ roles: ["admin"] });
  const [rows, coaches] = await Promise.all([getPayrollRows(), getCoaches()]);
  const missing = missingBeforePayroll(rows).map((r) => ({ ...r, detail: holdDetail(r) }));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const next = nextPayPeriod(today);
  const fr = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return (
    <>
      <div className="admin-content" style={{ paddingBottom: 0 }}>
        <p className="admin-section" style={{ margin: 0, fontSize: "0.9rem", color: "var(--adm-text-2)" }}>
          <strong style={{ color: "var(--adm-text)" }}>Prochaine paie : {fr(next.payDate)}</strong> · elle couvre du {fr(next.from)} au {fr(next.to)} (paie aux deux semaines). Les présences des éducateurs dans MonClubSportif confirment leurs heures chaque soir.
        </p>
      </div>
      <AdminEntraineursPaie rows={rows} coaches={coaches} missing={missing} />
    </>
  );
}
