"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { SignaturePad } from "@/components/contract-sign-form";

interface PayRow {
  period: string;
  payDate: string;
  hours: string;
  amountCents: number;
}

interface ContractRow {
  id: string;
  token: string;
  employeeName: string;
  title: string;
  status: "sent" | "signed" | "cancelled";
  signedAt: string | null;
  employerSignedAt: string | null;
  hasCheque: boolean;
  schedule: PayRow[];
  summary: { label: string; value: string }[];
  contact: { email: string; mobile: string; address: string } | null;
}

const money = (cents: number) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

const card: React.CSSProperties = { background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem", marginBottom: "1.25rem" };
const cell: React.CSSProperties = { padding: "0.45rem 0.5rem", borderBottom: "1px solid #1f1d25", fontSize: "0.8rem", color: "#c3c2c8" };

function ContractCard({ c, origin }: { c: ContractRow; origin: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [sig, setSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const link = `${origin}/contrat/${c.token}`;
  const today = new Date().toISOString().slice(0, 10);
  const next = c.schedule.find((r) => r.payDate >= today) ?? null;
  const paidSoFar = c.schedule.filter((r) => r.payDate < today).reduce((s, r) => s + r.amountCents, 0);
  const total = c.schedule.reduce((s, r) => s + r.amountCents, 0);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/contrats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Erreur");
      return json;
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erreur");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const status =
    c.status === "signed"
      ? { label: `Signé le ${day(c.signedAt!)}`, color: "#8fce9f" }
      : c.status === "cancelled"
        ? { label: "Lien annulé", color: "#ff9999" }
        : { label: "En attente de sa signature", color: "#f0c878" };

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <p style={{ fontWeight: 700, color: "#fff", margin: 0, fontSize: "1.05rem" }}>{c.employeeName}</p>
          <p style={{ color: "#8a8791", margin: "0.15rem 0 0", fontSize: "0.8rem" }}>{c.title}</p>
        </div>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: status.color }}>
          {status.label}
          {c.employerSignedAt ? ` · contresigné le ${day(c.employerSignedAt)}` : " · pas encore contresigné"}
        </span>
      </div>

      {/* Lien à envoyer */}
      {c.status === "sent" && (
        <div style={{ marginTop: "0.9rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <input className="admin-input" readOnly value={link} style={{ flex: "1 1 320px" }} onFocus={(e) => e.target.select()} />
          <button type="button" className="admin-btn-primary" onClick={() => navigator.clipboard.writeText(link).then(() => setMsg("Lien copié : envoyez-le à l'employée."))}>
            Copier le lien
          </button>
          <a className="admin-btn-ghost" href={link} target="_blank" rel="noreferrer">Voir la page</a>
        </div>
      )}

      {/* Documents */}
      <div style={{ marginTop: "0.9rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {c.status === "signed" && (
          <a className="admin-btn-primary" href={`/api/admin/contrats/${c.id}/fichier?type=signed`} target="_blank" rel="noreferrer">Contrat signé (PDF complet)</a>
        )}
        {c.hasCheque && <a className="admin-btn-ghost" href={`/api/admin/contrats/${c.id}/fichier?type=cheque`} target="_blank" rel="noreferrer">Spécimen de chèque</a>}
        <a className="admin-btn-ghost" href={`/api/admin/contrats/${c.id}/fichier?type=original`} target="_blank" rel="noreferrer">Contrat original</a>
        {!c.employerSignedAt && c.status !== "cancelled" && (
          <button type="button" className="admin-btn-ghost" onClick={() => setSigning((s) => !s)}>Contresigner pour l&apos;Académie</button>
        )}
        {c.status === "sent" && (
          <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => confirm("Annuler ce lien ? L'employée ne pourra plus signer.") && post({ action: "cancel", id: c.id }).then((r) => r && location.reload())}>
            Annuler le lien
          </button>
        )}
      </div>

      {signing && (
        <div style={{ marginTop: "0.9rem", maxWidth: 520 }}>
          <p style={{ fontSize: "0.8rem", color: "#c3c2c8", margin: "0 0 0.4rem" }}>
            Votre signature sera apposée à « Signature du représentant » (lettre d&apos;offre).{c.status === "signed" ? " La copie finale sera renvoyée à l'employée." : " Elle sera incluse quand l'employée signera."}
          </p>
          <SignaturePad onChange={setSig} />
          <button
            type="button"
            className="admin-btn-primary"
            style={{ marginTop: "0.6rem" }}
            disabled={!sig || busy}
            onClick={() =>
              post({ action: "countersign", id: c.id, signature: sig }).then((r) => {
                if (r) {
                  setMsg(r.emailed ? "Contresigné : la copie finale a été envoyée à l'employée." : "Contresigné.");
                  setTimeout(() => location.reload(), 1200);
                }
              })
            }
          >
            {busy ? "…" : "Signer"}
          </button>
        </div>
      )}

      {msg && <p style={{ fontSize: "0.8rem", color: "#8fce9f", margin: "0.7rem 0 0" }}>{msg}</p>}

      {c.contact && (
        <p style={{ fontSize: "0.8rem", color: "#8a8791", margin: "0.9rem 0 0" }}>
          {c.contact.email} · {c.contact.mobile} · {c.contact.address}
        </p>
      )}

      {/* Paie */}
      {c.schedule.length > 0 && (
        <div style={{ marginTop: "1.1rem" }}>
          <div className="admin-stats" style={{ marginBottom: "0.8rem" }}>
            <div className="admin-stat-card admin-stat-card-accent">
              <p className="admin-stat-value">{next ? money(next.amountCents) : "—"}</p>
              <p className="admin-stat-label">{next ? `Prochaine paie : ${day(next.payDate)}` : "Toutes les paies sont passées"}</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-value">{money(paidSoFar)}</p>
              <p className="admin-stat-label">Déjà dû (paies passées)</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-value">{money(total)}</p>
              <p className="admin-stat-label">Total saison ({c.schedule.length} paies, brut)</p>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr>
                  {["Payer le (jeudi, minuit)", "Période travaillée", "Heures", "Montant brut"].map((h) => (
                    <th key={h} style={{ ...cell, color: "#8a8791", textAlign: "left", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.schedule.map((r) => {
                  const isNext = next?.payDate === r.payDate;
                  const past = r.payDate < today;
                  return (
                    <tr key={r.payDate} style={{ background: isNext ? "rgba(195,166,255,0.1)" : undefined, opacity: past ? 0.55 : 1 }}>
                      <td style={{ ...cell, color: isNext ? "#fff" : cell.color, fontWeight: isNext ? 700 : 400 }}>
                        {day(r.payDate)}
                        {isNext ? " ← prochaine" : ""}
                      </td>
                      <td style={cell}>{r.period}</td>
                      <td style={cell}>{r.hours}</td>
                      <td style={{ ...cell, textAlign: "right", color: "#fff" }}>{money(r.amountCents)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: "0.75rem", color: "#6d6b71", margin: "0.5rem 0 0" }}>
            Montants bruts prévus au contrat, avant déductions. La paie réelle suit les heures travaillées. Indemnité de vacances de 4 % à verser avec la dernière paie.
          </p>
        </div>
      )}
    </div>
  );
}

export function AdminContracts({ contracts, origin }: { contracts: ContractRow[]; origin: string }) {
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Contrats des entraîneurs</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1rem" }}>
            Envoyez le lien à l&apos;employée : elle remplit ses informations, joint son spécimen de chèque et signe en ligne. Elle reçoit sa copie par courriel (NAS masqué) et vous êtes avisé. Le contrat complet et le chèque sont conservés ici, en accès privé.
          </p>
          {contracts.length === 0 && <p className="admin-empty-text">Aucun contrat pour l&apos;instant.</p>}
          {contracts.map((c) => (
            <ContractCard key={c.id} c={c} origin={origin} />
          ))}
        </div>
      </div>
    </>
  );
}
