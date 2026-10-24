import { createHash, randomBytes } from "crypto";
import { PDFDocument, PDFSignature, PDFTextField, rgb, StandardFonts, type PDFForm } from "pdf-lib";

import { decryptSecret, encryptSecret } from "@/lib/mail-config";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Contrats d'embauche signés en ligne : l'employée reçoit un lien personnel,
 *  remplit ses informations, signe une fois (la signature est apposée sur chaque
 *  document) et reçoit sa copie. Tout est conservé dans un stockage privé. */

export const CONTRACT_BUCKET = "employee-contracts";

function db() {
  return getSupabaseAdminClient() as any;
}

export interface PayRow {
  period: string;
  payDate: string; // AAAA-MM-JJ
  hours: string;
  amountCents: number;
}

export interface ContractSummaryItem {
  label: string;
  value: string;
}

export interface EmployeeContract {
  id: string;
  token: string;
  employee_name: string;
  employee_email: string | null;
  title: string;
  template_path: string;
  status: "sent" | "signed" | "cancelled";
  summary: ContractSummaryItem[];
  pay_schedule: PayRow[];
  prefill: Record<string, string>;
  employee_data: EmployeeFormData | null;
  sin_encrypted: string | null;
  signed_at: string | null;
  signer_ip: string | null;
  signer_user_agent: string | null;
  signed_pdf_path: string | null;
  cheque_path: string | null;
  employer_signature_path: string | null;
  employer_signed_at: string | null;
  created_at: string;
}

/** Ce que l'employée remplit (sans le NAS, conservé chiffré à part). */
export interface EmployeeFormData {
  lastName: string;
  firstName: string;
  birthDate: string;
  gender: "h" | "f" | "a";
  address: string;
  city: string;
  postalCode: string;
  mobile: string;
  homePhone: string;
  email: string;
  emergencyLastName: string;
  emergencyFirstName: string;
  emergencyRelationship: string;
  emergencyMobile: string;
  emergencyWork: string;
  emergencyHome: string;
  imageConsent: boolean;
  signedAtCity: string;
  initials: string;
  documentsAccepted: string[];
}

/** Les 10 documents du contrat, dans l'ordre du PDF. */
export const CONTRACT_DOCUMENTS = [
  "Lettre d'offre d'emploi",
  "Fiche de poste",
  "Fiche de l'employée + spécimen de chèque",
  "Entente de confidentialité et de cession de droits",
  "Code de déontologie",
  "Politique — relations interpersonnelles",
  "Politique — paris et jeux d'argent",
  "Politique — harcèlement, intimidation, discrimination",
  "Consentement — utilisation de l'image",
  "Politique — drogues et alcool"
];

const EMPLOYEE_SIGNATURE_FIELDS = ["sig_offre_employe", "sig_poste", "sig_fiche", "sig_conf", "sig_code", "sig_rel", "sig_paris", "sig_harc", "sig_image", "sig_drog"];
const EMPLOYER_SIGNATURE_FIELDS = ["sig_offre_employeur"];
const PLACE_DATE_PREFIXES = ["poste", "conf", "code", "rel", "paris", "harc", "image", "drog"];

export function newContractToken(): string {
  return randomBytes(18).toString("base64url");
}

export function maskSin(sin: string): string {
  const digits = sin.replace(/\D/g, "");
  return digits.length >= 3 ? `*** *** ${digits.slice(-3)}` : "***";
}

export function formatDateFr(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Toronto" });
}

// ── Accès aux données ──

export async function getContractByToken(token: string): Promise<EmployeeContract | null> {
  const { data } = await db().from("employee_contracts").select("*").eq("token", token).maybeSingle();
  return data ?? null;
}

