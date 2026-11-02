"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import {
  AGE_GROUPS,
  EXERCISE_CATEGORIES,
  EXERCISE_TYPES,
  SESSION_PLACES,
  STATUS_LABEL,
  STATUS_TONE,
  VENUES,
  compareBank,
  fmtScore,
  matchesFilters,
  typeLabel,
  venueLabel,
  type BankFilters,
  type BankStatus
} from "@/lib/exercise-bank";
import type { BankEntry } from "@/lib/exercises-repo";

const STAT_CARDS: { status: BankStatus; label: string; color?: string }[] = [
  { status: "approuve", label: "Approuvés", color: "var(--adm-good)" },
  { status: "a-valider", label: "À valider par toi", color: "var(--adm-accent)" },
  { status: "a-changer", label: "À changer (note sous 8)", color: "var(--adm-warn)" },
  { status: "a-tester", label: "À tester" }
];

const EMPTY: BankFilters = { q: "", type: "", theme: "", age: "", venue: "", place: "", players: null, status: "", minScore: null };

function Row({ e }: { e: BankEntry }) {
  const b = e.bank;
  const players = e.min_players && e.min_players === e.max_players ? `${e.min_players} joueuses` : e.min_players || e.max_players ? `${e.min_players ?? "?"} à ${e.max_players ?? "?"} joueuses` : null;
  return (
    <li>
      <Link href={`/admin/exercices/${e.id}`} className="xb-row">
        <div className="xb-row-body">
          <p className="xb-row-title">
            {b.top ? <span aria-label="Top exercice" title="Top exercice : approuvé, 9 ou plus">★</span> : null}
            {e.title}
            <Pill tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Pill>
          </p>
          <div className="xb-row-meta">
            {typeLabel(e.exercise_type) ? <span>{typeLabel(e.exercise_type)}</span> : <span style={{ color: "var(--adm-warn)" }}>Type à choisir</span>}
            {e.category ? <span>{e.category}</span> : null}
            {e.age_groups?.length ? <span>{e.age_groups.join(", ")}</span> : null}
            {e.venue ? <span>{venueLabel(e.venue)}</span> : null}
            {players ? <span>{players}</span> : null}
            {e.duration_minutes ? <span>{e.duration_minutes} min</span> : null}
            {e.version > 1 ? <span>v{e.version}</span> : null}
            <span style={e.sheet.done < e.sheet.total ? { color: "var(--adm-warn)" } : undefined}>
              {e.sheet.done < e.sheet.total ? `Fiche ${e.sheet.done}/${e.sheet.total}` : "Fiche complète"}
            </span>
          </div>
        </div>
        <div className="xb-score">
          <div className="xb-score-num">
            {fmtScore(b.average)}
            {b.average !== null ? <small>/10</small> : null}
          </div>
          <div className="xb-score-sub">{b.count ? `${b.count} note${b.count > 1 ? "s" : ""} · ${Math.min(b.coachesAtApproval, 2)}/2 à 8+` : "pas encore noté"}</div>
        </div>
      </Link>
    </li>
  );
}

