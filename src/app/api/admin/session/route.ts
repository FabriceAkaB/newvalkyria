import { NextResponse } from "next/server";

import { getSessionAdminRole } from "@/lib/admin-auth";

export async function GET() {
  const role = await getSessionAdminRole();
  return NextResponse.json({ role });
}
