import { SiteFooter } from "@/components/site-footer";
import { organizationJsonLd } from "@/lib/organization-jsonld";
import { SiteHeader } from "@/components/site-header";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <div className="page-background" aria-hidden />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
