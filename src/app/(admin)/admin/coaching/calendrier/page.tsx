import Link from "next/link";

import { requireAdmin } from "@/lib/admin-auth";
import { needsOpponent } from "@/lib/mcs-teams";
import { getEventsBetween } from "@/lib/mcs-teams-repo";
import { listPractices, todayIso, type Practice } from "@/lib/practices-repo";

export const metadata = { title: "Calendrier des pratiques — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const dow = (iso: string) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
const toMin = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : -1);

interface CalItem {
  key: string;
  time: string;
  label: string;
  kind: "prete" | "a-preparer" | "passee" | "match" | "match-a-trouver" | "mcs" | "perso";
  href: string | null;
}

const KIND: Record<CalItem["kind"], string> = { prete: "Prête", "a-preparer": "À préparer", passee: "Passée", match: "Match", "match-a-trouver": "Adversaire à trouver", mcs: "MonClubSportif", perso: "Activités de JP (hors académie)" };
/** Activités de JP hors académie (Saint-Gabriel, FC Elevate…), aussi copiées dans MonClubSportif pour son calendrier. */
const PERSO = /st-?gabriel|saint-gabriel|fc elevate|cadet/i;

/** « Qu'est-ce qui se passe ce mois-ci ? » : chaque jour du mois avec ses pratiques (prête, à préparer, passée) et
 *  les matchs et activités de MonClubSportif qui ne sont pas déjà dans l'horaire du site. */
export default async function PracticeCalendarPage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  await requireAdmin();
  const today = todayIso();
  const raw = (await searchParams).mois;
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const [practices, mcs] = await Promise.all([listPractices({ from: first, to: last }).catch(() => [] as Practice[]), getEventsBetween(first, last).catch(() => [])]);

  const items = new Map<string, CalItem[]>();
  const push = (d: string, it: CalItem) => items.set(d, [...(items.get(d) ?? []), it]);
  for (const p of practices.filter((x) => !x.organization)) {
    const past = p.date < today;
    push(p.date, {
      key: p.key,
      time: p.start,
      label: p.group.replace(/^Filles /, ""),
      kind: past ? "passee" : p.readiness === "prete" ? "prete" : "a-preparer",
      href: past ? "/admin/coaching/historique" : p.activityId ? `/admin/entraineurs/activites/${p.activityId}` : "/admin/pratiques"
    });
  }
  for (const p of practices.filter((x) => x.organization)) {
    push(p.date, { key: p.key, time: p.start, label: `${p.organization} · ${p.group}`, kind: "perso", href: p.activityId ? `/admin/entraineurs/activites/${p.activityId}` : null });
  }
  const persoAt = (d: string, t: string | null) => practices.some((p) => p.organization && p.date === d && Math.abs(toMin(p.start) - toMin(t)) <= 15);
  for (const e of mcs) {
    if (PERSO.test(e.title) && persoAt(e.date, e.start)) continue;
    const sameAsSite = practices.some((p) => p.date === e.date && Math.abs(toMin(p.start) - toMin(e.start)) <= 15) && e.type !== "Match";
    if (sameAsSite) continue;
    const isMatch = e.type === "Match" || e.type === "Tournoi";
    push(e.date, {
      key: `${e.team_id}-${e.key}`,
      time: e.start ?? "",
      label: isMatch ? `${e.team}${e.opponent ? ` c. ${e.opponent}` : ""}` : `${e.team} · ${e.title.replace(/^(Event|Événement|Other|Autre)\s+/i, "").replace(e.team, "").replace(/^\s*-\s*/, "")}`,
      kind: PERSO.test(e.title) ? "perso" : isMatch ? (needsOpponent(e) ? "match-a-trouver" : "match") : "mcs",
      href: "/admin/monclubsportif/equipes"
    });
  }
  for (const list of items.values()) list.sort((a, b) => a.time.localeCompare(b.time));

  const gridStart = addDays(first, -dow(first));
  const cells: string[] = [];
  for (let d = gridStart; d <= last || dow(d) !== 0; d = addDays(d, 1)) cells.push(d);
  const total = [...items.values()].flat();

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1180 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p className="mda-eyebrow">Espace coaching · le mois en un coup d&apos;œil</p>
            <h1 className="mda-h1" style={{ textTransform: "capitalize" }}>{MONTHS[m - 1]} {y}</h1>
            <p className="mda-lead" style={{ margin: 0 }}>
              {total.filter((i) => i.kind !== "match" && i.kind !== "match-a-trouver").length} pratiques et activités · {total.filter((i) => i.kind === "match" || i.kind === "match-a-trouver").length} matchs ({total.filter((i) => i.kind === "match-a-trouver").length} sans adversaire)
            </p>
          </div>
          <nav style={{ display: "flex", gap: 6 }}>
            <Link href={`/admin/coaching/calendrier?mois=${prev}`} className="admin-btn-ghost" style={{ textDecoration: "none" }}>← {MONTHS[(m + 10) % 12]}</Link>
            {month !== today.slice(0, 7) && <Link href="/admin/coaching/calendrier" className="admin-btn-ghost" style={{ textDecoration: "none" }}>Ce mois-ci</Link>}
            <Link href={`/admin/coaching/calendrier?mois=${next}`} className="admin-btn-ghost" style={{ textDecoration: "none" }}>{MONTHS[m % 12]} →</Link>
          </nav>
        </header>

        <p className="cal-legend">
          {(Object.keys(KIND) as CalItem["kind"][]).map((k) => <span key={k} data-kind={k}><i /> {KIND[k]}</span>)}
        </p>

        <div className="cal-grid" role="grid" aria-label={`Calendrier de ${MONTHS[m - 1]} ${y}`}>
          {DAYS.map((d) => <div key={d} className="cal-head" role="columnheader">{d}</div>)}
          {cells.map((d) => {
            const list = items.get(d) ?? [];
            const out = d.slice(0, 7) !== month;
            return (
              <div key={d} className="cal-day" data-out={out || undefined} data-today={d === today || undefined} data-empty={list.length === 0 || undefined} role="gridcell">
                <p className="cal-num"><span className="cal-dow">{DAYS[dow(d)]} </span>{Number(d.slice(8))}</p>
                {list.map((it) => {
                  const body = (
                    <>
                      <b>{it.time}</b> {it.label}
                    </>
                  );
                  return it.href ? (
                    <Link key={it.key} href={it.href} className="cal-item" data-kind={it.kind} title={KIND[it.kind]}>{body}</Link>
                  ) : (
                    <span key={it.key} className="cal-item" data-kind={it.kind}>{body}</span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
