import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getMcsStatus, markImported, markPhotoSent, markRemoved } from "@/lib/mcs-sync";
import { EVENT_EXPORT_HEADER, MEMBER_EXPORT_HEADER } from "@/lib/monclubsportif-export";

export const dynamic = "force-dynamic";

/** Fichier des nouveautés seulement, prêt à importer dans MonClubSportif. */
export async function GET(request: Request) {
  if ((await getCurrentAdminRole()) !== "admin") return jsonError("Non autorisé", 401);
  const file = new URL(request.url).searchParams.get("fichier");
  if (file !== "membres" && file !== "evenements") return jsonError("Fichier inconnu", 400);
  const s = await getMcsStatus();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(file === "membres" ? "import_members" : "Fr");
  sheet.addRow(file === "membres" ? MEMBER_EXPORT_HEADER : EVENT_EXPORT_HEADER);
  sheet.getRow(1).font = { bold: true };
  for (const row of file === "membres" ? s.newMembers : s.newEvents) sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="nouveaux-${file}-monclubsportif-${new Date().toISOString().slice(0, 10)}.xlsx"`
    }
  });
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("imported"), kind: z.enum(["membre", "evenement"]) }),
  z.object({ action: z.literal("removed"), key: z.string().min(3).max(400) }),
  z.object({ action: z.literal("photo"), key: z.string().min(3).max(400), label: z.string().max(200) })
]);

export async function POST(request: Request) {
  if ((await getCurrentAdminRole()) !== "admin") return jsonError("Non autorisé", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Demande invalide");
  if (parsed.data.action === "imported") return NextResponse.json({ ok: true, count: await markImported(parsed.data.kind) });
  if (parsed.data.action === "photo") {
    await markPhotoSent(parsed.data.key, parsed.data.label);
    return NextResponse.json({ ok: true });
  }
  await markRemoved(parsed.data.key);
  return NextResponse.json({ ok: true });
}
