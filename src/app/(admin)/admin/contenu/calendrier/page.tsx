import Link from "next/link";

import { Plan90SeedButton } from "@/components/content-admin";
import { ShootForm } from "@/components/jp-shoots";
import { requireAdmin } from "@/lib/admin-auth";
import { addDaysIso, ANGLES, calendarWeeks, filterAccount, NETWORK_LINKS, POST_KINDS, postKindLabel, weekStart, type CalendarAccount, type CalendarItem } from "@/lib/content-core";
import { shortDate } from "@/lib/content-format";
import { buildPlan90, FAMILIES, familyOf, FUNNELS, funnelLabel, HOOK_BANK, hooksOf, MIN_TESTS_PER_WEEK, plan90ForSeed, PLAN90_END, PLAN90_START, POSTS_PER_DAY, POSTS_PER_WEEK, weekBalance, WINNER_REUSES_PER_WEEK, WINNER_RULE } from "@/lib/content-plan-90";
import { getCalendarItems, plan90Count } from "@/lib/content-repo";
import { fmtInt, networkLabel } from "@/lib/marketing-posts-core";
import { CTA } from "@/lib/shooting-guide-core";

export const metadata = { title: "Calendrier de publication, Création de contenu", robots: "noindex" };
export const dynamic = "force-dynamic";

const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
const KIND_COLOR: Record<string, string> = { organique: "#5fd38a", essai: "#f0c878", pub: "#ff9f6e" };
const FUNNEL_TONE: Record<string, string> = { haut: "info", milieu: "accent", bas: "good" };
const ACCOUNTS: { id: CalendarAccount; label: string }[] = [
  { id: "newvalkyria", label: "New Valkyria" },
  { id: "jpcoach", label: "JP Coach" },
  { id: "tous", label: "Les deux" }
];

function Item({ it }: { it: CalendarItem }) {
  const fam = familyOf(it.family);
  return (
    <details
      style={{ fontSize: "0.76rem", lineHeight: 1.35, padding: "5px 7px", borderRadius: 6, borderLeft: `3px solid ${KIND_COLOR[it.postKind] ?? KIND_COLOR.organique}`, background: it.kind === "prevu" ? "var(--adm-surface)" : "transparent", opacity: it.kind === "publie" ? 0.7 : 1, color: "var(--adm-text)" }}
    >
      <summary style={{ cursor: "pointer", listStyle: "none" }}>
        {it.funnel ? (
          <span className="mda-pill" data-tone={it.postKind === "essai" ? "warn" : FUNNEL_TONE[it.funnel]} style={{ fontSize: "0.66rem", padding: "1px 6px", marginRight: 4 }}>
            {it.postKind === "essai" ? `Essai · ${funnelLabel(it.funnel)}` : funnelLabel(it.funnel)}
          </span>
        ) : null}
        {it.kind === "publie" ? "✓ " : ""}
        {it.account === "jpcoach" ? <strong style={{ color: "var(--adm-accent)" }}>JP Coach · </strong> : null}
        {it.title}
        {it.kind === "publie" && it.views ? <span style={{ color: "var(--adm-text-3)" }}> · {fmtInt(it.views)} vues</span> : null}
      </summary>
      <div style={{ display: "grid", gap: 4, marginTop: 6, color: "var(--adm-text-2)" }}>
        {it.hook ? (
          <span>
            <strong style={{ color: "var(--adm-text)" }}>Crochet :</strong> « {it.hook} »
          </span>
        ) : null}
        {it.message ? <span style={{ whiteSpace: "pre-line" }}>{it.message}</span> : null}
        <span style={{ color: "var(--adm-text-3)" }}>
          {[postKindLabel(it.postKind), it.format, fam?.label, it.angle, it.networks.map(networkLabel).join(", ")].filter(Boolean).join(" · ")}
        </span>
      </div>
    </details>
  );
}

/** Espace Contenu › Calendrier de publication (P3.2.06) et calendrier de contenu de l'académie sur 90 jours
 *  (P3.2.25) : ce qui est prévu (tournages avec un jour de publication) et ce qui est publié (Réseaux sociaux),
 *  avec sa place dans l'entonnoir, son crochet et son appel à l'action. L'académie par défaut ; JP Coach à part. */
