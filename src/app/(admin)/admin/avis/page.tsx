import { AdminTopbar } from "@/components/admin-topbar";
import { ReviewActions, ReviewSettingsForm } from "@/components/admin-reviews";
import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { VIDEO_STATUS_LABEL } from "@/lib/family-reviews";
import { getReviewSettings, listReviews } from "@/lib/family-reviews-repo";

export const metadata = { title: "Avis et témoignages — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const fr = (iso: string) => new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", timeZone: "America/Toronto" });
const stars = (n: number | null) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "—");

/** « Qu'est-ce que les familles disent de nous ? » Les avis écrits dans l'espace famille (et s'ils ont cliqué pour
 *  les publier sur Google et Facebook), les témoignages vidéo à valider (crédit sur la prochaine saison). */
export default async function ReviewsPage() {
  const role = await requireAdmin({ roles: ["admin", "gerante"] });
  const [reviews, settings] = await Promise.all([listReviews(), getReviewSettings()]);
  const toValidate = reviews.filter((r) => r.videoStatus === "a-valider");
  const written = reviews.filter((r) => r.body);
  const avg = written.length ? written.reduce((s, r) => s + (r.stars ?? 0), 0) / written.length : null;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Voix des familles · avis et témoignages</p>
            <h1 className="mda-h1">{toValidate.length ? `${toValidate.length} témoignage${toValidate.length > 1 ? "s" : ""} vidéo à valider` : `${written.length} avis${avg ? ` · ${avg.toLocaleString("fr-CA", { maximumFractionDigits: 1 })} sur 5` : ""}`}</h1>
            <p className="mda-lead">
              Les parents écrivent leur avis dans leur espace (onglet « Votre avis »), puis le publient sur Google et Facebook en deux clics : le texte est copié et la page d&apos;avis s&apos;ouvre. Le site ne peut pas publier à leur place (Google et Facebook l&apos;interdisent), et aucun crédit n&apos;est lié à un avis Google ou Facebook (fiche suspendue sinon). Le crédit récompense seulement le témoignage vidéo, validé ici.
            </p>
          </header>

          <section className="mda-card-flush">
            <div className="mda-card-head"><h2 className="mda-h2">Avis et témoignages</h2><Pill>{reviews.length}</Pill></div>
            {reviews.length ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {reviews.map((r) => (
                  <li key={r.id} style={{ display: "grid", gap: 6, padding: "14px 16px", borderTop: "1px solid var(--adm-line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>
                        {r.parentName || r.parentEmail}{r.playerNames ? ` · ${r.playerNames}` : ""} <span style={{ color: "var(--adm-accent)", letterSpacing: 1 }}>{stars(r.stars)}</span>
                      </p>
                      <span style={{ fontSize: "0.82rem", color: "var(--adm-text-3)" }}>{fr(r.updatedAt)}</span>
                    </div>
                    {r.body ? <p style={{ margin: 0, color: "var(--adm-text)", whiteSpace: "pre-line" }}>{r.body}</p> : null}
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--adm-text-2)" }}>
                      Google : {r.googleClickedAt ? `ouvert le ${fr(r.googleClickedAt)}` : "pas encore"} · Facebook : {r.facebookClickedAt ? `ouvert le ${fr(r.facebookClickedAt)}` : "pas encore"} · Vidéo : {VIDEO_STATUS_LABEL[r.videoStatus] ?? r.videoStatus}
                      {r.creditedAt && r.creditCents ? ` · crédit de ${(r.creditCents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} versé` : ""}
                    </p>
                    <ReviewActions id={r.id} videoStatus={r.videoStatus} hasVideo={r.hasVideo} showOnSite={r.showOnSite} canValidate={role === "admin"} />
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, padding: "14px 16px", color: "var(--adm-text-2)" }}>Aucun avis pour l&apos;instant. Les familles le trouvent dans leur espace : Plus › Votre avis.</p>
            )}
          </section>

          {role === "admin" && (
            <section className="mda-card-flush">
              <div className="mda-card-head"><h2 className="mda-h2">Liens et crédit</h2></div>
              <ReviewSettingsForm googleUrl={settings.googleUrl ?? ""} facebookUrl={settings.facebookUrl ?? ""} creditCents={settings.videoCreditCents} />
            </section>
          )}
        </div>
      </div>
    </>
  );
}
