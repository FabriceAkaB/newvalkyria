import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { addCertification, getCertificationsForCoach } from "@/lib/certifications-repo";
import { jsonError } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const certifications = await getCertificationsForCoach(id);
  return NextResponse.json({ certifications });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { name?: string; issuedDate?: string | null; expiryDate?: string | null; notes?: string | null } | null;
  if (!body?.name?.trim()) return jsonError("Nom de la certification requis", 400);

  const certId = await addCertification({
    coachId: id,
    name: body.name.trim(),
    issuedDate: body.issuedDate || null,
    expiryDate: body.expiryDate || null,
    notes: body.notes?.trim() || null
  });

  return NextResponse.json({ ok: true, id: certId }, { status: 201 });
}
