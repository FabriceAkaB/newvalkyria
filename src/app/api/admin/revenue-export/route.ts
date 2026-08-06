import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getRevenueExportRows } from "@/lib/revenue-calc";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET() {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }

  const rows = await getRevenueExportRows();

  const header = ["Date", "Type", "Saison", "Catégorie", "Description", "Montant total ($)", "Taxe (%)", "Montant net ($)", "Montant taxe ($)", "Compte"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.date,
        row.type,
        row.season,
        row.category,
        csvEscape(row.description),
        (row.amountCents / 100).toFixed(2),
        (row.taxRate * 100).toFixed(2),
        (row.netAmountCents / 100).toFixed(2),
        (row.taxAmountCents / 100).toFixed(2),
        row.paidWith
      ].join(",")
    );
  }

  return new Response(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="revenus-new-valkyria-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
