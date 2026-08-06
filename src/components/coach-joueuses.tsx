"use client";

import Link from "next/link";

import { CoachTopbar } from "@/components/coach-topbar";
import type { CoachPlayer } from "@/lib/coach-portal-repo";

interface Props {
  coachName: string;
  players: CoachPlayer[];
}

export function CoachJoueuses({ coachName, players }: Props) {
  return (
    <>
      <CoachTopbar coachName={coachName} />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Joueuses ({players.length})</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.5rem" }}>
            Joueuses de vos groupes.
          </p>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Née</th>
                  <th>Groupe</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.registrationId}>
                    <td>
                      <Link href={`/entraineur/joueuses/${p.registrationId}`} style={{ color: "#c3a6ff", textDecoration: "none" }}>
                        {p.firstName} {p.lastName}
                      </Link>
                    </td>
                    <td>{p.birthYear ?? "—"}</td>
                    <td>{p.advancedGroup ? "Avancé" : "Régulier"}</td>
                  </tr>
                ))}
                {players.length === 0 && (
                  <tr><td colSpan={3} className="admin-empty-text">Aucune joueuse dans vos groupes pour le moment.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
