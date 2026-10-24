"use client";

import { useEffect, useRef, useState } from "react";

interface SummaryItem {
  label: string;
  value: string;
}

interface PayRow {
  period: string;
  payDate: string;
  hours: string;
  amountCents: number;
}

const money = (cents: number) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
const payDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

const sectionTitle: React.CSSProperties = { fontSize: "0.72rem", letterSpacing: "0.16em", color: "#c4a4e4", textTransform: "uppercase", margin: "1.6rem 0 0.5rem" };
const card: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "1rem 1.1rem" };

/** Cadre de signature au doigt / à la souris. Renvoie une image PNG. */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef(0);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1c1340";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    strokes.current += 1;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (strokes.current > 8 && canvas.current) onChange(canvas.current.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    strokes.current = 0;
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvas}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        style={{ width: "100%", height: 170, background: "#fff", borderRadius: 12, touchAction: "none", cursor: "crosshair", display: "block" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: "0.8rem", color: "#a9a4b8" }}>
        <span>Signez dans le cadre blanc (doigt ou souris)</span>
        <button type="button" onClick={clear} style={{ background: "none", border: "none", color: "#c4a4e4", cursor: "pointer", textDecoration: "underline" }}>
          Effacer
        </button>
      </div>
    </div>
  );
}

/** Réduit une photo de chèque (souvent très lourde sur téléphone) avant l'envoi. */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/heic") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  c.getContext("2d")?.drawImage(bitmap, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/jpeg", 0.85));
  return blob ? new File([blob], "specimen-cheque.jpg", { type: "image/jpeg" }) : file;
}

