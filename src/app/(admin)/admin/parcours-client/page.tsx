import { CustomerJourney } from "@/components/customer-journey";
import { requireAdmin } from "@/lib/admin-auth";
import { buildTree, countByStatus, NODE_KINDS } from "@/lib/customer-journey-core";
import { getJourney } from "@/lib/customer-journey-repo";

export const metadata = { title: "Parcours client — Familles & inscriptions", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Le parcours client décortiqué : de la découverte à la réinscription, étape par étape, ce que la famille fait, ce à
 *  quoi elle a droit, ce que l'académie fait (à la main ou automatiquement) et les branches (s'inscrit ou non,
 *  programme, paiement). Modifiable ici : on le bonifie au fur et à mesure. */
export default async function ParcoursClientPage() {
  await requireAdmin();
  const nodes = await getJourney();
  const tree = buildTree(nodes);
  const c = countByStatus(nodes);
  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">De la découverte à la réinscription</p>
          <h1 className="mda-h1">Parcours client</h1>
          <p className="mda-lead">
            Chaque étape que vit une famille, ce à quoi elle a droit et ce que l&apos;académie fait pour elle. ✏️ pour modifier, ＋ pour ajouter dessous, ↑↓ pour déplacer.
            {` ${c["en-place"]} éléments en place, ${c["en-cours"]} en cours, ${c.prevu} prévus.`}
          </p>
        </header>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.8rem", color: "var(--adm-text-2)" }}>
          {NODE_KINDS.map((k) => (
            <span key={k.id}>
              {k.icon} {k.label}
            </span>
          ))}
        </div>
        <CustomerJourney tree={tree} editable />
      </div>
    </div>
  );
}
