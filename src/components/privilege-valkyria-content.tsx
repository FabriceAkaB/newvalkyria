"use client";

import { useState } from "react";

import { Container } from "@/components/container";
import { InscriptionForm, type InscriptionFormData } from "@/components/inscription-form";

interface DateRow {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  location: string;
}

function formatSessionDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
}

function fmt(cents: number) {
  return (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

export function PrivilegeValkyriaContent({
  title,
  tagline,
  intro,
  priceCents,
  dates,
  remaining,
  isFull
}: {
  title: string;
  tagline: string;
  intro: string;
  priceCents: number;
  dates: DateRow[];
  remaining: number;
  isFull: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async (data: InscriptionFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/inscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programCode: "PV",
          year: "2013-2012",
          variant: "public",
          playerFirstName: data.plFirst,
          playerLastName: data.plLast,
          playerDob: data.plDob || undefined,
          parentName: `${data.accFirst} ${data.accLast}`.trim(),
          parentEmail: data.accEmail,
          parentPhone: data.accPhone,
          city: data.accCity,
          cancelPath: "/programmes/privilege-valkyria?cancelled=1"
        })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Erreur d'inscription");
      window.location.href = body.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="insc-hero se-hero">
        <Container>
          <div className="insc-hero-inner" style={{ textAlign: "center" }}>
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">{tagline}</p>
            <h1 className="insc-hero-title">{title}</h1>
            <p className="insc-hero-sub">{intro}</p>
          </div>
        </Container>
      </section>

      <section className="section-band">
        <Container className="max-w-2xl">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginBottom: "0.75rem" }}>Les {dates.length} séances</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.5rem" }}>
            {dates.map((d) => (
              <p key={d.id} style={{ fontSize: "0.82rem", color: "#c3c2c8", margin: 0 }}>
                {formatSessionDate(d.session_date)} · {d.start_time.slice(0, 5)}–{d.end_time.slice(0, 5)} · {d.location}
              </p>
            ))}
          </div>

          {isFull ? (
            <p style={{ fontSize: "0.9rem", color: "#ffb464", marginBottom: "1.5rem" }}>Ce programme est complet pour le moment.</p>
          ) : (
            <>
              <p style={{ fontSize: "0.82rem", color: "#6d6b71", marginBottom: "1.5rem" }}>
                {remaining} place{remaining !== 1 ? "s" : ""} restante{remaining !== 1 ? "s" : ""} · {fmt(priceCents)}
              </p>

              {error && <p className="nv27-pay-error" style={{ marginBottom: "1rem" }}>{error}</p>}

              <InscriptionForm onComplete={handleComplete} finalLabel={submitting ? "..." : `S'inscrire — ${fmt(priceCents)} →`} />
            </>
          )}
        </Container>
      </section>
    </>
  );
}
