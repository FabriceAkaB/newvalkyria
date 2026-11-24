"use client";

import { CalendarDays, Check, CircleCheck, Clock, MapPin, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ANSWERS, deadlineLabel, money, type GirlAnswer, type TournamentAnswer, type TournamentView } from "@/lib/tournaments-core";

/** Carte d'un tournoi (JP, 25 nov. 2026), la même dans l'espace famille et sur la page à lien privé :
 *  image, nom, quand, où, équipe visée, coût par joueuse, barre « X sur le minimum », réponse de la famille,
 *  et au go le bouton « Payer la place ». */

function Cost({ t }: { t: TournamentView }) {
  if (t.priceCents != null) {
    return (
      <div className="tourn-cost">
        <strong>{money(t.priceCents)}</strong>
        <span>par joueuse, prix fixé au go</span>
      </div>
    );
  }
  const same = t.costHigh === t.costLow;
  return (
    <div className="tourn-cost">
      <strong>{same ? money(t.costHigh) : `${money(t.costLow)} à ${money(t.costHigh)}`}</strong>
      <span>
        par joueuse : {money(t.totalFeesCents)} (inscription {t.teams > 1 ? `de ${t.teams} équipes` : "de l'équipe"} et coach) partagés entre {same ? t.minPlayers : `${t.minPlayers} et ${t.maxPlayers}`} joueuses
      </span>
    </div>
  );
}

function Progress({ t }: { t: TournamentView }) {
  return (
    <div className="tourn-progress" data-reached={t.reached || undefined}>
      <div className="tourn-progress__label">
        <span>
          <strong>{t.count}</strong> disponible{t.count > 1 ? "s" : ""} sur un minimum de {t.minPlayers}
        </span>
        <span>{t.go ? "Go donné" : t.reached ? "Minimum atteint" : `Il en manque ${t.minPlayers - t.count}`}</span>
      </div>
      <div className="fam-bar-track" role="progressbar" aria-valuemin={0} aria-valuemax={t.minPlayers} aria-valuenow={Math.min(t.count, t.minPlayers)} aria-label="Joueuses disponibles sur le minimum">
        <span style={{ width: `${Math.max(3, t.pct)}%` }} />
      </div>
    </div>
  );
}

function Header({ t, href }: { t: TournamentView; href?: string }) {
  return (
    <>
      <div className="tourn-art" data-empty={t.imageUrl ? undefined : true}>
        {t.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.imageUrl} alt="" />
        ) : (
          <div className="tourn-art__empty">
            <Trophy strokeWidth={1.5} aria-hidden />
          </div>
        )}
      </div>
      <div className="tourn-body">
        {t.teamLabel ? <p className="tourn-eyebrow">{t.teamLabel}</p> : null}
        <h2 className="tourn-name">{href ? <Link href={href}>{t.name}</Link> : t.name}</h2>
        <ul className="tourn-meta">
          <li>
            <CalendarDays aria-hidden />
            <span>{t.datesLabel}</span>
          </li>
          {t.location || t.venue ? (
            <li>
              <MapPin aria-hidden />
              <span>{[t.venue, t.location].filter(Boolean).join(", ")}</span>
            </li>
          ) : null}
          {t.organizer ? (
            <li>
              <Users aria-hidden />
              <span>
                Organisé par {t.organizerUrl ? <a href={t.organizerUrl} target="_blank" rel="noreferrer">{t.organizer}</a> : t.organizer}
              </span>
            </li>
          ) : null}
        </ul>
      </div>
    </>
  );
}

