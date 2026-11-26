import { ChevronRight, Trophy } from "lucide-react";
import Link from "next/link";

import { ChampionKindIcon } from "@/components/family-icons";

import { groupByMonth, kindsLine, palmaresSummary, timesLabel, type ChampionTitle } from "@/lib/champion-titles";
import { championLabel } from "@/lib/player-points";

/** Le palmarès d'une fille dans l'app famille (JP, 25 nov. 2026) : chaque fois qu'elle a été championne du jour,
 *  la plus récente en haut. Page /compte/championne ; la carte d'accès est sur l'Accueil. */

const longDay = (iso: string) => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const diff = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${iso}T12:00:00Z`)) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  const s = new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** La carte de l'Accueil : « Léa : 5 fois championne », dernier titre, lien vers son palmarès. */
export function ChampionTitlesLink({ firstName, titles, many }: { firstName: string; titles: ChampionTitle[]; many: boolean }) {
  const last = titles[0];
  return (
    <li>
      <Trophy aria-hidden strokeWidth={1.75} />
      <span>
        <Link href="/compte/championne" className="parent-link">
          {many ? `${firstName} : ` : ""}
          {titles.length ? timesLabel(titles.length) : "Ses titres de championne"}
        </Link>
        <small>
          {last
            ? `Dernier titre : ${championLabel(last.kind).label.toLowerCase()}${last.title ? ` (${last.title})` : ""}, ${longDay(last.date).toLowerCase()}`
            : "Chaque pratique est une chance : ses titres apparaîtront ici"}
        </small>
      </span>
      <ChevronRight aria-hidden strokeWidth={1.75} />
    </li>
  );
}

/** Le palmarès complet d'une fille : compteur, puis chaque titre, mois par mois. */
export function ChampionTitles({ firstName, titles, photoUrl }: { firstName: string; titles: ChampionTitle[]; photoUrl: string | null }) {
  const sum = palmaresSummary(titles);
  return (
    <section className="fam-titles">
      <header className="fam-titles__head">
        <span className="fam-girl__avatar" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photoUrl ? <img src={photoUrl} alt="" /> : firstName.charAt(0)}
        </span>
        <div className="fam-titles__id">
          <p className="fam-girl__name">{firstName}</p>
          <p className="fam-titles__count">{timesLabel(sum.total)}</p>
          {sum.total ? <p className="fam-titles__kinds">{kindsLine(sum.byKind)} · +{sum.points} points</p> : null}
        </div>
        <span className="fam-titles__badge" aria-hidden>
          <Trophy strokeWidth={1.75} />
          <strong>{sum.total}</strong>
        </span>
      </header>

      {!titles.length ? (
        <div className="parent-card fam-titles__empty">
          <p style={{ margin: 0, fontWeight: 600 }}>Son premier titre l&apos;attend</p>
          <p className="parent-muted" style={{ margin: "4px 0 0", fontSize: "0.9rem" }}>
            Après chaque pratique, les éducatrices nomment les championnes du jour : un jeu gagné, une équipe gagnante, une belle attitude. Dès que {firstName} en sera, son titre s&apos;ajoutera ici, avec la date et le mot de l&apos;éducatrice.
          </p>
        </div>
      ) : (
        groupByMonth(titles).map((m) => (
          <div key={m.key}>
            <h3 className="fam-titles__month">{m.label}</h3>
            <ul className="fam-titles__list">
              {m.items.map((t) => {
                const k = championLabel(t.kind);
                return (
                  <li key={t.id} className="fam-title">
                    <div className="fam-title__row">
                      <span className="fam-title__icon" aria-hidden><ChampionKindIcon kind={t.kind} size={20} /></span>
                      <div className="fam-title__body">
                        <p className="fam-title__kind">{k.label}</p>
                        {t.title ? <p className="fam-title__word">{`«\u00a0${t.title}\u00a0»`}{t.coachName ? <small> · {t.coachName}</small> : null}</p> : null}
                        <p className="fam-title__meta">
                          <span>{longDay(t.date)}</span>
                          <span>{t.group}</span>
                          {!t.title && t.coachName ? <span>Nommée par {t.coachName}</span> : null}
                        </p>
                        {t.teammates.length ? <p className="fam-title__meta">Avec {t.teammates.join(", ")}</p> : null}
                      </div>
                      <strong className="fam-title__pts">+{t.points}<small>points</small></strong>
                    </div>
                    {t.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.photoUrl} alt={`${firstName}, championne du jour`} className="fam-title__photo" loading="lazy" />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
