import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import { isAdminRequest } from "@/lib/admin-auth";
import { filterPayrollRows, getPayrollRows, groupPayrollByCoach, type CoachPayrollTotal } from "@/lib/coach-payroll-data";
import { jsonError } from "@/lib/http";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function buildCsv(rows: CoachPayrollTotal[]): string {
  const header = ["Entraîneur", "Heures", "Taux moyen ($)", "Salaire ($)", "Payé ($)", "Reste à payer ($)"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.name),
        r.hours.toFixed(2),
        (r.avgRateCents / 100).toFixed(2),
        (r.payCents / 100).toFixed(2),
        (r.paidCents / 100).toFixed(2),
        (r.remainingCents / 100).toFixed(2)
      ].join(",")
    );
  }
  return lines.join("\n");
}

async function buildXlsx(rows: CoachPayrollTotal[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Paie");
  sheet.columns = [
    { header: "Entraîneur", key: "name", width: 26 },
    { header: "Heures", key: "hours", width: 12 },
    { header: "Taux moyen ($)", key: "rate", width: 16 },
    { header: "Salaire ($)", key: "pay", width: 14 },
    { header: "Payé ($)", key: "paid", width: 14 },
    { header: "Reste à payer ($)", key: "remaining", width: 18 }
  ];
  sheet.getRow(1).font = { bold: true };
  for (const r of rows) {
    sheet.addRow({
      name: r.name,
      hours: Number(r.hours.toFixed(2)),
      rate: Number((r.avgRateCents / 100).toFixed(2)),
      pay: Number((r.payCents / 100).toFixed(2)),
      paid: Number((r.paidCents / 100).toFixed(2)),
      remaining: Number((r.remainingCents / 100).toFixed(2))
    });
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function buildPdf(rows: CoachPayrollTotal[]): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40, size: "letter" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fontSize(16).text("New Valkyria — Tableau de paie", { align: "left" });
    doc.fontSize(9).fillColor("#666").text(new Date().toLocaleDateString("fr-CA"), { align: "left" });
    doc.moveDown(1);

    const colX = [40, 220, 300, 380, 460, 520];
    const headers = ["Entraîneur", "Heures", "Taux ($)", "Salaire ($)", "Payé ($)", "Reste ($)"];
    doc.fontSize(10).fillColor("#000").font("Helvetica-Bold");
    headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { continued: false, width: 100 }));
    doc.moveDown(0.5);
    doc.font("Helvetica");

    let totalHours = 0;
    let totalPay = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    for (const r of rows) {
      const y = doc.y;
      doc.text(r.name, colX[0], y, { width: 170 });
      doc.text(r.hours.toFixed(2), colX[1], y);
      doc.text((r.avgRateCents / 100).toFixed(2), colX[2], y);
      doc.text((r.payCents / 100).toFixed(2), colX[3], y);
      doc.text((r.paidCents / 100).toFixed(2), colX[4], y);
      doc.text((r.remainingCents / 100).toFixed(2), colX[5], y);
      doc.moveDown(0.6);
      totalHours += r.hours;
      totalPay += r.payCents;
      totalPaid += r.paidCents;
      totalRemaining += r.remainingCents;
    }

    doc.moveDown(0.4);
    doc.font("Helvetica-Bold");
    const y = doc.y;
    doc.text("Total", colX[0], y);
    doc.text(totalHours.toFixed(2), colX[1], y);
    doc.text("—", colX[2], y);
    doc.text((totalPay / 100).toFixed(2), colX[3], y);
    doc.text((totalPaid / 100).toFixed(2), colX[4], y);
    doc.text((totalRemaining / 100).toFixed(2), colX[5], y);

    doc.end();
  });
}

export async function GET(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "csv";
  const month = searchParams.get("month") || undefined;
  const category = searchParams.get("category") || undefined;
  const activityType = searchParams.get("type") || undefined;
  const coachId = searchParams.get("coachId") || undefined;
  const paid = (searchParams.get("paid") as "paid" | "unpaid" | null) || undefined;
  const weekOnly = searchParams.get("weekOnly") === "1";

  const allRows = await getPayrollRows();
  const weekStartISO = weekOnly ? new Date(Date.now() - ((new Date().getDay() + 6) % 7) * 86400000).toISOString().slice(0, 10) : undefined;
  const filtered = filterPayrollRows(allRows, { month, category, activityType, coachId, paid, weekStartISO });
  const grouped = groupPayrollByCoach(filtered);

  const filename = `paie-new-valkyria-${new Date().toISOString().slice(0, 10)}`;

  if (format === "xlsx") {
    const buffer = await buildXlsx(grouped);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`
      }
    });
  }

  if (format === "pdf") {
    const buffer = await buildPdf(grouped);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`
      }
    });
  }

  return new Response(buildCsv(grouped), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`
    }
  });
}