/** « Quels exercices marchent vraiment, par âge, thème et espace ? » */
export function AdminExercices({ entries, weekTheme }: { entries: BankEntry[]; weekTheme: string | null }) {
  const [f, setF] = useState<BankFilters>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const set = <K extends keyof BankFilters>(k: K, v: BankFilters[K]) => setF((p) => ({ ...p, [k]: v }));

  const counts = useMemo(() => {
    const c: Record<BankStatus, number> = { approuve: 0, "a-valider": 0, "a-changer": 0, "a-tester": 0, retire: 0 };
    for (const e of entries) c[e.bank.status] += 1;
    return c;
  }, [entries]);
  const approvedByAge = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries.filter((x) => x.bank.status === "approuve")) for (const a of e.age_groups ?? []) m.set(a, (m.get(a) ?? 0) + 1);
    return m;
  }, [entries]);

  // Les retirés ne sortent que si on les demande.
  const list = entries.filter((e) => (f.status ? true : e.bank.status !== "retire") && matchesFilters(e, f)).sort(compareBank);
  const filtering = JSON.stringify(f) !== JSON.stringify(EMPTY);
  const activeFilters = (Object.keys(EMPTY) as (keyof BankFilters)[]).filter((k) => k !== "q" && f[k] !== EMPTY[k] && f[k] !== undefined).length;
  const themeKnown = weekTheme && EXERCISE_CATEGORIES.some((c) => c.toLowerCase() === weekTheme.toLowerCase());

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Banque d’exercices Valkyria · approuvé = 2 éducateurs à 8/10 ou plus, puis ta validation</p>
            <h1 className="mda-h1">{counts.approuve ? `${counts.approuve} exercice${counts.approuve > 1 ? "s" : ""} approuvé${counts.approuve > 1 ? "s" : ""}` : "Aucun exercice approuvé pour l'instant"}</h1>
            <p className="mda-lead">
              Objectif : 30 par génération (U8 à U12) d’ici le 30 juin 2027, 150 en tout
              {approvedByAge.size ? ` · ${["U8", "U9", "U10", "U11", "U12"].map((a) => `${a} ${approvedByAge.get(a) ?? 0}`).join(" · ")}` : ""}. Les éducateurs notent chaque exercice sur 10 après la séance, dans le portail entraîneur.
            </p>
          </header>

          <section className="mda-cols-4" aria-label="Exercices par statut">
            {STAT_CARDS.map((s) => (
              <button key={s.status} type="button" className="mda-card xb-stat" data-active={f.status === s.status} onClick={() => set("status", f.status === s.status ? "" : s.status)} aria-pressed={f.status === s.status}>
                <p className="mda-num" style={{ color: counts[s.status] ? s.color : undefined }}>{counts[s.status]}</p>
                <p className="mda-label">{s.label}</p>
              </button>
            ))}
          </section>

          <section className="mda-card-flush">
            <div className="xb-filters" data-open={showFilters}>
              <div className="xb-search">
                <input className="admin-input" type="search" placeholder="Chercher un exercice" value={f.q} onChange={(e) => set("q", e.target.value)} aria-label="Chercher" />
                <button type="button" className="admin-btn-ghost xb-filter-toggle" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
                  Filtres{activeFilters ? ` (${activeFilters})` : ""}
                </button>
              </div>
              <select className="admin-input xb-filter-more" value={f.type} onChange={(e) => set("type", e.target.value)} aria-label="Type">
                <option value="">Type</option>
                {EXERCISE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <select className="admin-input xb-filter-more" value={f.theme} onChange={(e) => set("theme", e.target.value)} aria-label="Geste ou thème">
                <option value="">Geste ou thème</option>
                {EXERCISE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="admin-input xb-filter-more" value={f.age} onChange={(e) => set("age", e.target.value)} aria-label="Âge">
                <option value="">Âge</option>
                {AGE_GROUPS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <select className="admin-input xb-filter-more" value={f.venue} onChange={(e) => set("venue", e.target.value)} aria-label="Lieu">
                <option value="">Lieu</option>
                {VENUES.filter((v) => v.key !== "les-deux").map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
              </select>
              <select className="admin-input xb-filter-more" value={f.place} onChange={(e) => set("place", e.target.value)} aria-label="Place dans la séance">
                <option value="">Bloc de séance</option>
                {SESSION_PLACES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <input className="admin-input xb-filter-more" type="number" inputMode="numeric" min={1} max={30} placeholder="Nb de joueuses" value={f.players ?? ""} onChange={(e) => set("players", e.target.value ? parseInt(e.target.value, 10) : null)} aria-label="Nombre de joueuses" />
              <select className="admin-input xb-filter-more" value={f.status} onChange={(e) => set("status", e.target.value as BankStatus | "")} aria-label="Statut">
                <option value="">Statut</option>
                {(Object.keys(STATUS_LABEL) as BankStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <select className="admin-input xb-filter-more" value={f.minScore ?? ""} onChange={(e) => set("minScore", e.target.value ? Number(e.target.value) : null)} aria-label="Note minimale">
                <option value="">Note</option>
                <option value="6">6 et plus</option>
                <option value="8">8 et plus</option>
                <option value="9">9 et plus</option>
              </select>
              {themeKnown || filtering ? (
                <div className="xb-filter-foot">
                  {themeKnown ? (
                    <button type="button" className="xb-chip" data-on={(f.theme ?? "").toLowerCase() === weekTheme!.toLowerCase() || undefined} onClick={() => set("theme", (f.theme ?? "").toLowerCase() === weekTheme!.toLowerCase() ? "" : EXERCISE_CATEGORIES.find((c) => c.toLowerCase() === weekTheme!.toLowerCase())!)}>
                      Thème de la semaine : {weekTheme}
                    </button>
                  ) : null}
                  {filtering ? (
                    <button type="button" className="admin-btn-ghost" onClick={() => setF(EMPTY)} style={{ padding: "6px 12px" }}>
                      Effacer les filtres
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2" style={{ margin: 0 }}>
                  {list.length} exercice{list.length > 1 ? "s" : ""}
                </h2>
                <p className="mda-sub" style={{ margin: 0 }}>Top exercices d’abord : approuvés, puis par note moyenne.</p>
              </div>
              <Link href="/admin/exercices/nouveau" className="admin-btn-primary" style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
                Nouvel exercice
              </Link>
            </div>

            {list.length ? (
              <ul className="xb-list">
                {list.map((e) => (
                  <Row key={e.id} e={e} />
                ))}
              </ul>
            ) : (
              <p className="mda-sub" style={{ padding: "20px", margin: 0 }}>
                {entries.length ? "Aucun exercice ne correspond à ces filtres." : "La banque est vide : ajoute un premier exercice avec la fiche Valkyria."}
              </p>
            )}
          </section>

          <p className="mda-sub" style={{ margin: 0 }}>
            Une note sous 8 met l’exercice « à changer » : fais-en une nouvelle version (les notes repartent à zéro) ; il ne revient pas dans une séance la même semaine. Retiré si la moyenne de ses 2 dernières notes reste sous 6. Gymnase : technique et ball mastery ; synthétique : tactique, grand espace et prise de décision.
          </p>
        </div>
      </div>
    </>
  );
}
