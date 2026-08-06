import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";

export async function GET() {
  const role = await getCurrentAdminRole();
  return NextResponse.json({ role });
}
