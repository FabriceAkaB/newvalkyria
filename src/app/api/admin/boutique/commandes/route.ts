import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getOrders, maskOrderAmountsForGerante } from "@/lib/shop-repo";

export async function GET() {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);
  const orders = await getOrders();
  return NextResponse.json({ orders: role === "gerante" ? maskOrderAmountsForGerante(orders) : orders });
}
