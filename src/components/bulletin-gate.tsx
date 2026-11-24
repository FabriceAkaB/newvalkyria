"use client";

import { Check, Copy, ExternalLink, Lock, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SurveyQuestion } from "@/lib/surveys-repo";

import "./bulletin-gate.css";

/** Espace famille, Progression (P4.8.18) : le bulletin remis reste fermé tant que le parent n'a pas répondu au
 *  sondage de 2 minutes. À l'envoi, la page se recharge et le bulletin s'ouvre. Jetons --adm-*, une colonne au téléphone. */

const SCALE5 = ["Pas du tout", "Peu", "Moyen", "Bien", "Excellent"];

export function BulletinGateSurvey({ period, names, label, intro, questions }: { period: "mi-saison" | "fin-saison"; names: string; label: string; intro: string | null; questions: SurveyQuestion[] }) {
  const router = useRouter();
  const [a, setA] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (id: string, v: unknown) => setA((cur) => ({ ...cur, [id]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/compte/bulletin-sondage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "repondre", period, answers: a })
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      return setError(json?.error ?? "Pas envoyé : vérifiez votre connexion et réessayez.");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    router.refresh();
  };

  return (
    <form className="nvg" onSubmit={submit} aria-label={`Sondage avant le ${label.toLowerCase()}`}>
      <header className="nvg-head">
        <span className="nvg-lock" aria-hidden>
          <Lock size={20} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="nvg-title">Le {label.charAt(0).toLowerCase() + label.slice(1)} de {names} est prêt</h2>
          <p className="nvg-sub">{intro || "Répondez d'abord à ce court sondage (2 minutes) : le bulletin s'ouvre juste après."}</p>
        </div>
      </header>

      <ol className="nvg-list">
        {questions.map((q, idx) => (
          <li key={q.id} className="nvg-q">
            <fieldset>
              <legend className="nvg-label">
                <span className="nvg-num">{idx + 1}</span>
                <span>
                  {q.label}
                  {q.required ? <span className="nvg-req" aria-label="obligatoire"> *</span> : null}
                </span>
              </legend>
              {q.help ? <p className="nvg-help">{q.help}</p> : null}
              <Answer q={q} value={a[q.id]} onChange={(v) => set(q.id, v)} />
            </fieldset>
          </li>
        ))}
      </ol>

      {error ? (
        <p className="nvg-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="nvg-submit" disabled={busy}>
        {busy ? "Envoi…" : "Envoyer et voir le bulletin"}
      </button>
      <p className="nvg-foot">Vos réponses sont lues par l&apos;équipe de l&apos;académie seulement.</p>
    </form>
  );
}

function Answer({ q, value, onChange }: { q: SurveyQuestion; value: unknown; onChange: (v: unknown) => void }) {
  if (q.type === "note10" || q.type === "echelle5") {
    const values = q.type === "note10" ? Array.from({ length: 11 }, (_, i) => i) : [1, 2, 3, 4, 5];
    return (
      <div className={q.type === "note10" ? "nvg-scale nvg-scale--10" : "nvg-scale"} role="radiogroup" aria-label={q.label}>
        {values.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} data-on={value === n || undefined} onClick={() => onChange(n)} title={q.type === "echelle5" ? SCALE5[n - 1] : undefined}>
            {q.type === "echelle5" ? SCALE5[n - 1] : n}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === "choix" || q.type === "oui_non") {
    const opts = q.type === "oui_non" ? ["Oui", "Non"] : q.options ?? [];
    return (
      <div className="nvg-chips" role="radiogroup" aria-label={q.label}>
        {opts.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} data-on={value === o || undefined} onClick={() => onChange(value === o ? undefined : o)}>
            {o}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === "choix_multiple") {
    const cur = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="nvg-chips" role="group" aria-label={q.label}>
        {(q.options ?? []).map((o) => {
          const on = cur.includes(o);
          return (
            <button key={o} type="button" aria-pressed={on} data-on={on || undefined} onClick={() => onChange(on ? cur.filter((x) => x !== o) : [...cur, o])}>
              {on ? <Check size={14} strokeWidth={2.25} aria-hidden /> : null}
              {o}
            </button>
          );
        })}
      </div>
    );
  }
  return <textarea className="nvg-text" rows={2} maxLength={4000} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} aria-label={q.label} />;
}

/** Au-dessus du bulletin ouvert, pour un parent qui a donné 9 ou 10 (P3.8.19) : son texte est copié et la fenêtre d'avis de
 *  la fiche Google s'ouvre ; c'est lui qui choisit ses étoiles et clique « Publier » (règle de Google). Jamais de cadeau. */
export function BulletinGoogleReview({ period, url, draft, clicked }: { period: "mi-saison" | "fin-saison"; url: string; draft: string; clicked: boolean }) {
  const [text, setText] = useState(draft);
  const [done, setDone] = useState(clicked);
  const [copied, setCopied] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const open = () => {
    // Copie lancée pendant que la page a encore le focus, puis la fenêtre Google (même clic : pas bloquée).
    const t = text.trim();
    if (t && navigator.clipboard) navigator.clipboard.writeText(t).then(() => setCopied(true), () => setCopied(false));
    window.open(url, "_blank", "noopener");
    setDone(true);
    void fetch("/api/compte/bulletin-sondage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "google", period }) }).catch(() => null);
  };

  return (
    <section className="nvg nvg--review" aria-label="Laisser un avis Google">
      <header className="nvg-head">
        <span className="nvg-lock nvg-lock--star" aria-hidden>
          <Star size={20} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="nvg-title">Merci ! Un avis Google aiderait d&apos;autres familles</h2>
          <p className="nvg-sub">Vous nous recommandez sans hésiter. En 20 secondes, votre avis aide un parent qui cherche une académie pour sa fille à nous trouver.</p>
        </div>
      </header>
      <label className="nvg-label nvg-label--plain" htmlFor="nvg-review-text">
        Votre texte (vous pouvez le modifier)
      </label>
      <textarea id="nvg-review-text" className="nvg-text" rows={3} maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ce que votre fille vit à l'académie, ce que vous aimez…" />
      <button type="button" className="nvg-submit" onClick={open}>
        <Copy size={16} strokeWidth={2} aria-hidden /> Laisser cet avis sur Google <ExternalLink size={15} strokeWidth={2} aria-hidden />
      </button>
      {done ? (
        <p className="nvg-ok" role="status">
          <Check size={16} strokeWidth={2.25} aria-hidden /> {copied ? "Texte copié. " : ""}Dans la fenêtre Google : choisissez vos étoiles, collez le texte (appui long, puis « Coller ») et touchez « Publier ».
        </p>
      ) : (
        <p className="nvg-foot">Google demande que ce soit vous qui publiez : le bouton copie votre texte et ouvre la page d&apos;avis de l&apos;académie.</p>
      )}
      <button type="button" className="nvg-later" onClick={() => setHidden(true)}>
        {done ? "Fermer" : "Plus tard"}
      </button>
    </section>
  );
}
