import Link from "next/link";

import { Pill } from "@/components/mandalart/ui";
import { CopyLink, LabAction, SendLinkButton } from "@/components/valkyria-lab-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { firstNames, getFamilyLinks, monthName, ofMonth, shortDate, todayIso, type FamilyLinkRow } from "@/lib/valkyria-lab";

export const metadata = { title: "Liens des familles · Valkyria Lab — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

const day = (ts: string) => todayIso(new Date(ts));
const s = (n: number) => (n > 1 ? "s" : "");

function Row({ r, canSend }: { r: FamilyLinkRow; canSend: boolean }) {
  const a = r.access;
  const sent = a.sent_at ? `Lien envoyé le ${shortDate(day(a.sent_at))}${a.send_count > 1 ? ` (${a.send_count} fois)` : ""}` : null;
  return (
    <li className="mda-task" style={{ display: "block", opacity: a.active ? 1 : 0.65 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <p className="mda-task-title" style={{ fontWeight: 600 }}>
            {firstNames(a.players) || "Joueuse"}
            <span className="mda-muted" style={{ fontWeight: 400 }}>
              {" "}
              · {a.parent_name ?? a.parent_email}
            </span>
          </p>
          <div className="mda-task-meta">
            <span>{a.parent_email}</span>
            {!a.active ? <span style={{ color: "var(--adm-text-3)" }}>Lien désactivé{r.enrolled ? "" : " (plus inscrite)"}</span> : null}
            {a.active && !sent ? <span style={{ color: "var(--adm-warn)" }}>Lien pas encore reçu</span> : null}
            {sent ? <span>{sent}</span> : null}
            {a.opened_at ? <span style={{ color: "var(--adm-good)" }}>Ouvert{a.last_seen_at ? ` · dernière visite le ${shortDate(day(a.last_seen_at))}` : ""}</span> : a.sent_at ? <span>Pas encore ouvert</span> : null}
            {r.videosThisMonth ? (
              <span style={{ color: "var(--adm-good)" }}>
                {r.videosThisMonth} vidéo{s(r.videosThisMonth)} ce mois-ci
              </span>
            ) : r.lastVideoAt ? (
              <span>Dernière vidéo le {shortDate(day(r.lastVideoAt))}</span>
            ) : null}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {a.active ? (
            <>
              <CopyLink url={r.link} />
              {canSend ? <SendLinkButton id={a.id} email={a.parent_email} already={!!a.sent_at} /> : null}
              <LabAction small body={{ action: "access-active", id: a.id, active: false }} label="Désactiver" confirmText={`Désactiver le lien de ${a.parent_name ?? a.parent_email} ? La famille ne pourra plus ouvrir sa page du Lab.`} />
            </>
          ) : (
            <LabAction small body={{ action: "access-active", id: a.id, active: true }} label="Réactiver" />
          )}
        </div>
      </div>
    </li>
  );
}

/** « Est-ce que chaque famille inscrite a reçu son lien du Lab ? » : un lien personnel par famille, l'envoi par courriel
 *  (une famille ou toutes, avec confirmation), et qui l'a ouvert. */
export default async function LabFamiliesPage() {
  await requireAdmin({ roles: ["admin"] });
  const f = await getFamilyLinks();
  const active = f.rows.filter((r) => r.access.active);
  const inactive = f.rows.filter((r) => !r.access.active);
  const canSend = !!f.routine;
  const unsentNames = active.filter((r) => !r.access.sent_at).map((r) => r.access.parent_name ?? r.access.parent_email);
  const preview = (names: string[]) => `${names.slice(0, 6).join(", ")}${names.length > 6 ? ` et ${names.length - 6} autre${s(names.length - 6)}` : ""}`;
  const syncFirst = f.missing.length > 0;

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">Valkyria Lab · un lien personnel par famille inscrite (inscriptions payées de la saison)</p>
          <h1 className="mda-h1">
            {f.counts.active === 0
              ? "Aucun lien créé pour l'instant"
              : f.counts.unsent
                ? `${f.counts.unsent} famille${s(f.counts.unsent)} n'${f.counts.unsent > 1 ? "ont pas encore reçu leur" : "a pas encore reçu son"} lien`
                : `Les ${f.counts.active} familles ont reçu leur lien`}
          </h1>
          <p className="mda-lead">
            Le lien est le même tous les mois : la famille y voit la routine du mois et envoie ses vidéos. Le courriel part de info@newvalkyria.com, un parent à la fois. Désactivez un lien si une
            famille quitte l’académie (c’est fait tout seul quand vous mettez à jour la liste).
          </p>
        </header>

        <section className="mda-cols-3">
          <div className="mda-card" style={f.missing.length ? { boxShadow: "inset 3px 0 0 var(--adm-warn)" } : undefined}>
            <p className="mda-num" style={{ color: f.missing.length ? "var(--adm-warn)" : undefined }}>
              {f.missing.length}
            </p>
            <p className="mda-label">Famille{s(f.missing.length)} inscrite{s(f.missing.length)} sans lien</p>
          </div>
          <div className="mda-card">
            <p className="mda-num">
              {f.counts.sent}
              <span className="mda-muted" style={{ fontSize: "1rem" }}> / {f.counts.active}</span>
            </p>
            <p className="mda-label">
              Lien{s(f.counts.sent)} reçu{s(f.counts.sent)} · {f.counts.opened} ouvert{s(f.counts.opened)}
            </p>
          </div>
          <div className="mda-card">
            <p className="mda-num">{f.counts.withVideo}</p>
            <p className="mda-label">
              Famille{s(f.counts.withVideo)} avec une vidéo en {monthName(f.month)}
            </p>
          </div>
        </section>

        <section className="mda-card" style={{ display: "grid", gap: 12 }}>
          {!canSend ? (
            <p style={{ margin: 0, padding: "10px 12px", borderRadius: "var(--adm-radius-sm)", background: "var(--adm-warn-soft)", color: "var(--adm-text-2)", fontSize: "0.88rem" }}>
              Publiez d’abord la routine du mois (
              <Link href={`/admin/valkyria-lab/routine?mois=${f.month}`} style={{ color: "var(--adm-accent)" }}>
                Routine {ofMonth(f.month)}
              </Link>
              ) : sans elle, le lien montrerait une page vide. Vous pouvez déjà créer les liens.
            </p>
          ) : !f.routine?.current ? (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--adm-text-3)" }}>
              Les familles voient en ce moment la routine {ofMonth(f.routine?.month ?? f.month)} : publiez celle {ofMonth(f.month)} avant d’envoyer le courriel du mois.
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <LabAction
              primary={syncFirst || !canSend || !f.counts.unsent}
              body={{ action: "sync-families" }}
              label={syncFirst ? `Créer les liens (${f.missing.length} famille${s(f.missing.length)})` : "Mettre à jour à partir des inscriptions"}
              done="synced"
            />
            {canSend && f.counts.unsent ? (
              <LabAction
                primary={!syncFirst}
                body={{ action: "send-links", scope: "unsent" }}
                label={`Envoyer le lien aux ${f.counts.unsent} famille${s(f.counts.unsent)} qui ne l'ont pas`}
                confirmText={`Envoyer le lien personnel du Valkyria Lab par courriel à ${f.counts.unsent} famille${s(f.counts.unsent)} ?\n\n${preview(unsentNames)}\n\n(La liste complète est sur cette page : « Lien pas encore reçu ».)`}
                done="sent"
              />
            ) : null}
            {canSend && f.counts.sent ? (
              <LabAction
                body={{ action: "send-links", scope: "all" }}
                label={`Courriel du mois à toutes (${f.counts.active})`}
                confirmText={`Envoyer le courriel « routine maison ${ofMonth(f.routine?.month ?? f.month)} » à toutes les ${f.counts.active} familles qui ont un lien actif ? Chaque parent reçoit son lien personnel.`}
                done="sent"
              />
            ) : null}
          </div>
        </section>

        {f.missing.length ? (
          <section className="mda-card-flush">
            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2">Inscrites sans lien · {f.missing.length}</h2>
                <p className="mda-sub" style={{ margin: 0 }}>Touchez « Créer les liens » : un lien par courriel de parent (les sœurs partagent le même).</p>
              </div>
            </div>
            <ul className="mda-tasks">
              {f.missing.slice(0, 40).map((m) => (
                <li key={m.email} className="mda-task">
                  <div className="mda-task-body">
                    <p className="mda-task-title">
                      {firstNames(m.players)}
                      <span className="mda-muted"> · {m.parentName ?? m.email}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {f.missing.length > 40 ? <p style={{ padding: "12px 20px", margin: 0, fontSize: "0.8rem", color: "var(--adm-text-3)" }}>Et {f.missing.length - 40} autres.</p> : null}
          </section>
        ) : null}

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <div>
              <h2 className="mda-h2">Liens actifs · {active.length}</h2>
              <p className="mda-sub" style={{ margin: 0 }}>
                {active.length ? "« Copier le lien » pour l'envoyer par texto ; « Envoyer » le renvoie par courriel." : "Aucun lien pour l'instant : touchez « Créer les liens »."}
              </p>
            </div>
            {active.length ? <Pill tone={f.counts.unsent ? "warn" : "good"}>{f.counts.unsent ? `${f.counts.unsent} à envoyer` : "Tous envoyés"}</Pill> : null}
          </div>
          {active.length ? (
            <ul className="mda-tasks">
              {active.map((r) => (
                <Row key={r.access.id} r={r} canSend={canSend} />
              ))}
            </ul>
          ) : null}
        </section>

        {inactive.length ? (
          <details className="mda-card-flush">
            <summary className="mda-card-head" style={{ cursor: "pointer", listStyle: "none" }}>
              <h2 className="mda-h2" style={{ margin: 0 }}>
                Liens désactivés · {inactive.length}
              </h2>
              <span className="mda-muted" style={{ fontSize: "0.8rem" }}>
                Afficher
              </span>
            </summary>
            <ul className="mda-tasks">
              {inactive.map((r) => (
                <Row key={r.access.id} r={r} canSend={false} />
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  );
}
