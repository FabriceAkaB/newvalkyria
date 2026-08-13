import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

const BUCKET = "documents";

export const DOCUMENT_CATEGORIES = ["Contrat", "Formulaire", "Certificat", "Autorisation", "Facture", "Reçu", "Autre"] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export type DocumentEntityType = "registration" | "lead" | "coach";

export interface EntityDocument {
  id: string;
  entity_type: DocumentEntityType;
  entity_id: string;
  category: string;
  file_name: string;
  storage_path: string;
  uploaded_by: string | null;
  uploaded_at: string;
}

export async function getDocumentsForEntity(entityType: DocumentEntityType, entityId: string): Promise<EntityDocument[]> {
  const { data, error } = await db()
    .from("documents")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EntityDocument[];
}

export async function addDocument(input: { entityType: DocumentEntityType; entityId: string; category: string; uploadedBy: string | null; file: File }): Promise<string> {
  const supabase = db();
  const ext = input.file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = `${input.entityType}/${input.entityId}/${Date.now()}-${input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, input.file, { contentType: input.file.type, upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("documents")
    .insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      category: input.category,
      file_name: input.file.name,
      storage_path: path,
      uploaded_by: input.uploadedBy
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function deleteDocument(id: string): Promise<void> {
  const supabase = db();
  const { data: doc, error: fetchErr } = await supabase.from("documents").select("storage_path").eq("id", id).maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (doc?.storage_path) await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getDocumentSignedUrl(id: string): Promise<string | null> {
  const supabase = db();
  const { data: doc, error } = await supabase.from("documents").select("storage_path").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!doc?.storage_path) return null;

  const { data, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 300);
  if (signError) throw new Error(signError.message);
  return data.signedUrl as string;
}
