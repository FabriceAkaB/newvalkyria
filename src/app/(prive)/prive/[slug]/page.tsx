import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getCurrentAdminRole } from "@/lib/admin-auth";

import { PrivateProgramContent } from "@/components/private-program-content";
import { getPrivateProgram } from "@/lib/private-programs-repo";
import { buildPrivateProgramView, programBrand } from "@/lib/private-program-view";

export const dynamic = "force-dynamic";

/** Page de vente non répertoriée : jamais indexée, absente des menus, du
 *  catalogue et du sitemap. Accessible uniquement par le lien direct. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const program = await getPrivateProgram(slug);
  const title = program ? `${program.name} | New Valkyria` : "New Valkyria";
  // L'aperçu du lien (texto, WhatsApp, courriel) montre le logo de l'académie
  // sur fond neutre — jamais la photo d'accueil du site.
  const description = "Programme de développement de soccer New Valkyria — places limitées.";
  const image = { url: "/og/garcons.jpg", width: 1200, height: 628, alt: "New Valkyria" };
  // IMPORTANT : canonique et og:url propres à la page. Sans ça, Messenger/Facebook
  // suivent le canonique du site (l'accueil) et affichent sa photo et ses textes.
  const path = program ? `/prive/${program.slug}` : "/";
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    openGraph: { title, description, url: path, type: "website", locale: "fr_CA", siteName: "New Valkyria", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] }
  };
}

export default async function PrivateProgramPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string; cancelled?: string }>;
}) {
  const { slug } = await params;
  const { ref } = await searchParams;

  const program = await getPrivateProgram(slug);
  const redirectTo = (program?.presentation as { redirectTo?: string } | null)?.redirectTo;
  if (redirectTo && redirectTo.startsWith("/")) redirect(redirectTo);
  const isAdmin = Boolean(await getCurrentAdminRole());
  const live = Boolean(program && program.active && program.published);
  if (!program || (!live && !isAdmin)) notFound();

  // Programme FC Atlantic : servi par sa propre page, sans aucune mention de New Valkyria.
  if (programBrand(program) === "atlantic") redirect(`/programme/${program.slug}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`);

  const view = await buildPrivateProgramView(program, live);
  return <PrivateProgramContent program={view} initialRef={ref?.trim() || null} />;
}
