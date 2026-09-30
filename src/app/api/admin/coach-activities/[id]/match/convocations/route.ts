import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getConvocations, removeConvocation, setConvocation, type ConvocationStatus } from "@/lib/match-repo";

const VALID_STATUSES: readonly string[] = ["convoked", "confirmed", "declined", "absent"] satisfies readonly ConvocationStatus[];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const convocations = await getConvocations(id);
  return NextResponse.json({ convocations });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { registrationId?: string; status?: string } | null;
  if (!body?.registrationId || !body.status || !VALID_STATUSES.includes(body.status)) return jsonError("Paramètres invalides", 400);

  await setConvocation(id, body.registrationId, body.status as ConvocationStatus);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const registrationId = searchParams.get("registrationId");
  if (!registrationId) return jsonError("registrationId requis", 400);

  await removeConvocation(id, registrationId);
  return NextResponse.json({ ok: true });
}
