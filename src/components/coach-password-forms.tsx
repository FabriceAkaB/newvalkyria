"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Formulaires d'accès des éducateurs (JP, 18 nov. 2026) : mot de passe oublié, choisir son mot de passe avec le lien
 *  reçu, changer son mot de passe dans Mon dossier. */

export function CoachForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (sent) {
    return (
      <div className="admin-login-form">
        <p className="admin-login-sub" style={{ margin: 0 }}>Si ce courriel est celui d&apos;un éducateur, un lien vient d&apos;y être envoyé. Il est valide 2 heures.</p>
        <Link href="/entraineur" className="admin-btn-ghost" style={{ textAlign: "center" }}>Retour à la connexion</Link>
      </div>
    );
  }
  return (
    <form
      className="admin-login-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await fetch("/api/coach/auth/oubli", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => null);
        setSent(true);
      }}
    >
      <label className="admin-field">
        <span>Ton courriel</span>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="admin-input" autoFocus autoComplete="email" />
      </label>
      <button type="submit" disabled={busy} className="admin-btn-primary">{busy ? "Envoi…" : "Recevoir un lien"}</button>
      <Link href="/entraineur" style={{ fontSize: "0.85rem", textAlign: "center" }}>Retour à la connexion</Link>
    </form>
  );
}

export function CoachSetPasswordForm({ token, firstName }: { token: string; firstName: string }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="admin-login-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pw !== pw2) return setError("Les deux mots de passe ne sont pas pareils.");
        setBusy(true);
        setError(null);
        const res = await fetch("/api/coach/auth/mot-de-passe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: pw }) }).catch(() => null);
        if (res?.ok) return router.push("/entraineur/dashboard");
        const data = await res?.json().catch(() => null);
        setError(data?.error ?? "Erreur, réessaie.");
        setBusy(false);
      }}
    >
      <p className="admin-login-sub" style={{ margin: 0 }}>Bonjour {firstName}, choisis ton mot de passe : au moins 8 caractères, avec une lettre et un chiffre.</p>
      <label className="admin-field">
        <span>Nouveau mot de passe</span>
        <input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} className="admin-input" autoFocus autoComplete="new-password" />
      </label>
      <label className="admin-field">
        <span>Encore une fois</span>
        <input type="password" required value={pw2} onChange={(e) => setPw2(e.target.value)} className="admin-input" autoComplete="new-password" />
      </label>
      {error ? <p className="admin-error" role="alert">{error}</p> : null}
      <button type="submit" disabled={busy} className="admin-btn-primary">{busy ? "…" : "Enregistrer et entrer →"}</button>
    </form>
  );
}

export function CoachChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      style={{ display: "grid", gap: 10, maxWidth: 360 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await fetch("/api/coach/auth/changer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current, next }) }).catch(() => null);
        const data = await res?.json().catch(() => null);
        setMsg(res?.ok ? { ok: true, text: "Mot de passe changé." } : { ok: false, text: data?.error ?? "Erreur, réessaie." });
        if (res?.ok) (setCurrent(""), setNext(""));
        setBusy(false);
      }}
    >
      <input type="password" required placeholder="Mot de passe actuel" value={current} onChange={(e) => setCurrent(e.target.value)} className="admin-input" autoComplete="current-password" />
      <input type="password" required placeholder="Nouveau (8 caractères, une lettre et un chiffre)" value={next} onChange={(e) => setNext(e.target.value)} className="admin-input" autoComplete="new-password" />
      <button type="submit" disabled={busy} className="admin-btn-primary">{busy ? "…" : "Changer mon mot de passe"}</button>
      {msg ? <p role="status" style={{ margin: 0, color: msg.ok ? "var(--adm-good)" : "var(--adm-bad)", fontSize: "0.85rem" }}>{msg.text}</p> : null}
    </form>
  );
}
