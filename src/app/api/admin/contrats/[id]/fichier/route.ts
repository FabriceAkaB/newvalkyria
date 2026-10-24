import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { getContract, signedUrl } from "@/lib/employee-contracts";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Fichiers confidentiels d'un contrat (NAS, chèque) : administrateur seulement, lien valide 5 minutes. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if ((await getCurrentAdminRole()) !== "admin") return jsonError("Non autorisé", 401);
  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) return jsonError("Contrat introuvable", 404);
  const type = new URL(request.url).searchParams.get("type");
  const path = type === "cheque" ? contract.cheque_path : type === "signed" ? contract.signed_pdf_path : contract.template_path;
  if (!path) return jsonError("Fichier pas encore disponible", 404);
  const url = await signedUrl(path);
  if (!url) return jsonError("Fichier introuvable", 404);
  return NextResponse.redirect(url);
}
