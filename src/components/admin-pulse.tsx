import { ClipboardCheck, ShoppingBag, UserPlus, Users } from "lucide-react";
import Link from "next/link";

import type { PulseEvent, PulseStat } from "@/lib/admin-pulse";

/** Indicateurs et activité récente en haut de « Aujourd'hui » (charte docs/DESIGN_ADMIN.md). */

const ICON = { inscription: UserPlus, programme: Users, commande: ShoppingBag, evaluation: ClipboardCheck } as const;

function when(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const diff = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 86_400_000);
  if (diff === 0) return `Aujourd'hui, ${d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", timeZone: "America/Toronto" })}`;
  if (diff === 1) return "Hier";
  return d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "short", timeZone: "America/Toronto" });
}

export function PulseStats({ stats }: { stats: PulseStat[] }) {
  return (
    <div className="adm-kpis">
      {stats.map((s) => (
        <Link key={s.label} href={s.href} className="adm-kpi">
          <span className="adm-kpi__label">{s.label}</span>
          <strong className="adm-kpi__value">{s.value}</strong>
          <span className="adm-kpi__hint">{s.hint}</span>
        </Link>
      ))}
    </div>
  );
}

export function PulseFeed({ events }: { events: PulseEvent[] }) {
  return (
    <section className="adm-feed">
      <h2 className="adm-feed__title">Activité récente</h2>
      {events.length === 0 ? (
        <p className="adm-feed__empty">Rien de nouveau depuis 7 jours.</p>
      ) : (
        <ul>
          {events.map((e, i) => {
            const Icon = ICON[e.kind];
            return (
              <li key={i}>
                <Link href={e.href}>
                  <span className="adm-feed__icon" data-kind={e.kind} aria-hidden><Icon size={15} strokeWidth={1.75} /></span>
                  <span className="adm-feed__body">
                    <strong>{e.title}</strong>
                    <span>{e.detail}</span>
                  </span>
                  <span className="adm-feed__when">{when(e.at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
