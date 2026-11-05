import { AdminTopbar } from "@/components/admin-topbar";
import { McsButton } from "@/components/mcs-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { eventLabel, getMcsStatus, memberLabel } from "@/lib/mcs-sync";

export const metadata = { title: "À faire dans MonClubSportif — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

/** « Qu'est-ce qui manque dans MonClubSportif ? » : nouvelles inscrites, nouvelles activités, joueuses à retirer. */
export default async function McsPage() {
  await requireAdmin({ roles: ["admin"] });
  const s = await getMcsStatus();
  const first = s.syncedMembers === 0 && s.syncedEvents === 0;
  const total = s.newMembers.length + s.newEvents.length + s.toRemove.length;
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Tâche P8.4.06 · automatisation AU19 · plus tard l&apos;agent MonClubSportif (A12)</p>
            <h1 className="mda-h1">{first ? "Point de départ à fixer" : total ? `${total} chose${total > 1 ? "s" : ""} à faire dans MonClubSportif` : "MonClubSportif est à jour"}</h1>
            <p className="mda-lead">
              Le site prépare un fichier avec seulement les nouveautés depuis la dernière importation. Importez-le dans MonClubSportif (Membres → Importer, Calendrier → Importer), puis touchez « Importé ». Les joueuses qui ne sont plus inscrites apparaissent à retirer.
            </p>
          </header>

          {first && (
            <section className="mda-card" style={{ boxShadow: "inset 3px 0 0 var(--adm-warn)" }}>
              <h2 className="mda-h2">Première fois : dire au site ce qui est déjà dans MonClubSportif</h2>
              <p className="mda-sub">
                Si toutes les inscrites ({s.members.length}) et les activités à venir ({s.events.length}) sont déjà dans MonClubSportif, marquez-les comme importées : à partir de là, seules les nouveautés apparaîtront.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <McsButton primary body={{ action: "imported", kind: "membre" }} label={`Les ${s.members.length} inscrites sont déjà dans MonClubSportif`} confirmText="Confirmer que toutes les inscrites actuelles sont déjà dans MonClubSportif ?" />
                <McsButton body={{ action: "imported", kind: "evenement" }} label={`Les ${s.events.length} activités à venir y sont déjà`} confirmText="Confirmer que toutes les activités à venir sont déjà dans MonClubSportif ?" />
              </div>
            </section>
          )}

          <section className="mda-cols-3">
            <div className="mda-card">
              <p className="mda-num">{s.newMembers.length}</p>
              <p className="mda-label">Nouvelles inscrites à importer</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{s.newEvents.length}</p>
              <p className="mda-label">Activités à venir à importer</p>
            </div>
            <div className="mda-card" style={s.toRemove.length ? { boxShadow: "inset 3px 0 0 var(--adm-warn)" } : undefined}>
              <p className="mda-num">{s.toRemove.length}</p>
              <p className="mda-label">Joueuses à retirer (plus inscrites)</p>
            </div>
          </section>

          {!first && s.newMembers.length > 0 && (
            <section className="mda-card-flush">
              <div className="mda-card-head">
                <h2 className="mda-h2">Nouvelles inscrites · {s.newMembers.length}</h2>
                <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
                  <a className="admin-btn-primary" href="/api/admin/monclubsportif?fichier=membres" style={{ textDecoration: "none", padding: "8px 14px" }}>Télécharger le fichier</a>
                  <McsButton body={{ action: "imported", kind: "membre" }} label="Importé ✓" confirmText="Le fichier des nouvelles inscrites a été importé dans MonClubSportif ?" />
                </span>
              </div>
              <ul className="mda-tasks">
                {s.newMembers.slice(0, 60).map((r, i) => (
                  <li key={i} className="mda-task" style={{ display: "block" }}>
                    <p className="mda-task-title">{memberLabel(r)}</p>
                    <div className="mda-task-meta">
                      <span>{r[7]}</span>
                      <span>{r[4]}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!first && s.newEvents.length > 0 && (
            <section className="mda-card-flush">
              <div className="mda-card-head">
                <h2 className="mda-h2">Activités à venir · {s.newEvents.length}</h2>
                <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
                  <a className="admin-btn-primary" href="/api/admin/monclubsportif?fichier=evenements" style={{ textDecoration: "none", padding: "8px 14px" }}>Télécharger le fichier</a>
                  <McsButton body={{ action: "imported", kind: "evenement" }} label="Importé ✓" confirmText="Le fichier des activités a été importé dans MonClubSportif ?" />
                </span>
              </div>
              <ul className="mda-tasks">
                {s.newEvents.slice(0, 60).map((r, i) => (
                  <li key={i} className="mda-task" style={{ display: "block" }}>
                    <p className="mda-task-title">{eventLabel(r)}</p>
                    <div className="mda-task-meta">
                      <span>{r[0]}</span>
                      <span>{r[4]}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {s.toRemove.length > 0 && (
            <section className="mda-card-flush">
              <div className="mda-card-head">
                <h2 className="mda-h2">À retirer de MonClubSportif · {s.toRemove.length}</h2>
              </div>
              <ul className="mda-tasks">
                {s.toRemove.map((r) => (
                  <li key={r.key} className="mda-task" style={{ justifyContent: "space-between" }}>
                    <p className="mda-task-title">{r.label}</p>
                    <McsButton body={{ action: "removed", key: r.key }} label="Retirée ✓" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {s.photosToSend.length > 0 && (
            <section className="mda-card-flush">
              <div className="mda-card-head">
                <h2 className="mda-h2">Photos à mettre dans MonClubSportif · {s.photosToSend.length}</h2>
                <p className="mda-sub" style={{ margin: 0 }}>La bonne photo sur le profil du bon jeune (fait par le robot A12, ou à la main). Profil interne de l&apos;équipe seulement, jamais publié.</p>
              </div>
              <ul className="mda-tasks">
                {s.photosToSend.map((p) => (
                  <li key={p.key} className="mda-task" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.photoUrl} alt="" width={40} height={40} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }} />
                      <span className="mda-task-title">{p.label}</span>
                    </span>
                    <McsButton body={{ action: "photo", key: p.key, label: p.label }} label="Photo mise ✓" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mda-card">
            <h2 className="mda-h2">Vers l&apos;autonomie complète (agent A12)</h2>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--adm-text-2)", fontSize: "0.88rem", lineHeight: 1.6 }}>
              <li>Aujourd&apos;hui : le site prépare les fichiers des nouveautés ; l&apos;importation dans MonClubSportif prend une minute.</li>
              <li>Étape suivante : un agent Claude, dans votre navigateur Chrome où MonClubSportif est déjà ouvert, télécharge ce fichier et fait l&apos;importation à votre place, une fois par jour, et note ce qu&apos;il a fait.</li>
              <li>Si MonClubSportif offre une API ou un lien de calendrier (iCal), l&apos;agent l&apos;utilise à la place : plus besoin du navigateur.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
