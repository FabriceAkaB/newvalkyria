"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { cropSquareAndCompress } from "@/lib/image-client";
import type { AthleteSearchResult, TryoutAttendanceStatus, TryoutEvaluator, TryoutEvent, TryoutParticipantWithPlayer, TryoutTeam } from "@/lib/tryout-repo";

const DEFAULT_TEAM_PALETTE: { name: string; colorHex: string }[] = [
  { name: "Rouge", colorHex: "#e6394a" },
  { name: "Bleu", colorHex: "#3a7de6" },
  { name: "Jaune", colorHex: "#e6c93a" },
  { name: "Vert", colorHex: "#3ae66b" },
  { name: "Noir", colorHex: "#1a1a1a" },
  { name: "Blanc", colorHex: "#f5f5f5" },
  { name: "Orange", colorHex: "#e68a3a" },
  { name: "Rose", colorHex: "#e63ac9" }
];

const ATTENDANCE_LABELS: Record<TryoutAttendanceStatus, string> = {
  attendu: "Attendu",
  present: "Présent",
  absent: "Absent",
  en_retard: "En retard",
  parti_tot: "Parti tôt",
  blesse: "Blessé"
};

function Avatar({ firstName, lastName, photoUrl, colorHex }: { firstName: string; lastName: string; photoUrl: string | null; colorHex?: string }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: colorHex ?? "#342b40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
      {initials || "?"}
    </div>
  );
}

function birthYear(dob: string | null): string {
  return dob ? String(new Date(dob + "T00:00:00").getFullYear()) : "—";
}

