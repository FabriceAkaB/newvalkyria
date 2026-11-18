import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountAuthForm } from "@/components/account-auth-form";
import { Container } from "@/components/container";
import { getParentUserId } from "@/lib/parent-auth";

export const metadata: Metadata = {
  title: "Mon compte | New Valkyria",
  robots: "noindex"
};
export const dynamic = "force-dynamic";

export default async function ComptePage() {
  const userId = await getParentUserId();
  if (userId) redirect("/compte/espace");

  return (
    <section className="insc-hero">
      <Container className="max-w-md">
        <div className="insc-hero-inner">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Espace parent</p>
          <h1 className="insc-hero-title">Mon compte</h1>
          <p className="insc-hero-sub">
            Créez un compte pour retrouver vos enfants d&apos;une saison à l&apos;autre et pré-remplir vos prochaines inscriptions.
          </p>
        </div>
        <AccountAuthForm />
      </Container>
    </section>
  );
}
