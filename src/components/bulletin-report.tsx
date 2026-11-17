import Link from "next/link";

import { LEVELS, levelOf } from "@/lib/bulletin-report";
import type { BulletinReportData } from "@/lib/bulletin-repo";

/** Le bulletin de progression d'une joueuse (mi-saison ou fin de saison), en feuille claire imprimable :
 *  évaluation globale, présences, critères de terrain sur une barre de couleur, bien-être, leadership, objectifs.
 *  `periodHref(p)` : le lien vers l'autre bulletin de la saison. */

const fr = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).replace(/^1 /, "1er ") : "—");
const num = (v: number | null) => (v === null ? "—" : v.toLocaleString("fr-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

function Bar({ value, min, max, reverse = false }: { value: number | null; min: number; max: number; reverse?: boolean }) {
  const pos = value === null ? null : Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div className="nvb-bar" data-reverse={reverse || undefined} aria-hidden>
      {pos !== null ? (
        <span className="nvb-marker" style={{ left: `${pos}%` }}>
          {num(value)}
        </span>
      ) : null}
    </div>
  );
}

export function BulletinReport({ data, periodHref }: { data: BulletinReportData; periodHref?: (p: "mi-saison" | "fin-saison") => string }) {
  const { player, summary: s, range } = data;
  const level = levelOf(s.global);
  return (
    <article className="nvb" aria-label={`${range.label} de ${player.firstName} ${player.lastName}`}>
      {periodHref ? (
        <nav className="nvb-switch no-print" aria-label="Bulletins de la saison">
          <Link href={periodHref("mi-saison")} data-on={range.period === "mi-saison" || undefined}>Mi-saison</Link>
          <Link href={periodHref("fin-saison")} data-on={range.period === "fin-saison" || undefined}>Fin de saison</Link>
        </nav>
      ) : null}
      <header className="nvb-head">
        <div className="nvb-club">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={56} height={56} />
          <div>
            <p className="nvb-club-name">Académie New Valkyria</p>
            <p>Académie de soccer féminin · Laurentides, Québec</p>
            <p>info@newvalkyria.com · newvalkyria.com</p>
          </div>
        </div>
        <div className="nvb-title">
          <span>{range.label}</span>
          <p>{data.seasonLabel}</p>
          <p className="nvb-small">
            Du {fr(range.from)} au {fr(range.to)}
            {range.provisional ? " · provisoire" : ""}
          </p>
        </div>
      </header>

      <section className="nvb-player">
        {player.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="nvb-photo" src={player.photoUrl} alt="" />
        ) : (
          <span className="nvb-photo nvb-initial" aria-hidden>{player.firstName.charAt(0)}</span>
        )}
        <div className="nvb-id">
          <p className="nvb-label">Joueuse</p>
          <p className="nvb-name">{player.firstName} {player.lastName}</p>
          <div className="nvb-facts">
            <div><p className="nvb-label">Groupe</p><p>{[player.category ? `Filles ${player.category}` : null, player.advanced ? "avancé" : null].filter(Boolean).join(" ") || "—"}{player.group ? ` · ${player.group}` : ""}</p></div>
            <div><p className="nvb-label">Date de naissance</p><p>{fr(player.dob)}</p></div>
          </div>
        </div>
        <div className="nvb-global" style={{ background: level?.color ?? "#8a8496" }}>
          <p>Évaluation globale</p>
          <strong>{num(s.global)}</strong>
          <p>{level ? level.label : "Pas encore évaluée"}</p>
        </div>
      </section>

      <section className="nvb-sec">
        <h3 className="nvb-h">Présences</h3>
        <div className="nvb-stats">
          <div><strong>{s.attendance.rate === null ? "—" : `${s.attendance.rate} %`}</strong><span>taux de présence</span></div>
          <div><strong>{s.attendance.present}</strong><span>pratiques présente sur {s.attendance.total}</span></div>
          <div><strong>{s.practices}</strong><span>pratiques évaluées</span></div>
          <div><strong>{s.coaches}</strong><span>éducateur{s.coaches > 1 ? "s" : ""} l&apos;ont évaluée</span></div>
        </div>
      </section>

      <section className="nvb-sec">
        <div className="nvb-sec-head">
          <h3 className="nvb-h">Sur le terrain</h3>
          <div className="nvb-legend" aria-label="Échelle">
            {LEVELS.map((l) => (
              <span key={l.value} style={{ background: l.color }}>{l.value} · {l.label}</span>
            ))}
          </div>
        </div>
        <p className="nvb-small">La moyenne des évaluations des éducateurs après chaque pratique, sur 5.</p>
        <ol className="nvb-list">
          {s.criteria.map((c) => (
            <li key={c.key}>
              <div className="nvb-crit">
                <p className="nvb-crit-name">{c.label}</p>
                <p className="nvb-small">{c.detail}</p>
                {c.before !== null && c.value !== null ? (
                  <p className="nvb-delta" data-up={c.value >= c.before || undefined}>
                    Mi-saison {num(c.before)} → {num(c.value)} {c.value >= c.before ? "▲" : "▼"}
                  </p>
                ) : null}
              </div>
              <Bar value={c.value} min={1} max={5} />
            </li>
          ))}
        </ol>
      </section>

      <section className="nvb-sec">
        <h3 className="nvb-h">Bien-être et engagement</h3>
        <p className="nvb-small">Ce que {player.firstName} a répondu elle-même au sondage de fin de pratique, sur 10.</p>
        <ol className="nvb-list">
          {s.wellbeing.map((w) => (
            <li key={w.key}>
              <div className="nvb-crit">
                <p className="nvb-crit-name">{w.label}</p>
                <p className="nvb-small">{w.detail}{w.count ? ` · ${w.count} réponse${w.count > 1 ? "s" : ""}` : ""}</p>
              </div>
              <Bar value={w.value} min={1} max={10} reverse={w.reverse} />
            </li>
          ))}
        </ol>
      </section>

      <section className="nvb-sec nvb-two">
        <div>
          <h3 className="nvb-h">Leadership</h3>
          {s.leadership.times ? (
            <p>
              Capitaine <strong>{s.leadership.times} fois</strong>
              {s.leadership.value !== null ? <> · leadership <strong>{num(s.leadership.value)}/5</strong></> : null}
            </p>
          ) : (
            <p className="nvb-small">Pas encore capitaine cette période : chaque fille le devient à son tour.</p>
          )}
        </div>
        <div>
          <h3 className="nvb-h">Objectifs</h3>
          {data.objectives.length ? (
            <ul className="nvb-obj">
              {data.objectives.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          ) : (
            <p className="nvb-small">Les objectifs individuels sont fixés avec les éducatrices.</p>
          )}
        </div>
      </section>

      {data.notes.length ? (
        <section className="nvb-sec no-print-parent">
          <h3 className="nvb-h">Notes des éducateurs (internes, jamais montrées aux parents)</h3>
          <ul className="nvb-notes">
            {data.notes.map((n, i) => (
              <li key={i}><span className="nvb-small">{fr(n.date)} · {n.coach}</span> « {n.text} »</li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="nvb-foot">
        Bulletin établi à partir des évaluations des éducateurs après chaque pratique et des réponses de la joueuse au sondage de fin de pratique. Généré le {fr(new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" }))}.
      </footer>
    </article>
  );
}
