import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { sendContractCopyToEmployee } from "@/lib/email";
import { getContract, renderAndStore, updateContract, uploadFile } from "@/lib/employee-contracts";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("countersign"), id: z.string().uuid(), signature: z.string().startsWith("data:image/png;base64,") }),
  z.object({ action: z.literal("cancel"), id: z.string().uuid() })
]);

/** Contresignature par l'Académie (la copie finale est renvoyée à l'employée) et annulation d'un lien. */
export async function POST(request: Request) {
  if ((await getCurrentAdminRole()) !== "admin") return jsonError("Non autorisé", 401);
  try {
    const body = schema.parse(await request.json());
    const contract = await getContract(body.id);
    if (!contract) return jsonError("Contrat introuvable", 404);

    if (body.action === "cancel") {
      if (contract.status === "signed") return jsonError("Un contrat signé ne peut pas être annulé ici.", 409);
      await updateContract(contract.id, { status: "cancelled" });
      return NextResponse.json({ ok: true });
    }

    const path = `${contract.id}/signature-employeur.png`;
    await uploadFile(path, Buffer.from(body.signature.split(",")[1], "base64"), "image/png");
    const employerSignedAt = new Date().toISOString();
    await updateContract(contract.id, { employer_signature_path: path, employer_signed_at: employerSignedAt });

    let emailed = false;
    if (contract.status === "signed" && contract.employee_data) {
      const { masked } = await renderAndStore({ ...contract, employer_signature_path: path, employer_signed_at: employerSignedAt });
      const to = contract.employee_data.email || contract.employee_email;
      if (to) {
        await sendContractCopyToEmployee({ to, firstName: contract.employee_data.firstName, title: contract.title, pdf: masked, countersigned: true, schedule: contract.pay_schedule });
        emailed = true;
      }
    }
    return NextResponse.json({ ok: true, emailed });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 500);
  }
}
