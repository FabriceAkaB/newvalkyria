"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      router.push(data?.role === "borne" ? "/admin/borne" : "/admin/aujourdhui");
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Mot de passe incorrect");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-login-form">
      <label className="admin-field">
        <span>Mot de passe</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="admin-input"
          autoFocus
          autoComplete="current-password"
        />
      </label>

      {error && <p className="admin-error" role="alert">{error}</p>}

      <button type="submit" disabled={loading} className="admin-btn-primary">
        {loading ? "Connexion..." : "Accéder →"}
      </button>
      <ForgotCode />
    </form>
  );
}

/** « Code oublié ? » (JP, 20 nov. 2026) : un lien de 30 minutes part au courriel de JP pour choisir un nouveau code. */
function ForgotCode() {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  if (state === "sent") return <p className="admin-login-sub" role="status" style={{ margin: 0 }}>Si ce compte existe, un lien vient de partir au courriel de JP (valable 30 minutes).</p>;
  return (
    <button
      type="button"
      disabled={state === "busy"}
      onClick={async () => {
        setState("busy");
        await fetch("/api/admin/code-oublie", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
        setState("sent");
      }}
      style={{ background: "none", border: 0, padding: 0, color: "var(--adm-accent)", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", justifySelf: "start" }}
    >
      {state === "busy" ? "Envoi…" : "Code oublié ?"}
    </button>
  );
}
