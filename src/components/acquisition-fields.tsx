"use client";

import { useId } from "react";

import { ACQUISITION_SOURCES, sourceDef, sourceFormLabel, type AcquisitionErrors, type AcquisitionValue } from "@/lib/acquisition-core";

/** « Comment nous avez-vous connus ? » (obligatoire) + « Avez-vous une entreprise ? » (facultatif).
 *  Un seul composant pour tous les formulaires publics : inscription et essai filles, programmes et
 *  essais garçons, Sport-Études. Réutilise les styles des formulaires (puces, Oui / Non, champs).
 *  `referralElsewhere` : le formulaire a déjà son bloc « Recommandation » (code ou nom de la famille),
 *  on n'y redemande pas la précision du parrainage. `brand="atlantic"` : libellés sans « Valkyria ». */
export function AcquisitionFields({
  value,
  onChange,
  errors,
  brand = "nv",
  referralElsewhere = false,
  showBusiness = true
}: {
  value: AcquisitionValue;
  onChange: (next: AcquisitionValue) => void;
  /** Erreurs à afficher (seulement après une tentative d'envoi). */
  errors?: AcquisitionErrors;
  brand?: "nv" | "atlantic";
  referralElsewhere?: boolean;
  showBusiness?: boolean;
}) {
  const uid = useId();
  const def = sourceDef(value.source);
  const detail = def?.detail;
  const chip = { minHeight: 44, lineHeight: 1.25 } as const;
  const yesNo = { minHeight: 44, minWidth: 64 } as const;

  return (
    <div className="nv27-form-fields" style={{ gap: "0.75rem" }}>
      <p id={`${uid}-q`} className="nv27-form-help" style={{ margin: 0, color: "#ecebf0", fontWeight: 600 }}>
        Comment nous avez-vous connus&nbsp;? *
      </p>
      <div className="nv27-source-grid" role="radiogroup" aria-labelledby={`${uid}-q`} aria-invalid={Boolean(errors?.source)}>
        {ACQUISITION_SOURCES.map((s) => {
          const on = value.source === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`nv27-source-chip${on ? " nv27-source-on" : ""}`}
              style={chip}
              onClick={() => onChange({ ...value, source: s.id, detail: on ? value.detail : "" })}
            >
              {sourceFormLabel(s, brand)}
            </button>
          );
        })}
      </div>
      {errors?.source ? <span className="insc-field-error">{errors.source}</span> : null}

      {def && detail?.options ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <p id={`${uid}-d`} className="nv27-form-help" style={{ margin: 0 }}>
            {detail.label}
            {detail.required ? " *" : ""}
          </p>
          <div role="radiogroup" aria-labelledby={`${uid}-d`} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "0.5rem" }}>
            {detail.options.map((o) => {
              const on = value.detail === o;
              return (
                <button key={o} type="button" role="radio" aria-checked={on} className={`nv27-source-chip${on ? " nv27-source-on" : ""}`} style={chip} onClick={() => onChange({ ...value, detail: o })}>
                  {o}
                </button>
              );
            })}
          </div>
          {errors?.detail ? <span className="insc-field-error">{errors.detail}</span> : null}
        </div>
      ) : def && detail && def.id === "parrainage" && referralElsewhere ? (
        <div>
          <p className="nv27-form-help" style={{ margin: 0, fontSize: "0.8rem", color: "#a9a8b0" }}>
            Indiquez le code ou le nom de la famille dans « Recommandation », juste en dessous.
          </p>
          {errors?.detail ? <span className="insc-field-error">{errors.detail}</span> : null}
        </div>
      ) : def && detail ? (
        <label className="insc-field">
          <span>
            {detail.label}
            {detail.required ? " *" : ""}
          </span>
          <input
            className={`insc-input${errors?.detail ? " insc-input-error" : ""}`}
            value={value.detail}
            maxLength={200}
            placeholder={detail.placeholder}
            aria-invalid={Boolean(errors?.detail)}
            onChange={(e) => onChange({ ...value, detail: e.target.value })}
          />
          {errors?.detail ? <span className="insc-field-error">{errors.detail}</span> : null}
        </label>
      ) : null}

      {showBusiness ? (
        <>
          <div className="nv27-yesno" style={{ borderBottom: "none", paddingBottom: 0 }}>
            <p className="nv27-yesno-q" id={`${uid}-b`} style={{ margin: 0 }}>
              Avez-vous une entreprise&nbsp;? <span style={{ color: "#8f8e96" }}>(facultatif)</span>
              <span style={{ display: "block", fontSize: "0.76rem", color: "#8f8e96", marginTop: 4, lineHeight: 1.45 }}>
                Des familles appuient l&apos;académie comme commanditaires. On vous en parlera seulement si ça vous intéresse.
              </span>
            </p>
            <div className="nv27-yesno-btns" role="radiogroup" aria-labelledby={`${uid}-b`}>
              <button
                type="button"
                role="radio"
                aria-checked={value.hasBusiness === true}
                className={`nv27-yesno-btn${value.hasBusiness === true ? " nv27-yesno-on" : ""}`}
                style={yesNo}
                onClick={() => onChange({ ...value, hasBusiness: true })}
              >
                Oui
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={value.hasBusiness === false}
                className={`nv27-yesno-btn${value.hasBusiness === false ? " nv27-yesno-on" : ""}`}
                style={yesNo}
                onClick={() => onChange({ ...value, hasBusiness: false, businessName: "" })}
              >
                Non
              </button>
            </div>
          </div>
          {value.hasBusiness ? (
            <label className="insc-field">
              <span>Nom de l&apos;entreprise *</span>
              <input
                className={`insc-input${errors?.businessName ? " insc-input-error" : ""}`}
                value={value.businessName}
                maxLength={160}
                autoComplete="organization"
                aria-invalid={Boolean(errors?.businessName)}
                onChange={(e) => onChange({ ...value, businessName: e.target.value })}
              />
              {errors?.businessName ? <span className="insc-field-error">{errors.businessName}</span> : null}
            </label>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
