"use client";

import { Pause, Play, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Interrupteur de l'accueil des 30 premiers jours (mode assistant par défaut) et lien de la vidéo de bienvenue. */
export function Onboarding30DaysPanel({ active, videoUrl }: { active: boolean; videoUrl: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [video, setVideo] = useState(videoUrl ?? "");
  const [message, setMessage] = useState<string | null>(null);

  const save = async (body: { active?: boolean; videoUrl?: string }) => {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/accueil-30-jours", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res?.ok) {
      setMessage(json?.error ?? "Enregistrement impossible.");
      return;
    }
    setMessage("Enregistré.");
    router.refresh();
  };

  return (
    <section className="mda-card" style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          padding: 12,
          borderRadius: 10,
          background: active ? "var(--adm-good-soft)" : "var(--adm-surface-2)"
        }}
      >
        <div>
          <p style={{ margin: 0, fontWeight: 600, color: active ? "var(--adm-good)" : "var(--adm-text)" }}>
            {active ? "Actif : chaque nouvelle famille reçoit sa séquence" : "Mode assistant : rien ne part, la page montre ce qui serait programmé"}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "0.8125rem", color: "var(--adm-text-2)" }}>
            Les courriels programmés se voient et s&apos;annulent dans Messages et tâches programmés.
          </p>
        </div>
        <button
          type="button"
          className={active ? "admin-btn-ghost" : "admin-btn-primary"}
          disabled={busy}
          style={{ minHeight: 40, display: "inline-flex", alignItems: "center", gap: 6 }}
          onClick={() => {
            if (!active && !confirm("Activer l'accueil des 30 premiers jours ? Chaque nouvelle famille payée recevra ces 5 courriels.")) return;
            void save({ active: !active });
          }}
        >
          {active ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          {active ? "Mettre en pause" : "Activer"}
        </button>
      </div>

      <form
        style={{ display: "grid", gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          void save({ videoUrl: video.trim() });
        }}
      >
        <label htmlFor="video-bienvenue" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: "0.875rem", color: "var(--adm-text)" }}>
          <Video size={16} aria-hidden /> Vidéo de bienvenue de JP (60 secondes)
        </label>
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--adm-text-2)" }}>
          Le lien (YouTube non répertorié, Vimeo…) apparaît dans le courriel de bienvenue. Vide = pas de vidéo.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            id="video-bienvenue"
            className="admin-input"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={video}
            onChange={(e) => setVideo(e.target.value)}
            style={{ flex: "1 1 240px", minWidth: 0 }}
          />
          <button type="submit" className="admin-btn-ghost" disabled={busy} style={{ minHeight: 40 }}>
            Enregistrer le lien
          </button>
        </div>
      </form>
      {message ? <p style={{ margin: 0, fontSize: "0.8125rem", color: message === "Enregistré." ? "var(--adm-good)" : "var(--adm-bad)" }}>{message}</p> : null}
    </section>
  );
}
