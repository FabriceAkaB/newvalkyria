"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { EntityDocuments } from "@/components/admin-entity-documents";
import type { CoachCertification } from "@/lib/certifications-repo";
import { computeAssignment, formatHours } from "@/lib/coach-payroll";
import { ACTIVITY_TYPES, COACH_ROLES, type Coach, type CoachActivity, type CoachAssignment, type CoachTypeRate } from "@/lib/coaches-repo";
import { formatCAD } from "@/lib/season-2027";

function CertificationsSection({ coachId, certifications: initial }: { coachId: string; certifications: CoachCertification[] }) {
  const [certifications, setCertifications] = useState(initial);
  const [name, setName] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const todayISO = new Date().toISOString().slice(0, 10);

  const add = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/coaches/${coachId}/certifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), issuedDate: issuedDate || null, expiryDate: expiryDate || null })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return;
      setCertifications((prev) => [...prev, { id: data.id, coach_id: coachId, name: name.trim(), issued_date: issuedDate || null, expiry_date: expiryDate || null, document_url: null, notes: null, created_at: new Date().toISOString() }]);
      setName("");
      setIssuedDate("");
      setExpiryDate("");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setCertifications((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/admin/certifications/${id}`, { method: "DELETE" });
  };

  const uploadDocument = async (id: string, file: File | undefined) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("document", file);
    const res = await fetch(`/api/admin/certifications/${id}/document`, { method: "POST", body: formData });
    if (res.ok) setCertifications((prev) => prev.map((c) => (c.id === id ? { ...c, document_url: "uploaded" } : c)));
  };

  const viewDocument = async (id: string) => {
    const res = await fetch(`/api/admin/certifications/${id}/document`);
    const data = await res.json().catch(() => null);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div style={{ background: "#17151e", border: "1px solid #302e36", borderRadius: "10px", padding: "1.1rem" }}>
      <p style={{ fontSize: "0.68rem", color: "#9d9da0", textTransform: "uppercase", margin: "0 0 0.6rem" }}>Certifications</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.6rem" }}>
        {certifications.length === 0 && <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: 0 }}>Aucune certification enregistrée.</p>}
        {certifications.map((c) => {
          const expired = c.expiry_date && c.expiry_date < todayISO;
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: expired ? "#ff9999" : "#c3c2c8" }}>
              <span style={{ flex: 1 }}>
                {c.name}{c.expiry_date ? ` · expire le ${new Date(c.expiry_date + "T00:00:00").toLocaleDateString("fr-CA")}${expired ? " (expirée)" : ""}` : ""}
              </span>
              {c.document_url ? (
                <button onClick={() => viewDocument(c.id)} className="admin-btn-ghost" style={{ padding: "0.15rem 0.4rem", fontSize: "0.68rem" }}>Document</button>
              ) : (
                <>
                  <button onClick={() => fileInputs.current[c.id]?.click()} className="admin-btn-ghost" style={{ padding: "0.15rem 0.4rem", fontSize: "0.68rem" }}>+ Document</button>
                  <input ref={(el) => { fileInputs.current[c.id] = el; }} type="file" accept="application/pdf,image/jpeg,image/png" style={{ display: "none" }} onChange={(e) => uploadDocument(c.id, e.target.files?.[0])} />
                </>
              )}
              <button onClick={() => remove(c.id)} style={{ fontSize: "0.68rem", color: "#ff9999", background: "none", border: "none", cursor: "pointer" }}>×</button>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <input className="admin-input" placeholder="Nom (ex. PNCE Compétition-Introduction)" value={name} onChange={(e) => setName(e.target.value)} style={{ fontSize: "0.75rem" }} />
        <div style={{ display: "flex", gap: "0.35rem" }}>
          <input className="admin-input" type="date" placeholder="Obtenue le" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} style={{ fontSize: "0.72rem", flex: 1 }} />
          <input className="admin-input" type="date" placeholder="Expire le" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} style={{ fontSize: "0.72rem", flex: 1 }} />
        </div>
        <button onClick={add} disabled={saving || !name.trim()} className="admin-btn-ghost" style={{ fontSize: "0.72rem" }}>+ Ajouter</button>
      </div>
    </div>
  );
}

type AssignmentWithActivity = CoachAssignment & { activity: CoachActivity };

interface Props {
  coach: Coach;
  initialAssignments: AssignmentWithActivity[];
  initialTypeRates: CoachTypeRate[];
  initialCertifications: CoachCertification[];
}

function ProfileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="admin-field" style={{ gap: "0.3rem" }}>
      <span className="admin-drawer-label">{label}</span>
      {children}
    </label>
  );
}

function TypeRatesSection({ coachId, rates: initial }: { coachId: string; rates: CoachTypeRate[] }) {
  const [rates, setRates] = useState(initial);
  const [type, setType] = useState<string>(ACTIVITY_TYPES[0]);
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const dollars = parseFloat(rate.replace(",", "."));
    if (Number.isNaN(dollars) || dollars < 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/coach-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coachId, activityType: type, hourlyRateCents: Math.round(dollars * 100) })
      });
      if (res.ok) {
        setRates((prev) => [...prev.filter((r) => r.activity_type !== type), { id: crypto.randomUUID(), coach_id: coachId, activity_type: type, hourly_rate_cents: Math.round(dollars * 100) }]);
        setRate("");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/admin/coach-rates/${id}`, { method: "DELETE" });
    if (res.ok) setRates((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="admin-drawer-section">
      <p className="admin-drawer-section-title">Taux par type d&apos;activité</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.6rem" }}>
        {rates.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", color: "#c3c2c8" }}>
            <span>{r.activity_type}</span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {formatCAD(r.hourly_rate_cents / 100)}/h
              <button onClick={() => remove(r.id)} style={{ background: "none", border: "none", color: "#6d6b71", cursor: "pointer" }}>×</button>
            </span>
          </div>
        ))}
        {rates.length === 0 && <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: 0 }}>Aucune surcharge — le taux par défaut s&apos;applique partout.</p>}
      </div>
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <select className="admin-input" value={type} onChange={(e) => setType(e.target.value)} style={{ fontSize: "0.75rem" }}>
          {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="number" min={0} step="0.01" placeholder="Taux $" className="admin-input" style={{ width: "90px", fontSize: "0.75rem" }} value={rate} onChange={(e) => setRate(e.target.value)} />
        <button className="admin-btn-ghost" onClick={add} disabled={saving} style={{ fontSize: "0.7rem" }}>Ajouter</button>
      </div>
    </div>
  );
}

