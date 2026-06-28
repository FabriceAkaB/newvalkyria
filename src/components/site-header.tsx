import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/container";
import { MainNav } from "@/components/main-nav";
import logo from "@/content/image/logo/LogoNewValkeryaBlackwhite.png";

export function SiteHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-4 pt-3">
      <div className="mx-auto max-w-6xl rounded-2xl bg-ink px-5 md:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-display text-xl uppercase tracking-[0.18em] text-white">
            <Image src={logo} alt="" width={34} height={34} className="logo-img" aria-hidden />
            New Valkyria
          </Link>
          <MainNav />
          <Link
            href="/inscription"
            className="hidden rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-accent-soft md:inline-flex"
          >
            Réserver une place
          </Link>
        </div>
      </div>
    </header>
  );
}
