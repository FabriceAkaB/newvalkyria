import { CircleAlert, Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import "./bulletin-lock.css";
import "./bulletin-feedback.css";

import { BulletinFeedback } from "@/components/bulletin-feedback";

import { LEVELS, levelOf } from "@/lib/bulletin-report";
import type { BulletinReportData } from "@/lib/bulletin-repo";

/** Le bulletin de progression d'une joueuse (mi-saison ou fin de saison), au style New Valkyria : bande violette,
 *  titres Oswald, évaluation globale dans un écusson, barres qui se remplissent jusqu'à la note (échelle corail →
 *  violet). Contenu : évaluation globale, présences, critères de terrain, bien-être, leadership, objectifs.
 *  `periodHref(p)` : le lien vers l'autre bulletin de la saison. */

const fr = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).replace(/^1 /, "1er ") : "—";
const num = (v: number | null) => (v === null ? "—" : v.toLocaleString("fr-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

function Meter({ value, min, max, reverse = false, scaleOf }: { value: number | null; min: number; max: number; reverse?: boolean; scaleOf: (v: number) => number }) {
  const pos = value === null ? 0 : Math.min(100, Math.max(4, ((value - min) / (max - min)) * 100));
  const level = value === null ? null : levelOf(reverse ? 6 - scaleOf(value) : scaleOf(value));
  return (
    <div className="nvb-meter" aria-hidden>
      <div className="nvb-track">
        {value !== null ? <span className="nvb-fill" style={{ width: `${pos}%`, background: level?.color }} /> : null}
      </div>
      <span className="nvb-value" style={{ color: level?.color ?? "var(--nvb-muted)" }}>
        {num(value)}
        <small>/{max}</small>
      </span>
    </div>
  );
}

export function BulletinReport({
  data,
  periodHref,
  audience = data.audience
}: {
  data: BulletinReportData;
  periodHref?: (p: "mi-saison" | "fin-saison") => string;
  /** « parent » : sous le bulletin remis, le sondage court « Ce bulletin vous est-il utile ? » (P4.8.11). */
  audience?: "equipe" | "parent";
}) {
  if (!data.released) {
    // Pas encore remis à la famille : le bulletin flou, avec la date de remise (JP, 17 nov. 2026).
    return (
      <div className="nvb-lock">
        {periodHref ? (
          <nav className="nvb-switch no-print" aria-label="Bulletins de la saison">
            <Link href={periodHref("mi-saison")} data-on={data.range.period === "mi-saison" || undefined}>Mi-saison</Link>
            <Link href={periodHref("fin-saison")} data-on={data.range.period === "fin-saison" || undefined}>Fin de saison</Link>
          </nav>
        ) : null}
        <div className="nvb-lock__veil" aria-hidden inert>
          <BulletinBody data={data} />
        </div>
        <div className="nvb-lock__card" role="status">
          <Lock size={22} strokeWidth={1.75} aria-hidden />
          <strong>Bientôt disponible</strong>
          <p>
            {data.range.provisional
              ? `${data.range.label} de ${data.player.firstName} sera remis le ${fr(data.range.to)}. Les éducatrices le remplissent après chaque pratique.`
              : `${data.range.label} de ${data.player.firstName} sera remis dès que ses éducatrices auront terminé ses évaluations.`}
          </p>
        </div>
      </div>
    );
  }
  const feedback =
    audience === "parent" ? <BulletinFeedback registrationId={data.registrationId} period={data.range.period} firstName={data.player.firstName || "votre fille"} /> : null;
  // Moins de 4 pratiques évaluées : l'équipe voit le bulletin en construction, avec ce qui manque ; la famille ne le reçoit pas.
  const notReady = data.readiness && !data.readiness.ready && data.audience === "equipe" ? (
    <div className="nvb-ready no-print" role="status">
      <CircleAlert size={18} strokeWidth={1.75} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <strong>{data.readiness.message}</strong>
        Il faut au moins {data.readiness.min} pratiques où un éducateur a fait l&apos;évaluation rapide de {data.player.firstName || "la joueuse"} : d&apos;ici là, le bulletin n&apos;est pas remis à la famille.
      </div>
    </div>
  ) : null;
  return (
    <>
      {notReady}
      <BulletinBody data={data} periodHref={periodHref} feedback={feedback} />
    </>
  );
}

function BulletinBody({ data, periodHref, feedback }: { data: BulletinReportData; periodHref?: (p: "mi-saison" | "fin-saison") => string; feedback?: ReactNode }) {
  const { player, summary: s, range } = data;
  const level = levelOf(s.global);
  const on10 = (v: number) => 1 + ((v - 1) / 9) * 4; // une note sur 10 ramenée sur l'échelle 1 à 5
  return (
    <article className="nvb" aria-label={`${range.label} de ${player.firstName} ${player.lastName}`}>
      {periodHref ? (
        <nav className="nvb-switch no-print" aria-label="Bulletins de la saison">
          <Link href={periodHref("mi-saison")} data-on={range.period === "mi-saison" || undefined}>Mi-saison</Link>
          <Link href={periodHref("fin-saison")} data-on={range.period === "fin-saison" || undefined}>Fin de saison</Link>
        </nav>
      ) : null}

      <header className="nvb-band">
        <div className="nvb-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={52} height={52} />
          <span>Académie New Valkyria</span>
        </div>
        <h2 className="nvb-heading">{range.period === "mi-saison" ? "Bulletin de mi-saison" : "Bulletin de fin de saison"}</h2>
        <p className="nvb-band-sub">
          {data.seasonLabel} · du {fr(range.from)} au {fr(range.to)}
          {range.provisional ? " · provisoire" : ""}
        </p>
      </header>

      <section className="nvb-player">
        {player.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="nvb-photo" src={player.photoUrl} alt="" />
        ) : (
          <span className="nvb-photo nvb-initial" aria-hidden>{player.firstName.charAt(0)}</span>
        )}
        <div className="nvb-id">
          <p className="nvb-name">{player.firstName} {player.lastName}</p>
          <div className="nvb-chips">
            <span>{[player.category ? `Filles ${player.category}` : "Groupe à venir", player.advanced ? "avancé" : null].filter(Boolean).join(" ")}{player.group ? ` · ${player.group}` : ""}</span>
            <span>Née le {fr(player.dob)}</span>
          </div>
        </div>
        <div className="nvb-shield" style={{ background: level?.color ?? "#8a8496" }}>
          <small>Évaluation globale</small>
          <strong>{num(s.global)}</strong>
          <small>{level ? level.label : "À venir"}</small>
        </div>
      </section>

      <section className="nvb-stats" aria-label="Présences">
        <div><strong>{s.attendance.rate === null ? "—" : `${s.attendance.rate} %`}</strong><span>de présence</span></div>
        <div><strong>{s.attendance.present}<small>/{s.attendance.total}</small></strong><span>pratiques présente</span></div>
        <div><strong>{s.practices}</strong><span>pratiques évaluées</span></div>
        <div><strong>{s.coaches}</strong><span>éducateur{s.coaches > 1 ? "s" : ""}</span></div>
      </section>

      <section className="nvb-sec">
        <div className="nvb-sec-head">
          <h3 className="nvb-h">Sur le terrain</h3>
          <ul className="nvb-scale" aria-label="Échelle">
            {LEVELS.map((l) => (
              <li key={l.value}><i style={{ background: l.color }} />{l.value} {l.label}</li>
            ))}
          </ul>
        </div>
        <p className="nvb-small">La moyenne des évaluations des éducateurs après chaque pratique.</p>
        <ul className="nvb-rows">
          {s.criteria.map((c) => (
            <li key={c.key}>
              <div>
                <p className="nvb-row-name">{c.label}</p>
                <p className="nvb-small">{c.detail}</p>
                {c.before !== null && c.value !== null ? (
                  <p className="nvb-delta" data-up={c.value >= c.before || undefined}>
                    {c.value >= c.before ? "▲" : "▼"} mi-saison {num(c.before)} → {num(c.value)}
                  </p>
                ) : null}
              </div>
              <Meter value={c.value} min={1} max={5} scaleOf={(v) => v} />
            </li>
          ))}
        </ul>
      </section>

      <section className="nvb-sec">
        <h3 className="nvb-h">Bien-être et engagement</h3>
        <p className="nvb-small">Ce que {player.firstName} a répondu elle-même au sondage de fin de pratique.</p>
        <ul className="nvb-rows">
          {s.wellbeing.map((w) => (
            <li key={w.key}>
              <div>
                <p className="nvb-row-name">{w.label}</p>
                <p className="nvb-small">{w.detail}{w.count ? ` · ${w.count} réponse${w.count > 1 ? "s" : ""}` : ""}</p>
              </div>
              <Meter value={w.value} min={1} max={10} reverse={w.reverse} scaleOf={on10} />
            </li>
          ))}
        </ul>
      </section>

      <section className="nvb-duo">
        <div className="nvb-card">
          <h3 className="nvb-h">Leadership</h3>
          {s.leadership.times ? (
            <p className="nvb-lead">
              <span className="nvb-armband" aria-hidden>C</span>
              <span>
                Capitaine <strong>{s.leadership.times} fois</strong>
                {s.leadership.value !== null ? <><br />Leadership <strong>{num(s.leadership.value)}/5</strong></> : null}
              </span>
            </p>
          ) : (
            <p className="nvb-small">Pas encore capitaine cette période : chaque fille porte le brassard à son tour.</p>
          )}
        </div>
        <div className="nvb-card">
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

      {data.familyComments.length ? (
        <section className="nvb-sec">
          <h3 className="nvb-h">Le mot des éducatrices</h3>
          <ul className="nvb-words">
            {data.familyComments.map((c, i) => (
              <li key={i}>
                <p>« {c.text} »</p>
                <span className="nvb-small">{c.author} · {fr(c.date)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.notes.length ? (
        <section className="nvb-sec">
          <h3 className="nvb-h">Notes des éducateurs (internes, jamais montrées aux parents)</h3>
          <ul className="nvb-obj">
            {data.notes.map((n, i) => (
              <li key={i}><span className="nvb-small">{fr(n.date)} · {n.coach}</span> « {n.text} »</li>
            ))}
          </ul>
        </section>
      ) : null}

      {feedback}

      <footer className="nvb-foot">
        <p className="nvb-motto">Former des joueuses plus techniques, intelligentes et confiantes.</p>
        <p className="nvb-small">
          Établi à partir des évaluations des éducateurs après chaque pratique et des réponses de la joueuse au sondage de fin de pratique · généré le{" "}
          {fr(new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" }))} · info@newvalkyria.com
        </p>
      </footer>
    </article>
  );
}
