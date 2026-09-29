import ExcelJS from "exceljs";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getAllMembersForExport, MEMBER_EXPORT_HEADER } from "@/lib/monclubsportif-export";

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);

  const rows = await getAllMembersForExport();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("import_members");
  sheet.addRow(MEMBER_EXPORT_HEADER);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `membres-monclubsportif-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
