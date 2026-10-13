import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export type BoysRegistrationSource = "session" | "sport-etudes" | "trial";
export type BoysRegistrationStatus = "pending" | "confirmed" | "paid" | "waitlist" | "cancelled" | "trial";

/** Une ligne de la vue unifiée « Inscriptions garçons » (tous les programmes garçons + essais gratuits). */
export interface BoysRegistrationRow {
  key: string;
  source: BoysRegistrationSource;
  id: string;
  /** Slug du programme (« sport-etudes » pour Sport-Études). */
  programSlug: string;
  programLabel: string;
  playerName: string;
  playerDob: string | null;
  birthYear: number | null;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  status: BoysRegistrationStatus;
  /** Libellé précis du statut pour les essais (confirmé, présent, absent, annulé). */
  statusDetail: string | null;
  priceCents: number | null;
  trialDate: string | null;
  comments: string | null;
  createdAt: string;
}

const TRIAL_STATUS_LABEL: Record<string, string> = { confirmed: "Essai confirmé", attended: "Essai — présent", absent: "Essai — absent", cancelled: "Essai annulé" };

function clean(s: string | null | undefined): string {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

/** Tous les garçons inscrits (programmes garçons de session + Sport-Études) et les essais gratuits. */
export async function getAllBoysRegistrations(): Promise<BoysRegistrationRow[]> {
  const supabase = db();
  const { data: programs } = await supabase.from("session_programs").select("slug, name, gender");
  const boysPrograms = (programs ?? []).filter((p: any) => p.gender === "garcons");
  const labelFor = (slug: string) => {
    const p = boysPrograms.find((x: any) => x.slug === slug);
    if (!p) return slug;
    return p.name.replace("Programme de développement ", "").replace(/^garçons/, "Garçons");
  };
  const slugs = boysPrograms.map((p: any) => p.slug);

  const [{ data: sessionRegs }, { data: seRegs }, { data: trials }] = await Promise.all([
    supabase.from("session_program_registrations").select("*").in("program_slug", slugs.length ? slugs : ["_none_"]),
    supabase.from("sport_etudes_registrations").select("*"),
    supabase.from("boys_trials").select("*")
  ]);

  const rows: BoysRegistrationRow[] = [];

  for (const r of sessionRegs ?? []) {
    rows.push({
      key: `session:${r.id}`,
      source: "session",
      id: r.id,
      programSlug: r.program_slug,
      programLabel: labelFor(r.program_slug),
      playerName: clean(`${r.player_first_name} ${r.player_last_name}`),
      playerDob: r.player_dob ?? null,
      birthYear: r.birth_year ?? (r.player_dob ? Number(String(r.player_dob).slice(0, 4)) : null),
      parentName: clean(r.parent_name),
      parentEmail: clean(r.parent_email),
      parentPhone: clean(r.parent_phone),
      status: r.status,
      statusDetail: null,
      priceCents: r.total_due_cents ?? r.price_cents ?? null,
      trialDate: null,
      comments: r.comments ?? null,
      createdAt: r.created_at
    });
  }

  for (const r of seRegs ?? []) {
    rows.push({
      key: `sport-etudes:${r.id}`,
      source: "sport-etudes",
      id: r.id,
      programSlug: "sport-etudes",
      programLabel: "Sport-Études",
      playerName: clean(`${r.player_first_name} ${r.player_last_name}`),
      playerDob: r.player_dob ?? null,
      birthYear: r.player_dob ? Number(String(r.player_dob).slice(0, 4)) : null,
      parentName: clean(`${r.parent_first_name} ${r.parent_last_name}`),
      parentEmail: clean(r.parent_email),
      parentPhone: clean(r.parent_phone),
      status: r.status,
      statusDetail: null,
      priceCents: r.price_cents ?? null,
      trialDate: null,
      comments: r.comments ?? null,
      createdAt: r.created_at
    });
  }

  for (const t of trials ?? []) {
    rows.push({
      key: `trial:${t.id}`,
      source: "trial",
      id: t.id,
      programSlug: t.program_slug,
      programLabel: labelFor(t.program_slug),
      playerName: clean(`${t.player_first_name} ${t.player_last_name}`),
      playerDob: null,
      birthYear: t.birth_year ?? null,
      parentName: clean(t.parent_name),
      parentEmail: clean(t.parent_email),
      parentPhone: clean(t.parent_phone),
      status: t.status === "cancelled" ? "cancelled" : "trial",
      statusDetail: TRIAL_STATUS_LABEL[t.status] ?? "Essai gratuit",
      priceCents: 0,
      trialDate: t.trial_date ?? null,
      comments: t.notes ?? null,
      createdAt: t.created_at
    });
  }

  return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
