import Link from "next/link";

import { KnowledgeCard, KnowledgeForm } from "@/components/jp-space";
import { requireAdmin } from "@/lib/admin-auth";
import { KNOWLEDGE_STATUS_LABEL, SOURCE_LABEL } from "@/lib/jp-core";
import { getKnowledge } from "@/lib/jp-repo";

export const metadata = { title: "Mes connaissances — Espace JP", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Ce que JP accumule : livres, vidéos, cours, mentors, ce qu'il en retient et comment il l'applique. */
export default async function ConnaissancesPage({ searchParams }: { searchParams: Promise<{ tag?: string; q?: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const { tag, q } = await searchParams;
  const all = await getKnowledge();
  const tags = [...new Set(all.flatMap((k) => k.tags))].sort((a, b) => a.localeCompare(b, "fr"));
  const needle = q?.trim().toLowerCase();
  const shown = all.filter((k) => (!tag || k.tags.includes(tag)) && (!needle || [k.title, k.author, k.lessons, k.apply_to].some((x) => x?.toLowerCase().includes(needle))));
  const toApply = all.filter((k) => k.apply_to && !k.applied).length;
  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">Ce que j&apos;apprends, je l&apos;applique</p>
          <h1 className="mda-h1">Mes connaissances</h1>
          <p className="mda-lead">
            Une fiche par livre, vidéo, cours ou conseil de mentor : ce que tu en retiens et comment tu l&apos;appliques à l&apos;académie ou à ton image. {all.length} fiche{all.length > 1 ? "s" : ""}
            {toApply ? `, ${toApply} idée${toApply > 1 ? "s" : ""} pas encore appliquée${toApply > 1 ? "s" : ""}` : ""}.
          </p>
        </header>

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginTop: 0 }}>Nouvelle fiche</h2>
          <KnowledgeForm />
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">{tag ? `Étiquette « ${tag} »` : "Toutes mes fiches"}</h2>
            <form style={{ display: "flex", gap: 8 }}>
              {tag ? <input type="hidden" name="tag" value={tag} /> : null}
              <input className="admin-input" name="q" placeholder="Chercher" defaultValue={q ?? ""} style={{ maxWidth: 200 }} />
            </form>
          </div>
          {tags.length ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "12px 20px 0" }}>
              <Link href="/admin/moi/connaissances" className="mda-pill" style={{ textDecoration: "none", fontWeight: tag ? 400 : 700 }}>
                Toutes
              </Link>
              {tags.map((t) => (
                <Link key={t} href={`/admin/moi/connaissances?tag=${encodeURIComponent(t)}`} className="mda-pill" style={{ textDecoration: "none", fontWeight: t === tag ? 700 : 400 }}>
                  {t}
                </Link>
              ))}
            </div>
          ) : null}
          {shown.length ? (
            <ul className="mda-tasks">
              {shown.map((k) => (
                <KnowledgeCard key={k.id} k={k} sourceLabel={SOURCE_LABEL[k.source_type]} statusLabel={KNOWLEDGE_STATUS_LABEL[k.status]} />
              ))}
            </ul>
          ) : (
            <p style={{ padding: "14px 20px", margin: 0, fontSize: "0.88rem", color: "var(--adm-text-3)" }}>{all.length ? "Aucune fiche ne correspond." : "Ta première fiche : $100M Offers d'Alex Hormozi ?"}</p>
          )}
        </section>
      </div>
    </div>
  );
}
