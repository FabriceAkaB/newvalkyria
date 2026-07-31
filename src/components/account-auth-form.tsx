"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "signin" | "signup";

export function AccountAuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = mode === "signup" ? "/api/compte/inscription" : "/api/compte/connexion";
    const body = mode === "signup" ? { fullName, email, password } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Une erreur est survenue.");
        setLoading(false);
        return;
      }
      router.push("/compte/espace");
      router.refresh();
    } catch {
      setError("Une erreur réseau est survenue. Veuillez réessayer.");
      setLoading(false);
    }
  };

  return (
    <div className="nv27-step" style={{ marginTop: "1.5rem" }}>
      <div className="nv27-tabs" role="tablist" aria-label="Mode d'accès au compte">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          className={`nv27-tab${mode === "signin" ? " nv27-tab-active" : ""}`}
          onClick={() => { setMode("signin"); setError(null); }}
        >
          Se connecter
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={`nv27-tab${mode === "signup" ? " nv27-tab-active" : ""}`}
          onClick={() => { setMode("signup"); setError(null); }}
        >
          Créer un compte
        </button>
      </div>

      {error && <p className="nv27-pay-error" style={{ marginTop: "1rem" }}>{error}</p>}

      <form onSubmit={handleSubmit} className="nv27-form-fields" style={{ marginTop: "1.25rem" }}>
        {mode === "signup" && (
          <label className="insc-field">
            <span>Nom complet</span>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="insc-input"
              autoComplete="name"
            />
          </label>
        )}
        <label className="insc-field">
          <span>Courriel</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="insc-input"
            autoComplete="email"
          />
        </label>
        <label className="insc-field">
          <span>Mot de passe</span>
          <input
            type="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="insc-input"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </label>

        <button type="submit" className="nv27-btn-primary" disabled={loading} style={{ marginTop: "0.5rem" }}>
          {loading ? "Un instant…" : mode === "signup" ? "Créer mon compte →" : "Se connecter →"}
        </button>
      </form>
    </div>
  );
}
