import Link from "next/link";

import { Container } from "@/components/container";

export default function NotFound() {
  return (
    <section className="nf-root">
      <Container className="max-w-xl">
        <div className="nf-inner">

          <p className="nf-num" aria-hidden>404</p>

          <p className="nf-kicker">Page introuvable</p>
          <h1 className="nf-title">Cette page<br />n&apos;existe pas</h1>
          <p className="nf-sub">
            Elle a peut-être été déplacée ou l&apos;adresse contient une erreur.
          </p>

          <Link href="/" className="nf-cta">
            ← Retour à l&apos;accueil
          </Link>

        </div>
      </Container>
    </section>
  );
}