function CredentialsSection({ coachId, username: initialUsername }: { coachId: string; username: string | null }) {
  const [username, setUsername] = useState(initialUsername ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [msgError, setMsgError] = useState(false);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/coaches/${coachId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsgError(true);
        setMessage(data.error ?? "Erreur de sauvegarde");
      } else {
        setMsgError(false);
        setMessage("Identifiants enregistrés.");
        setPassword("");
      }
    } catch {
      setMsgError(true);
      setMessage("Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-drawer-section" style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "1.1rem" }}>
      <p className="admin-drawer-section-title">Accès Espace Entraîneur</p>
      <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0 0 0.6rem" }}>
        {initialUsername ? "Cet entraîneur a déjà un accès. Vous pouvez changer son mot de passe ci-dessous." : "Aucun accès configuré — l'entraîneur ne peut pas encore se connecter à /entraineur."}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <label className="admin-field" style={{ gap: "0.3rem" }}>
          <span className="admin-drawer-label">Nom d&apos;utilisateur</span>
          <input className="admin-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex. jsmith" />
        </label>
        <label className="admin-field" style={{ gap: "0.3rem" }}>
          <span className="admin-drawer-label">{initialUsername ? "Nouveau mot de passe" : "Mot de passe"}</span>
          <input type="text" className="admin-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 caractères minimum" />
        </label>
        <button className="admin-btn-ghost" onClick={save} disabled={saving || !username || !password} style={{ fontSize: "0.75rem", alignSelf: "flex-start" }}>
          {saving ? "Enregistrement..." : "Enregistrer les identifiants"}
        </button>
        {message && <p style={{ fontSize: "0.72rem", color: msgError ? "#ff8a8a" : "#7fd88f", margin: 0 }}>{message}</p>}
      </div>
    </div>
  );
}

