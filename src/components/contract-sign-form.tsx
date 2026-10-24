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

/** Cadre de signature au doigt / à la souris. Renvoie une image PNG. */
export function SignaturePad({ onChange, light = false }: { onChange: (dataUrl: string | null) => void; light?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef(0);
  const [signed, setSigned] = useState(false);

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
    if (strokes.current > 8 && canvas.current) {
      setSigned(true);
      onChange(canvas.current.toDataURL("image/png"));
    }
  };
  const clear = () => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    strokes.current = 0;
    setSigned(false);
    onChange(null);
  };

  return (
    <div>
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvas}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          style={{ width: "100%", height: 180, background: "#fff", borderRadius: 12, border: "2px dashed #b9a6d6", touchAction: "none", cursor: "crosshair", display: "block" }}
        />
        {!signed && (
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#b3a8c4", fontSize: "1rem", pointerEvents: "none" }}>
            ✍️ Signez ici
          </span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: "0.85rem", color: light ? "#6b6478" : "#a9a4b8" }}>
        <span>Avec le doigt (téléphone) ou la souris</span>
        <button type="button" onClick={clear} style={{ background: "none", border: "none", color: light ? "#5b2a86" : "#c4a4e4", cursor: "pointer", textDecoration: "underline", fontSize: "0.85rem" }}>
          Effacer et recommencer
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

/** Styles du formulaire : fond blanc, cases bien visibles, gros texte (lisible au téléphone). */
const CSS = `
.nvc-card{background:#fff;color:#1d1730;border-radius:16px;padding:1.3rem 1.2rem;margin-top:1rem;box-shadow:0 4px 18px rgba(0,0,0,.25)}
.nvc-head{display:flex;gap:.75rem;align-items:flex-start;margin-bottom:1rem}
.nvc-num{flex:0 0 2rem;height:2rem;border-radius:50%;background:#5b2a86;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}
.nvc-num.ok{background:#2f9e5b}
.nvc-title{font-size:1.15rem;font-weight:700;margin:0;color:#1d1730}
.nvc-help{font-size:.9rem;color:#5d566b;margin:.2rem 0 0;line-height:1.45}
.nvc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.9rem 1rem}
.nvc-field{display:flex;flex-direction:column;gap:.35rem}
.nvc-label{font-size:.95rem;font-weight:600;color:#1d1730}
.nvc-label em{color:#c0392b;font-style:normal}
.nvc-hint{font-size:.8rem;color:#6b6478}
.nvc-input{width:100%;box-sizing:border-box;font-size:16px;padding:.8rem .9rem;border:1.5px solid #c9bedb;border-radius:10px;background:#fbf9ff;color:#1d1730;outline:none}
.nvc-input:focus{border-color:#5b2a86;background:#fff;box-shadow:0 0 0 3px rgba(91,42,134,.15)}
.nvc-input.err{border-color:#d14b4b;background:#fff6f6}
.nvc-input::placeholder{color:#a79fb5}
.nvc-pills{display:flex;gap:.6rem;flex-wrap:wrap}
.nvc-pill{flex:1 1 120px;padding:.8rem 1rem;border:1.5px solid #c9bedb;border-radius:10px;background:#fbf9ff;color:#1d1730;font-size:1rem;cursor:pointer;text-align:center}
.nvc-pill.on{border-color:#5b2a86;background:#5b2a86;color:#fff;font-weight:700}
.nvc-pill.err{border-color:#d14b4b}
.nvc-file{display:flex;align-items:center;justify-content:center;gap:.6rem;padding:1.3rem 1rem;border:2px dashed #b9a6d6;border-radius:12px;background:#fbf9ff;color:#5b2a86;font-weight:700;cursor:pointer;text-align:center}
.nvc-file.done{border-style:solid;border-color:#2f9e5b;background:#f1fbf5;color:#1f7a45}
.nvc-file.err{border-color:#d14b4b}
.nvc-check{display:flex;gap:.75rem;align-items:flex-start;padding:.7rem .8rem;border:1.5px solid #e3dcec;border-radius:10px;cursor:pointer;font-size:.95rem;line-height:1.4;color:#1d1730}
.nvc-check.on{border-color:#2f9e5b;background:#f1fbf5}
.nvc-check input{width:22px;height:22px;flex:0 0 22px;margin:0;accent-color:#5b2a86}
.nvc-link{color:#5b2a86;font-weight:700}
.nvc-btn{display:inline-block;background:#5b2a86;color:#fff;border:none;border-radius:12px;padding:.85rem 1.2rem;font-size:1rem;font-weight:700;cursor:pointer;text-decoration:none}
.nvc-btn.ghost{background:#efe8f8;color:#5b2a86}
.nvc-btn:disabled{opacity:.6}
.nvc-missing{background:#fff6e5;border:1px solid #f0c878;border-radius:10px;padding:.8rem 1rem;color:#6b4b00;font-size:.9rem;margin-top:1rem}
.nvc-error{background:#fff0f0;border:1px solid #e8a0a0;border-radius:10px;padding:.8rem 1rem;color:#9b1c1c;font-size:.95rem;margin-top:1rem}
.nvc-dl{display:grid;grid-template-columns:minmax(110px,32%) 1fr;gap:.5rem 1rem;margin:0;font-size:.92rem}
.nvc-dl dt{color:#6b6478}
.nvc-dl dd{margin:0;color:#1d1730}
`;

