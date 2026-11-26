import { CalendarClock, PiggyBank, TrendingUp, Wallet } from "lucide-react";

import type { PayBank } from "@/lib/coach-pay-core";

/** La banque d'heures d'un éducateur (JP, 25 nov. 2026) : la paie en cours, la prochaine, le total accumulé et ce qui
 *  est à venir d'après les pratiques assignées. Portail « Ma paie » (un éducateur) et admin Paie (tableau). */

const money = (c: number) => `${(c / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const hrs = (h: number) => `${h.toLocaleString("fr-CA", { maximumFractionDigits: 2 })} h`;
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const short = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "short", timeZone: "UTC" });

function Tile({ icon, label, hours, cents, detail, children }: { icon: React.ReactNode; label: string; hours: number; cents: number; detail: string; children?: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--adm-line)", borderRadius: 12, padding: "14px 16px", background: "var(--adm-surface)", display: "grid", gap: 6, minWidth: 0 }}>
      <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 600, color: "var(--adm-text-2)" }}>
        {icon}
        {label}
      </p>
      <p style={{ margin: 0, fontSize: "1.45rem", fontWeight: 700, color: "var(--adm-text)", fontVariantNumeric: "tabular-nums", lineHeight: 1.15 }}>
        {hrs(hours)} <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--adm-text-2)" }}>· {money(cents)}</span>
      </p>
      {children}
      <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--adm-text-3)" }}>{detail}</p>
    </div>
  );
}

function Bar({ earned, total }: { earned: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((earned / total) * 100)) : 0;
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Part déjà comptée" style={{ height: 6, borderRadius: 999, background: "var(--adm-surface-3)", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(pct ? 3 : 0, pct)}%`, height: "100%", background: "var(--adm-good)" }} />
    </div>
  );
}

/** Portail : la banque d'heures d'un éducateur, en 4 tuiles. */
export function PayBankTiles({ bank }: { bank: PayBank }) {
  const c = bank.current;
  const n = bank.next;
  const iconStyle = { width: 15, height: 15, color: "var(--adm-accent-strong)" } as const;
  return (
    <section aria-label="Ma banque d'heures" style={{ marginTop: 20 }}>
      <p className="coach-card__label" style={{ margin: "0 0 8px" }}>Ma banque d&apos;heures</p>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Tile icon={<Wallet style={iconStyle} aria-hidden />} label={`Paie du ${day(c.payDate)}`} hours={c.totalHours} cents={c.totalCents} detail={`${hrs(c.earnedHours)} déjà comptées${c.heldHours ? ` · ${hrs(c.heldHours)} en attente` : ""}${c.plannedHours ? ` · ${hrs(c.plannedHours)} à venir` : ""}`}>
          <Bar earned={c.earnedCents} total={c.totalCents} />
        </Tile>
        <Tile icon={<CalendarClock style={iconStyle} aria-hidden />} label={`Prochaine paie, ${day(n.payDate)}`} hours={n.totalHours} cents={n.totalCents} detail={`Du ${short(n.from)} au ${short(n.to)}${n.plannedHours ? ` · ${hrs(n.plannedHours)} déjà assignées` : " · rien d'assigné encore"}`}>
          <Bar earned={n.earnedCents} total={n.totalCents} />
        </Tile>
        <Tile icon={<PiggyBank style={iconStyle} aria-hidden />} label="Accumulé depuis le début" hours={bank.accumulated.hours} cents={bank.accumulated.cents} detail={bank.paid.cents ? `${money(bank.paid.cents)} déjà versés · ${money(bank.owed.cents)} à recevoir` : "Toutes tes heures comptées pour la paie"} />
        <Tile icon={<TrendingUp style={iconStyle} aria-hidden />} label="À venir" hours={bank.upcoming.hours} cents={bank.upcoming.cents} detail="Pratiques assignées et heures en attente (présence ou rapport à faire)" />
      </div>
    </section>
  );
}

/** Admin : la banque d'heures de chaque éducateur, en tableau (montants : admin seulement). */
export function PayBankTable({ banks }: { banks: { coachId: string; name: string; bank: PayBank }[] }) {
  if (!banks.length) return null;
  const c = banks[0].bank.current;
  const n = banks[0].bank.next;
  const cell = (h: number, cents: number, sub?: string) => (
    <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      {hrs(h)} · {money(cents)}
      {sub ? <span style={{ display: "block", fontSize: "0.72rem", color: "var(--adm-text-3)" }}>{sub}</span> : null}
    </td>
  );
  const sum = (f: (b: PayBank) => number) => banks.reduce((s, b) => s + f(b.bank), 0);
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p style={{ margin: "0 0 0.25rem", fontWeight: 600, fontSize: "1rem", color: "var(--adm-text)" }}>Banque d&apos;heures</p>
      <p style={{ margin: "0 0 0.75rem", fontSize: "0.82rem", color: "var(--adm-text-3)" }}>
        Paie du {day(c.payDate)} (du {short(c.from)} au {short(c.to)}) et la suivante, le {day(n.payDate)}. Compté = présence confirmée ; en attente = présence ou rapport à faire ; à venir = pratiques assignées. Les séances où l&apos;éducateur n&apos;était pas là sont enlevées.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Éducateur</th>
              <th>Paie du {short(c.payDate)}</th>
              <th>Prochaine paie ({short(n.payDate)})</th>
              <th>Accumulé, pas versé</th>
              <th>À venir</th>
            </tr>
          </thead>
          <tbody>
            {banks.map(({ coachId, name, bank: b }) => (
              <tr key={coachId}>
                <td>{name}</td>
                {cell(b.current.totalHours, b.current.totalCents, `${hrs(b.current.earnedHours)} compté${b.current.heldHours ? ` · ${hrs(b.current.heldHours)} en attente` : ""}`)}
                {cell(b.next.totalHours, b.next.totalCents, b.next.plannedHours ? `${hrs(b.next.plannedHours)} assignées` : undefined)}
                {cell(b.owed.hours, b.owed.cents, b.paid.cents ? `${money(b.paid.cents)} déjà versés` : undefined)}
                {cell(b.upcoming.hours, b.upcoming.cents)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td>Total</td>
              {cell(sum((b) => b.current.totalHours), sum((b) => b.current.totalCents))}
              {cell(sum((b) => b.next.totalHours), sum((b) => b.next.totalCents))}
              {cell(sum((b) => b.owed.hours), sum((b) => b.owed.cents))}
              {cell(sum((b) => b.upcoming.hours), sum((b) => b.upcoming.cents))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
