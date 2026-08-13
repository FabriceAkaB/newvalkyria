import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export interface Player {
  id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  verified: boolean;
  created_at: string;
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Trouve la joueuse existante correspondant à ce nom/DOB au sein de la même
 *  famille (email OU téléphone du parent déjà vus sur une autre inscription),
 *  sinon en crée une nouvelle. Ne fusionne jamais deux familles différentes —
 *  même logique que le backfill du 14 août 2026 (voir supabase/migrations). */
export async function findOrCreatePlayer(input: {
  firstName: string | null;
  lastName: string | null;
  dob: string | null;
  parentEmail: string;
  parentPhone: string;
}): Promise<string | null> {
  if (!input.firstName || !input.lastName) return null;

  const supabase = db();
  const firstKey = normalizeName(input.firstName);
  const lastKey = normalizeName(input.lastName);

  if (input.dob) {
    // Cherche parmi les inscriptions de cette famille (même email ou même
    // téléphone) une joueuse déjà liée avec le même nom+DOB normalisés.
    const { data: familyRegs, error } = await supabase
      .from("registrations")
      .select("player_id, player_first_name, player_last_name, player_dob")
      .or(`parent_email.eq.${input.parentEmail},parent_phone.eq.${input.parentPhone}`)
      .not("player_id", "is", null);
    if (!error && familyRegs) {
      const match = (familyRegs as any[]).find(
        (r) =>
          normalizeName(r.player_first_name ?? "") === firstKey &&
          normalizeName(r.player_last_name ?? "") === lastKey &&
          r.player_dob === input.dob
      );
      if (match) return match.player_id as string;
    }
  }

  const { data: created, error: insertErr } = await supabase
    .from("players")
    .insert({ first_name: input.firstName, last_name: input.lastName, dob: input.dob, verified: Boolean(input.dob) })
    .select("id")
    .single();
  if (insertErr) throw new Error(insertErr.message);
  return created.id as string;
}
