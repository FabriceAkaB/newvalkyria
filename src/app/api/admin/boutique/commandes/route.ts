import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getOrders } from "@/lib/shop-repo";

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const orders = await getOrders();
  return NextResponse.json({ orders });
}
