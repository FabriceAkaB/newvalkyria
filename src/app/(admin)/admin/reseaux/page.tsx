import { Bar, shortDay } from "@/components/mandalart/ui";
import { AdSpendEntry, CompareTabs, FollowerSpark, PostList, QuickEntry, ReseauxStyles, WeeklyChart } from "@/components/marketing-posts-admin";
import { requireAdmin } from "@/lib/admin-auth";
import {
  THEMES,
  WEEKLY_IDEAL,
  WEEKLY_TARGET,
  addDays,
  aggregate,
  bestContent,
  compareBy,
  contentGroups,
  fmt1,
  fmtInt,
  fmtMoney,
  fmtPct,
  fmtSigned,
  followersByNetwork,
  formatLabel,
  growthSinceLabel,
  localDay,
  networkLabel,
  pacePerWeek,
  paidVsOrganic,
  plural,
  postLabel,
  postsSince,
  safeHref,
  themeKey,
  themeLabel,
  topPosts,
  totalFollowers,
  weeklyRhythm,
  type Agg,
  type ChannelStatRow,
  type MarketingPost
} from "@/lib/marketing-posts-core";
import { listChannelStats, listPosts } from "@/lib/marketing-posts";

export const metadata = { title: "Réseaux sociaux — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

const toneOf = (n: number | null) => (n === null || n === 0 ? undefined : n > 0 ? "good" : "bad");
const toneColor = { good: "var(--adm-good)", bad: "var(--adm-bad)", warn: "var(--adm-warn)" } as const;

/** « Est-ce que nos réseaux grandissent, et quel contenu amène des familles ? » */
export default async function ReseauxPage() {
  await requireAdmin({ roles: ["admin"] });
  const today = localDay(new Date());
  const [posts, stats] = await Promise.all([listPosts(), listChannelStats()]);

  const nets = followersByNetwork(stats);
  const total = totalFollowers(nets);
  const pace = pacePerWeek(posts, today, true);
  const bars = weeklyRhythm(posts, today, 12);
  const last30 = postsSince(posts, addDays(today, -29), today);
  const agg30 = aggregate(last30);
  const contents30 = contentGroups(last30).length;
  const best = bestContent(posts);
  const topViews = topPosts(posts, "views", 5);
  const topLeads = topPosts(posts, "leads", 5);
  const { organic, paid } = paidVsOrganic(posts);
  const adRows = stats.filter((r) => (r.channel === "pub_meta" || r.channel === "pub_google") && r.measured_at >= addDays(today, -89)).reverse();
  const extraThemes = [...new Map(posts.filter((p) => p.theme && !THEMES.some((t) => themeKey(t) === themeKey(p.theme))).map((p) => [themeKey(p.theme), themeLabel(p.theme)])).values()];
  const hasAnything = posts.length > 0 || total.current !== null;

  // Le titre répond à la question : est-ce que ça grandit ?
  const since = growthSinceLabel(total.since, total.lastReading);
  const h1 =
    total.delta !== null
      ? total.delta > 0
        ? `Vos réseaux grandissent : ${fmtSigned(total.delta)} abonnés ${since}`
        : total.delta === 0
          ? `Vos réseaux stagnent : aucun nouvel abonné ${since}`
          : `Vos réseaux reculent : ${fmtSigned(total.delta)} abonnés ${since}`
      : total.current !== null
        ? `${fmtInt(total.current)} abonnés : un 2e relevé montrera la croissance`
        : posts.length
          ? "Entrez vos abonnés pour voir si vos réseaux grandissent"
          : "Entrez vos abonnés d'aujourd'hui : c'est le point de départ";
  // … et quel contenu amène des familles ?
  const lead = !posts.length
    ? "Après chaque publication, ajoutez-la ici (réseau, type, thème, organique ou payant). 7 jours après, entrez ses vues et les essais qu'elle a amenés : la page dira quel contenu amène des familles."
    : best?.kind === "essais"
      ? `Le contenu qui amène le plus de familles : ${best.agg.label}, avec ${fmt1(best.agg.leadsPer1000)} ${plural(best.agg.leadsPer1000 ?? 0, "essai")} pour 1 000 vues (${best.agg.posts} ${plural(best.agg.posts, "publication")}).`
      : best?.kind === "vues"
        ? `Aucun essai n'est encore attribué à une publication. Le plus regardé : ${best.agg.label} (${fmtInt(best.agg.avgViews)} vues en moyenne). Demandez aux familles quelle vidéo les a amenées et notez-le sur la publication.`
        : "Entrez les vues de vos publications 7 jours après : la page comparera les thèmes et les types de contenu.";

  const paceTone = pace.value === null ? undefined : pace.value >= WEEKLY_TARGET ? "good" : pace.value >= WEEKLY_TARGET / 2 ? "warn" : "bad";

  return (
    <div className="admin-content">
      <div className="admin-section mda">
        <ReseauxStyles />
        <header>
          <p className="mda-eyebrow">
            Réseaux sociaux · {contentGroups(posts).length} {plural(contentGroups(posts).length, "publication suivie", "publications suivies")} ·{" "}
            {total.lastReading ? `abonnés relevés le ${shortDay(total.lastReading)}` : "aucun relevé d'abonnés"}
          </p>
          <h1 className="mda-h1">{h1}</h1>
          <p className="mda-lead">{lead}</p>
        </header>

        <QuickEntry
          today={today}
          followers={nets.map((n) => ({ network: n.network, label: n.label, current: n.growth.current, at: n.growth.at }))}
          extraThemes={extraThemes}
          startWith={hasAnything ? null : "followers"}
        />

        <section className="mda-cols-4">
          <div className="mda-card">
            <p className="mda-num">{fmtInt(total.current)}</p>
            <p className="mda-label">
              Abonnés, tous réseaux
              {total.delta !== null ? (
                <span style={{ display: "block", color: toneOf(total.delta) ? toneColor[toneOf(total.delta)!] : undefined }}>
                  {fmtSigned(total.delta)} {since}
                </span>
              ) : (
                <span className="mda-muted" style={{ display: "block" }}>
                  Croissance au 2e relevé
                </span>
              )}
            </p>
          </div>
          <div className="mda-card" style={paceTone ? { boxShadow: `inset 3px 0 0 ${toneColor[paceTone]}` } : undefined}>
            <p className="mda-num">{fmt1(pace.value ?? 0)}</p>
            <p className="mda-label">Vidéos par semaine ({pace.sinceFirst ? `depuis le ${shortDay(pace.from)}` : "moyenne des 4 dernières"})</p>
            <div style={{ marginTop: 10 }}>
              <Bar thin value={(pace.value ?? 0) / WEEKLY_IDEAL} marker={WEEKLY_TARGET / WEEKLY_IDEAL} color={paceTone ? toneColor[paceTone] : undefined} />
            </div>
            <p className="mda-label mda-muted">
              Cible {WEEKLY_TARGET}, idéal {WEEKLY_IDEAL}
            </p>
          </div>
          <div className="mda-card">
            <p className="mda-num">{fmtInt(agg30.views)}</p>
            <p className="mda-label">
              Vues en 30 jours
              <span className="mda-muted" style={{ display: "block" }}>
                {contents30} {plural(contents30, "publication")} · engagement {fmtPct(agg30.engagementRate)}
              </span>
            </p>
          </div>
          <div className="mda-card">
            <p className="mda-num">{agg30.leads}</p>
            <p className="mda-label">
              {plural(agg30.leads, "Essai attribué", "Essais attribués")} en 30 jours
              <span className="mda-muted" style={{ display: "block" }}>
                {agg30.registrations} {plural(agg30.registrations, "inscription")} · {fmt1(agg30.leadsPer1000)} pour 1 000 vues
              </span>
            </p>
          </div>
        </section>

        <section style={{ display: "grid", gap: 12 }}>
          <div>
            <h2 className="mda-h2">Abonnés par réseau</h2>
            <p className="mda-sub" style={{ margin: 0 }}>
              Un relevé aux 2 semaines suffit. Le gain se compte depuis le relevé d’il y a environ 30 jours. Touchez une courbe pour lire une date.
            </p>
          </div>
          <div className="mda-cols-4">
            {nets.map((n) => (
              <div key={n.network} className="mda-card" style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <p className="mda-label" style={{ marginTop: 0, fontWeight: 600, color: "var(--adm-text)" }}>
                    {n.label}
                  </p>
                  {n.growth.delta !== null ? (
                    <span className="mda-pill" data-tone={toneOf(n.growth.delta)}>
                      {fmtSigned(n.growth.delta)}
                    </span>
                  ) : null}
                </div>
                <p className="mda-num" style={{ marginTop: 6 }}>
                  {fmtInt(n.growth.current)}
                </p>
                <FollowerSpark points={n.points} label={n.label} />
                <p className="mda-label mda-muted" style={{ marginTop: "auto", paddingTop: 8 }}>
                  {n.growth.at
                    ? n.growth.delta !== null
                      ? `${fmtSigned(n.growth.delta)} ${growthSinceLabel(n.growth.since, n.growth.at)} · relevé le ${shortDay(n.growth.at)}`
                      : `Relevé le ${shortDay(n.growth.at)}`
                    : "Aucun relevé"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mda-card">
          <h2 className="mda-h2">Vidéos par semaine</h2>
          <p className="mda-sub">
            Une vidéo publiée sur Instagram et Facebook compte une fois. Le chiffre au-dessus de chaque barre = les vidéos de la semaine.
            {pace.value !== null ? ` ${pace.sinceFirst ? "Moyenne depuis la première publication" : "Moyenne des 4 dernières semaines"} : ${fmt1(pace.value)}.` : ""}
          </p>
          <WeeklyChart bars={bars} />
          {!posts.length ? (
            <p className="rsx-hint" style={{ marginTop: 12 }}>
              Aucune publication entrée : la première barre montera dès l’ajout d’une publication.
            </p>
          ) : null}
        </section>

        <section className="mda-cols-2">
          <TopList
            title="Les plus vues"
            empty="Entrez les vues de vos publications 7 jours après pour voir les plus regardées."
            posts={topViews}
            metric={(p) => ({ value: fmtInt(p.views), unit: "vues" })}
          />
          <TopList
            title="Celles qui amènent des essais"
            empty="Aucun essai attribué encore. Quand une famille dit « j'ai vu votre vidéo », notez-le sur la publication (Essais / contacts)."
            posts={topLeads}
            metric={(p) => ({ value: String(p.leads ?? 0), unit: `${plural(p.leads ?? 0, "essai")}${p.registrations ? ` · ${p.registrations} ${plural(p.registrations, "inscription")}` : ""}` })}
          />
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <div>
              <h2 className="mda-h2">Quel contenu marche le mieux</h2>
              <p className="mda-sub" style={{ margin: 0 }}>
                Classé par essais pour 1 000 vues : c’est ce qui amène des familles, pas seulement des vues.
              </p>
            </div>
          </div>
          <CompareTabs byTheme={compareBy(posts, "theme")} byFormat={compareBy(posts, "format")} byNetwork={compareBy(posts, "network")} />
        </section>

        <PaidSection organic={organic} paid={paid} adRows={adRows} today={today} />

        <section className="mda-card-flush" id="publications">
          <div className="mda-card-head">
            <div>
              <h2 className="mda-h2">Toutes les publications</h2>
              <p className="mda-sub" style={{ margin: 0 }}>
                7 jours après une publication, relevez ses vues, ses essais et ses inscriptions : c’est ce qui alimente les comparaisons.
              </p>
            </div>
          </div>
          <PostList posts={posts} today={today} extraThemes={extraThemes} />
        </section>
      </div>
    </div>
  );
}

function TopList({ title, empty, posts, metric }: { title: string; empty: string; posts: MarketingPost[]; metric: (p: MarketingPost) => { value: string; unit: string } }) {
  return (
    <div className="mda-card-flush">
      <div className="mda-card-head">
        <h2 className="mda-h2" style={{ margin: 0 }}>
          {title}
        </h2>
      </div>
      {posts.length === 0 ? (
        <p className="rsx-empty">{empty}</p>
      ) : (
        <ol className="rsx-top">
          {posts.map((p) => {
            const m = metric(p);
            return (
              <li key={p.id}>
                <div style={{ minWidth: 0 }}>
                  <p className="mda-task-title" style={{ fontWeight: 600 }}>
                    {safeHref(p.url) ? (
                      <a href={safeHref(p.url)!} target="_blank" rel="noopener noreferrer" className="rsx-link">
                        {postLabel(p)} <span aria-hidden>↗</span>
                      </a>
                    ) : (
                      postLabel(p)
                    )}
                  </p>
                  <div className="mda-task-meta">
                    <span>{networkLabel(p.network)}</span>
                    <span>{formatLabel(p.format)}</span>
                    <span>{shortDay(p.posted_on)}</span>
                    {p.paid ? (
                      <span className="mda-pill" data-tone="accent">
                        Payant
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="rsx-top-num">
                  {m.value}
                  <small>{m.unit}</small>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function PaidSection({ organic, paid, adRows, today }: { organic: Agg; paid: Agg; adRows: ChannelStatRow[]; today: string }) {
  const verdict =
    paid.posts === 0
      ? "Aucune publication payante pour l’instant. Quand vous boostez une publication, choisissez « Payant » et entrez le montant : le coût par essai et par inscription se calcule seul."
      : paid.costPerRegistrationCents !== null
        ? `La pub coûte ${fmtMoney(paid.costPerLeadCents)} par essai et ${fmtMoney(paid.costPerRegistrationCents)} par inscription.`
        : paid.costPerLeadCents !== null
          ? `La pub coûte ${fmtMoney(paid.costPerLeadCents)} par essai ; aucune inscription ne lui est encore attribuée.`
          : paid.spendCents > 0
            ? `${fmtMoney(paid.spendCents)} dépensés en pub, sans essai attribué pour l’instant.`
            : "Entrez le montant dépensé sur vos publications payantes pour voir le coût par essai.";
  const rows: { label: string; o: string; p: string; strong?: boolean }[] = [
    { label: "Publications", o: String(organic.posts), p: String(paid.posts) },
    { label: "Vues", o: fmtInt(organic.views), p: fmtInt(paid.views) },
    { label: "Vues moyennes", o: fmtInt(organic.avgViews), p: fmtInt(paid.avgViews) },
    { label: "Engagement", o: fmtPct(organic.engagementRate), p: fmtPct(paid.engagementRate) },
    { label: "Essais", o: String(organic.leads), p: String(paid.leads) },
    { label: "Inscriptions", o: String(organic.registrations), p: String(paid.registrations) },
    { label: "Essais pour 1 000 vues", o: fmt1(organic.leadsPer1000), p: fmt1(paid.leadsPer1000) },
    { label: "Dépensé", o: "0 $", p: fmtMoney(paid.spendCents) },
    { label: "Coût par essai", o: "—", p: fmtMoney(paid.costPerLeadCents), strong: true },
    { label: "Coût par inscription", o: "—", p: fmtMoney(paid.costPerRegistrationCents), strong: true }
  ];
  const adSpend = adRows.reduce((s, r) => s + (r.spend_cents ?? 0), 0);
  const adLeads = adRows.reduce((s, r) => s + (r.leads ?? 0), 0);
  return (
    <section className="mda-card-flush">
      <div className="mda-card-head">
        <div>
          <h2 className="mda-h2">Organique ou payant</h2>
          <p className="mda-sub" style={{ margin: 0 }}>
            {verdict}
          </p>
        </div>
      </div>
      <div className="mda-scroll">
        <table className="mda-table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 20 }}>
                <span className="sr-only">Mesure</span>
              </th>
              <th className="r">Organique</th>
              <th className="r" style={{ paddingRight: 20 }}>
                Payant
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td style={{ paddingLeft: 20, color: "var(--adm-text-2)" }}>{r.label}</td>
                <td className="r">{r.o}</td>
                <td className="r" style={{ paddingRight: 20, fontWeight: r.strong ? 600 : undefined }}>
                  {r.p}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rsx-campaigns">
        <div className="rsx-row">
          <div style={{ minWidth: 0 }}>
            <h3 className="rsx-h3">Campagnes de pub (90 derniers jours)</h3>
            <p className="rsx-hint">
              {adRows.length
                ? `${fmtMoney(adSpend)} dépensés, ${adLeads} ${plural(adLeads, "contact")}${adSpend > 0 && adLeads > 0 ? `, soit ${fmtMoney(adSpend / adLeads)} par contact` : ""}. Pas additionnées aux publications ci-dessus.`
                : "Une campagne qui n’est pas une publication boostée (Gestionnaire de publicités Meta, Google Ads) : entrez son montant et ses contacts à la fin de la campagne."}
            </p>
          </div>
          <AdSpendEntry today={today} />
        </div>
        {adRows.length ? (
          <ul className="rsx-top" style={{ marginTop: 8 }}>
            {adRows.slice(0, 6).map((r) => (
              <li key={r.id} style={{ padding: "10px 0" }}>
                <div style={{ minWidth: 0 }}>
                  <p className="mda-task-title">{r.channel === "pub_meta" ? "Pub Facebook / Instagram" : "Pub Google"}</p>
                  <div className="mda-task-meta">
                    <span>{shortDay(r.measured_at)}</span>
                    {r.note ? <span>{r.note}</span> : null}
                  </div>
                </div>
                <span className="rsx-top-num">
                  {fmtMoney(r.spend_cents)}
                  <small>
                    {r.leads ?? 0} {plural(r.leads ?? 0, "contact")}
                    {r.spend_cents && r.leads ? ` · ${fmtMoney(r.spend_cents / r.leads)} chacun` : ""}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