type FormState = {
  lastName: string;
  firstName: string;
  sin: string;
  birthDate: string;
  gender: string;
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
  imageConsent: string;
  signedAtCity: string;
  initials: string;
};

const REQUIRED: { key: keyof FormState; label: string }[] = [
  { key: "firstName", label: "Prénom" },
  { key: "lastName", label: "Nom de famille" },
  { key: "sin", label: "Numéro d'assurance sociale" },
  { key: "birthDate", label: "Date de naissance" },
  { key: "gender", label: "Genre" },
  { key: "address", label: "Adresse" },
  { key: "city", label: "Ville" },
  { key: "postalCode", label: "Code postal" },
  { key: "mobile", label: "Cellulaire" },
  { key: "email", label: "Courriel" },
  { key: "emergencyFirstName", label: "Urgence : prénom" },
  { key: "emergencyLastName", label: "Urgence : nom" },
  { key: "emergencyRelationship", label: "Urgence : lien" },
  { key: "emergencyMobile", label: "Urgence : cellulaire" },
  { key: "imageConsent", label: "Utilisation de l'image (accepter ou refuser)" },
  { key: "signedAtCity", label: "Ville où vous signez" },
  { key: "initials", label: "Initiales" }
];

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
  const [f, setF] = useState<FormState>({
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
  const [tried, setTried] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (k: keyof FormState, v: string) => setF((s) => ({ ...s, [k]: v }));
  const toggleDoc = (d: string) => setAccepted((a) => (a.includes(d) ? a.filter((x) => x !== d) : [...a, d]));
  const total = schedule.reduce((s, r) => s + r.amountCents, 0);
  const pdfUrl = `/api/contrat/${token}`;
  const empty = (k: keyof FormState) => !f[k].trim();
  const bad = (k: keyof FormState) => tried && empty(k);

  const missing = [
    ...REQUIRED.filter((r) => empty(r.key)).map((r) => r.label),
    ...(cheque ? [] : ["Spécimen de chèque"]),
    ...(accepted.length < documents.length ? [`Cocher les documents lus (${accepted.length}/${documents.length})`] : []),
    ...(certify ? [] : ["Déclaration « renseignements exacts »"]),
    ...(signature ? [] : ["Signature"])
  ];

  const sectionDone = {
    1: ["firstName", "lastName", "sin", "birthDate", "gender", "address", "city", "postalCode", "mobile", "email"].every((k) => !empty(k as keyof FormState)),
    2: Boolean(cheque),
    3: ["emergencyFirstName", "emergencyLastName", "emergencyRelationship", "emergencyMobile"].every((k) => !empty(k as keyof FormState)),
    4: Boolean(f.imageConsent),
    5: accepted.length === documents.length && certify,
    6: Boolean(signature) && !empty("signedAtCity") && !empty("initials")
  };

  const submit = async () => {
    setTried(true);
    setError(null);
    if (missing.length) return;
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("data", JSON.stringify({ ...f, documentsAccepted: accepted, certify }));
      body.append("signature", signature!);
      body.append("cheque", await compressImage(cheque!));
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

  const input = (k: keyof FormState, label: string, opts: { required?: boolean; hint?: string; props?: React.InputHTMLAttributes<HTMLInputElement> } = {}) => (
    <label className="nvc-field">
      <span className="nvc-label">
        {label} {opts.required !== false && <em>*</em>}
      </span>
      <input className={`nvc-input${opts.required !== false && bad(k) ? " err" : ""}`} value={f[k]} onChange={(e) => set(k, e.target.value)} {...opts.props} />
      {opts.hint && <span className="nvc-hint">{opts.hint}</span>}
    </label>
  );

  const head = (n: 1 | 2 | 3 | 4 | 5 | 6, titleText: string, help: string) => (
    <div className="nvc-head">
      <span className={`nvc-num${sectionDone[n] ? " ok" : ""}`}>{sectionDone[n] ? "✓" : n}</span>
      <div>
        <p className="nvc-title">{titleText}</p>
        <p className="nvc-help">{help}</p>
      </div>
    </div>
  );

  if (done) {
    return (
      <>
        <style>{CSS}</style>
        <div className="nvc-card">
          <p className="nvc-title" style={{ fontSize: "1.5rem" }}>✓ Contrat signé</p>
          <p className="nvc-help" style={{ fontSize: "1rem", marginTop: ".6rem" }}>
            Merci {f.firstName} ! Votre contrat est signé. Une copie vous est envoyée par courriel à <strong>{f.email}</strong>.
          </p>
          <a className="nvc-btn" href={`${pdfUrl}?fichier=copie`} target="_blank" rel="noreferrer" style={{ marginTop: "1rem" }}>
            Voir ma copie signée
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <p style={{ fontSize: "0.75rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#c4a4e4", margin: "0 0 0.4rem" }}>Contrat d&apos;embauche</p>
      <h1 style={{ fontSize: "1.7rem", fontWeight: 700, color: "#fff", margin: "0 0 0.4rem" }}>{employeeName}</h1>
      <p style={{ color: "#d6d3dd", margin: 0, lineHeight: 1.6, fontSize: "1rem" }}>{title}</p>

      {/* Mode d'emploi */}
      <div className="nvc-card">
        <p className="nvc-title">Comment ça marche (environ 10 minutes)</p>
        <ol style={{ margin: ".6rem 0 0", paddingLeft: "1.3rem", lineHeight: 1.7, fontSize: ".95rem", listStyle: "decimal" }}>
          <li>Lisez votre contrat (bouton ci-dessous).</li>
          <li>Remplissez les 6 sections plus bas. Les champs avec <em style={{ color: "#c0392b", fontStyle: "normal" }}>*</em> sont obligatoires.</li>
          <li>Signez une seule fois : votre signature est ajoutée partout dans le contrat.</li>
        </ol>
        <p className="nvc-help" style={{ marginTop: ".7rem" }}>
          À avoir sous la main : votre <strong>numéro d&apos;assurance sociale</strong> et une <strong>photo d&apos;un chèque annulé</strong> (ou le formulaire de dépôt direct de votre banque).
        </p>
      </div>

      {/* Résumé */}
      <div className="nvc-card">
        <p className="nvc-title" style={{ marginBottom: ".8rem" }}>Votre contrat en bref</p>
        <dl className="nvc-dl">
          {summary.map((s) => (
            <div key={s.label} style={{ display: "contents" }}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
        <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", marginTop: "1.1rem" }}>
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="nvc-btn">📄 Lire le contrat complet</a>
        </div>
        {schedule.length > 0 && (
          <details style={{ marginTop: "1rem" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, color: "#5b2a86" }}>
              Voir mon calendrier de paie ({schedule.length} paies, {money(total)} brut)
            </summary>
            <table style={{ width: "100%", fontSize: "0.88rem", marginTop: "0.6rem", borderCollapse: "collapse" }}>
              <tbody>
                {schedule.map((r) => (
                  <tr key={r.payDate} style={{ borderTop: "1px solid #eee7f5" }}>
                    <td style={{ padding: "0.4rem 0" }}>{payDay(r.payDate)}</td>
                    <td style={{ padding: "0.4rem 0.5rem", color: "#6b6478" }}>{r.period}</td>
                    <td style={{ padding: "0.4rem 0", textAlign: "right", fontWeight: 600 }}>{money(r.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>

      {/* 1 */}
      <div className="nvc-card">
        {head(1, "Vos informations", "Pour votre dossier d'employée et votre paie.")}
        <div className="nvc-grid">
          {input("firstName", "Prénom", { props: { autoComplete: "given-name" } })}
          {input("lastName", "Nom de famille", { props: { autoComplete: "family-name" } })}
          {input("sin", "Numéro d'assurance sociale (NAS)", { hint: "9 chiffres. S'il commence par 9, envoyez aussi votre permis de travail à info@newvalkyria.com.", props: { inputMode: "numeric", placeholder: "123 456 789", autoComplete: "off" } })}
          {input("birthDate", "Date de naissance", { props: { type: "date" } })}
        </div>
        <div className="nvc-field" style={{ marginTop: ".9rem" }}>
          <span className="nvc-label">Genre <em>*</em></span>
          <div className="nvc-pills">
            {[
              ["f", "Femme"],
              ["h", "Homme"],
              ["a", "Autre"]
            ].map(([v, l]) => (
              <button key={v} type="button" className={`nvc-pill${f.gender === v ? " on" : ""}${bad("gender") ? " err" : ""}`} onClick={() => set("gender", v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="nvc-grid" style={{ marginTop: ".9rem" }}>
          {input("address", "Adresse (numéro et rue)", { props: { autoComplete: "street-address", placeholder: "ex. 123, rue Principale, app. 4" } })}
          {input("city", "Ville", { props: { autoComplete: "address-level2" } })}
          {input("postalCode", "Code postal", { props: { autoComplete: "postal-code", placeholder: "ex. J7C 1A1" } })}
          {input("mobile", "Cellulaire", { props: { type: "tel", autoComplete: "tel", placeholder: "514 555-1234" } })}
          {input("homePhone", "Téléphone à la maison", { required: false, hint: "Facultatif", props: { type: "tel" } })}
          {input("email", "Courriel", { hint: "Votre copie du contrat y sera envoyée.", props: { type: "email", autoComplete: "email" } })}
        </div>
      </div>

      {/* 2 */}
      <div className="nvc-card">
        {head(2, "Spécimen de chèque", "Pour recevoir votre paie par dépôt direct. Prenez une photo d'un chèque annulé, ou joignez le formulaire de dépôt direct de votre banque (PDF).")}
        <label className={`nvc-file${cheque ? " done" : ""}${tried && !cheque ? " err" : ""}`}>
          <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => setCheque(e.target.files?.[0] ?? null)} />
          {cheque ? `✓ ${cheque.name} (toucher pour changer)` : "📷 Prendre une photo ou choisir un fichier"}
        </label>
      </div>

      {/* 3 */}
      <div className="nvc-card">
        {head(3, "Personne à joindre en cas d'urgence", "Quelqu'un que nous pouvons appeler s'il vous arrive quelque chose pendant une séance.")}
        <div className="nvc-grid">
          {input("emergencyFirstName", "Prénom")}
          {input("emergencyLastName", "Nom de famille")}
          {input("emergencyRelationship", "Lien avec vous", { props: { placeholder: "ex. mère, conjoint, ami" } })}
          {input("emergencyMobile", "Cellulaire", { props: { type: "tel" } })}
          {input("emergencyWork", "Téléphone au travail", { required: false, hint: "Facultatif", props: { type: "tel" } })}
          {input("emergencyHome", "Téléphone à la maison", { required: false, hint: "Facultatif", props: { type: "tel" } })}
        </div>
      </div>

      {/* 4 */}
      <div className="nvc-card">
        {head(4, "Utilisation de votre image", "Acceptez-vous que l'Académie utilise des photos et vidéos de vous (site Web, réseaux sociaux, communications aux parents) ? Vous pouvez changer d'avis en tout temps.")}
        <div className="nvc-pills">
          <button type="button" className={`nvc-pill${f.imageConsent === "oui" ? " on" : ""}${bad("imageConsent") ? " err" : ""}`} onClick={() => set("imageConsent", "oui")}>
            J&apos;accepte
          </button>
          <button type="button" className={`nvc-pill${f.imageConsent === "non" ? " on" : ""}${bad("imageConsent") ? " err" : ""}`} onClick={() => set("imageConsent", "non")}>
            Je refuse
          </button>
        </div>
      </div>

      {/* 5 */}
      <div className="nvc-card">
        {head(5, "Les 10 documents du contrat", "Cochez chaque document après l'avoir lu dans le contrat complet.")}
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="nvc-link" style={{ display: "inline-block", marginBottom: ".8rem" }}>
          📄 Ouvrir le contrat complet (12 pages)
        </a>
        <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
          {documents.map((d, i) => (
            <label key={d} className={`nvc-check${accepted.includes(d) ? " on" : ""}`}>
              <input type="checkbox" checked={accepted.includes(d)} onChange={() => toggleDoc(d)} />
              <span>
                <strong>Document {i + 1} :</strong> {d}. J&apos;ai lu, je comprends et j&apos;accepte.
              </span>
            </label>
          ))}
          <label className={`nvc-check${certify ? " on" : ""}`} style={{ marginTop: ".4rem" }}>
            <input type="checkbox" checked={certify} onChange={(e) => setCertify(e.target.checked)} />
            <span>Je déclare que les renseignements que j&apos;ai fournis sont exacts et complets.</span>
          </label>
        </div>
      </div>

      {/* 6 */}
      <div className="nvc-card">
        {head(6, "Votre signature", "Une seule signature : elle sera ajoutée à chaque endroit « Signer ici » du contrat, avec vos initiales au bas de chaque page et la date d'aujourd'hui.")}
        <div className="nvc-grid" style={{ marginBottom: "1rem" }}>
          {input("signedAtCity", "Ville où vous signez", { props: { placeholder: "ex. Blainville" } })}
          {input("initials", "Vos initiales", { props: { maxLength: 5, placeholder: "ex. MD" } })}
        </div>
        <SignaturePad onChange={setSignature} light />

        {tried && missing.length > 0 && (
          <div className="nvc-missing">
            <strong>Il manque encore :</strong> {missing.join(", ")}.
          </div>
        )}
        {error && <div className="nvc-error">{error}</div>}

        <button type="button" className="nvc-btn" onClick={submit} disabled={submitting} style={{ width: "100%", marginTop: "1.1rem", padding: "1rem", fontSize: "1.05rem" }}>
          {submitting ? "Signature en cours…" : "✍️ Signer mon contrat"}
        </button>
        <p className="nvc-hint" style={{ marginTop: ".6rem", textAlign: "center" }}>
          En cliquant, vous signez électroniquement les 10 documents du contrat.
        </p>
      </div>
    </>
  );
}
