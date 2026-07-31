"use client";

import { useState } from "react";

import { isValidEmail, isValidPhone } from "@/lib/form-validation";

/* ── Données collectées par le formulaire ── */

export interface InscriptionFormData {
  // Bloc 1 — Responsable
  accFirst: string; accLast: string; accEmail: string; accPhone: string;
  accAddress: string; accCity: string; accProvince: string; accCountry: string; accPostal: string;
  // Bloc 2 — Joueuse
  plFirst: string; plLast: string; plDob: string; plLevel: string; plClub: string;
  // Bloc 3 — Contact d'urgence
  ecFirst: string; ecLast: string; ecRelation: string; ecPhone: string;
  hasSecond: boolean;
  ec2First: string; ec2Last: string; ec2Relation: string; ec2Phone: string;
  // Bloc 4 — Médical
  hasAllergies: boolean; allergies: string;
  hasHealth: boolean; health: string;
  hasMedication: boolean; medicationName: string; medicationInstr: string;
  hasRestrictions: boolean; restrictions: string;
  // Bloc 5 — Provenance
  source: string;
  // Bloc 6 — Photo/vidéo
  photoConsent: "yes" | "no" | "";
}

const EMPTY: InscriptionFormData = {
  accFirst: "", accLast: "", accEmail: "", accPhone: "",
  accAddress: "", accCity: "", accProvince: "Québec", accCountry: "Canada", accPostal: "",
  plFirst: "", plLast: "", plDob: "", plLevel: "", plClub: "",
  ecFirst: "", ecLast: "", ecRelation: "", ecPhone: "",
  hasSecond: false, ec2First: "", ec2Last: "", ec2Relation: "", ec2Phone: "",
  hasAllergies: false, allergies: "",
  hasHealth: false, health: "",
  hasMedication: false, medicationName: "", medicationInstr: "",
  hasRestrictions: false, restrictions: "",
  source: "",
  photoConsent: ""
};

const LEVELS = ["Débutante", "D3", "D2", "D1"];
const PROVINCES = ["Québec", "Ontario", "Nouveau-Brunswick", "Autre"];
const COUNTRIES = ["Canada", "États-Unis", "Autre"];
const SOURCES = [
  "Facebook", "Instagram", "TikTok", "Google", "Site Web",
  "Ami / Famille", "Ancienne joueuse", "Club", "École", "Autre"
];

const TOTAL_BLOCKS = 6;

const BLOCK_TITLES = [
  "Responsable du compte",
  "Informations de la joueuse",
  "Contact d'urgence",
  "Informations médicales",
  "Provenance",
  "Autorisation photo / vidéo"
];

/* ── Champs réutilisables ── */

function Field({
  label, value, onChange, type = "text", required = false, autoComplete, placeholder, error
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; autoComplete?: string; placeholder?: string; error?: string;
}) {
  return (
    <label className="insc-field">
      <span>{label}{required && " *"}</span>
      <input
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`insc-input${error ? " insc-input-error" : ""}`}
        aria-invalid={Boolean(error)}
      />
      {error && <span className="insc-field-error">{error}</span>}
    </label>
  );
}

function SelectField({
  label, value, onChange, options, required = false
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; required?: boolean;
}) {
  return (
    <label className="insc-field">
      <span>{label}{required && " *"}</span>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="insc-input insc-select"
      >
        <option value="" disabled>Sélectionner…</option>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

function YesNo({
  label, value, onChange
}: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="nv27-yesno">
      <p className="nv27-yesno-q">{label}</p>
      <div className="nv27-yesno-btns">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`nv27-yesno-btn${value ? " nv27-yesno-on" : ""}`}
        >Oui</button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`nv27-yesno-btn${!value ? " nv27-yesno-on" : ""}`}
        >Non</button>
      </div>
    </div>
  );
}

type Props = {
  onComplete: (data: InscriptionFormData) => void;
  finalLabel?: string;
  initialData?: Partial<InscriptionFormData>;
};

