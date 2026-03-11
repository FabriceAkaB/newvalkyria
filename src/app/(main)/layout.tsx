import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="page-background" aria-hidden />
      <SiteHeader />
      <main className="pt-20">{children}</main>
      <SiteFooter />
    </>
  );
}
