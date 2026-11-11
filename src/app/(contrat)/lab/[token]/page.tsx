import type { Metadata } from "next";

import { LabUpload } from "@/components/valkyria-lab-family";
import { getCurrentAdminRole } from "@/lib/admin-auth";
import {
  VIDEO_TYPES,
  gameOfWeek,
  gestureOptions,
  getFamilyView,
  labMaxVideoBytes,
  listRoutines,
  monthOf,
  monthTitle,
  ofMonth,
  pickRoutine,
  playerFullName,
  firstNames,
  shortDate,
  todayIso,
  videoEmbed,
  type LabPlayer,
  type LabRoutine,
  type LabSubmission
} from "@/lib/valkyria-lab";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Valkyria Lab | New Valkyria",
  robots: { index: false, follow: false, nocache: true }
};

const INK = "#1d1730";
const MUTED = "#5d566b";
const ACCENT = "#5b2a86";
const card: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: "1.25rem", border: "1px solid #e6e0ee" };
const h2: React.CSSProperties = { fontSize: "1.2rem", fontWeight: 800, margin: 0, color: INK, letterSpacing: "-0.01em" };
const eyebrow: React.CSSProperties = { margin: 0, fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT };
const body: React.CSSProperties = { color: MUTED, lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div style={card}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0, color: INK }}>{title}</h1>
      <p style={{ ...body, marginTop: "0.5rem" }}>{text}</p>
    </div>
  );
}

/** Lecteur intégré d'une démonstration YouTube ou Vimeo (non répertoriée). */
function Demo({ url, title }: { url: string | null; title: string }) {
  const e = videoEmbed(url);
  if (!e) return null;
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: e.vertical ? 320 : undefined,
        margin: e.vertical ? "0 auto" : undefined,
        aspectRatio: e.vertical ? "9 / 16" : "16 / 9",
        borderRadius: 12,
        overflow: "hidden",
        background: "#15121c"
      }}
    >
      <iframe
        src={e.embedUrl}
        title={`Démonstration : ${title}`}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
      />
    </div>
  );
}

/** Durée approximative qui entre dans la limite : un iPhone filme environ 1 à 2 Mo par seconde en 1080p. */
function limitHint(maxBytes: number): string {
  const mb = Math.round(maxBytes / (1024 * 1024));
  const secs = Math.max(15, Math.floor((mb * 0.6) / 5) * 5);
  const duration = secs >= 120 ? `${Math.floor(secs / 60)} minutes` : `${secs} secondes`;
  return `Vidéo courte du geste · ${mb} Mo maximum (environ ${duration} en 1080p)`;
}

