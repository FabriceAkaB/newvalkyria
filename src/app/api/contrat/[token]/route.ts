import { after, NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { sendContractCopyToEmployee, sendContractSignedNotification } from "@/lib/email";
import {
  CONTRACT_DOCUMENTS,
  downloadFile,
  encryptSin,
  getContractByToken,
  maskedPath,
  nextPay,
  renderAndStore,
  updateContract,
  uploadFile,
  type EmployeeContract,
  type EmployeeFormData
} from "@/lib/employee-contracts";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Lecture des PDF par l'employée (lien personnel) : le contrat original, ou sa copie signée (NAS masqué). */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const contract = await getContractByToken(token);
  if (!contract || contract.status === "cancelled") return jsonError("Lien invalide", 404);
  const which = new URL(request.url).searchParams.get("fichier");
  const path = which === "copie" && contract.status === "signed" ? maskedPath(contract) : contract.template_path;
  const bytes = await downloadFile(path);
  const name = which === "copie" ? "Contrat_signe_New_Valkyria.pdf" : "Contrat_New_Valkyria.pdf";
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"`, "Cache-Control": "private, no-store" }
  });
}

function isValidSin(sin: string): boolean {
  const d = sin.replace(/\D/g, "");
  if (d.length !== 9) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(d[i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

const req = (label: string) => z.string().trim().min(1, `${label} : champ obligatoire`).max(200);
const opt = z.string().trim().max(200).optional().default("");

const schema = z.object({
  lastName: req("Nom de famille"),
  firstName: req("Prénom"),
  sin: z.string().refine(isValidSin, "Numéro d'assurance sociale invalide (9 chiffres)."),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de naissance invalide"),
  gender: z.enum(["h", "f", "a"], { message: "Genre : choisissez une option" }),
  address: req("Adresse"),
  city: req("Ville"),
  postalCode: req("Code postal"),
  mobile: req("Cellulaire"),
  homePhone: opt,
  email: z.string().trim().email("Courriel invalide"),
  emergencyLastName: req("Urgence — nom"),
  emergencyFirstName: req("Urgence — prénom"),
  emergencyRelationship: req("Urgence — lien"),
  emergencyMobile: req("Urgence — cellulaire"),
  emergencyWork: opt,
  emergencyHome: opt,
  imageConsent: z.enum(["oui", "non"], { message: "Consentement à l'image : choisissez une option" }),
  signedAtCity: req("Signé à (ville)"),
  initials: z.string().trim().min(1, "Initiales requises").max(5),
  documentsAccepted: z.array(z.string()).refine((a) => CONTRACT_DOCUMENTS.every((d) => a.includes(d)), "Vous devez lire et accepter chacun des 10 documents."),
  certify: z.literal(true, { message: "Vous devez certifier que les renseignements sont exacts." }),
  signature: z.string().startsWith("data:image/png;base64,", "Signature requise")
});

const CHEQUE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "application/pdf": "pdf" };

/** Signature du contrat : enregistre les informations, le spécimen de chèque et la signature,
 *  génère la copie signée, l'envoie à l'employée et avise JP. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const contract = await getContractByToken(token);
    if (!contract || contract.status === "cancelled") return jsonError("Ce lien n'est pas valide.", 404);
    if (contract.status === "signed") return jsonError("Ce contrat est déjà signé.", 409);

    const form = await request.formData();
    const payload = schema.parse({
      ...JSON.parse(String(form.get("data") ?? "{}")),
      signature: String(form.get("signature") ?? "")
    });
    const cheque = form.get("cheque");
    if (!(cheque instanceof File) || cheque.size === 0) return jsonError("Le spécimen de chèque est obligatoire.", 422);
    const ext = CHEQUE_TYPES[cheque.type];
    if (!ext) return jsonError("Spécimen de chèque : envoyez une photo (JPG, PNG) ou un PDF.", 422);
    if (cheque.size > 4 * 1024 * 1024) return jsonError("Spécimen de chèque : fichier trop lourd (4 Mo maximum).", 422);

    const signaturePng = Buffer.from(payload.signature.split(",")[1], "base64");
    if (signaturePng.length < 800) return jsonError("Signature requise : signez dans le cadre.", 422);

    const [y, m, d] = payload.birthDate.split("-");
    const data: EmployeeFormData = {
      lastName: payload.lastName,
      firstName: payload.firstName,
      birthDate: `${d}/${m}/${y}`,
      gender: payload.gender,
      address: payload.address,
      city: payload.city,
      postalCode: payload.postalCode.toUpperCase(),
      mobile: payload.mobile,
      homePhone: payload.homePhone,
      email: payload.email,
      emergencyLastName: payload.emergencyLastName,
      emergencyFirstName: payload.emergencyFirstName,
      emergencyRelationship: payload.emergencyRelationship,
      emergencyMobile: payload.emergencyMobile,
      emergencyWork: payload.emergencyWork,
      emergencyHome: payload.emergencyHome,
      imageConsent: payload.imageConsent === "oui",
      signedAtCity: payload.signedAtCity,
      initials: payload.initials.toUpperCase(),
      documentsAccepted: payload.documentsAccepted
    };

    const chequePath = `${contract.id}/specimen-cheque.${ext}`;
    await uploadFile(chequePath, Buffer.from(await cheque.arrayBuffer()), cheque.type);
    await uploadFile(`${contract.id}/signature-employee.png`, signaturePng, "image/png");

    const sin = payload.sin.replace(/\D/g, "");
    const patch = {
      status: "signed" as const,
      employee_data: data,
      employee_email: payload.email,
      sin_encrypted: encryptSin(`${sin.slice(0, 3)} ${sin.slice(3, 6)} ${sin.slice(6)}`),
      cheque_path: chequePath,
      signed_at: new Date().toISOString(),
      signer_ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      signer_user_agent: request.headers.get("user-agent")
    };
    // Le PDF est généré AVANT de marquer le contrat signé : en cas d'échec, l'employée peut réessayer.
    const signed: EmployeeContract = { ...contract, ...patch };
    const { masked } = await renderAndStore(signed);
    await updateContract(contract.id, { ...patch, signed_pdf_path: `${contract.id}/contrat-signe.pdf` });

    after(async () => {
      const countersigned = Boolean(signed.employer_signature_path);
      await sendContractCopyToEmployee({ to: payload.email, firstName: data.firstName, title: signed.title, pdf: masked, countersigned, schedule: signed.pay_schedule }).catch((err) =>
        console.error("Unable to send contract copy", err)
      );
      await sendContractSignedNotification({
        employeeName: `${data.firstName} ${data.lastName}`,
        title: signed.title,
        pdf: masked,
        adminUrl: `${env.publicSiteUrl}/admin/contrats`,
        nextPay: nextPay(signed.pay_schedule)
      }).catch((err) => console.error("Unable to send contract notification", err));
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    console.error("Contract signing failed", error);
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 500);
  }
}
