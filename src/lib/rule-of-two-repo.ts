import { RULE_OF_TWO_VERSION, checkSignerName } from "@/lib/rule-of-two";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Engagements à la règle de deux (P8.3.01) : signés par l'éducateur dans Mon dossier, lus par JP dans Suivi. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface RuleOfTwoPledge {
  coachId: string;
  version: string;
  signerName: string;
  signedAt: string;
  signerIp: string | null;
  current: boolean;
}

const toPledge = (r: any): RuleOfTwoPledge => ({
  coachId: r.coach_id,
  version: r.version,
  signerName: r.signer_name,
  signedAt: r.signed_at,
  signerIp: r.signer_ip ?? null,
  current: r.version === RULE_OF_TWO_VERSION
});

/** Le dernier engagement de chaque éducateur (la version en cours d'abord). */
export async function getRuleOfTwoPledges(coachIds?: string[]): Promise<Map<string, RuleOfTwoPledge>> {
  let q = db().from("coach_rule_of_two").select("coach_id, version, signer_name, signed_at, signer_ip").order("signed_at", { ascending: false });
  if (coachIds) {
    if (!coachIds.length) return new Map();
    q = q.in("coach_id", coachIds);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const out = new Map<string, RuleOfTwoPledge>();
  for (const r of (data ?? []) as any[]) {
    const p = toPledge(r);
    const prev = out.get(p.coachId);
    if (!prev || (!prev.current && p.current)) out.set(p.coachId, p);
  }
  return out;
}

/** L'éducateur s'engage (une fois par version du texte). Renvoie le problème, ou null. */
export async function signRuleOfTwo(input: { coachId: string; typedName: string; ip: string | null; userAgent: string | null }): Promise<string | null> {
  const { data: coach } = await db().from("coaches").select("first_name, last_name").eq("id", input.coachId).maybeSingle();
  if (!coach) return "Éducateur introuvable.";
  const problem = checkSignerName(input.typedName, coach);
  if (problem) return problem;
  const { error } = await db()
    .from("coach_rule_of_two")
    .upsert(
      {
        coach_id: input.coachId,
        version: RULE_OF_TWO_VERSION,
        signer_name: input.typedName.trim().replace(/\s+/g, " ").slice(0, 120),
        signed_at: new Date().toISOString(),
        signer_ip: input.ip?.slice(0, 64) ?? null,
        user_agent: input.userAgent?.slice(0, 300) ?? null
      },
      { onConflict: "coach_id,version", ignoreDuplicates: true }
    );
  if (error) throw new Error(error.message);
  return null;
}
