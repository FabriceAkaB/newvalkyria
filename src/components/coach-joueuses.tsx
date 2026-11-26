"use client";

import "./player-dossier.css";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CoachTopbar } from "@/components/coach-topbar";
import type { DossierListPlayer } from "@/lib/player-dossier-repo";
import { searchKey } from "@/lib/player-dossier";

interface Props {
  coachName: string;
  players: DossierListPlayer[];
}

/** Toutes les joueuses de l'Académie (JP, 26 nov. 2026) : recherche, filtre par année et par groupe, « Mes groupes »,
 *  et une pastille d'état par fille (dernière évaluation, présence des 4 dernières semaines, blessure ouverte). */
export function CoachJoueuses({ coachName, players }: Props) {
  const [q, setQ] = useState("");
  const [year, setYear] = useState<string>("");
  const [group, setGroup] = useState<string>("");
  const [mineOnly, setMineOnly] = useState(false);
  const [alertsOnly, setAlertsOnly] = useState(false);

  const years = useMemo(() => [...new Set(players.map((p) => p.category).filter((c): c is string => Boolean(c)))].sort(), [players]);
  const groups = useMemo(() => [...new Set(players.map((p) => p.group).filter((g): g is string => Boolean(g)))].sort((a, b) => a.localeCompare(b, "fr")), [players]);
  const hasMine = players.some((p) => p.mine);

  const shown = useMemo(() => {
    const k = searchKey(q);
    return players.filter((p) => {
      if (k && !searchKey(`${p.firstName} ${p.lastName}`).includes(k)) return false;
      if (year && p.category !== year) return false;
      if (group === "__avance" ? !p.advanced : group && p.group !== group) return false;
      if (mineOnly && !p.mine) return false;
      if (alertsOnly && !p.badges.some((b) => b.tone === "bad" || b.tone === "warn")) return false;
      return true;
    });
  }, [players, q, year, group, mineOnly, alertsOnly]);

  return (
    <>
      <CoachTopbar coachName={coachName} />
      <div className="admin-content">
        <div className="admin-section coach-page coach-page--wide">
          <p className="coach-eyebrow">Joueuses</p>
          <h1 className="coach-title coach-title--xl">Le dossier de chaque joueuse</h1>
          <p className="coach-sub">
            Toutes les filles de l&apos;Académie ({players.length}). Ouvre une fille pour voir tout son dossier : rapports des éducateurs, sondages, matchs, vidéos,
            passeport, fiche du parent, blessures et son bulletin en construction.
          </p>

          <div className="pd-filters">
            <label style={{ position: "relative", display: "block" }}>
              <Search size={16} aria-hidden style={{ position: "absolute", left: 14, top: 14, color: "var(--adm-text-3)" }} />
              <input className="pd-search" type="search" placeholder="Chercher une joueuse" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 38 }} aria-label="Chercher une joueuse" />
            </label>
            <select className="pd-select" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Année de naissance">
              <option value="">Toutes les années</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select className="pd-select" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Groupe">
              <option value="">Tous les groupes</option>
              <option value="__avance">Groupe avancé</option>
              {groups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="pd-chips" style={{ marginBottom: 16 }}>
            {hasMine ? (
              <button type="button" data-on={mineOnly || undefined} onClick={() => setMineOnly((v) => !v)}>Mes groupes</button>
            ) : null}
            <button type="button" data-on={alertsOnly || undefined} onClick={() => setAlertsOnly((v) => !v)}>À surveiller</button>
            <span className="coach-muted" style={{ alignSelf: "center", marginLeft: 4 }}>{shown.length} joueuse{shown.length > 1 ? "s" : ""}</span>
          </div>

          <div className="pd-grid">
            {shown.map((p) => (
              <Link key={p.registrationId} href={`/entraineur/joueuses/${p.registrationId}`} className="pd-pcard">
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="coach-avatar" src={p.photoUrl} alt="" loading="lazy" />
                ) : (
                  <span className="coach-avatar" aria-hidden>{p.firstName.charAt(0)}{p.lastName.charAt(0)}</span>
                )}
                <span className="pd-pcard__body">
                  <p className="pd-pcard__name">{p.firstName} {p.lastName}</p>
                  <p className="pd-pcard__meta">{[p.category ? `Filles ${p.category}` : null, p.advanced ? "avancé" : null, p.group].filter(Boolean).join(" · ") || "Groupe à venir"}</p>
                  <span className="pd-badges">
                    {p.badges.map((b) => (
                      <span key={b.key} className="pd-badge" data-tone={b.tone}>{b.label}</span>
                    ))}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          {shown.length === 0 ? <p className="pd-empty" style={{ marginTop: 16 }}>Aucune joueuse ne correspond à ta recherche.</p> : null}
        </div>
      </div>
    </>
  );
}