function GirlRow({ girl, slug, endpoint, onChange }: { girl: GirlAnswer; slug: string; endpoint: "famille" | "lien"; onChange: (g: GirlAnswer) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const answer = async (a: TournamentAnswer) => {
    setBusy(a);
    setError(null);
    const res = await fetch(endpoint === "famille" ? "/api/compte/tournois" : "/api/tournois", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(endpoint === "famille" ? { slug, firstName: girl.firstName, lastName: girl.lastName, answer: a } : { token: girl.token, answer: a })
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(null);
    if (!res?.ok) return setError(data?.error ?? "Réponse non enregistrée. Réessayez.");
    onChange({ ...girl, answer: data.answer, offerStatus: data.offerStatus ?? null, token: data.token ?? girl.token });
    router.refresh(); // la barre « X sur le minimum » suit
  };

  const pay = async () => {
    setBusy("pay");
    setError(null);
    const res = await fetch("/api/tournois/payer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: girl.token }) }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok || !data?.url) {
      setBusy(null);
      return setError(data?.error ?? "Paiement impossible pour l'instant.");
    }
    window.location.href = data.url;
  };

  const paid = girl.offerStatus === "payee";
  return (
    <div className="tourn-girl">
      <p className="tourn-girl__name">{girl.firstName}</p>
      {paid ? (
        <p className="tourn-paid">
          <CircleCheck aria-hidden /> Place payée. À bientôt au tournoi !
        </p>
      ) : (
        <>
          {girl.offerStatus === "offerte" && girl.payDeadline ? (
            <div className="tourn-offer">
              <p>
                <Clock aria-hidden /> Sa place est réservée jusqu&apos;au <strong>{deadlineLabel(girl.payDeadline)}</strong>.
              </p>
              <button type="button" className="tourn-pay" onClick={pay} disabled={!!busy || !girl.token}>
                {busy === "pay" ? "Ouverture du paiement…" : "Payer sa place"}
              </button>
            </div>
          ) : null}
          {girl.offerStatus === "expiree" ? <p className="tourn-note">La date limite est passée : sa place est allée à une autre joueuse. Répondez « Disponible » pour revenir sur la liste.</p> : null}
          <div className="tourn-answers" role="group" aria-label={`Réponse pour ${girl.firstName}`}>
            {ANSWERS.map((a) => (
              <button key={a.key} type="button" data-on={girl.answer === a.key || undefined} aria-pressed={girl.answer === a.key} disabled={!!busy} onClick={() => answer(a.key)}>
                {girl.answer === a.key ? <Check aria-hidden /> : null}
                {busy === a.key ? "…" : a.label}
              </button>
            ))}
          </div>
        </>
      )}
      {error ? <p className="tourn-error" role="alert">{error}</p> : null}
    </div>
  );
}

/** Une carte avec les filles de la famille (espace famille, ou lien personnel ?r=…). */
export function TournamentCard({ t, girls: initial, endpoint, href, full, children }: { t: TournamentView; girls: GirlAnswer[]; endpoint: "famille" | "lien"; href?: string; full?: boolean; children?: React.ReactNode }) {
  const [girls, setGirls] = useState(initial);
  return (
    <article className="tourn-card">
      <Header t={t} href={href} />
      <div className="tourn-body tourn-body--rest">
        <Cost t={t} />
        <Progress t={t} />
        {t.info && full ? <p className="tourn-info">{t.info}</p> : null}
        {girls.length ? (
          <div className="tourn-girls">
            <p className="tourn-ask">{t.go ? "Les places sont offertes aux familles disponibles, dans l'ordre des réponses." : "Votre réponse nous aide à décider. Rien ne vous engage avant le go."}</p>
            {girls.map((g) => (
              <GirlRow key={`${g.firstName} ${g.lastName}`} girl={g} slug={t.slug} endpoint={endpoint} onChange={(n) => setGirls((all) => all.map((x) => (x.firstName === n.firstName && x.lastName === n.lastName ? n : x)))} />
            ))}
          </div>
        ) : null}
        {children}
      </div>
    </article>
  );
}

/** Page à lien privé, sans compte : la famille se nomme (joueuse + courriel de l'inscription) pour répondre. */
export function TournamentPublicAnswer({ t }: { t: TournamentView }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async (a: TournamentAnswer) => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/tournois", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: t.slug, firstName: first, lastName: last, parentEmail: email, answer: a }) }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setMsg({ ok: false, text: data?.error ?? "Réponse non enregistrée." });
    setMsg({ ok: true, text: `Merci ! Réponse notée pour ${first.trim()} : ${ANSWERS.find((x) => x.key === a)?.label}. Au go, vous recevrez un courriel avec le lien de paiement.` });
  };

  const ready = first.trim() && last.trim() && /.+@.+\..+/.test(email.trim());
  return (
    <div className="tourn-girls">
      <p className="tourn-ask">Répondez pour votre fille. Rien ne vous engage avant le go.</p>
      <div className="tourn-form">
        <label>
          <span>Prénom de la joueuse</span>
          <input className="admin-input" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="off" />
        </label>
        <label>
          <span>Nom</span>
          <input className="admin-input" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="off" />
        </label>
        <label className="tourn-form__wide">
          <span>Courriel du parent (celui de l&apos;inscription)</span>
          <input className="admin-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
      </div>
      <div className="tourn-answers" role="group" aria-label="Réponse">
        {ANSWERS.map((a) => (
          <button key={a.key} type="button" disabled={busy || !ready} onClick={() => send(a.key)}>
            {a.label}
          </button>
        ))}
      </div>
      {msg ? <p className={msg.ok ? "tourn-paid" : "tourn-error"} role="status">{msg.ok ? <CircleCheck aria-hidden /> : null}{msg.text}</p> : null}
      <p className="tourn-note">
        Vous avez un compte ? <Link href="/compte/tournois">Répondez depuis votre espace famille</Link>.
      </p>
    </div>
  );
}
