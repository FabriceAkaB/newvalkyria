import type { Metadata } from "next";

import { Container } from "@/components/container";
import { EmailCheckBanner } from "@/components/email-check-banner";
import { StreamPlayer } from "@/components/stream-player";
import { requireParentUserId } from "@/lib/parent-auth";
import { videosForParent } from "@/lib/match-videos";
import { durationLabel } from "@/lib/match-videos-core";

export const metadata: Metadata = { title: "Nos matchs filmés | New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Les matchs filmés de l'équipe de sa fille (et ceux où elle a joué), dans l'espace parent. */
export default async function MatchsFilmesPage() {
  const userId = await requireParentUserId();
  const { verified, videos } = await videosForParent(userId);
  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="insc-hero-inner">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Espace parent</p>
          <h1 className="insc-hero-title">Matchs filmés</h1>
          <p className="insc-hero-sub">Les matchs de l&apos;équipe de votre fille, en haute qualité. Ces vidéos sont privées : seules les familles de l&apos;équipe les voient.</p>
        </div>
      </Container>
      <Container className="max-w-2xl">
        <div style={{ display: "grid", gap: "1rem", paddingBottom: "3rem" }}>
          {!verified ? <EmailCheckBanner /> : null}
          {verified && !videos.length ? <p style={{ color: "#b9a9cf", margin: 0 }}>Aucun match filmé pour l&apos;instant. Ils apparaissent ici quelques jours après chaque match.</p> : null}
          {videos.map((v) => (
            <article key={v.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "1rem", display: "grid", gap: "0.6rem" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: "#fff" }}>{v.title}</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#b9a9cf", textTransform: "capitalize" }}>
                  {day(v.date)}
                  {v.duration_s ? ` · ${durationLabel(v.duration_s)}` : ""}
                </p>
              </div>
              <StreamPlayer endpoint={`/api/compte/matchs/${v.id}`} label="Regarder le match" />
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
