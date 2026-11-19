import { AdminTopbar } from "@/components/admin-topbar";
import { requireAdmin } from "@/lib/admin-auth";
import { getKioskPractices } from "@/lib/kiosk-practice-repo";
import { kioskPath } from "@/lib/survey-kiosk";

export const metadata = { title: "Borne du terrain", robots: "noindex" };
export const dynamic = "force-dynamic";

const openHref = (p: { key: string; activityId: string | null }, vue: "pratique" | "sondage") =>
  p.activityId ? `${kioskPath(p.activityId)}&vue=${vue}` : `/admin/borne/ouvrir?pratique=${encodeURIComponent(p.key)}&vue=${vue}`;

/** Accueil de la borne (code 180180) : les pratiques du jour, chacune avec son plan et son sondage. Ouvrir une
 *  pratique avec du réseau ; ensuite elle reste lisible hors réseau tant que la page reste ouverte. */
export default async function KioskHome() {
  await requireAdmin({ roles: ["admin", "gerante", "borne"] });
  const practices = await getKioskPractices();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const dayLabel = (iso: string) => (iso === today ? "Aujourd'hui" : new Date(`${iso}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" }));

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda" style={{ maxWidth: 720 }}>
          <header>
            <p className="mda-eyebrow" style={{ textTransform: "none" }}>{practices[0] ? dayLabel(practices[0].date) : "Aujourd'hui"}</p>
            <h1 className="mda-h1">Pratiques du jour</h1>
            <p className="mda-lead">Ouvre la pratique pendant que tu as du réseau. Ensuite, le plan, les diapos et le sondage des filles restent dans la page, même hors réseau : ne la ferme pas.</p>
          </header>
          {practices.length === 0 ? (
            <div className="admin-stat-card"><p style={{ margin: 0 }}>Aucune pratique de l&apos;Académie aujourd&apos;hui ni dans les 3 prochains jours.</p></div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {practices.map((p) => (
                <div key={p.key} className="admin-stat-card" style={{ display: "grid", gap: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600, color: "var(--adm-text)" }}>
                      {p.start.slice(0, 5).replace(":", " h ")}{p.end ? ` à ${p.end.slice(0, 5).replace(":", " h ")}` : ""} · {p.label}
                    </p>
                    <p style={{ margin: "2px 0 0", color: "var(--adm-text-2)" }}>
                      {p.location || "Lieu à confirmer"} · {p.ready ? "plan prêt" : "plan pas encore prêt"}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <a href={openHref(p, "pratique")} className="admin-btn-primary" style={{ textDecoration: "none", minHeight: 44, display: "inline-flex", alignItems: "center" }}>
                      La pratique
                    </a>
                    <a href={openHref(p, "sondage")} className="admin-btn-ghost" style={{ textDecoration: "none", minHeight: 44, display: "inline-flex", alignItems: "center" }}>
                      Sondage des filles
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
