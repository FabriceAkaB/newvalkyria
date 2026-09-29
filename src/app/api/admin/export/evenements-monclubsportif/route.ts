import ExcelJS from "exceljs";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { EVENT_EXPORT_HEADER, getAllEventsForExport } from "@/lib/monclubsportif-export";

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);

  const rows = await getAllEventsForExport();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Fr");
  sheet.addRow(EVENT_EXPORT_HEADER);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `evenements-monclubsportif-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
