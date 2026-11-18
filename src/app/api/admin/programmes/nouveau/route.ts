import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Ouvre un camp de jour ou un groupe parascolaire (JP, 17 nov. 2026) : un programme à dates fixes, toujours en
 *  BROUILLON (non publié) ; les dates, le prix, la page et les inscriptions se gèrent ensuite dans sa fiche. */

const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const b = (await request.json().catch(() => null)) as { kind?: string; name?: string; gender?: string; birthYears?: string[]; priceCents?: number; capacity?: number; school?: string } | null;
  if (b?.kind !== "camp" && b?.kind !== "parascolaire") return jsonError("Type invalide", 400);
  if (!b.name?.trim()) return jsonError("Donne un nom (ex. Camp de la relâche 2027, ou Parascolaire école X).", 400);
  const years = (b.birthYears ?? []).map((y) => String(y).trim()).filter((y) => /^\d{4}$/.test(y));
  const gender = b.gender && ["filles", "garcons", "mixte"].includes(b.gender) ? b.gender : b.kind === "parascolaire" ? "mixte" : "filles";
  const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
  const db = getSupabaseAdminClient() as any;
  let slug = `${b.kind}-${slugify(b.name)}`;
  const { data: existing } = await db.from("session_programs").select("slug").like("slug", `${slug}%`);
  if (existing?.length) slug = `${slug}-${existing.length + 1}`;
  const { error } = await db.from("session_programs").insert({
    slug,
    name: b.name.trim().slice(0, 120),
    gender,
    birth_years: years.join("-") || null,
    eligible_birth_years: years,
    price_cents: int(b.priceCents),
    max_capacity: Math.max(1, int(b.capacity) || (b.kind === "camp" ? 40 : 20)),
    active: false,
    published: false,
    is_private: false,
    program_kind: b.kind,
    presentation: b.school?.trim() ? { school: b.school.trim().slice(0, 120) } : {}
  });
  if (error) return jsonError(error.message, 422);
  return NextResponse.json({ ok: true, slug });
}