/** Valkyria Lab : la routine maison du mois et « Envoyer ma vidéo » (lien personnel de la famille). */
export default async function LabFamilyPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ mois?: string }> }) {
  const { token } = await params;
  const today = todayIso();

  // Aperçu pour l'admin (« Voir comme une famille ») : montre aussi un brouillon, sans envoi possible.
  let preview = false;
  let routine: LabRoutine | null = null;
  let routineIsCurrent = false;
  let parentName: string | null = null;
  let players: LabPlayer[] = [];
  let submissions: LabSubmission[] = [];
  let month = monthOf(today);

  if (token === "apercu") {
    if ((await getCurrentAdminRole()) !== "admin") return <Message title="Lien introuvable" text="Écrivez-nous à info@newvalkyria.com." />;
    const { mois } = await searchParams;
    if (mois && /^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) month = mois;
    const routines = await listRoutines();
    const own = routines.find((r) => r.month === month) ?? null;
    const picked = pickRoutine(routines, month);
    routine = own ?? picked?.routine ?? null;
    routineIsCurrent = !!own || !!picked?.current;
    preview = true;
    parentName = "Famille exemple";
    players = [{ firstName: "Joueuse", lastName: "Exemple" }];
  } else {
    const view = await getFamilyView(token, today);
    if (!view) return <Message title="Lien introuvable" text="Vérifiez le lien reçu par courriel, ou écrivez-nous à info@newvalkyria.com." />;
    if ("inactive" in view) return <Message title="Ce lien n'est plus actif" text="Si votre fille est toujours inscrite, écrivez-nous à info@newvalkyria.com et on vous renvoie votre lien." />;
    ({ routine, routineIsCurrent, submissions, month } = view);
    parentName = view.access.parent_name;
    players = view.access.players;
  }

  const first = (parentName ?? "").trim().split(/\s+/)[0];
  const kids = firstNames(players);
  const dayOfMonth = month === monthOf(today) ? today : `${month}-01`;
  const game = routine ? gameOfWeek(routine.weekly_games, dayOfMonth) : null;
  const gestures = gestureOptions(routine);
  const maxBytes = labMaxVideoBytes();

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {preview ? (
        <p style={{ margin: 0, padding: "0.75rem 1rem", borderRadius: 12, background: "#fff4d6", color: "#6b4e00", fontWeight: 600, fontSize: "0.9rem" }}>
          Aperçu : voici ce que les familles voient{routine?.status === "brouillon" ? " (cette routine est encore en brouillon)" : ""}. L’envoi de vidéo est désactivé.
        </p>
      ) : null}

      <header style={{ ...card, display: "grid", gap: "0.75rem", padding: "1.5rem 1.25rem" }}>
        <p style={eyebrow}>Valkyria Lab · {cap(monthTitle(routine?.month ?? month))}</p>
        <h1 style={{ fontSize: "1.75rem", lineHeight: 1.15, fontWeight: 800, margin: 0, color: INK, letterSpacing: "-0.02em" }}>{routine ? routine.title : "Le Valkyria Lab arrive bientôt"}</h1>
        <p style={{ ...body, color: INK }}>
          {first ? `Bonjour ${first} !` : "Bonjour !"}
          {kids ? ` Voici le travail maison de ${kids} ce mois-ci.` : ""}
        </p>
        {routine?.instructions ? <p style={body}>{routine.instructions}</p> : null}
        {routine && !routineIsCurrent ? <p style={{ ...body, fontSize: "0.9rem" }}>La routine {ofMonth(month)} arrive très bientôt : en attendant, voici celle {ofMonth(routine.month)}.</p> : null}
        {!routine ? <p style={body}>La première routine maison sera en ligne ce mois-ci. Vous recevrez un courriel dès qu’elle est prête.</p> : null}
        {routine && gestures.length ? (
          <a
            href="#envoyer"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 48, padding: "0 1.2rem", borderRadius: 12, border: `2px solid ${ACCENT}`, color: ACCENT, fontWeight: 700, textDecoration: "none", justifySelf: "start" }}
          >
            Envoyer ma vidéo ↓
          </a>
        ) : null}
      </header>

      {routine?.challenge ? (
        <section style={{ ...card, background: "#f3edf9", borderColor: "#e2d5f1", display: "grid", gap: "0.75rem" }}>
          <p style={eyebrow}>Le défi {ofMonth(routine.month)}</p>
          <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.45, whiteSpace: "pre-line" }}>{routine.challenge}</p>
          <Demo url={routine.challenge_video_url} title="défi du mois" />
          <p style={{ ...body, fontSize: "0.9rem" }}>Quand c’est réussi : filmez et envoyez la vidéo plus bas (geste « Défi du mois »).</p>
        </section>
      ) : null}

      {routine?.exercises.length ? (
        <section style={{ display: "grid", gap: "0.75rem" }}>
          <h2 style={{ ...h2, padding: "0.5rem 0.25rem 0" }}>La routine</h2>
          {routine.exercises.map((e, i) => (
            <article key={e.name} style={{ ...card, display: "grid", gap: "0.75rem" }}>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <span
                  aria-hidden
                  style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 999, background: ACCENT, color: "#fff", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.95rem" }}
                >
                  {i + 1}
                </span>
                <div style={{ display: "grid", gap: "0.25rem", minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: INK }}>{e.name}</h3>
                  {e.how ? <p style={body}>{e.how}</p> : null}
                </div>
              </div>
              <Demo url={e.videoUrl} title={e.name} />
            </article>
          ))}
        </section>
      ) : null}

      {game ? (
        <section style={{ ...card, display: "grid", gap: "0.6rem" }}>
          <p style={eyebrow}>Jeu de la semaine{routine && routine.weekly_games.length > 1 ? ` · semaine ${game.week}` : ""}</p>
          <h2 style={h2}>{game.game.title}</h2>
          {game.game.how ? <p style={body}>{game.game.how}</p> : null}
          <Demo url={game.game.videoUrl} title={game.game.title} />
        </section>
      ) : null}

      {routine && gestures.length ? (
        <section id="envoyer" style={{ display: "grid", gap: "0.75rem", scrollMarginTop: 16 }}>
          <div style={{ padding: "0.5rem 0.25rem 0" }}>
            <h2 style={h2}>Envoyer ma vidéo</h2>
            <p style={{ ...body, marginTop: "0.3rem" }}>Filmez le geste ou le défi, puis envoyez-le : le coach le regarde et vous répond sur cette page.</p>
          </div>
          <LabUpload
            token={token}
            players={players.map((p) => ({ value: playerFullName(p), label: p.firstName || playerFullName(p) }))}
            gestures={gestures}
            maxBytes={maxBytes}
            limitHint={limitHint(maxBytes)}
            videoExts={Object.keys(VIDEO_TYPES)}
            preview={preview}
          />
        </section>
      ) : null}

      {submissions.length ? (
        <section style={{ display: "grid", gap: "0.75rem" }}>
          <h2 style={{ ...h2, padding: "0.5rem 0.25rem 0" }}>Nos vidéos</h2>
          <ul style={{ ...card, listStyle: "none", margin: 0, padding: 0, overflow: "hidden" }}>
            {submissions.map((s, i) => (
              <li key={s.id} style={{ padding: "1rem 1.25rem", borderTop: i ? "1px solid #efe9f5" : "none", display: "grid", gap: "0.4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                  <span style={{ fontWeight: 700, color: INK }}>
                    {s.player_name.split(" ")[0]} · {s.gesture}
                  </span>
                  <span style={{ fontSize: "0.85rem", color: MUTED }}>{shortDate(s.recorded_on)}</span>
                </div>
                <span
                  style={{
                    justifySelf: "start",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    padding: "0.2rem 0.65rem",
                    borderRadius: 999,
                    background: s.status === "vu" ? "#e3f5ea" : "#fdf3dc",
                    color: s.status === "vu" ? "#1d6b3c" : "#7a5500"
                  }}
                >
                  {s.status === "vu" ? "✓ Vue par le coach" : "Envoyée · le coach va la regarder"}
                </span>
                {s.status === "vu" && s.coach_comment ? (
                  <p style={{ margin: 0, padding: "0.6rem 0.8rem", borderLeft: `3px solid ${ACCENT}`, background: "#f7f3fb", borderRadius: 6, color: INK, lineHeight: 1.5 }}>« {s.coach_comment} »</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
