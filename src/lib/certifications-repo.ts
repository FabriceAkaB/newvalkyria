import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

const DOCUMENT_BUCKET = "coach-certification-documents";

export interface CoachCertification {
  id: string;
  coach_id: string;
  name: string;
  issued_date: string | null;
  expiry_date: string | null;
  document_url: string | null;
  notes: string | null;
  created_at: string;
}

export async function getCertificationsForCoach(coachId: string): Promise<CoachCertification[]> {
  const { data, error } = await db().from("coach_certifications").select("*").eq("coach_id", coachId).order("expiry_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CoachCertification[];
}

/** Toutes les certifications, jointes au nom de l'entraîneur — pour calculer
 *  les alertes d'expiration sur le tableau de bord Entraîneurs. */
export async function getAllCertificationsWithCoach(): Promise<(CoachCertification & { coach: { first_name: string; last_name: string } })[]> {
  const { data, error } = await db()
    .from("coach_certifications")
    .select("*, coach:coaches(first_name, last_name)")
    .not("expiry_date", "is", null)
    .order("expiry_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as any;
}

export async function addCertification(input: { coachId: string; name: string; issuedDate: string | null; expiryDate: string | null; notes: string | null }): Promise<string> {
  const { data, error } = await db()
    .from("coach_certifications")
    .insert({ coach_id: input.coachId, name: input.name, issued_date: input.issuedDate, expiry_date: input.expiryDate, notes: input.notes })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function deleteCertification(id: string): Promise<void> {
  const { error } = await db().from("coach_certifications").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setCertificationDocument(id: string, file: File): Promise<void> {
  const supabase = db();
  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = `${id}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase.from("coach_certifications").update({ document_url: path }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getCertificationDocumentSignedUrl(id: string): Promise<string | null> {
  const supabase = db();
  const { data: cert, error } = await supabase.from("coach_certifications").select("document_url").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!cert?.document_url) return null;

  const { data, error: signError } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(cert.document_url, 300);
  if (signError) throw new Error(signError.message);
  return data.signedUrl as string;
}

/* ── Alertes d'expiration ─────────────────────────────────────────── */

export interface CertificationAlert {
  certificationId: string;
  coachName: string;
  certificationName: string;
  expiryDate: string;
  status: "expired" | "expiring_soon";
}

const EXPIRY_WARNING_DAYS = 60;

export function computeCertificationAlerts(
  certifications: (CoachCertification & { coach: { first_name: string; last_name: string } })[],
  today: Date = new Date()
): CertificationAlert[] {
  const todayISO = today.toISOString().slice(0, 10);
  const warningThreshold = new Date(today);
  warningThreshold.setDate(today.getDate() + EXPIRY_WARNING_DAYS);
  const warningISO = warningThreshold.toISOString().slice(0, 10);

  const alerts: CertificationAlert[] = [];
  for (const c of certifications) {
    if (!c.expiry_date) continue;
    if (c.expiry_date < todayISO) {
      alerts.push({ certificationId: c.id, coachName: `${c.coach.first_name} ${c.coach.last_name}`, certificationName: c.name, expiryDate: c.expiry_date, status: "expired" });
    } else if (c.expiry_date <= warningISO) {
      alerts.push({ certificationId: c.id, coachName: `${c.coach.first_name} ${c.coach.last_name}`, certificationName: c.name, expiryDate: c.expiry_date, status: "expiring_soon" });
    }
  }
  return alerts;
}