export function AdminEvaluationEventDetail({
  event,
  initialParticipants,
  teams: initialTeams,
  initialEvaluators,
  programs
}: {
  event: TryoutEvent;
  initialParticipants: TryoutParticipantWithPlayer[];
  teams: TryoutTeam[];
  initialEvaluators: TryoutEvaluator[];
  programs: { id: string; name: string }[];
}) {
  const [participants, setParticipants] = useState(initialParticipants);
  const [evaluators, setEvaluators] = useState(initialEvaluators);
  const [teams, setTeams] = useState(initialTeams);
  const [status, setStatus] = useState(event.status);


  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AthleteSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [showExternal, setShowExternal] = useState(false);
  const [ext, setExt] = useState({ firstName: "", lastName: "", dob: "", primaryPosition: "", currentClub: "", parentName: "", parentEmail: "", parentPhone: "" });
  const [extSaving, setExtSaving] = useState(false);
  const [extError, setExtError] = useState<string | null>(null);

  const [bulkSource, setBulkSource] = useState("ah_all");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const [newEvaluatorName, setNewEvaluatorName] = useState("");
  const [photoUploadingId, setPhotoUploadingId] = useState<string | null>(null);
  const [copyingEmails, setCopyingEmails] = useState(false);
  const [copyEmailsMessage, setCopyEmailsMessage] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      setSearching(true);
      fetch(`/api/admin/evaluations/search?eventId=${event.id}&q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data) => setResults(data.results ?? []))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, event.id]);

  const refreshParticipants = async () => {
    const res = await fetch(`/api/admin/evaluations/events/${event.id}/participants`);
    const data = await res.json();
    setParticipants(data.participants ?? []);
  };

  const addPlayer = async (playerId: string) => {
    await fetch(`/api/admin/evaluations/events/${event.id}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId })
    });
    setResults((prev) => prev.map((r) => (r.playerId === playerId ? { ...r, alreadyAdded: true } : r)));
    await refreshParticipants();
  };

  const uploadPhoto = async (participant: TryoutParticipantWithPlayer, file: File | undefined) => {
    if (!file) return;
    setPhotoUploadingId(participant.id);
    try {
      const compressed = await cropSquareAndCompress(file);
      const formData = new FormData();
      formData.append("file", compressed);
      const res = await fetch(`/api/admin/evaluations/players/${participant.player_id}/photo`, { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setParticipants((prev) => prev.map((p) => (p.id === participant.id ? { ...p, player_photo_url: data.photoUrl } : p)));
      }
    } finally {
      setPhotoUploadingId(null);
    }
  };

  const copyEmails = async () => {
    setCopyingEmails(true);
    setCopyEmailsMessage(null);
    try {
      const res = await fetch(`/api/admin/evaluations/events/${event.id}/emails`);
      const data = await res.json();
      const emails = (data.emails ?? []) as string[];
      if (emails.length === 0) {
        setCopyEmailsMessage("Aucun courriel trouvé pour cet événement.");
        return;
      }
      const joined = emails.join("; ");
      try {
        await navigator.clipboard.writeText(joined);
        setCopyEmailsMessage(`${emails.length} courriel(s) copié(s) dans le presse-papier.`);
      } catch {
        // Presse-papier bloqué (permissions, vieux navigateur) — filet de
        // sécurité : la liste reste sélectionnable/copiable manuellement.
        window.prompt(`Copie manuelle (Ctrl+C / Cmd+C) — ${emails.length} courriel(s) :`, joined);
      }
    } catch {
      setCopyEmailsMessage("Impossible de récupérer la liste — réessaie.");
    } finally {
      setCopyingEmails(false);
    }
  };

  const removeParticipant = async (participantId: string) => {
    if (!window.confirm("Retirer cette athlète de l'événement ?")) return;
    await fetch(`/api/admin/evaluations/events/${event.id}/participants/${participantId}`, { method: "DELETE" });
    setParticipants((prev) => prev.filter((p) => p.id !== participantId));
  };

  const updateParticipant = async (participantId: string, patch: Record<string, unknown>) => {
    setParticipants((prev) => prev.map((p) => (p.id === participantId ? { ...p, ...patch } : p)));
    await fetch(`/api/admin/evaluations/events/${event.id}/participants/${participantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
  };

  const createExternal = async () => {
    if (!ext.firstName.trim() || !ext.lastName.trim() || !ext.dob) {
      setExtError("Prénom, nom et date de naissance requis");
      return;
    }
    setExtSaving(true);
    setExtError(null);
    try {
      const res = await fetch(`/api/admin/evaluations/events/${event.id}/participants/external`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ext)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erreur");
      setExt({ firstName: "", lastName: "", dob: "", primaryPosition: "", currentClub: "", parentName: "", parentEmail: "", parentPhone: "" });
      setShowExternal(false);
      await refreshParticipants();
    } catch (err) {
      setExtError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setExtSaving(false);
    }
  };

  const bulkTransfer = async () => {
    if (!bulkSource) return;
    setBulkSaving(true);
    setBulkMessage(null);
    try {
      const source =
        bulkSource === "ete2026"
          ? { type: "ete2026" as const }
          : bulkSource === "ah_all"
            ? { type: "automne_hiver" as const }
            : bulkSource === "ah_trials"
              ? { type: "automne_hiver_trials" as const }
              : bulkSource === "sport_etudes"
                ? { type: "sport_etudes" as const }
                : { type: "automne_hiver" as const, programId: bulkSource.replace("ah_program:", "") };

      const res = await fetch(`/api/admin/evaluations/events/${event.id}/participants/bulk-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source })
      });
      const data = await res.json();
      setBulkMessage(`${data.added} ajoutée(s), ${data.skipped} déjà présente(s).`);
      await refreshParticipants();
    } finally {
      setBulkSaving(false);
    }
  };

  const addTeamFromPalette = async (name: string, colorHex: string) => {
    const res = await fetch(`/api/admin/evaluations/events/${event.id}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, colorHex })
    });
    const data = await res.json();
    setTeams((prev) => [...prev, { id: data.id, event_id: event.id, name, color_hex: colorHex, display_order: prev.length }]);
  };

  const removeTeam = async (teamId: string) => {
    if (!window.confirm("Retirer cette couleur ? Les athlètes qui y étaient assignées perdront leur équipe.")) return;
    await fetch(`/api/admin/evaluations/events/${event.id}/teams/${teamId}`, { method: "DELETE" });
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
    setParticipants((prev) => prev.map((p) => (p.team_id === teamId ? { ...p, team_id: null } : p)));
  };

  const addEvaluator = async () => {
    if (!newEvaluatorName.trim()) return;
    const res = await fetch(`/api/admin/evaluations/events/${event.id}/evaluators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestName: newEvaluatorName.trim() })
    });
    const data = await res.json();
    setEvaluators((prev) => [...prev, { id: data.id, event_id: event.id, coach_id: null, guest_name: newEvaluatorName.trim() }]);
    setNewEvaluatorName("");
  };

  const changeStatus = async (newStatus: typeof status) => {
    setStatus(newStatus);
    await fetch(`/api/admin/evaluations/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
  };

  const presentCount = participants.filter((p) => p.attendance_status === "present").length;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.6rem", marginBottom: "0.3rem" }}>
            <div>
              <p className="admin-section-title" style={{ margin: 0 }}>{event.name}</p>
              <p style={{ fontSize: "0.78rem", color: "#6d6b71", margin: "0.2rem 0 0" }}>
                {new Date(event.event_date + "T00:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                {event.location ? ` · ${event.location}` : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <select className="admin-input" value={status} onChange={(e) => changeStatus(e.target.value as typeof status)} style={{ width: "auto", fontSize: "0.75rem" }}>
                <option value="brouillon">Brouillon</option>
                <option value="en_cours">En cours</option>
                <option value="termine">Terminé</option>
                <option value="archive">Archivé</option>
              </select>
              <Link href={`/admin/evaluations/${event.id}/terrain`} className="admin-btn-primary" style={{ fontSize: "0.78rem", padding: "0.45rem 0.9rem", textDecoration: "none" }}>
                Aller au terrain →
              </Link>
            </div>
          </div>

          <p style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 600, margin: "1rem 0" }}>
            {participants.length} athlète{participants.length > 1 ? "s" : ""} · {presentCount} présente{presentCount > 1 ? "s" : ""}
          </p>

          {/* ── Recherche universelle ── */}
          <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "10px", padding: "1rem", marginBottom: "1rem" }}>
            <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>Ajouter une athlète</p>
            <input
              className="admin-input"
              placeholder="🔍 Rechercher par nom, prénom ou année de naissance..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: "100%", marginBottom: "0.5rem" }}
            />
            {searching && <p style={{ fontSize: "0.72rem", color: "#6d6b71" }}>Recherche...</p>}
            {results.map((r) => (
              <div key={r.playerId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid #1f1d25", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <Avatar firstName={r.firstName} lastName={r.lastName} photoUrl={r.photoUrl} />
                  <div>
                    <p style={{ fontSize: "0.8rem", color: "#fff", margin: 0 }}>{r.firstName} {r.lastName} <span style={{ color: "#6d6b71" }}>({birthYear(r.dob)})</span></p>
                    <p style={{ fontSize: "0.68rem", color: "#9d9da0", margin: 0 }}>{r.currentProgram ?? "Aucun programme actuel"}</p>
                  </div>
                </div>
                {r.alreadyAdded ? (
                  <span style={{ fontSize: "0.68rem", color: "#8fce9f" }}>✓ Déjà ajoutée</span>
                ) : (
                  <button className="admin-btn-ghost" onClick={() => addPlayer(r.playerId)} style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }}>Ajouter</button>
                )}
              </div>
            ))}

            <p style={{ fontSize: "0.68rem", color: "#6d6b71", margin: "0.9rem 0 0.4rem" }}>
              Transférer des inscriptions existantes — peu importe la saison :
            </p>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
              <select className="admin-input" value={bulkSource} onChange={(e) => setBulkSource(e.target.value)} style={{ width: "auto", fontSize: "0.72rem" }}>
                <option value="ete2026">Été 2026 — toutes les inscrites actives</option>
                <option value="ah_all">Automne/Hiver 2026 — tous programmes</option>
                {programs.map((p) => <option key={p.id} value={`ah_program:${p.id}`}>Automne/Hiver 2026 — {p.name}</option>)}
                <option value="ah_trials">Automne/Hiver 2026 — essais seulement</option>
                <option value="sport_etudes">Sport-Études — tous les inscrits actifs</option>
              </select>
              <button className="admin-btn-ghost" onClick={bulkTransfer} disabled={bulkSaving} style={{ fontSize: "0.72rem", padding: "0.35rem 0.7rem" }}>
                {bulkSaving ? "..." : "Ajouter"}
              </button>
              <button className="admin-btn-ghost" onClick={() => setShowExternal((v) => !v)} style={{ fontSize: "0.72rem", padding: "0.35rem 0.7rem" }}>
                {showExternal ? "Annuler" : "+ Athlète externe / essai"}
              </button>
            </div>
            {bulkMessage && <p style={{ fontSize: "0.7rem", color: "#8fce9f", marginTop: "0.4rem" }}>{bulkMessage}</p>}

            {showExternal && (
              <div style={{ marginTop: "0.8rem", padding: "0.8rem", background: "#17151e", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <input className="admin-input" placeholder="Prénom *" value={ext.firstName} onChange={(e) => setExt({ ...ext, firstName: e.target.value })} style={{ flex: 1, minWidth: "140px" }} />
                  <input className="admin-input" placeholder="Nom *" value={ext.lastName} onChange={(e) => setExt({ ...ext, lastName: e.target.value })} style={{ flex: 1, minWidth: "140px" }} />
                  <input type="date" className="admin-input" value={ext.dob} onChange={(e) => setExt({ ...ext, dob: e.target.value })} style={{ width: "auto" }} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <input className="admin-input" placeholder="Poste principal" value={ext.primaryPosition} onChange={(e) => setExt({ ...ext, primaryPosition: e.target.value })} style={{ flex: 1, minWidth: "140px" }} />
                  <input className="admin-input" placeholder="Club actuel" value={ext.currentClub} onChange={(e) => setExt({ ...ext, currentClub: e.target.value })} style={{ flex: 1, minWidth: "140px" }} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <input className="admin-input" placeholder="Nom du parent" value={ext.parentName} onChange={(e) => setExt({ ...ext, parentName: e.target.value })} style={{ flex: 1, minWidth: "140px" }} />
                  <input className="admin-input" placeholder="Courriel du parent" value={ext.parentEmail} onChange={(e) => setExt({ ...ext, parentEmail: e.target.value })} style={{ flex: 1, minWidth: "140px" }} />
                  <input className="admin-input" placeholder="Téléphone du parent" value={ext.parentPhone} onChange={(e) => setExt({ ...ext, parentPhone: e.target.value })} style={{ flex: 1, minWidth: "140px" }} />
                </div>
                {extError && <p className="admin-error-text">{extError}</p>}
                <button className="admin-btn-primary" onClick={createExternal} disabled={extSaving} style={{ alignSelf: "flex-start", fontSize: "0.76rem" }}>
                  {extSaving ? "..." : "Créer et ajouter"}
                </button>
              </div>
            )}
          </div>

          {/* ── Équipes / couleurs de dossard ── */}
          <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "10px", padding: "1rem", marginBottom: "1rem" }}>
            <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>Équipes / couleurs de dossard</p>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
              {teams.map((t) => (
                <span key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.72rem", color: "#fff", background: "#251f30", borderRadius: "999px", padding: "0.25rem 0.5rem 0.25rem 0.7rem" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: t.color_hex, display: "inline-block" }} />
                  {t.name}
                  <button onClick={() => removeTeam(t.id)} style={{ background: "none", border: "none", color: "#9d9da0", cursor: "pointer", fontSize: "0.75rem", padding: "0 0.2rem" }}>✕</button>
                </span>
              ))}
              {teams.length === 0 && <span style={{ fontSize: "0.72rem", color: "#6d6b71" }}>Aucune couleur pour l&apos;instant.</span>}
            </div>
            <p style={{ fontSize: "0.68rem", color: "#6d6b71", margin: "0 0 0.4rem" }}>Ajouter depuis la palette :</p>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {DEFAULT_TEAM_PALETTE.filter((c) => !teams.some((t) => t.name === c.name)).map((c) => (
                <button
                  key={c.name}
                  onClick={() => addTeamFromPalette(c.name, c.colorHex)}
                  className="admin-btn-ghost"
                  style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem", display: "flex", alignItems: "center", gap: "0.35rem" }}
                >
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: c.colorHex, display: "inline-block", border: c.colorHex === "#f5f5f5" ? "1px solid #444" : "none" }} />
                  + {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* ── Évaluateurs ── */}
          <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "10px", padding: "1rem", marginBottom: "1rem" }}>
            <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>Évaluateurs assignés</p>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
              {evaluators.map((e) => (
                <span key={e.id} style={{ fontSize: "0.72rem", color: "#fff", background: "#251f30", borderRadius: "999px", padding: "0.25rem 0.7rem" }}>
                  {e.guest_name ?? `${e.coach_first_name ?? ""} ${e.coach_last_name ?? ""}`.trim()}
                </span>
              ))}
              {evaluators.length === 0 && <span style={{ fontSize: "0.72rem", color: "#6d6b71" }}>Aucun évaluateur pour l&apos;instant.</span>}
            </div>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <input className="admin-input" placeholder="Nom de l'évaluateur" value={newEvaluatorName} onChange={(e) => setNewEvaluatorName(e.target.value)} style={{ width: "auto", fontSize: "0.75rem" }} />
              <button className="admin-btn-ghost" onClick={addEvaluator} style={{ fontSize: "0.72rem", padding: "0.35rem 0.7rem" }}>Ajouter</button>
            </div>
          </div>

          {/* ── Liste des participantes ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "1rem 0 0.6rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff", margin: 0 }}>Participantes ({participants.length})</p>
            <button className="admin-btn-ghost" onClick={copyEmails} disabled={copyingEmails} style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }}>
              {copyingEmails ? "..." : "📋 Copier tous les courriels"}
            </button>
          </div>
          {copyEmailsMessage && <p style={{ fontSize: "0.7rem", color: "#8fce9f", margin: "-0.3rem 0 0.6rem" }}>{copyEmailsMessage}</p>}
          {participants.length === 0 && <p className="admin-empty-text">Aucune athlète ajoutée pour l&apos;instant.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {participants.map((p) => {
              const team = teams.find((t) => t.id === p.team_id);
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.7rem", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.5rem 0.8rem", flexWrap: "wrap" }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <Avatar firstName={p.player_first_name} lastName={p.player_last_name} photoUrl={p.player_photo_url} colorHex={team?.color_hex} />
                    <label
                      htmlFor={`photo-${p.id}`}
                      title="Ajouter une photo (caméra ou galerie)"
                      style={{
                        position: "absolute",
                        bottom: "-3px",
                        right: "-3px",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        background: "#251f30",
                        border: "1px solid #17151e",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        fontSize: "0.6rem"
                      }}
                    >
                      {photoUploadingId === p.id ? "…" : "📷"}
                      <input
                        id={`photo-${p.id}`}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => uploadPhoto(p, e.target.files?.[0])}
                      />
                    </label>
                  </div>
                  <div style={{ minWidth: "160px" }}>
                    <p style={{ fontSize: "0.8rem", color: "#fff", margin: 0 }}>{p.player_first_name} {p.player_last_name}</p>
                    <p style={{ fontSize: "0.68rem", color: "#9d9da0", margin: 0 }}>{birthYear(p.player_dob)}{p.is_trial ? " · Essai" : ""}</p>
                  </div>
                  <input
                    type="number"
                    className="admin-input"
                    placeholder="N°"
                    value={p.bib_number ?? ""}
                    onChange={(e) => updateParticipant(p.id, { bibNumber: e.target.value ? Number(e.target.value) : null })}
                    style={{ width: "4.5rem", fontSize: "0.75rem" }}
                  />
                  <select
                    className="admin-input"
                    value={p.team_id ?? ""}
                    onChange={(e) => updateParticipant(p.id, { teamId: e.target.value || null })}
                    style={{ width: "auto", fontSize: "0.72rem" }}
                  >
                    <option value="">Équipe...</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button
                    onClick={() => updateParticipant(p.id, { primaryPositionObserved: p.primary_position_observed === "GK" ? null : "GK" })}
                    title="Marquer comme gardienne durant cette évaluation"
                    className={p.primary_position_observed === "GK" ? "admin-btn-primary" : "admin-btn-ghost"}
                    style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }}
                  >
                    🧤 GK
                  </button>
                  <select
                    className="admin-input"
                    value={p.attendance_status}
                    onChange={(e) => updateParticipant(p.id, { attendanceStatus: e.target.value })}
                    style={{ width: "auto", fontSize: "0.72rem" }}
                  >
                    {Object.entries(ATTENDANCE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                  <button className="admin-btn-ghost" onClick={() => removeParticipant(p.id)} style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem", marginLeft: "auto" }}>Retirer</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
