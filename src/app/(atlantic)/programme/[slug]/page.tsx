import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PrivateProgramContent } from "@/components/private-program-content";
import { getCurrentAdminRole } from "@/lib/admin-auth";
import { buildPrivateProgramView, programBrand } from "@/lib/private-program-view";
import { getPrivateProgram } from "@/lib/private-programs-repo";

export const dynamic = "force-dynamic";

/** Page FC Atlantic (non répertoriée, jamais indexée). L'aperçu du lien montre le logo FC Atlantic. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const program = await getPrivateProgram(slug);
  // Programme qui n'est plus FC Atlantic : la page redirige vers /prive/ — l'aperçu doit être celui des programmes garçons.
  if (!program || programBrand(program) !== "atlantic") {
    const nvImage = { url: "/og/garcons.jpg", width: 1200, height: 628, alt: "New Valkyria" };
    const nvTitle = program ? `${program.name} | New Valkyria` : "New Valkyria";
    return {
      title: { absolute: nvTitle },
      robots: { index: false, follow: false },
      alternates: { canonical: `/prive/${slug}` },
      openGraph: { title: nvTitle, url: `/prive/${slug}`, type: "website", locale: "fr_CA", siteName: "New Valkyria", images: [nvImage] },
      twitter: { card: "summary_large_image", title: nvTitle, images: [nvImage.url] }
    };
  }
  const title = `${program.name} | FC Atlantic`;
  const description = "Programme intensif de soccer pour aider davantage les jeunes à progresser — encadré par un coach certifié. Places limitées.";
  const image = { url: "/og/fc-atlantic.jpg", width: 1200, height: 630, alt: "FC Atlantic" };
  const path = `/programme/${slug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    icons: { icon: "/brand/fc-atlantic.jpg" },
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    openGraph: { title, description, url: path, type: "website", locale: "fr_CA", siteName: "FC Atlantic", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] }
  };
}

export default async function AtlanticProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = await getPrivateProgram(slug);
  const isAdmin = Boolean(await getCurrentAdminRole());
  const live = Boolean(program && program.active && program.published);
  if (!program || (!live && !isAdmin)) notFound();
  if (programBrand(program) !== "atlantic") redirect(`/prive/${program.slug}`);
  const view = await buildPrivateProgramView(program, live);
  return <PrivateProgramContent program={view} initialRef={null} />;
}
