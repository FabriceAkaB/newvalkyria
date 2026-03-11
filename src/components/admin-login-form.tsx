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
      router.push("/admin/dashboard");
    } else {
      setError("Mot de passe incorrect");
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
    </form>
  );
}
