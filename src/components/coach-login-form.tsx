"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CoachLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/coach/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      router.push("/entraineur/dashboard");
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Identifiant ou mot de passe incorrect");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-login-form">
      <label className="admin-field">
        <span>Identifiant</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="admin-input"
          autoFocus
          autoComplete="username"
        />
      </label>
      <label className="admin-field">
        <span>Mot de passe</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="admin-input"
          autoComplete="current-password"
        />
      </label>

      {error && <p className="admin-error" role="alert">{error}</p>}

      <button type="submit" disabled={loading} className="admin-btn-primary">
        {loading ? "Connexion..." : "Accéder →"}
      </button>
    </form>
  );
}