export function InscriptionForm({ onComplete, finalLabel = "Vers le paiement →", initialData }: Props) {
  const [data, setData] = useState<InscriptionFormData>(() => ({ ...EMPTY, ...initialData }));
  const [block, setBlockRaw] = useState(1);
  const [attempted, setAttempted] = useState(false);

  const set = <K extends keyof InscriptionFormData>(key: K, val: InscriptionFormData[K]) =>
    setData((prev) => ({ ...prev, [key]: val }));

  // Change de bloc en réinitialisant l'affichage des erreurs du nouveau bloc
  const setBlock = (n: number) => { setAttempted(false); setBlockRaw(n); };

  // Validation par bloc — présence ET format (téléphone, courriel). Une seule
  // source de vérité : canContinue() est dérivé de blockFieldErrors().
  const blockFieldErrors = (): Partial<Record<keyof InscriptionFormData, string>> => {
    const errors: Partial<Record<keyof InscriptionFormData, string>> = {};
    switch (block) {
      case 1:
        if (!data.accFirst) errors.accFirst = "Prénom requis";
        if (!data.accLast) errors.accLast = "Nom requis";
        if (!data.accEmail) errors.accEmail = "Courriel requis";
        else if (!isValidEmail(data.accEmail)) errors.accEmail = "Courriel invalide";
        if (!data.accPhone) errors.accPhone = "Téléphone requis";
        else if (!isValidPhone(data.accPhone)) errors.accPhone = "Numéro de téléphone invalide (10 chiffres)";
        if (!data.accAddress) errors.accAddress = "Adresse requise";
        if (!data.accCity) errors.accCity = "Ville requise";
        if (!data.accProvince) errors.accProvince = "Province requise";
        if (!data.accCountry) errors.accCountry = "Pays requis";
        if (!data.accPostal) errors.accPostal = "Code postal requis";
        break;
      case 2:
        if (!data.plFirst) errors.plFirst = "Prénom requis";
        if (!data.plLast) errors.plLast = "Nom requis";
        if (!data.plDob) errors.plDob = "Date de naissance requise";
        if (!data.plLevel) errors.plLevel = "Niveau requis";
        break;
      case 3:
        if (!data.ecFirst) errors.ecFirst = "Prénom requis";
        if (!data.ecLast) errors.ecLast = "Nom requis";
        if (!data.ecRelation) errors.ecRelation = "Lien requis";
        if (!data.ecPhone) errors.ecPhone = "Téléphone requis";
        else if (!isValidPhone(data.ecPhone)) errors.ecPhone = "Numéro de téléphone invalide (10 chiffres)";
        if (data.hasSecond) {
          if (!data.ec2First) errors.ec2First = "Prénom requis";
          if (!data.ec2Last) errors.ec2Last = "Nom requis";
          if (!data.ec2Relation) errors.ec2Relation = "Lien requis";
          if (!data.ec2Phone) errors.ec2Phone = "Téléphone requis";
          else if (!isValidPhone(data.ec2Phone)) errors.ec2Phone = "Numéro de téléphone invalide (10 chiffres)";
        }
        break;
      case 4:
        if (data.hasAllergies && !data.allergies.trim()) errors.allergies = "Précisez les allergies";
        if (data.hasHealth && !data.health.trim()) errors.health = "Précisez";
        if (data.hasMedication && !data.medicationName.trim()) errors.medicationName = "Nom de la médication requis";
        if (data.hasRestrictions && !data.restrictions.trim()) errors.restrictions = "Description requise";
        break;
      case 5:
        if (!data.source) errors.source = "Sélectionnez une provenance";
        break;
      case 6:
        if (data.photoConsent !== "yes" && data.photoConsent !== "no") errors.photoConsent = "Choisissez une option";
        break;
    }
    return errors;
  };

  const errors = blockFieldErrors();
  const canContinue = Object.keys(errors).length === 0;
  const showError = (key: keyof InscriptionFormData) => (attempted ? errors[key] : undefined);

  const next = () => {
    if (!canContinue) { setAttempted(true); return; }
    if (block < TOTAL_BLOCKS) setBlock(block + 1);
    else onComplete(data);
  };

  return (
    <div className="nv27-form">
      {/* Progression */}
      <div className="nv27-form-progress">
        {BLOCK_TITLES.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => { if (i + 1 < block) setBlock(i + 1); }}
            disabled={i + 1 > block}
            className={`nv27-progress-dot${i + 1 === block ? " nv27-progress-active" : ""}${i + 1 < block ? " nv27-progress-done" : ""}`}
            aria-label={`Bloc ${i + 1} : ${t}`}
          >
            {i + 1 < block ? "✓" : i + 1}
          </button>
        ))}
      </div>

      <p className="nv27-form-blocklabel">Étape {block} / {TOTAL_BLOCKS}</p>
      <h3 className="nv27-form-blocktitle">{BLOCK_TITLES[block - 1]}</h3>

      {/* ── Bloc 1 ── */}
      {block === 1 && (
        <div className="nv27-form-fields">
          <div className="nv27-grid2">
            <Field label="Prénom" value={data.accFirst} onChange={(v) => set("accFirst", v)} required autoComplete="given-name" />
            <Field label="Nom" value={data.accLast} onChange={(v) => set("accLast", v)} required autoComplete="family-name" />
          </div>
          <div className="nv27-grid2">
            <Field label="Courriel" type="email" value={data.accEmail} onChange={(v) => set("accEmail", v)} required autoComplete="email" error={showError("accEmail")} />
            <Field label="Cellulaire" type="tel" value={data.accPhone} onChange={(v) => set("accPhone", v)} required autoComplete="tel" error={showError("accPhone")} />
          </div>
          <Field label="Adresse" value={data.accAddress} onChange={(v) => set("accAddress", v)} required autoComplete="street-address" />
          <div className="nv27-grid2">
            <Field label="Ville" value={data.accCity} onChange={(v) => set("accCity", v)} required autoComplete="address-level2" />
            <SelectField label="Province / État" value={data.accProvince} onChange={(v) => set("accProvince", v)} options={PROVINCES} required />
          </div>
          <div className="nv27-grid2">
            <SelectField label="Pays" value={data.accCountry} onChange={(v) => set("accCountry", v)} options={COUNTRIES} required />
            <Field label="Code postal" value={data.accPostal} onChange={(v) => set("accPostal", v)} required autoComplete="postal-code" />
          </div>
        </div>
      )}

      {/* ── Bloc 2 ── */}
      {block === 2 && (
        <div className="nv27-form-fields">
          <div className="nv27-grid2">
            <Field label="Prénom" value={data.plFirst} onChange={(v) => set("plFirst", v)} required />
            <Field label="Nom" value={data.plLast} onChange={(v) => set("plLast", v)} required />
          </div>
          <div className="nv27-grid2">
            <Field label="Date de naissance" type="date" value={data.plDob} onChange={(v) => set("plDob", v)} required />
            <SelectField label="Niveau de jeu" value={data.plLevel} onChange={(v) => set("plLevel", v)} options={LEVELS} required />
          </div>
          <Field label="Club actuel (facultatif)" value={data.plClub} onChange={(v) => set("plClub", v)} />
        </div>
      )}

      {/* ── Bloc 3 ── */}
      {block === 3 && (
        <div className="nv27-form-fields">
          <div className="nv27-grid2">
            <Field label="Prénom" value={data.ecFirst} onChange={(v) => set("ecFirst", v)} required />
            <Field label="Nom" value={data.ecLast} onChange={(v) => set("ecLast", v)} required />
          </div>
          <div className="nv27-grid2">
            <Field label="Lien avec la joueuse" value={data.ecRelation} onChange={(v) => set("ecRelation", v)} required placeholder="Mère, père, tuteur…" />
            <Field label="Cellulaire" type="tel" value={data.ecPhone} onChange={(v) => set("ecPhone", v)} required error={showError("ecPhone")} />
          </div>

          {!data.hasSecond ? (
            <button type="button" className="nv27-add-btn" onClick={() => set("hasSecond", true)}>
              + Ajouter un deuxième contact (optionnel)
            </button>
          ) : (
            <div className="nv27-subblock">
              <div className="nv27-subblock-head">
                <span>Deuxième contact</span>
                <button type="button" className="nv27-remove-btn" onClick={() => set("hasSecond", false)}>Retirer</button>
              </div>
              <div className="nv27-grid2">
                <Field label="Prénom" value={data.ec2First} onChange={(v) => set("ec2First", v)} required />
                <Field label="Nom" value={data.ec2Last} onChange={(v) => set("ec2Last", v)} required />
              </div>
              <div className="nv27-grid2">
                <Field label="Lien avec la joueuse" value={data.ec2Relation} onChange={(v) => set("ec2Relation", v)} required />
                <Field label="Cellulaire" type="tel" value={data.ec2Phone} onChange={(v) => set("ec2Phone", v)} required error={showError("ec2Phone")} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bloc 4 ── */}
      {block === 4 && (
        <div className="nv27-form-fields">
          <YesNo label="Votre enfant souffre-t-elle d'allergies ?" value={data.hasAllergies} onChange={(v) => set("hasAllergies", v)} />
          {data.hasAllergies && (
            <label className="insc-field">
              <span>Précisez les allergies *</span>
              <textarea className="insc-input insc-textarea" value={data.allergies} onChange={(e) => set("allergies", e.target.value)} rows={2} />
            </label>
          )}

          <YesNo label="Votre enfant présente-t-elle des problèmes de santé ?" value={data.hasHealth} onChange={(v) => set("hasHealth", v)} />
          {data.hasHealth && (
            <label className="insc-field">
              <span>Précisez *</span>
              <textarea className="insc-input insc-textarea" value={data.health} onChange={(e) => set("health", e.target.value)} rows={2} />
            </label>
          )}

          <YesNo label="Votre enfant prend-elle une médication ?" value={data.hasMedication} onChange={(v) => set("hasMedication", v)} />
          {data.hasMedication && (
            <div className="nv27-grid2">
              <Field label="Nom de la médication" value={data.medicationName} onChange={(v) => set("medicationName", v)} required />
              <Field label="Consignes à respecter" value={data.medicationInstr} onChange={(v) => set("medicationInstr", v)} />
            </div>
          )}

          <YesNo label="Restrictions physiques ou médicales ?" value={data.hasRestrictions} onChange={(v) => set("hasRestrictions", v)} />
          {data.hasRestrictions && (
            <label className="insc-field">
              <span>Description *</span>
              <textarea className="insc-input insc-textarea" value={data.restrictions} onChange={(e) => set("restrictions", e.target.value)} rows={2} />
            </label>
          )}
        </div>
      )}

      {/* ── Bloc 5 ── */}
      {block === 5 && (
        <div className="nv27-form-fields">
          <p className="nv27-form-help">Comment avez-vous entendu parler de New Valkyria Académie ?</p>
          <div className="nv27-source-grid">
            {SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set("source", s)}
                className={`nv27-source-chip${data.source === s ? " nv27-source-on" : ""}`}
              >{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Bloc 6 ── */}
      {block === 6 && (
        <div className="nv27-form-fields">
          <p className="nv27-form-help">
            Veuillez lire l&apos;autorisation ci-dessous, puis indiquer votre choix.
          </p>

          <details className="nv27-accordion">
            <summary className="nv27-accordion-summary">
              <span>Autorisation d&apos;utilisation de l&apos;image — texte complet</span>
              <span className="nv27-accordion-chevron" aria-hidden>▾</span>
            </summary>
            <div className="nv27-accordion-body">
              <p>
                Par la présente, j&apos;autorise <strong>New Valkyria Académie</strong>, ainsi que toute
                personne mandatée par elle, à <strong>photographier, filmer et enregistrer</strong> mon
                enfant dans le cadre des activités, entraînements, matchs et événements de l&apos;académie.
              </p>
              <p>
                Cette autorisation vise l&apos;utilisation de l&apos;<strong>image, de la voix et des
                enregistrements vidéo</strong> de mon enfant, en tout ou en partie, sans limite de durée
                ni de territoire.
              </p>
              <p>
                Les contenus pourront être utilisés à des fins de promotion, de communication et de
                documentation sur les supports suivants&nbsp;: <strong>site Web, réseaux sociaux,
                publications imprimées, affiches, infolettres, vidéos promotionnelles, communiqués et tout
                autre matériel de communication</strong> de l&apos;académie ou de ses partenaires.
              </p>
              <p>
                Je reconnais que cette autorisation est accordée <strong>à titre gratuit</strong>, sans
                aucune compensation ou contrepartie financière, présente ou future, et je renonce à toute
                réclamation à cet égard.
              </p>
              <p>
                Je confirme être le <strong>parent ou le tuteur légal</strong> de l&apos;enfant et être
                légalement autorisé(e) à consentir à la présente en son nom. Je comprends que je peux
                retirer ce consentement en tout temps par écrit, sans effet rétroactif sur les contenus
                déjà diffusés.
              </p>
              <p className="nv27-accordion-note">
                Conformément à la Loi sur la protection des renseignements personnels dans le secteur privé
                (Québec) et au droit à l&apos;image reconnu par le Code civil du Québec.
              </p>
            </div>
          </details>

          <label className={`nv27-radio${data.photoConsent === "yes" ? " nv27-radio-on" : ""}`}>
            <input type="radio" name="photo" checked={data.photoConsent === "yes"} onChange={() => set("photoConsent", "yes")} />
            <span>J&apos;autorise New Valkyria Académie à utiliser l&apos;image de mon enfant conformément aux conditions ci-dessus.</span>
          </label>
          <label className={`nv27-radio${data.photoConsent === "no" ? " nv27-radio-on" : ""}`}>
            <input type="radio" name="photo" checked={data.photoConsent === "no"} onChange={() => set("photoConsent", "no")} />
            <span>Je n&apos;autorise pas l&apos;utilisation de l&apos;image de mon enfant.</span>
          </label>
        </div>
      )}

      {/* Navigation */}
      <div className="nv27-form-nav">
        {block > 1 && (
          <button type="button" className="nv27-btn-ghost" onClick={() => setBlock(block - 1)}>
            ← Retour
          </button>
        )}
        <button type="button" className="nv27-btn-primary" onClick={next}>
          {block < TOTAL_BLOCKS ? "Continuer →" : finalLabel}
        </button>
      </div>
    </div>
  );
}