export function AdminEntraineurDetail({ coach: initialCoach, initialAssignments, initialTypeRates, initialCertifications }: Props) {
  const [coach, setCoach] = useState(initialCoach);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>, optimistic: Partial<Coach>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/coaches/${coach.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      setCoach((prev) => ({ ...prev, ...optimistic }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/coaches/${coach.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
      window.location.href = "/admin/entraineurs";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setDeleting(false);
      setConfirming(false);
    }
  };

  const rows = initialAssignments.map((a) => {
    const typeRate = initialTypeRates.find((r) => r.activity_type === a.activity.activity_type)?.hourly_rate_cents ?? null;
    const computed = computeAssignment({
      status: a.status,
      arrivalTime: a.arrival_time,
      departureTime: a.departure_time,
      activityStartTime: a.activity.start_time,
      activityEndTime: a.activity.end_time,
      assignmentRateCents: a.hourly_rate_cents,
      typeRateCents: typeRate,
      defaultRateCents: coach.default_hourly_rate_cents
    });
    return { assignment: a, computed };
  });

  const totalHours = rows.reduce((s, r) => s + r.computed.hours, 0);
  const totalEarned = rows.reduce((s, r) => s + r.computed.payCents, 0);
  const totalPaid = rows.filter((r) => r.assignment.paid).reduce((s, r) => s + r.computed.payCents, 0);
  const totalOwed = totalEarned - totalPaid;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <Link href="/admin/entraineurs" className="admin-btn-ghost" style={{ textDecoration: "none", display: "inline-block", marginBottom: "1rem" }}>
            ← Entraîneurs
          </Link>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <p className="admin-section-title" style={{ margin: 0, fontSize: "1.1rem", textTransform: "none", letterSpacing: 0, color: "#fff" }}>
              {coach.first_name} {coach.last_name}
            </p>
            <button className="admin-btn-danger" onClick={() => setConfirming(true)}>Supprimer l&apos;entraîneur</button>
          </div>

          {error && <p className="admin-error">{error}</p>}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="admin-drawer-section" style={{ flex: "1 1 320px", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "1.1rem" }}>
              <p className="admin-drawer-section-title">Profil</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.6rem" }}>
                <ProfileField label="Prénom">
                  <input className="admin-input" defaultValue={coach.first_name} onBlur={(e) => e.target.value !== coach.first_name && patch({ firstName: e.target.value }, { first_name: e.target.value })} />
                </ProfileField>
                <ProfileField label="Nom">
                  <input className="admin-input" defaultValue={coach.last_name} onBlur={(e) => e.target.value !== coach.last_name && patch({ lastName: e.target.value }, { last_name: e.target.value })} />
                </ProfileField>
                <ProfileField label="Téléphone">
                  <input className="admin-input" defaultValue={coach.phone ?? ""} onBlur={(e) => e.target.value !== (coach.phone ?? "") && patch({ phone: e.target.value || null }, { phone: e.target.value || null })} />
                </ProfileField>
                <ProfileField label="Courriel">
                  <input className="admin-input" defaultValue={coach.email ?? ""} onBlur={(e) => e.target.value !== (coach.email ?? "") && patch({ email: e.target.value || null }, { email: e.target.value || null })} />
                </ProfileField>
                <ProfileField label="Statut">
                  <select className="admin-input" value={coach.status} onChange={(e) => patch({ status: e.target.value }, { status: e.target.value as Coach["status"] })}>
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                  </select>
                </ProfileField>
                <ProfileField label="Poste">
                  <select className="admin-input" value={coach.role} onChange={(e) => patch({ role: e.target.value }, { role: e.target.value })}>
                    {COACH_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </ProfileField>
                <ProfileField label="Taux horaire par défaut $">
                  <input
                    type="number" min={0} step="0.01" className="admin-input"
                    defaultValue={(coach.default_hourly_rate_cents / 100).toFixed(2)}
                    onBlur={(e) => {
                      const cents = Math.round((parseFloat(e.target.value) || 0) * 100);
                      if (cents !== coach.default_hourly_rate_cents) patch({ defaultHourlyRateCents: cents }, { default_hourly_rate_cents: cents });
                    }}
                  />
                </ProfileField>
                <ProfileField label="Date d'embauche">
                  <input type="date" className="admin-input" defaultValue={coach.hired_on ?? ""} onBlur={(e) => e.target.value !== (coach.hired_on ?? "") && patch({ hiredOn: e.target.value || null }, { hired_on: e.target.value || null })} />
                </ProfileField>
              </div>
              <label className="admin-field" style={{ gap: "0.3rem", marginTop: "0.6rem" }}>
                <span className="admin-drawer-label">Notes internes</span>
                <textarea
                  className="admin-input"
                  rows={3}
                  defaultValue={coach.notes ?? ""}
                  onBlur={(e) => e.target.value !== (coach.notes ?? "") && patch({ notes: e.target.value || null }, { notes: e.target.value || null })}
                />
              </label>
              {saving && <p style={{ fontSize: "0.68rem", color: "#6d6b71", margin: "0.4rem 0 0" }}>Sauvegarde...</p>}
            </div>

            <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <TypeRatesSection coachId={coach.id} rates={initialTypeRates} />
              <CredentialsSection coachId={coach.id} username={coach.username} />
              <CertificationsSection coachId={coach.id} certifications={initialCertifications} />
              <div style={{ background: "#17151e", border: "1px solid #302e36", borderRadius: "10px", padding: "1.1rem" }}>
                <EntityDocuments entityType="coach" entityId={coach.id} />
              </div>

              <div style={{ background: "#17151e", border: "1px solid #302e36", borderRadius: "10px", padding: "1.1rem" }}>
                <p style={{ fontSize: "0.68rem", color: "#9d9da0", textTransform: "uppercase", margin: "0 0 0.5rem" }}>Solde</p>
                <p style={{ fontSize: "0.78rem", color: "#c3c2c8", margin: "0 0 0.25rem" }}>Heures totales : <strong style={{ color: "#fff" }}>{formatHours(totalHours)}</strong></p>
                <p style={{ fontSize: "0.78rem", color: "#c3c2c8", margin: "0 0 0.25rem" }}>Montant gagné : <strong style={{ color: "#fff" }}>{formatCAD(totalEarned / 100)}</strong></p>
                <p style={{ fontSize: "0.78rem", color: "#c3c2c8", margin: "0 0 0.25rem" }}>Montant payé : <strong style={{ color: "#7fd88f" }}>{formatCAD(totalPaid / 100)}</strong></p>
                <p style={{ fontSize: "0.85rem", color: "#c3c2c8", margin: 0 }}>Reste à payer : <strong style={{ color: totalOwed > 0 ? "#ffb464" : "#fff" }}>{formatCAD(totalOwed / 100)}</strong></p>
              </div>
            </div>
          </div>

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>Historique des activités ({rows.length})</p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Activité</th>
                  <th>Présence</th>
                  <th>Heures</th>
                  <th>Taux</th>
                  <th>Montant</th>
                  <th>Payé</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ assignment, computed }) => (
                  <tr key={assignment.id}>
                    <td>{new Date(assignment.activity.activity_date + "T00:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td>{assignment.activity.title ? `${assignment.activity.activity_type} — ${assignment.activity.title}` : assignment.activity.activity_type}</td>
                    <td>{STATUS_LABELS_FR[assignment.status]}</td>
                    <td>{formatHours(computed.hours)}</td>
                    <td>{formatCAD(computed.rateCents / 100)}/h</td>
                    <td>{formatCAD(computed.payCents / 100)}</td>
                    <td style={{ color: assignment.paid ? "#7fd88f" : "#ffb464" }}>{assignment.paid ? "✓ Payé" : "Non payé"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="admin-empty-text">Aucune activité assignée pour le moment.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {confirming && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-box">
            <p className="admin-modal-title">Supprimer cet entraîneur ?</p>
            <p className="admin-modal-body">
              <span className="admin-modal-name">{coach.first_name} {coach.last_name}</span> et toutes ses assignations seront définitivement supprimés. Cette action est irréversible.
            </p>
            <div className="admin-modal-actions">
              <button className="admin-btn-ghost" onClick={() => setConfirming(false)} disabled={deleting}>Annuler</button>
              <button className="admin-btn-danger" onClick={handleDelete} disabled={deleting}>{deleting ? "Suppression..." : "Supprimer définitivement"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const STATUS_LABELS_FR: Record<string, string> = {
  present: "Présent",
  absent: "Absent",
  replaced: "Remplacé",
  cancelled: "Annulé"
};
