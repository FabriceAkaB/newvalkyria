import Link from "next/link";

import { Bar, Pill, capitalize } from "@/components/mandalart/ui";
import { VideoCard, type VideoCardData } from "@/components/valkyria-lab-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { COMMENT_MAX, LAB_TARGET, getLabOverview, monthName, monthTitle, ofMonth, pct, shortDate, sizeLabel, todayIso, type LabSubmissionWithFamily } from "@/lib/valkyria-lab";

export const metadata = { title: "Valkyria Lab — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

const day = (ts: string) => todayIso(new Date(ts));

function card(s: LabSubmissionWithFamily): VideoCardData {
  return {
    id: s.id,
    player: s.player_name,
    gesture: s.gesture,
    family: s.parentName,
    receivedLabel: `Reçue le ${shortDate(day(s.created_at))}`,
    sizeLabel: s.size_bytes ? sizeLabel(s.size_bytes) : null,
    fileName: s.storage_path.split("/").pop() ?? s.storage_path,
    status: s.status,
    comment: s.coach_comment,
    notified: !!s.family_notified_at,
    seenLabel: s.seen_at ? `le ${shortDate(day(s.seen_at))}` : null
  };
}

/** « Est-ce que les filles travaillent à la maison ? » : familles qui envoient une vidéo ce mois-ci, vidéos à regarder. */
export default async function ValkyriaLabPage() {
  await requireAdmin({ roles: ["admin"] });
  const o = await getLabOverview();
  const routineTone = o.routine?.status === "publie" ? "good" : "warn";
  const routineLabel = o.routine?.status === "publie" ? "Publiée" : o.routine ? "Brouillon" : "À écrire";
  const reached = o.rate !== null && o.rate >= LAB_TARGET;
  const dayOfMonth = Number(o.today.slice(8, 10));
  const nextMonth = o.nextRoutine?.month ?? null;
  const steps = [
    {
      label: `Écrire et publier la routine ${ofMonth(o.month)}`,
      detail: "consignes, gestes avec leur démonstration YouTube ou Vimeo non répertoriée, défi du mois, jeu de la semaine",
      href: `/admin/valkyria-lab/routine?mois=${o.month}`,
      done: !!o.shownRoutine
    },
    {
      label: "Créer le lien de chaque famille",
      detail: o.links.missing ? `${o.links.missing} famille${o.links.missing > 1 ? "s" : ""} inscrite${o.links.missing > 1 ? "s" : ""} sans lien` : "à partir des inscriptions payées",
      href: "/admin/valkyria-lab/familles",
      done: o.links.total > 0 && o.links.missing === 0
    },
    {
      label: "Envoyer le lien par courriel",
      detail: o.links.total ? `${o.links.sent} sur ${o.links.total} envoyé${o.links.sent > 1 ? "s" : ""}` : "une famille à la fois ou toutes d'un coup, avec confirmation",
      href: "/admin/valkyria-lab/familles",
      done: o.links.total > 0 && o.links.sent === o.links.total
    }
  ];
  // Une fois la routine en ligne et les premiers liens partis, les nouvelles familles se gèrent dans « Liens des familles ».
  const launched = !!o.shownRoutine && o.links.sent > 0;

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">Valkyria Lab · {capitalize(monthTitle(o.month))} · routine maison et « Envoyer ma vidéo »</p>
          <h1 className="mda-h1">
            {o.activeFamilies
              ? `${o.familiesWithVideo} famille${o.familiesWithVideo > 1 ? "s" : ""} sur ${o.activeFamilies} ${o.familiesWithVideo > 1 ? "ont" : "a"} envoyé une vidéo en ${monthName(o.month)}`
              : "Aucune famille active pour l'instant"}
          </h1>
          <p className="mda-lead">
            Chaque famille a son lien personnel : elle y voit la routine du mois et envoie la vidéo du geste ou du défi. Vous la regardez ici (lien privé de 10 minutes) et votre
            commentaire lui est envoyé. Objectif : 50 % des familles chaque mois, la condition pour lancer la phase 2.
          </p>
        </header>

        {!launched ? (
          <section className="mda-card" style={{ display: "grid", gap: 12, boxShadow: "inset 3px 0 0 var(--adm-accent)" }}>
            <div>
              <h2 className="mda-h2">Lancer le Valkyria Lab en 3 étapes</h2>
              <p className="mda-sub" style={{ margin: 0 }}>Les familles ne voient rien tant que la routine n’est pas publiée et que leur lien n’est pas envoyé.</p>
            </div>
            <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 10, fontSize: "0.92rem", color: "var(--adm-text-2)" }}>
              {steps.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} style={{ color: s.done ? "var(--adm-good)" : "var(--adm-accent)", fontWeight: 600, textDecoration: "none" }}>
                    {s.done ? "✓ " : ""}
                    {s.label}
                  </Link>
                  <span className="mda-muted"> · {s.detail}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="mda-card" style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <p className="mda-num-xl" style={{ margin: 0, color: reached ? "var(--adm-good)" : undefined }}>
              {pct(o.rate)}
            </p>
            <p className="mda-label" style={{ margin: 0 }}>
              des familles actives ont envoyé au moins une vidéo en {monthName(o.month)} · objectif 50 %
            </p>
          </div>
          <Bar value={o.rate ?? 0} marker={LAB_TARGET} color={reached ? "var(--adm-good)" : undefined} />
          <p className="mda-label" style={{ margin: 0, color: "var(--adm-text-3)" }}>
            {o.videosThisMonth} vidéo{o.videosThisMonth > 1 ? "s" : ""} reçue{o.videosThisMonth > 1 ? "s" : ""} ce mois-ci · familles actives = inscriptions payées de la saison en cours, regroupées par courriel du parent.
          </p>
        </section>

        <section className="mda-cols-3">
          <div className="mda-card" style={o.toWatch.length ? { boxShadow: "inset 3px 0 0 var(--adm-warn)" } : undefined}>
            <p className="mda-num" style={{ color: o.toWatch.length ? "var(--adm-warn)" : undefined }}>
              {o.toWatch.length}
            </p>
            <p className="mda-label">Vidéo{o.toWatch.length > 1 ? "s" : ""} à regarder</p>
          </div>
          <Link href={`/admin/valkyria-lab/routine?mois=${o.month}`} className="mda-card" style={{ textDecoration: "none", display: "grid", gap: 6, boxShadow: routineTone === "warn" ? "inset 3px 0 0 var(--adm-warn)" : undefined }}>
            <Pill tone={routineTone}>{routineLabel}</Pill>
            <p className="mda-label" style={{ margin: 0 }}>
              Routine {ofMonth(o.month)} · {o.routine ? "modifier" : "l'écrire"} →
            </p>
          </Link>
          <Link href="/admin/valkyria-lab/familles" className="mda-card" style={{ textDecoration: "none", boxShadow: o.links.missing ? "inset 3px 0 0 var(--adm-warn)" : undefined }}>
            <p className="mda-num">
              {o.links.sent}
              <span className="mda-muted" style={{ fontSize: "1rem" }}>
                {" "}
                / {o.links.total}
              </span>
            </p>
            <p className="mda-label">
              Familles qui ont reçu leur lien{o.links.opened ? ` · ${o.links.opened} l'ont ouvert` : ""}
              {o.links.missing ? ` · ${o.links.missing} sans lien` : ""} →
            </p>
          </Link>
        </section>

        {dayOfMonth >= 20 && o.nextRoutine?.status !== "publie" ? (
          <section className="mda-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", boxShadow: "inset 3px 0 0 var(--adm-info)" }}>
            <div>
              <p className="mda-task-title" style={{ fontWeight: 600 }}>
                Préparer la routine du mois prochain
              </p>
              <p className="mda-label" style={{ margin: 0 }}>Règle d’anticipation : publiée avant le 1er, elle part avec le courriel du mois.</p>
            </div>
            <Link href={`/admin/valkyria-lab/routine?mois=${nextMonth ?? ""}`} className="admin-btn-ghost" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              {o.nextRoutine ? "Finir le brouillon" : "Commencer"}
            </Link>
          </section>
        ) : null}

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <div>
              <h2 className="mda-h2">À regarder · {o.toWatch.length}</h2>
              <p className="mda-sub" style={{ margin: 0 }}>
                Les plus anciennes d’abord. Un commentaire court et précis : ce qui est réussi, puis une seule chose à améliorer.
              </p>
            </div>
          </div>
          {o.toWatch.length === 0 ? (
            <p style={{ padding: "16px 20px", margin: 0, color: "var(--adm-text-3)", fontSize: "0.9rem" }}>
              Aucune vidéo à regarder. {o.links.sent ? "Les nouvelles vidéos arrivent ici (et vous recevez un courriel)." : "Envoyez d'abord leur lien aux familles (onglet Liens des familles)."}
            </p>
          ) : (
            <ul className="mda-tasks">
              {o.toWatch.map((s) => (
                <VideoCard key={s.id} v={card(s)} commentMax={COMMENT_MAX} />
              ))}
            </ul>
          )}
        </section>

        {o.recentlySeen.length ? (
          <details className="mda-card-flush">
            <summary className="mda-card-head" style={{ cursor: "pointer", listStyle: "none" }}>
              <h2 className="mda-h2" style={{ margin: 0 }}>
                Déjà vues · {o.recentlySeen.length} plus récentes
              </h2>
              <span className="mda-muted" style={{ fontSize: "0.8rem" }}>
                Afficher
              </span>
            </summary>
            <ul className="mda-tasks">
              {o.recentlySeen.map((s) => (
                <VideoCard key={s.id} v={card(s)} commentMax={COMMENT_MAX} />
              ))}
            </ul>
          </details>
        ) : null}

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <div>
              <h2 className="mda-h2">Mois par mois</h2>
              <p className="mda-sub" style={{ margin: 0 }}>Mesure P1.7.12 · par rapport aux familles actives d’aujourd’hui.</p>
            </div>
          </div>
          <div className="mda-scroll">
            <table className="mda-table">
              <thead>
                <tr>
                  <th>Mois</th>
                  <th className="r">Familles</th>
                  <th className="r">Vidéos</th>
                  <th className="r">Taux</th>
                </tr>
              </thead>
              <tbody>
                {o.history.map((h) => (
                  <tr key={h.month}>
                    <td>{capitalize(monthTitle(h.month))}</td>
                    <td className="r">{h.families}</td>
                    <td className="r">{h.videos}</td>
                    <td className="r" style={{ color: h.rate !== null && h.rate >= LAB_TARGET ? "var(--adm-good)" : undefined, fontWeight: h.month === o.month ? 600 : undefined }}>
                      {pct(h.rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ padding: "12px 20px", margin: 0, fontSize: "0.8rem", color: "var(--adm-text-3)", borderTop: "1px solid var(--adm-line)" }}>
            Après le premier mois : envoyez le sondage court « Le Valkyria Lab, un mois plus tard » depuis <Link href="/admin/sondages" style={{ color: "var(--adm-accent)" }}>Voix des familles</Link> (modèle Valkyria Lab).
          </p>
        </section>
      </div>
    </div>
  );
}