export async function getContract(id: string): Promise<EmployeeContract | null> {
  const { data } = await db().from("employee_contracts").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

export async function getAllContracts(): Promise<EmployeeContract[]> {
  const { data, error } = await db().from("employee_contracts").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function downloadFile(path: string): Promise<Uint8Array> {
  const { data, error } = await db().storage.from(CONTRACT_BUCKET).download(path);
  if (error || !data) throw new Error(`Fichier introuvable : ${path}`);
  return new Uint8Array(await data.arrayBuffer());
}

export async function uploadFile(path: string, bytes: Uint8Array | Buffer, contentType: string) {
  const { error } = await db().storage.from(CONTRACT_BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

export async function signedUrl(path: string, seconds = 300): Promise<string | null> {
  const { data } = await db().storage.from(CONTRACT_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

export function maskedPath(contract: Pick<EmployeeContract, "id">) {
  return `${contract.id}/contrat-signe-copie.pdf`;
}

export function decryptSin(contract: Pick<EmployeeContract, "sin_encrypted">): string {
  return contract.sin_encrypted ? decryptSecret(contract.sin_encrypted) : "";
}

export function encryptSin(sin: string): string {
  return encryptSecret(sin.replace(/\s+/g, " ").trim());
}

// ── Génération du PDF signé ──

function setText(form: PDFForm, name: string, value: string) {
  try {
    form.getTextField(name).setText(value);
  } catch {
    /* champ absent de ce modèle */
  }
}

function setCheck(form: PDFForm, name: string, checked: boolean) {
  try {
    const box = form.getCheckBox(name);
    if (checked) box.check();
    else box.uncheck();
  } catch {
    /* champ absent */
  }
}

async function drawSignature(pdf: PDFDocument, form: PDFForm, fieldName: string, png: Uint8Array) {
  let field;
  try {
    field = form.getField(fieldName);
  } catch {
    return;
  }
  if (!(field instanceof PDFSignature)) return;
  const image = await pdf.embedPng(png);
  for (const widget of field.acroField.getWidgets()) {
    const rect = widget.getRectangle();
    const ref = pdf.context.getObjectRef(widget.dict);
    const page = (ref && pdf.findPageForAnnotationRef(ref)) ?? pdf.getPages().find((p) => p.ref === widget.P());
    if (!page) continue;
    const scale = Math.min((rect.width - 40) / image.width, (rect.height + 6) / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, { x: rect.x + 34, y: rect.y + (rect.height - h) / 2 + 2, width: w, height: h });
  }
}

export interface BuildPdfInput {
  template: Uint8Array;
  contract: Pick<EmployeeContract, "prefill" | "employee_email">;
  data: EmployeeFormData;
  sin: string;
  signatureDate: string; // AAAA-MM-JJ
  employeeSignature: Uint8Array;
  employerSignature?: Uint8Array | null;
  employerSignedAt?: string | null;
  audit: { signedAtIso: string; ip: string | null; userAgent: string | null };
}

/** Remplit le PDF original (champs + signatures + initiales), l'aplatit et ajoute
 *  une page « certificat de signature électronique ». */
export async function buildSignedPdf(input: BuildPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input.template);
  const form = pdf.getForm();
  const { data, prefill } = { data: input.data, prefill: input.contract.prefill ?? {} };
  const dateLabel = formatDateFr(input.signatureDate);
  const fullName = `${data.firstName} ${data.lastName}`.trim();

  for (const [key, value] of Object.entries(prefill)) setText(form, key, value);
  setText(form, "nom_employe", fullName);
  setText(form, "offre_emp_date", dateLabel);
  for (const p of PLACE_DATE_PREFIXES) {
    setText(form, `${p}_lieu`, data.signedAtCity);
    setText(form, `${p}_date`, dateLabel);
  }
  setText(form, "fiche_nom", data.lastName);
  setText(form, "fiche_prenom", data.firstName);
  setText(form, "fiche_nas", input.sin);
  setText(form, "fiche_naissance", data.birthDate);
  setCheck(form, "fiche_genre_h", data.gender === "h");
  setCheck(form, "fiche_genre_f", data.gender === "f");
  setCheck(form, "fiche_genre_a", data.gender === "a");
  setText(form, "fiche_adresse", data.address);
  setText(form, "fiche_ville", data.city);
  setText(form, "fiche_cp", data.postalCode);
  setText(form, "fiche_cell", data.mobile);
  setText(form, "fiche_maison", data.homePhone);
  setText(form, "fiche_courriel", data.email);
  setCheck(form, "fiche_cheque", true);
  setText(form, "urg_nom", data.emergencyLastName);
  setText(form, "urg_prenom", data.emergencyFirstName);
  setText(form, "urg_lien", data.emergencyRelationship);
  setText(form, "urg_cell", data.emergencyMobile);
  setText(form, "urg_travail", data.emergencyWork);
  setText(form, "urg_maison", data.emergencyHome);
  setCheck(form, "fiche_certif", true);
  setText(form, "fiche_date", dateLabel);
  setCheck(form, "image_oui", data.imageConsent);
  setCheck(form, "image_non", !data.imageConsent);
  for (let i = 1; i <= pdf.getPageCount(); i++) setText(form, `initiales_p${i}`, data.initials);
  if (input.employerSignedAt && !prefill.offre_date) setText(form, "offre_date", formatDateFr(input.employerSignedAt));

  for (const name of EMPLOYEE_SIGNATURE_FIELDS) await drawSignature(pdf, form, name, input.employeeSignature);
  if (input.employerSignature) for (const name of EMPLOYER_SIGNATURE_FIELDS) await drawSignature(pdf, form, name, input.employerSignature);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  // Tous les champs texte (même vides) reçoivent une apparence, sinon l'aplatissement échoue.
  for (const field of form.getFields()) if (field instanceof PDFTextField) field.updateAppearances(font);
  // Les champs de signature n'ont pas d'apparence : on les retire avant d'aplatir.
  for (const field of form.getFields()) {
    if (!(field instanceof PDFSignature)) continue;
    for (const widget of field.acroField.getWidgets()) {
      const ref = pdf.context.getObjectRef(widget.dict);
      if (!ref) continue;
      pdf.findPageForAnnotationRef(ref)?.node.removeAnnot(ref);
    }
    form.acroForm.removeField(field.acroField);
  }
  form.flatten();

  // ── Certificat de signature ──
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  const hash = createHash("sha256").update(input.template).digest("hex");
  const when = new Date(input.audit.signedAtIso).toLocaleString("fr-CA", { timeZone: "America/Toronto", dateStyle: "long", timeStyle: "short" });
  let y = 720;
  const line = (text: string, opts: { size?: number; bold?: boolean; gap?: number } = {}) => {
    const size = opts.size ?? 10.5;
    for (const chunk of wrap(text, size > 12 ? 60 : 95)) {
      page.drawText(chunk, { x: 60, y, size, font: opts.bold ? bold : font, color: rgb(0.1, 0.08, 0.15) });
      y -= size + 5;
    }
    y -= opts.gap ?? 4;
  };
  line("Certificat de signature électronique", { size: 18, bold: true, gap: 10 });
  line("Académie New Valkyria — contrat d'embauche", { bold: true, gap: 12 });
  line(`Signé électroniquement par : ${fullName}`);
  line(`Courriel : ${data.email || input.contract.employee_email || "—"}`);
  line(`Date et heure : ${when} (heure de l'Est)`);
  line(`Lieu déclaré : ${data.signedAtCity}`);
  line(`Initiales apposées : ${data.initials}`);
  line(`Adresse IP : ${input.audit.ip ?? "non disponible"}`);
  line(`Navigateur : ${(input.audit.userAgent ?? "non disponible").slice(0, 160)}`, { gap: 12 });
  line("Documents lus et acceptés par l'employée :", { bold: true });
  for (const doc of data.documentsAccepted) line(`- ${doc}`, { gap: 0 });
  y -= 10;
  line(`Consentement à l'utilisation de l'image : ${data.imageConsent ? "J'accepte" : "Je refuse"}`, { gap: 12 });
  if (input.employerSignature && input.employerSignedAt) {
    line(`Contresigné pour l'Académie par ${prefill.offre_rep_nom ?? "la direction"} le ${formatDateFr(input.employerSignedAt)}.`, { gap: 12 });
  }
  line("L'employée a accédé au contrat par un lien personnel envoyé à son adresse courriel, a lu chacun des documents, puis a apposé sa signature manuscrite à l'écran, reproduite à chaque endroit « Signer ici ».", { size: 9 });
  line(`Empreinte SHA-256 du contrat original : ${hash}`, { size: 8 });
  return pdf.save();
}

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) out.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

/** Regénère et enregistre les deux versions (complète avec NAS pour l'académie,
 *  copie avec NAS masqué pour l'employée et les courriels). */
export async function renderAndStore(contract: EmployeeContract): Promise<{ full: Uint8Array; masked: Uint8Array }> {
  if (!contract.employee_data || !contract.signed_at) throw new Error("Contrat pas encore signé.");
  const [template, employeeSignature, employerSignature] = await Promise.all([
    downloadFile(contract.template_path),
    downloadFile(`${contract.id}/signature-employee.png`),
    contract.employer_signature_path ? downloadFile(contract.employer_signature_path) : Promise.resolve(null)
  ]);
  const sin = decryptSin(contract);
  const base = {
    template,
    contract,
    data: contract.employee_data,
    signatureDate: contract.signed_at.slice(0, 10),
    employeeSignature,
    employerSignature,
    employerSignedAt: contract.employer_signed_at,
    audit: { signedAtIso: contract.signed_at, ip: contract.signer_ip, userAgent: contract.signer_user_agent }
  };
  const full = await buildSignedPdf({ ...base, sin });
  const masked = await buildSignedPdf({ ...base, sin: maskSin(sin) });
  const fullPath = `${contract.id}/contrat-signe.pdf`;
  await uploadFile(fullPath, full, "application/pdf");
  await uploadFile(maskedPath(contract), masked, "application/pdf");
  return { full, masked };
}

export async function updateContract(id: string, patch: Record<string, unknown>) {
  const { error } = await db().from("employee_contracts").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Prochaine paie (à venir ou aujourd'hui) d'un calendrier. */
export function nextPay(schedule: PayRow[], today = new Date().toISOString().slice(0, 10)): PayRow | null {
  return schedule.find((r) => r.payDate >= today) ?? null;
}

export function payTotal(schedule: PayRow[]): number {
  return schedule.reduce((sum, r) => sum + r.amountCents, 0);
}
