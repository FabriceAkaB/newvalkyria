import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const MAX_SEMI_PRIVATE_CAPACITY = 6;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Crée un programme juvénile semi-privé à partir du gabarit : toujours en
 *  BROUILLON (non publié, page fermée) tant que l'administrateur ne l'a pas validé. */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    gender?: "filles" | "garcons" | "mixte";
    birthYears?: string[];
    priceCents?: number;
    capacity?: number;
    installmentFeeCents?: number;
    referralDiscountCents?: number;
    practices?: number;
    matches?: number;
    costPerSessionCents?: number;
    fixedCostsCents?: number;
    description?: string;
  } | null;

  if (!body?.name?.trim()) return jsonError("Le nom du programme est requis.", 400);
  const years = (body.birthYears ?? []).map((y) => String(y).trim()).filter((y) => /^\d{4}$/.test(y));
  if (years.length === 0) return jsonError("Indiquez au moins une année de naissance admissible (ex. 2015).", 400);
  const gender = body.gender && ["filles", "garcons", "mixte"].includes(body.gender) ? body.gender : "mixte";
  const capacity = Math.max(1, Math.min(MAX_SEMI_PRIVATE_CAPACITY, Math.round(body.capacity ?? MAX_SEMI_PRIVATE_CAPACITY)));
  const int = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : fallback);

  const db = getSupabaseAdminClient() as any;
  let slug = `semi-prive-${slugify(body.name)}`;
  const { data: existing } = await db.from("session_programs").select("slug").like("slug", `${slug}%`);
  if (existing?.length) slug = `${slug}-${existing.length + 1}`;

  const { error } = await db.from("session_programs").insert({
    slug,
    name: body.name.trim(),
    gender,
    birth_years: years.join("-"),
    price_cents: int(body.priceCents),
    max_capacity: capacity,
    description: body.description?.trim() || null,
    active: false,
    published: false,
    is_private: true,
    program_kind: "semi_prive_juvenile",
    practices_count: int(body.practices, 0) || null,
    matches_count: int(body.matches, 0),
    installment_fee_cents: int(body.installmentFeeCents),
    referral_discount_cents: int(body.referralDiscountCents),
    eligible_birth_years: years,
    cost_per_session_cents: int(body.costPerSessionCents),
    fixed_costs_cents: int(body.fixedCostsCents),
    presentation: {}
  });
  if (error) return jsonError(error.message, 422);
  return NextResponse.json({ ok: true, slug });
}