export default async function CalendrierPage({ searchParams }: { searchParams: Promise<{ depuis?: string; semaines?: string; compte?: string }> }) {
  const role = await requireAdmin();
  const sp = await searchParams;
  const today = todayIso();
  const account: CalendarAccount = ACCOUNTS.some((a) => a.id === sp.compte) ? (sp.compte as CalendarAccount) : "newvalkyria";
  const nWeeks = sp.semaines === "13" ? 14 : 4;
  const from = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(sp.depuis ?? "") ? sp.depuis! : addDaysIso(today, -7));
  const [items, inCalendar] = await Promise.all([getCalendarItems(from, addDaysIso(from, nWeeks * 7 - 1)), plan90Count()]);
  const weeks = calendarWeeks(filterAccount(items, account), from, nWeeks);
  const plan = buildPlan90();
  const planTests = plan.filter((p) => p.postKind === "essai").length;
  const planTotal = plan90ForSeed().length;
  const missing = Math.max(0, planTotal - inCalendar);
  const q = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(sp.depuis ? { depuis: sp.depuis } : {}), ...(sp.semaines ? { semaines: sp.semaines } : {}), ...(account !== "newvalkyria" ? { compte: account } : {}), ...extra });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const str = p.toString();
    return `/admin/contenu/calendrier${str ? `?${str}` : ""}`;
  };

  return (
    <div className="admin-content">
      {/* 7 colonnes sur ordinateur, une seule sur téléphone (lisible au doigt). */}
      <style>{".cal-week-grid{display:grid;gap:6px;grid-template-columns:repeat(7,minmax(0,1fr))}@media (max-width:820px){.cal-week-grid{grid-template-columns:1fr}}"}</style>
      <div className="admin-section mda" style={{ maxWidth: 1200 }}>
        <header>
          <p className="mda-eyebrow">Tenu chaque semaine, sans trou</p>
          <h1 className="mda-h1">Calendrier de publication</h1>
          <p className="mda-lead">
            Ce qui sort, quel jour, sur quel réseau, et pourquoi. Chaque publication a sa place dans l&apos;entonnoir, son crochet et le même appel à l&apos;action : « {CTA} ».
            Un reel d&apos;essai teste un crochet avant d&apos;y mettre de l&apos;argent ; une publicité se mesure en inscriptions
            {role === "admin" ? <> dans <Link href="/admin/reseaux">Réseaux sociaux</Link></> : null}.
          </p>
        </header>

        <section className="mda-card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ maxWidth: 640 }}>
              <h2 className="mda-h2" style={{ marginTop: 0 }}>Le plan des 90 jours de l&apos;académie</h2>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--adm-text-2)", lineHeight: 1.5 }}>
                Du {shortDate(PLAN90_START)} 2026 (jour 1) au {shortDate(PLAN90_END)} 2027, en volume : {POSTS_PER_DAY} publications par jour, soit {POSTS_PER_WEEK} par semaine (
                {FUNNELS.map((f) => `${f.perWeek} ${f.label.toLowerCase()}`).join(", ")}). Un tournage par jour : la même vidéo sort en 3 versions avec 3 crochets différents
                (le test de crochet, au moins {MIN_TESTS_PER_WEEK} par semaine), plus le carrousel du dimanche et une story chaque jour tirés du même tournage. Diffusion sur
                Instagram, Facebook, TikTok et YouTube Shorts.
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "0.88rem", color: "var(--adm-text)", lineHeight: 1.5 }}>
                {WINNER_RULE} Dans le calendrier, ces {WINNER_REUSES_PER_WEEK} publications s&apos;appellent « Reprise du gagnant ».
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="admin-btn-ghost" href={`/admin/contenu/calendrier?depuis=${PLAN90_START}&semaines=13${account !== "newvalkyria" ? `&compte=${account}` : ""}`}>
                Voir les 13 semaines
              </Link>
              <a className="admin-btn-ghost" href="#crochets">
                Banque de {HOOK_BANK.length} crochets
              </a>
            </div>
          </div>
          <div className="admin-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginTop: 14 }}>
            <div className="admin-stat-card">
              <p className="admin-stat-label">Publications</p>
              <p className="admin-stat-value">{plan.length}</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-label">Tests de crochets</p>
              <p className="admin-stat-value">{planTests}</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-label">Crochets dans la banque</p>
              <p className="admin-stat-value">{HOOK_BANK.length}</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-label">Dans le calendrier</p>
              <p className="admin-stat-value" style={{ color: missing ? "var(--adm-warn)" : "var(--adm-good)" }}>
                {Math.min(inCalendar, planTotal)}
                <span style={{ fontSize: "0.6em", color: "var(--adm-text-3)" }}> / {planTotal}</span>
              </p>
            </div>
          </div>
          {missing ? (
            <div style={{ marginTop: 12 }}>
              <Plan90SeedButton missing={missing} />
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", marginTop: 14 }}>
            {FAMILIES.map((f) => (
              <div key={f.id} style={{ border: "1px solid var(--adm-line)", borderRadius: 10, padding: "8px 10px", fontSize: "0.8rem" }}>
                <strong style={{ color: "var(--adm-text)" }}>{f.label}</strong>
                <span style={{ color: "var(--adm-text-3)" }}> · {f.funnels.map(funnelLabel).join(", ").toLowerCase()}</span>
                <div style={{ color: "var(--adm-text-2)", marginTop: 2 }}>{f.examples}</div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: "0.82rem", alignItems: "center" }}>
          <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }} role="group" aria-label="Compte">
            {ACCOUNTS.map((a) => (
              <Link key={a.id} href={q({ compte: a.id === "newvalkyria" ? "" : a.id })} className="mda-pill" data-tone={a.id === account ? "accent" : undefined} style={{ textDecoration: "none", padding: "5px 11px" }}>
                {a.label}
              </Link>
            ))}
          </span>
          {POST_KINDS.map((k) => (
            <span key={k.id} title={k.help} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: KIND_COLOR[k.id] }} />
              {k.label}
            </span>
          ))}
          <span style={{ color: "var(--adm-text-3)" }}>Touche une publication pour voir son crochet</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
            <Link href={q({ depuis: addDaysIso(from, -nWeeks * 7) })}>← Avant</Link>
            <Link href={q({ depuis: "", semaines: "" })}>Aujourd&apos;hui</Link>
            <Link href={q({ depuis: addDaysIso(from, nWeeks * 7) })}>Après →</Link>
          </span>
        </div>

        {weeks.map((w) => {
          const all = w.days.flatMap((d) => d.items);
          const b = weekBalance(all.filter((it) => it.funnel));
          const planned = b.haut + b.milieu + b.bas > 0;
          return (
            <section key={w.start} className="mda-card" style={{ padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "0 0 8px" }}>
                <h2 className="mda-h2" style={{ margin: 0, fontSize: "0.95rem" }}>
                  Semaine du {shortDate(w.start)}
                </h2>
                {planned ? (
                  <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {FUNNELS.map((f) => (
                      <span key={f.id} className="mda-pill" data-tone={FUNNEL_TONE[f.id]} title={f.goal}>
                        {f.label} {b[f.id]}
                      </span>
                    ))}
                    <span className="mda-pill" data-tone="warn">
                      Tests {b.essais}
                    </span>
                    {b.gagnants ? <span className="mda-pill">Gagnant {b.gagnants}</span> : null}
                  </span>
                ) : null}
              </div>
              <div className="cal-week-grid">
                {w.days.map((d) => (
                  <div key={d.date} style={{ minHeight: 70, border: "1px solid var(--adm-line)", borderRadius: 10, padding: 6, background: d.date === today ? "var(--adm-accent-soft)" : "transparent" }}>
                    <div style={{ fontSize: "0.72rem", color: d.date === today ? "var(--adm-accent)" : "var(--adm-text-3)", fontWeight: 600 }}>{shortDate(d.date)}</div>
                    <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
                      {d.items.map((it, i) => (
                        <Item key={it.id ?? i} it={it} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <section className="mda-card" id="crochets">
          <h2 className="mda-h2" style={{ marginTop: 0 }}>La banque de {HOOK_BANK.length} crochets</h2>
          <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
            Les 3 premières secondes, écrites à l&apos;écran et dites à voix haute. Chaque crochet est testé une fois, en version B ou C d&apos;une vidéo de sa famille (son numéro est
            dans le calendrier). Le gagnant de la semaine revient {WINNER_REUSES_PER_WEEK} fois la semaine suivante et sert aux publicités.
          </p>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" }}>
            {FAMILIES.map((f) => (
              <div key={f.id}>
                <h3 style={{ margin: "0 0 6px", fontSize: "0.88rem", fontWeight: 600, color: "var(--adm-text)" }}>{f.label}</h3>
                <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 4, fontSize: "0.84rem" }}>
                  {hooksOf(f.id).map((h) => (
                    <li key={h.id} style={{ display: "flex", gap: 8 }}>
                      <span style={{ color: "var(--adm-text-3)", fontVariantNumeric: "tabular-nums", minWidth: 36 }}>{h.id}</span>
                      <span>{h.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginTop: 0 }}>Ajouter au calendrier</h2>
          <p style={{ margin: "0 0 10px", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
            Chaque publication prévue est un tournage avec un jour de publication. Angles suggérés : {ANGLES.join(" · ")}.
          </p>
          <ShootForm endpoint="/api/admin/contenu" calendar />
        </section>

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginTop: 0 }}>🔌 Brancher nos réseaux (à venir)</h2>
          <p style={{ margin: "0 0 10px", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
            Pour l&apos;instant les vues et les abonnés s&apos;entrent à la main. Une fois les comptes reliés, la portée de chaque publication arrivera toute seule ici.
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Réseau</th>
                  <th>Ce qu&apos;on irait chercher</th>
                  <th>Ce qu&apos;il faut</th>
                </tr>
              </thead>
              <tbody>
                {NETWORK_LINKS.map((n) => (
                  <tr key={n.network}>
                    <td>
                      <strong>{n.network}</strong>
                    </td>
                    <td style={{ fontSize: "0.84rem" }}>{n.how}</td>
                    <td style={{ fontSize: "0.84rem" }}>{n.needs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
