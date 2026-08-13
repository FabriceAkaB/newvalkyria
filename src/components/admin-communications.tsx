"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { AudienceCriteria, CommunicationLogEntry, TargetType } from "@/lib/communications-repo";

interface SeasonOption {
  key: string;
  label: string;
  categories: { id: string; label: string }[];
  slots: { id: string; label: string }[];
}

interface PlayerResult {
  id: string;
  player_first_name: string | null;
  player_last_name: string | null;
  parent_name: string;
}

const TARGET_LABELS: Record<TargetType, string> = {
  all: "Toute l'académie",
  season: "Une saison",
  category: "Une catégorie",
  group: "Un groupe (horaire)",
  parents: "Tous les parents",
  coaches: "Tous les entraîneurs",
  player: "Une joueuse"
};

export function AdminCommunications({ seasonOptions, history: initialHistory }: { seasonOptions: SeasonOption[]; history: CommunicationLogEntry[] }) {
  const [history, setHistory] = useState(initialHistory);
  const [targetType, setTargetType] = useState<TargetType>("all");
  const [seasonKey, setSeasonKey] = useState(seasonOptions[0]?.key ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [timeSlotTemplateId, setTimeSlotTemplateId] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerResult | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ count: number; sample: { name: string; email: string }[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentSeason = seasonOptions.find((s) => s.key === seasonKey);

  const buildCriteria = (): AudienceCriteria => {
    switch (targetType) {
      case "season": return { seasonKey };
      case "category": return { seasonKey, categoryId };
      case "group": return { timeSlotTemplateId };
      case "player": return { registrationId: selectedPlayer?.id };
      default: return {};
    }
  };

  const targetLabel = (): string => {
    switch (targetType) {
      case "season": return `Saison — ${currentSeason?.label ?? seasonKey}`;
      case "category": return `Catégorie — ${currentSeason?.categories.find((c) => c.id === categoryId)?.label ?? categoryId}`;
      case "group": return `Groupe — ${currentSeason?.slots.find((s) => s.id === timeSlotTemplateId)?.label ?? timeSlotTemplateId}`;
      case "player": return `Joueuse — ${selectedPlayer ? `${selectedPlayer.player_first_name} ${selectedPlayer.player_last_name}` : ""}`;
      default: return TARGET_LABELS[targetType];
    }
  };

  const searchPlayers = async (q: string) => {
    setPlayerQuery(q);
    if (q.trim().length < 2) { setPlayerResults([]); return; }
    const res = await fetch(`/api/admin/registrations-search?q=${encodeURIComponent(q)}`);
    const data = await res.json().catch(() => ({ registrations: [] }));
    setPlayerResults(data.registrations ?? []);
  };

  const doPreview = async () => {
    setPreviewing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/communications/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, criteria: buildCriteria() })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur");
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPreviewing(false);
    }
  };

  const doSend = async () => {
    if (!preview) return;
    if (!confirm(`Envoyer ce message à ${preview.count} destinataire(s) — ${targetLabel()} ?`)) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, criteria: buildCriteria(), targetLabel: targetLabel(), subject, message })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur d'envoi");
      setResult(`Envoyé à ${data.sent}/${data.total} destinataire(s)${data.failed > 0 ? ` — ${data.failed} échec(s)` : ""}.`);
      setSubject("");
      setMessage("");
      setPreview(null);
      const historyRes = await fetch("/api/admin/communications");
      const historyData = await historyRes.json().catch(() => null);
      if (historyData?.history) setHistory(historyData.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSending(false);
    }
  };

  const canPreview = targetType !== "category" || (seasonKey && categoryId);
  const canSend = preview && preview.count > 0 && subject.trim() && message.trim();

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Communications</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Diffusez un message par courriel à un segment précis — un aperçu du nombre de destinataires est toujours affiché avant l&apos;envoi.
          </p>

          {error && <p className="admin-error" style={{ marginBottom: "1rem" }}>{error}</p>}
          {result && <p style={{ color: "#7fd88f", fontSize: "0.82rem", marginBottom: "1rem" }}>{result}</p>}

          <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "1.1rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.6rem" }}>
              {(Object.keys(TARGET_LABELS) as TargetType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTargetType(t); setPreview(null); }}
                  className={targetType === t ? "admin-btn-primary" : "admin-btn-ghost"}
                  style={{ fontSize: "0.72rem" }}
                >
                  {TARGET_LABELS[t]}
                </button>
              ))}
            </div>

            {(targetType === "season" || targetType === "category") && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.6rem" }}>
                <select className="admin-input" value={seasonKey} onChange={(e) => { setSeasonKey(e.target.value); setCategoryId(""); setPreview(null); }} style={{ width: "auto" }}>
                  {seasonOptions.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                {targetType === "category" && (
                  <select className="admin-input" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPreview(null); }} style={{ width: "auto" }}>
                    <option value="">Choisir une catégorie</option>
                    {currentSeason?.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                )}
              </div>
            )}

            {targetType === "group" && (
              <select className="admin-input" value={timeSlotTemplateId} onChange={(e) => { setTimeSlotTemplateId(e.target.value); setPreview(null); }} style={{ width: "auto", marginBottom: "0.6rem" }}>
                <option value="">Choisir un groupe</option>
                {seasonOptions.flatMap((s) => s.slots.map((sl) => <option key={sl.id} value={sl.id}>{s.label} — {sl.label}</option>))}
              </select>
            )}

            {targetType === "player" && (
              <div style={{ marginBottom: "0.6rem" }}>
                <input className="admin-input" placeholder="Rechercher une joueuse (nom)" value={playerQuery} onChange={(e) => searchPlayers(e.target.value)} />
                {playerResults.length > 0 && !selectedPlayer && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", marginTop: "0.4rem" }}>
                    {playerResults.map((p) => (
                      <button key={p.id} onClick={() => { setSelectedPlayer(p); setPlayerResults([]); setPlayerQuery(`${p.player_first_name} ${p.player_last_name}`); setPreview(null); }} className="admin-btn-ghost" style={{ textAlign: "left", fontSize: "0.75rem" }}>
                        {p.player_first_name} {p.player_last_name} ({p.parent_name})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button onClick={doPreview} disabled={previewing || !canPreview} className="admin-btn-ghost" style={{ fontSize: "0.75rem" }}>
              {previewing ? "..." : "Aperçu des destinataires"}
            </button>

            {preview && (
              <div style={{ marginTop: "0.6rem", fontSize: "0.78rem", color: "#c3c2c8" }}>
                <p style={{ margin: "0 0 0.3rem", fontWeight: 700, color: preview.count > 0 ? "#7fd88f" : "#ff9999" }}>{preview.count} destinataire(s)</p>
                {preview.sample.length > 0 && (
                  <p style={{ margin: 0, color: "#6d6b71" }}>
                    {preview.sample.map((r) => r.name).join(", ")}{preview.count > preview.sample.length ? "…" : ""}
                  </p>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
            <input className="admin-input" placeholder="Sujet" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <textarea className="admin-input" placeholder="Message" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          <button onClick={doSend} disabled={!canSend || sending} className="admin-btn-primary">
            {sending ? "Envoi..." : "Envoyer"}
          </button>

          <p className="admin-section-title" style={{ fontSize: "0.85rem", margin: "2rem 0 0.75rem" }}>Historique ({history.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {history.length === 0 && <p className="admin-empty-text">Aucune communication envoyée pour l&apos;instant.</p>}
            {history.map((h) => (
              <div key={h.id} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.6rem 0.9rem" }}>
                <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fff", margin: "0 0 0.15rem" }}>{h.subject}</p>
                <p style={{ fontSize: "0.7rem", color: "#6d6b71", margin: 0 }}>
                  {h.target_label} · {h.recipient_count} destinataire(s) · {new Date(h.sent_at).toLocaleString("fr-CA")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