export function ContractSignForm({
  token,
  title,
  employeeName,
  defaultFirstName,
  defaultLastName,
  defaultEmail,
  summary,
  schedule,
  documents
}: {
  token: string;
  title: string;
  employeeName: string;
  defaultFirstName: string;
  defaultLastName: string;
  defaultEmail: string;
  summary: SummaryItem[];
  schedule: PayRow[];
  documents: string[];
}) {
  const [f, setF] = useState({
    lastName: defaultLastName,
    firstName: defaultFirstName,
    sin: "",
    birthDate: "",
    gender: "",
    address: "",
    city: "",
    postalCode: "",
    mobile: "",
    homePhone: "",
    email: defaultEmail,
    emergencyLastName: "",
    emergencyFirstName: "",
    emergencyRelationship: "",
    emergencyMobile: "",
    emergencyWork: "",
    emergencyHome: "",
    imageConsent: "",
    signedAtCity: "",
    initials: ""
  });
  const [accepted, setAccepted] = useState<string[]>([]);
  const [certify, setCertify] = useState(false);
  const [cheque, setCheque] = useState<File | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const toggleDoc = (d: string) => setAccepted((a) => (a.includes(d) ? a.filter((x) => x !== d) : [...a, d]));
  const total = schedule.reduce((s, r) => s + r.amountCents, 0);
  const pdfUrl = `/api/contrat/${token}`;

  const submit = async () => {
    setError(null);
    if (!cheque) return setError("Ajoutez votre spécimen de chèque (photo ou PDF).");
    if (accepted.length < documents.length) return setError("Cochez chacun des 10 documents pour confirmer que vous les avez lus.");
    if (!certify) return setError("Cochez la case « Je déclare que les renseignements sont exacts ».");
    if (!signature) return setError("Signez dans le cadre blanc.");
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("data", JSON.stringify({ ...f, documentsAccepted: accepted, certify }));
      body.append("signature", signature);
      body.append("cheque", await compressImage(cheque));
      const res = await fetch(`/api/contrat/${token}`, { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Erreur d'envoi. Réessayez.");
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={card}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>✓ Contrat signé</h1>
        <p style={{ color: "#c3c2c8", lineHeight: 1.6 }}>
          Merci {f.firstName} ! Votre contrat est signé. Une copie vous est envoyée par courriel à <strong>{f.email}</strong>.
        </p>
        <a className="nv27-btn-primary" href={`${pdfUrl}?fichier=copie`} target="_blank" rel="noreferrer" style={{ display: "inline-block", padding: "0.7rem 1.2rem", marginTop: "0.6rem" }}>
          Voir ma copie signée
        </a>
      </div>
    );
  }

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="insc-field">
      <span>{label}</span>
      <input className="insc-input" value={f[k]} onChange={(e) => set(k, e.target.value)} {...props} />
    </label>
  );

  return (
    <>
      <p style={{ fontSize: "0.72rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#c4a4e4", margin: "0 0 0.4rem" }}>Contrat d&apos;embauche</p>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#fff", margin: "0 0 0.5rem" }}>{employeeName}</h1>
      <p style={{ color: "#c3c2c8", margin: "0 0 1.2rem", lineHeight: 1.6 }}>
        {title}. Lisez le contrat, remplissez vos informations et signez une seule fois : votre signature sera apposée sur chacun des documents. Vous recevrez votre copie par courriel.
      </p>

      <div style={card}>
        <dl style={{ display: "grid", gridTemplateColumns: "minmax(110px, 30%) 1fr", gap: "0.45rem 1rem", margin: 0, fontSize: "0.9rem" }}>
          {summary.map((s) => (
            <div key={s.label} style={{ display: "contents" }}>
              <dt style={{ color: "#a9a4b8" }}>{s.label}</dt>
              <dd style={{ margin: 0, color: "#fff" }}>{s.value}</dd>
            </div>
          ))}
        </dl>
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="nv27-btn-primary" style={{ display: "inline-block", padding: "0.6rem 1.1rem", marginTop: "1rem" }}>
          Lire le contrat complet (PDF, 12 pages)
        </a>
      </div>

      {schedule.length > 0 && (
        <details style={{ ...card, marginTop: "0.8rem" }}>
          <summary style={{ cursor: "pointer", color: "#fff", fontWeight: 600 }}>
            Calendrier de paie prévu : {schedule.length} paies, {money(total)} brut
          </summary>
          <table style={{ width: "100%", fontSize: "0.85rem", marginTop: "0.7rem", borderCollapse: "collapse", color: "#ddd" }}>
            <tbody>
              {schedule.map((r) => (
                <tr key={r.payDate} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <td style={{ padding: "0.35rem 0" }}>{payDay(r.payDate)}</td>
                  <td style={{ padding: "0.35rem 0.5rem", color: "#a9a4b8" }}>{r.period}</td>
                  <td style={{ padding: "0.35rem 0", textAlign: "right" }}>{money(r.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <div className="nv27-form-fields">
        <p style={sectionTitle}>1. Vos informations</p>
        <div className="nv27-grid2">
          {field("firstName", "Prénom *")}
          {field("lastName", "Nom de famille *")}
        </div>
        <div className="nv27-grid2">
          {field("sin", "N° d'assurance sociale *", { inputMode: "numeric", placeholder: "123 456 789", autoComplete: "off" })}
          {field("birthDate", "Date de naissance *", { type: "date" })}
        </div>
        <label className="insc-field">
          <span>Genre *</span>
          <select className="insc-input" value={f.gender} onChange={(e) => set("gender", e.target.value)}>
            <option value="">Choisir…</option>
            <option value="f">Femme</option>
            <option value="h">Homme</option>
            <option value="a">Autre</option>
          </select>
        </label>
        {field("address", "Adresse *", { autoComplete: "street-address" })}
        <div className="nv27-grid2">
          {field("city", "Ville *", { autoComplete: "address-level2" })}
          {field("postalCode", "Code postal *", { autoComplete: "postal-code" })}
        </div>
        <div className="nv27-grid2">
          {field("mobile", "Cellulaire *", { type: "tel", autoComplete: "tel" })}
          {field("homePhone", "Téléphone (maison)", { type: "tel" })}
        </div>
        {field("email", "Courriel * (votre copie y sera envoyée)", { type: "email", autoComplete: "email" })}
        <p style={{ fontSize: "0.78rem", color: "#a9a4b8", margin: "0.3rem 0 0" }}>
          Si votre numéro d&apos;assurance sociale commence par 9, envoyez aussi une copie de votre permis de travail à info@newvalkyria.com.
        </p>

        <p style={sectionTitle}>2. Spécimen de chèque (dépôt direct) *</p>
        <label className="insc-field">
          <span>Photo du chèque annulé ou PDF de votre banque</span>
          <input className="insc-input" type="file" accept="image/*,application/pdf" onChange={(e) => setCheque(e.target.files?.[0] ?? null)} />
        </label>

        <p style={sectionTitle}>3. Personne à joindre en cas d&apos;urgence</p>
        <div className="nv27-grid2">
          {field("emergencyFirstName", "Prénom *")}
          {field("emergencyLastName", "Nom de famille *")}
        </div>
        <div className="nv27-grid2">
          {field("emergencyRelationship", "Lien (ex. mère) *")}
          {field("emergencyMobile", "Cellulaire *", { type: "tel" })}
        </div>
        <div className="nv27-grid2">
          {field("emergencyWork", "Téléphone (travail)", { type: "tel" })}
          {field("emergencyHome", "Téléphone (maison)", { type: "tel" })}
        </div>

        <p style={sectionTitle}>4. Utilisation de votre image</p>
        <div style={{ display: "flex", gap: "1.2rem", color: "#ddd", fontSize: "0.92rem" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="radio" name="image" checked={f.imageConsent === "oui"} onChange={() => set("imageConsent", "oui")} /> J&apos;accepte
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="radio" name="image" checked={f.imageConsent === "non"} onChange={() => set("imageConsent", "non")} /> Je refuse
          </label>
        </div>

        <p style={sectionTitle}>5. Documents lus et acceptés</p>
        <p style={{ fontSize: "0.85rem", color: "#c3c2c8", margin: "0 0 0.4rem" }}>
          Cochez chaque document après l&apos;avoir lu dans <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ color: "#c4a4e4" }}>le contrat complet</a>.
        </p>
        {documents.map((d, i) => (
          <label key={d} className="insc-consent" style={{ marginTop: "0.35rem" }}>
            <div className="insc-checkbox-wrap">
              <input type="checkbox" className="insc-checkbox" checked={accepted.includes(d)} onChange={() => toggleDoc(d)} />
              <span className="insc-checkbox-custom" aria-hidden />
            </div>
            <span>
              {i + 1}. J&apos;ai lu, je comprends et j&apos;accepte : <strong>{d}</strong>
            </span>
          </label>
        ))}
        <label className="insc-consent" style={{ marginTop: "0.8rem" }}>
          <div className="insc-checkbox-wrap">
            <input type="checkbox" className="insc-checkbox" checked={certify} onChange={(e) => setCertify(e.target.checked)} />
            <span className="insc-checkbox-custom" aria-hidden />
          </div>
          <span>Je déclare que les renseignements fournis sont exacts et complets.</span>
        </label>

        <p style={sectionTitle}>6. Signature</p>
        <div className="nv27-grid2">
          {field("signedAtCity", "Signé à (ville) *")}
          {field("initials", "Vos initiales *", { maxLength: 5, placeholder: "ex. MD" })}
        </div>
        <SignaturePad onChange={setSignature} />
        <p style={{ fontSize: "0.78rem", color: "#a9a4b8", margin: "0.6rem 0 0" }}>
          En cliquant sur « Signer mon contrat », vous signez électroniquement les 10 documents. Votre signature et vos initiales seront apposées à chaque endroit prévu, avec la date du jour.
        </p>

        {error && <p className="nv27-pay-error">{error}</p>}
        <button type="button" className="nv27-btn-primary" onClick={submit} disabled={submitting} style={{ padding: "0.85rem", marginTop: "1rem", width: "100%" }}>
          {submitting ? "Signature en cours…" : "Signer mon contrat"}
        </button>
      </div>
    </>
  );
}
