import type { Metadata } from "next";
import { CalendarClock, Goal, MapPin } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/container";
import { fmtDay, fmtHours, mapsUrl, PRACTICE_DAYS, type ScheduleItem } from "@/lib/family-schedule-core";
import { getFamilySchedule } from "@/lib/family-schedule";
import { requireParentUserId } from "@/lib/parent-auth";
import { getFamilyRegistrations } from "@/lib/parent-repo";
import { CLUB } from "@/lib/club";

export const metadata: Metadata = { title: "Horaire | Espace famille", robots: "noindex" };
export const dynamic = "force-dynamic";

function Where({ item }: { item: ScheduleItem }) {
  if (!item.place && !item.address) return null;
  return (
    <small style={{ display: "flex", alignItems: "flex-start", gap: 4, marginTop: 2 }}>
      <MapPin aria-hidden strokeWidth={1.75} style={{ width: 14, height: 14, marginTop: 1, color: "var(--adm-text-3)" }} />
      <span>
        {item.place ? <>{item.place}{item.address ? " · " : ""}</> : null}
        {item.address ? (
          <a href={mapsUrl(item.address)} target="_blank" rel="noopener noreferrer" className="parent-link">
            {item.address}
          </a>
        ) : null}
      </span>
    </small>
  );
}

function Row({ item, today }: { item: ScheduleItem; today: string }) {
  const hours = fmtHours(item.start, item.end);
  const Icon = item.kind === "match" ? Goal : CalendarClock;
  const what = item.kind === "match" ? (item.opponent ? `Match contre ${item.opponent}` : item.title || "Match") : item.title || "Pratique";
  return (
    <li style={{ alignItems: "flex-start" }}>
      <Icon aria-hidden strokeWidth={1.75} style={{ marginTop: 2 }} />
      <span>
        <span style={{ fontWeight: 600 }}>
          {fmtDay(item.date, today)}
          {hours ? ` · ${hours}` : ""}
        </span>
        <small>
          {what}
          {item.group ? ` · ${item.group}` : ""}
        </small>
        <Where item={item} />
      </span>
    </li>
  );
}

/** « Quand et où est sa prochaine pratique ? » L'horaire de chaque fille : ses pratiques des 14 prochains jours et ses
 *  prochains matchs, tels qu'ils sont dans MonClubSportif (jour, heures, groupe, lieu et adresse). */
export default async function HorairePage() {
  const userId = await requireParentUserId();
  const family = await getFamilyRegistrations(userId);
  const schedules = await getFamilySchedule(family.map((f) => f.registrationId)).catch(() => []);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: CLUB.timezone });

  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="fam-hello">
          <p>Horaire</p>
          <h1>Ses prochaines pratiques et ses matchs</h1>
        </div>

        {!family.length ? (
          <div className="parent-card">
            <p className="parent-muted" style={{ margin: 0 }}>
              L&apos;horaire apparaît dès que votre fille est inscrite à la saison et reliée à votre compte. <Link href="/compte/enfants" className="parent-link">Mes enfants →</Link>
            </p>
          </div>
        ) : null}

        {schedules.map((s) => (
          <div key={s.registrationId}>
            <h2 className="fam-h2">
              Les pratiques de {s.firstName}
              <small style={{ display: "block", marginTop: 2, fontSize: "0.8rem", fontWeight: 400, color: "var(--adm-text-3)" }}>{PRACTICE_DAYS} prochains jours</small>
            </h2>
            {s.practices.length ? (
              <ul className="fam-list">
                {s.practices.map((p) => (
                  <Row key={`${p.date}|${p.start}|${p.group}`} item={p} today={today} />
                ))}
              </ul>
            ) : (
              <div className="parent-card">
                <p className="parent-muted" style={{ margin: 0 }}>Aucune pratique prévue dans les {PRACTICE_DAYS} prochains jours.</p>
              </div>
            )}

            <h2 className="fam-h2">Les matchs de {s.firstName}</h2>
            {s.matches.length ? (
              <ul className="fam-list">
                {s.matches.map((m) => (
                  <Row key={`${m.date}|${m.start}|${m.group}`} item={m} today={today} />
                ))}
              </ul>
            ) : (
              <div className="parent-card">
                <p className="parent-muted" style={{ margin: 0 }}>Aucun match prévu pour le moment : ils apparaissent ici dès qu&apos;ils sont au calendrier.</p>
              </div>
            )}
          </div>
        ))}

        {family.length ? (
          <div className="parent-card" style={{ marginTop: "2rem" }}>
            <p className="parent-muted" style={{ margin: 0 }}>
              Cet horaire vient de MonClubSportif, le calendrier officiel de l&apos;équipe. Une absence s&apos;indique dans MonClubSportif (onglet Présences), en tout temps, même à la dernière minute.
            </p>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
