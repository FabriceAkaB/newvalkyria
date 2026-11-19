import { ChevronRight, Gift } from "lucide-react";
import Link from "next/link";

import { ChampionKindIcon } from "@/components/family-icons";

import { CHAMPION_KINDS, type Progress } from "@/lib/player-points";
import type { ChampionPost, PointsSummary } from "@/lib/player-points-repo";

/** L'app famille : la carte des points d'une fille et le fil des championnes du jour (comme un fil d'actualité). */

const dayLabel = (iso: string) => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const diff = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${iso}T12:00:00Z`)) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
};
const endLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", timeZone: "UTC" });

export function ExpiryNote({ summary }: { summary: PointsSummary }) {
  if (!summary.seasonEnd || !summary.phase || summary.phase === "loin") return null;
  if (summary.phase === "expire") return <p className="fam-expiry" data-tone="done">Saison terminée : ses points restants sont devenus le cadeau de fin de saison.</p>;
  return (
    <p className="fam-expiry" data-tone={summary.phase}>
      {summary.daysLeft === 0 ? "Dernier jour" : `Plus que ${summary.daysLeft} jour${(summary.daysLeft ?? 0) > 1 ? "s" : ""}`} pour dépenser ses points (jusqu&apos;au {endLabel(summary.seasonEnd)}). Après, ce qui reste devient le cadeau de fin de saison.
    </p>
  );
}

export function GirlPointsCard({ firstName, progress: p, summary, titles, link = true, photoUrl = null }: { firstName: string; progress: Progress; summary: PointsSummary; titles: number; link?: boolean; photoUrl?: string | null }) {
  return (
    <article className="fam-girl">
      <div className="fam-girl__top">
        <span className="fam-girl__avatar" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photoUrl ? <img src={photoUrl} alt="" /> : firstName.charAt(0)}
        </span>
        <div className="fam-girl__id">
          <p className="fam-girl__name">{firstName}</p>
          <p className="fam-girl__level">Niveau {p.level.n} · {p.level.name}</p>
        </div>
        <div className="fam-girl__wallet">
          <strong>{p.balance}</strong>
          <small>points à dépenser</small>
        </div>
      </div>
      <div className="fam-bar-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.pct * 100)} aria-label={p.next ? `Vers le niveau ${p.next.name}` : "Niveau maximum"}>
        <span style={{ width: `${Math.max(4, p.pct * 100)}%` }} />
      </div>
      <p className="fam-girl__next">
        {p.next ? `Encore ${p.toNext} points pour devenir ${p.next.name}.` : "Elle a atteint le plus haut niveau : Légende."}
        {" "}{summary.presences} présence{summary.presences > 1 ? "s" : ""} · {titles} titre{titles > 1 ? "s" : ""} de championne
      </p>
      <ExpiryNote summary={summary} />
      {link ? (
        <Link href="/compte/points" className="fam-girl__cta">
          <Gift aria-hidden strokeWidth={1.75} />
          <span style={{ flex: 1 }}>{p.affordable.length ? `${p.affordable.length} récompense${p.affordable.length > 1 ? "s" : ""} à sa portée` : p.nextReward ? `Prochaine récompense : ${p.nextReward.name} (encore ${p.nextReward.toGo} points)` : "Voir les récompenses"}</span>
          <ChevronRight aria-hidden strokeWidth={1.75} />
        </Link>
      ) : null}
    </article>
  );
}

export function ChampionFeed({ posts, empty }: { posts: ChampionPost[]; empty: string }) {
  if (!posts.length) return <div className="parent-card"><p className="parent-muted" style={{ margin: 0 }}>{empty}</p></div>;
  return (
    <ul className="fam-feed">
      {posts.map((p) => {
        const k = CHAMPION_KINDS.find((x) => x.kind === p.kind)!;
        const mine = p.girls.some((g) => g.mine);
        return (
          <li key={p.id} className="fam-post" data-mine={mine || undefined}>
            {p.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photoUrl} alt={`Championnes : ${p.girls.map((g) => g.name).join(", ")}`} className="fam-post__photo" loading="lazy" />
            ) : (
              <div className="fam-post__art" aria-hidden><ChampionKindIcon kind={k.kind} size={40} /></div>
            )}
            <div className="fam-post__body">
              <p className="fam-post__kind"><ChampionKindIcon kind={k.kind} size={14} /> {k.label}{p.title ? ` · ${p.title}` : ""}</p>
              <p className="fam-post__names">
                {p.girls.map((g, i) => (
                  <span key={g.registrationId}>
                    {i ? ", " : ""}
                    {g.mine ? <mark>{g.name}</mark> : g.name}
                  </span>
                ))}
              </p>
              <p className="fam-post__meta">
                <span>{dayLabel(p.activity.date)}</span>
                <span>+{p.points} point{p.points > 1 ? "s" : ""}{p.girls.length > 1 ? " chacune" : ""}</span>
                {mine ? <span className="fam-post__bravo">Bravo !</span> : null}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
