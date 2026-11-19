import { Award, CircleCheck, Flag, MessagesSquare, Target, Timer, TrendingUp } from "lucide-react";

import { FamilyMeetingRequest } from "@/components/family-meeting-request";
import { levelLabel, type GestureState, type PassportGesture } from "@/lib/family-passport";
import type { FamilyParcours } from "@/lib/family-passport-repo";

/** Espace famille, page Progression : le passeport d'une fille (niveau, tests, gestes réussis et à travailler) et
 *  « Mon parcours » (ses objectifs, la rencontre fille-parent-coach de 10 minutes). Elle est comparée à elle-même
 *  seulement (P1.5.03) : aucun classement, aucune moyenne de groupe. */

const fr = (n: number) => n.toLocaleString("fr-CA", { maximumFractionDigits: 1 });
const dateFr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "long" });

const GROUPS: { state: GestureState; title: string; Icon: typeof CircleCheck; tone: string }[] = [
  { state: "reussi", title: "Gestes réussis", Icon: CircleCheck, tone: "var(--adm-good)" },
  { state: "en-progres", title: "En progrès", Icon: TrendingUp, tone: "var(--adm-accent)" },
  { state: "a-travailler", title: "À travailler", Icon: Target, tone: "var(--adm-warn)" }
];

const h3: React.CSSProperties = { margin: "0 0 8px", fontSize: "0.9rem", fontWeight: 600, color: "var(--adm-text)" };

function gestureDetail(g: PassportGesture): string {
  const parts: string[] = [];
  if (g.last === null) parts.push("Difficile à la dernière pratique");
  if (g.sinceFirst !== null && g.sinceFirst !== 0) parts.push(`${g.sinceFirst > 0 ? "+" : "−"}${Math.abs(g.sinceFirst)} depuis sa première note`);
  if (g.level) parts.push(`Geste du niveau ${levelLabel(g.level)}`);
  return parts.join(" · ");
}

export function FamilyPassport({ registrationId, firstName, photoUrl = null, data }: { registrationId: string; firstName: string; photoUrl?: string | null; data: FamilyParcours }) {
  const { passport, objectives, meeting } = data;
  return (
    <>
      <div className="parent-card" style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="fam-girl__avatar" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photoUrl ? <img src={photoUrl} alt="" /> : firstName.charAt(0)}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>Le passeport de {firstName}</h2>
            <p style={{ margin: "4px 0 0", display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.9rem", fontWeight: 600, color: "var(--adm-accent)" }}>
              <Award size={16} aria-hidden />
              {passport.level ? `Niveau ${levelLabel(passport.level)}` : "Niveau à venir"}
            </p>
          </div>
        </div>

        {passport.empty ? (
          <p className="parent-muted" style={{ margin: 0 }}>
            Son passeport se remplit au fil des tests de la saison : bronze, argent, or, puis mauve. Les éducatrices notent ses gestes à chaque pratique et la
            testent chaque mois, toujours comparée à elle-même.
          </p>
        ) : (
          <>
            <p className="parent-muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              {firstName} est comparée à elle-même seulement : à son premier test et à ses notes précédentes, jamais aux autres.
              {passport.next ? ` Prochain écusson : ${levelLabel(passport.next)}.` : ""}
            </p>

            {passport.tests.length ? (
              <div>
                <h3 style={h3}>Ses tests</h3>
                <ul className="fam-list">
                  {passport.tests.map((t) => (
                    <li key={t.testId}>
                      <Timer aria-hidden />
                      <span>
                        {t.name}
                        <small>{t.sinceFirst ? `Depuis son premier test : ${t.sinceFirst}` : `Premier test le ${dateFr(t.lastOn)}`}</small>
                      </span>
                      <span style={{ flex: "0 0 auto", display: "grid", justifyItems: "end", textAlign: "right" }}>
                        <strong>{fr(t.last)} {t.unit}</strong>
                        {t.level ? <small>{levelLabel(t.level)}</small> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {GROUPS.map(({ state, title, Icon, tone }) => {
              const list = passport.gestures.filter((g) => g.state === state);
              if (!list.length) return null;
              return (
                <div key={state}>
                  <h3 style={h3}>{title}</h3>
                  <ul className="fam-list">
                    {list.map((g) => {
                      const detail = gestureDetail(g);
                      return (
                        <li key={g.name}>
                          <Icon aria-hidden style={{ color: tone }} />
                          <span>
                            {g.name}
                            {detail ? <small>{detail}</small> : null}
                          </span>
                          {g.last !== null ? <strong style={{ flex: "0 0 auto" }}>{g.last}/10</strong> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="parent-card" style={{ display: "grid", gap: 16 }}>
        <h2 style={{ margin: 0 }}>Mon parcours : {firstName}</h2>
        <div>
          <h3 style={h3}>Ses objectifs</h3>
          {objectives.length ? (
            <ul className="fam-list">
              {objectives.map((o, i) => (
                <li key={`${i}-${o}`}>
                  <Flag aria-hidden />
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="parent-muted" style={{ margin: 0, fontSize: "0.9rem" }}>Ses objectifs seront fixés avec son éducatrice et apparaîtront ici.</p>
          )}
        </div>
        <div style={{ display: "grid", gap: 10, padding: 16, borderRadius: 12, background: "var(--adm-surface-2)", border: "1px solid var(--adm-line)" }}>
          <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "var(--adm-text)" }}>
            <MessagesSquare size={18} aria-hidden style={{ color: "var(--adm-accent)", flex: "0 0 auto" }} />
            Rencontre fille-parent-coach de 10 minutes
          </p>
          <p className="parent-muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            {firstName}, vous et son éducatrice, dix minutes pour regarder son passeport, ses objectifs et la suite de sa saison.
          </p>
          {meeting ? (
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--adm-text)" }}>
              <span className="fam-status" style={{ marginRight: 8 }}>{meeting.status === "en_cours" ? "En préparation" : "Demande reçue"}</span>
              Demandée le {dateFr(meeting.requestedAt)} : nous vous écrivons pour fixer le moment.
            </p>
          ) : (
            <FamilyMeetingRequest registrationId={registrationId} firstName={firstName} />
          )}
        </div>
      </div>
    </>
  );
}
