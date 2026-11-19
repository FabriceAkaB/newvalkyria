import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Container } from "@/components/container";
import { FamilyPlayerSheet } from "@/components/family-player-sheet";
import { requireParentUserId } from "@/lib/parent-auth";
import { getFamilyRegistrations } from "@/lib/parent-repo";
import { getPlayerSheet } from "@/lib/player-sheet-repo";

export const metadata: Metadata = { title: "Fiche joueuse | Espace famille", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Fiche joueuse (Mandalart P4.1.03) : le parent dit qui est sa fille ; l'éducatrice la lit dans son briefing. */
export default async function FichePage({ params }: { params: Promise<{ registrationId: string }> }) {
  const { registrationId } = await params;
  const userId = await requireParentUserId();
  const family = await getFamilyRegistrations(userId);
  const girl = family.find((f) => f.registrationId === registrationId);
  if (!girl) notFound();
  const sheet = await getPlayerSheet(registrationId).catch(() => null);

  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        {family.length > 1 ? (
          <Link href="/compte/fiche" className="parent-muted" style={{ fontSize: "0.9rem", textDecoration: "none" }}>
            ← Toutes les fiches
          </Link>
        ) : null}
        <div className="fam-hello">
          <p>Fiche joueuse</p>
          <h1>Parlez-nous de {girl.firstName}</h1>
        </div>
        <p className="parent-muted" style={{ margin: "0 0 16px" }}>
          Deux minutes pour que son éducatrice la connaisse dès la première pratique : elle lit ces réponses dans son briefing de 5 minutes avant chaque séance. Toutes les questions sont facultatives ; vous pouvez revenir les modifier en tout temps.
        </p>
        <FamilyPlayerSheet registrationId={girl.registrationId} firstName={girl.firstName} initial={sheet?.answers ?? null} />
        <p className="parent-muted" style={{ margin: "16px 0 0", fontSize: "0.85rem", display: "flex", gap: 8, alignItems: "flex-start" }}>
          <ShieldCheck size={16} strokeWidth={1.75} aria-hidden style={{ flex: "none", marginTop: 2 }} />
          Ces renseignements restent confidentiels : seuls les éducateurs de son groupe et la direction les lisent. Ils ne sont jamais partagés avec d&apos;autres familles.
        </p>
      </Container>
    </section>
  );
}
