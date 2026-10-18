"use client";

import Link from "next/link";
import { useState } from "react";

import { BoysRegistrationsTable } from "@/components/admin-boys-registrations";
import { AdminTopbar } from "@/components/admin-topbar";
import type { BoysRegistrationRow } from "@/lib/boys-registrations";
import { formatMoney } from "@/lib/private-programs";

export interface ProgramComparison {
  slug: string;
  name: string;
  capacity: number;
  held: number;
  paid: number;
  waitlist: number;
  waitlistOnly: boolean;
}

function fmtDate(iso: string | null) {
  return iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "long" }) : "—";
}

export function AdminBoysProgram({
  program,
  stats,
  link,
  comparison,
  rows
}: {
  program: { slug: string; name: string; brand: "nv" | "atlantic"; waitlistOnly: boolean; priceCents: number; installmentFeeCents: number; capacity: number; practices: number; matches: number; firstDate: string | null; lastDate: string | null };
  stats: { held: number; paid: number; waitlist: number; collectedCents: number };
  link: string;
  comparison: ProgramComparison[];
  rows: BoysRegistrationRow[];
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const remaining = Math.max(0, program.capacity - stats.held);
  const pending = Math.max(0, stats.held - stats.paid);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>
            {program.name}
            {program.brand === "atlantic" && <span style={{ marginLeft: "0.6rem", fontSize: "0.7rem", color: "#78a8f0" }}>FC Atlantic</span>}
            {program.waitlistOnly && <span style={{ marginLeft: "0.6rem", fontSize: "0.7rem", color: "#f0c878" }}>En attente — liste d&apos;attente seulement</span>}
          </p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", margin: "0 0 0.8rem" }}>
            {program.waitlistOnly
              ? "Programme en préparation : les familles s'inscrivent seulement sur la liste d'attente."
              : `${formatMoney(program.priceCents)}${program.installmentFeeCents ? ` (ou 2 versements, +${formatMoney(program.installmentFeeCents)})` : ""} · ${program.practices} pratiques${program.matches ? ` + ${program.matches} matchs` : ""} · du ${fmtDate(program.firstDate)} au ${fmtDate(program.lastDate)}`}
          </p>
          <p style={{ fontSize: "0.78rem", color: "#9d9da0", margin: "0 0 1rem" }}>
            Lien d&apos;inscription : <a href={link} target="_blank" rel="noreferrer" style={{ color: "#c4a4e4" }}>{link}</a>{" "}
            <button className="admin-btn-ghost" style={{ fontSize: "0.68rem" }} onClick={() => navigator.clipboard.writeText(link).then(() => { setMsg("Lien copié."); setTimeout(() => setMsg(null), 3000); })}>Copier</button>
            {msg && <span style={{ color: "#8fce9f", marginLeft: "0.5rem" }}>{msg}</span>}
          </p>

          <div className="admin-stats" style={{ marginBottom: "1.2rem" }}>
            <div className="admin-stat-card admin-stat-card-accent"><p className="admin-stat-value">{stats.paid}</p><p className="admin-stat-label">Inscrits payés</p></div>
            <div className="admin-stat-card admin-stat-card-warn"><p className="admin-stat-value">{pending}</p><p className="admin-stat-label">Paiement en cours</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{program.waitlistOnly ? "—" : `${remaining} / ${program.capacity}`}</p><p className="admin-stat-label">Places restantes</p></div>
            <div className="admin-stat-card admin-stat-card-warn"><p className="admin-stat-value">{stats.waitlist}</p><p className="admin-stat-label">Liste d&apos;attente</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{formatMoney(stats.collectedCents)}</p><p className="admin-stat-label">Montant des inscriptions payées</p></div>
          </div>

          {/* ── Comparaison des 3 programmes : lequel promouvoir ── */}
          <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem", marginBottom: "1.4rem" }}>
            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.6rem", fontSize: "0.85rem" }}>Comparaison des programmes garçons</p>
            <div style={{ display: "grid", gap: "0.55rem" }}>
              {comparison.map((c) => {
                const left = Math.max(0, c.capacity - c.held);
                const pct = c.capacity ? Math.min(100, Math.round((c.held / c.capacity) * 100)) : 0;
                return (
                  <Link key={c.slug} href={`/admin/programme/${c.slug}`} style={{ textDecoration: "none", display: "block", padding: "0.45rem 0.55rem", borderRadius: "8px", background: c.slug === program.slug ? "#1d1728" : "transparent" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", fontSize: "0.78rem", color: "#c3c2c8", flexWrap: "wrap" }}>
                      <span style={{ color: "#fff", fontWeight: 600 }}>{c.name}</span>
                      <span>
                        {c.waitlistOnly ? `En attente · ${c.waitlist} sur la liste d'attente` : `${c.paid} payé${c.paid > 1 ? "s" : ""} · ${left} place${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""} sur ${c.capacity}${c.waitlist ? ` · ${c.waitlist} en attente` : ""}`}
                      </span>
                    </div>
                    {!c.waitlistOnly && (
                      <div style={{ height: "6px", background: "#1f1d25", borderRadius: "999px", marginTop: "0.35rem", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: pct >= 85 ? "#ff9999" : pct >= 50 ? "#f0c878" : "#8fce9f" }} />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
            <p style={{ fontSize: "0.7rem", color: "#6d6b71", margin: "0.6rem 0 0" }}>Plus la barre est courte, plus il reste de places : c&apos;est le programme à promouvoir en priorité.</p>
          </div>

          <BoysRegistrationsTable initialRows={rows} initialProgram={program.slug} lockProgram title="Inscriptions" />
        </div>
      </div>
    </>
  );
}
