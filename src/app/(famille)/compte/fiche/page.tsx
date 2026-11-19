import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";

import { Container } from "@/components/container";
import { requireParentUserId } from "@/lib/parent-auth";
import { getFamilyRegistrations } from "@/lib/parent-repo";
import { filledCount, SHEET_FIELDS } from "@/lib/player-sheet";
import { getPlayerSheet } from "@/lib/player-sheet-repo";

export const metadata: Metadata = { title: "Fiches joueuses | Espace famille", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Les fiches joueuses de la famille : une seule fille = sa fiche directement ; plusieurs = la liste. */
export default async function FichesPage() {
  const userId = await requireParentUserId();
  const family = await getFamilyRegistrations(userId);
  if (family.length === 1) redirect(`/compte/fiche/${family[0].registrationId}`);
  const sheets = await Promise.all(family.map((f) => getPlayerSheet(f.registrationId).catch(() => null)));

  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="fam-hello">
          <p>Fiche joueuse</p>
          <h1>Parlez-nous de vos filles</h1>
        </div>
        {family.length === 0 ? (
          <div className="parent-card">
            <p className="parent-muted" style={{ margin: 0 }}>
              Aucune inscription payée n&apos;est encore reliée à votre compte. Reliez votre fille dans « Mes enfants », ou confirmez votre courriel, puis revenez ici.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {family.map((f, i) => {
              const n = filledCount(sheets[i]?.answers);
              return (
                <Link key={f.registrationId} href={`/compte/fiche/${f.registrationId}`} className="parent-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textDecoration: "none" }}>
                  <span style={{ display: "grid", gap: 2 }}>
                    <span style={{ fontWeight: 600, color: "var(--adm-text)" }}>{f.firstName} {f.lastName}</span>
                    <span className="parent-muted" style={{ fontSize: "0.88rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {n ? <Check size={14} aria-hidden style={{ color: "var(--adm-good)" }} /> : null}
                      {n ? `${n} réponse${n > 1 ? "s" : ""} sur ${SHEET_FIELDS.length}` : "Pas encore remplie"}
                    </span>
                  </span>
                  <ChevronRight size={18} aria-hidden style={{ color: "var(--adm-text-3)" }} />
                </Link>
              );
            })}
          </div>
        )}
      </Container>
    </section>
  );
}
