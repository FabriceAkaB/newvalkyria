"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Container } from "@/components/container";
import { InscriptionContent } from "@/components/inscription-content";

export function InvitationGate() {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/inscription/acces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; redirectTo?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Code invalide.");
      }
      if (data.redirectTo) {
        router.push(data.redirectTo);
        return;
      }
      setUnlocked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code invalide.");
      setLoading(false);
    }
  };

  if (unlocked) {
    return <InscriptionContent variant="advanced" />;
  }

  return (
    <>
      <section className="insc-hero">
        <Container>
          <div className="insc-hero-inner">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Accès sur invitation</p>
            <h1 className="insc-hero-title">Programmes avancés</h1>
            <p className="insc-hero-sub">
              Ces programmes sont réservés aux joueuses invitées par nos entraîneurs.
              Saisissez le code qui vous a été transmis pour accéder à l&apos;inscription.
            </p>
          </div>
        </Container>
      </section>

      <section className="section-band band-dark">
        <Container className="max-w-md">
          <form onSubmit={submit} className="nv27-gate">
            <label className="insc-field">
              <span>Code d&apos;accès</span>
              <input
                className="insc-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                inputMode="numeric"
                placeholder="Entrez votre code"
                required
              />
            </label>
            {error && <p className="insc-error" role="alert">{error}</p>}
            <button type="submit" className="nv27-btn-primary" disabled={loading}>
              {loading ? "Vérification…" : "Déverrouiller →"}
            </button>
          </form>
        </Container>
      </section>
    </>
  );
}
