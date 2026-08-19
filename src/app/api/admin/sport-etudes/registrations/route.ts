import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getAllRegistrations, getEnrollmentsForRegistration } from "@/lib/sport-etudes-repo";

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const registrations = await getAllRegistrations();
  const withEnrollments = await Promise.all(
    registrations.map(async (r) => ({ ...r, enrollments: await getEnrollmentsForRegistration(r.id) }))
  );
  return NextResponse.json({ registrations: withEnrollments });
}
