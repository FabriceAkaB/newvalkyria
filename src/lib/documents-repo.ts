import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

const BUCKET = "documents";

export const DOCUMENT_CATEGORIES = ["Contrat", "Formulaire", "Certificat", "Autorisation", "Facture", "Reçu", "Paie", "Pratique", "Autre"] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export type DocumentEntityType = "registration" | "lead" | "coach" | "coach_activity" | "sponsor" | "expense";

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

/** Lien de dépôt signé : le navigateur envoie le fichier directement au stockage (pas de limite de 4,5 Mo du serveur). */
export async function createDocumentUpload(folder: string, fileName: string): Promise<{ path: string; signedUrl: string }> {
  const path = `${folder}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Lien de dépôt impossible à créer");
  return { path, signedUrl: data.signedUrl };
}

/** Inscrit un fichier déjà envoyé au stockage (après vérification qu'il est bien arrivé). */
export async function registerDocument(input: { entityType: DocumentEntityType; entityId: string; category: string; fileName: string; storagePath: string; uploadedBy: string | null }): Promise<string> {
  const slash = input.storagePath.lastIndexOf("/");
  const folder = input.storagePath.slice(0, slash);
  const name = input.storagePath.slice(slash + 1);
  if (!name || input.storagePath.includes("..")) throw new Error("Fichier invalide");
  const { data: found, error: listErr } = await db().storage.from(BUCKET).list(folder, { search: name, limit: 5 });
  if (listErr) throw new Error(listErr.message);
  if (!(found ?? []).some((o: any) => o.name === name)) throw new Error("Le fichier n'est pas arrivé. Recommencez le dépôt.");
  const { data, error } = await db()
    .from("documents")
    .insert({ entity_type: input.entityType, entity_id: input.entityId, category: input.category, file_name: input.fileName, storage_path: input.storagePath, uploaded_by: input.uploadedBy })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Rattache un document déjà déposé à une autre fiche (ex. la même pratique pour une autre date), sans recopier le fichier. */
export async function linkDocument(sourceId: string, target: { entityType: DocumentEntityType; entityId: string; uploadedBy: string | null }): Promise<string> {
  const { data: doc, error: fetchErr } = await db().from("documents").select("category, file_name, storage_path").eq("id", sourceId).maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!doc) throw new Error("Document introuvable");
  const { data, error } = await db()
    .from("documents")
    .insert({ entity_type: target.entityType, entity_id: target.entityId, category: doc.category, file_name: doc.file_name, storage_path: doc.storage_path, uploaded_by: target.uploadedBy })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function deleteDocument(id: string): Promise<void> {
  const supabase = db();
  const { data: doc, error: fetchErr } = await supabase.from("documents").select("storage_path").eq("id", id).maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  // Une pratique réutilisée à plusieurs dates partage le même fichier : on ne l'efface qu'au dernier document.
  if (doc?.storage_path) {
    const { count } = await supabase.from("documents").select("id", { count: "exact", head: true }).eq("storage_path", doc.storage_path);
    if ((count ?? 0) <= 1) await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  }
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Utilisé pour vérifier qu'un entraîneur a le droit de consulter un
 *  document précis (l'activité correspondante lui est bien assignée) avant
 *  de lui délivrer une URL signée — voir /api/coach/documents. */
export async function getDocumentEntityRef(id: string): Promise<{ entity_type: DocumentEntityType; entity_id: string } | null> {
  const { data, error } = await db().from("documents").select("entity_type, entity_id").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as { entity_type: DocumentEntityType; entity_id: string } | null;
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
