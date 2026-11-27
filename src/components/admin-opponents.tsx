"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";

import { categoryLabel, type Opponent } from "@/lib/match-opponents";

/** Adversaires (JP, 27 nov. 2026) : chaque club qui joue contre nous, ses équipes (catégorie, calibre, combien
 *  d'équipes), ses matchs payés ; ajout à la main ; archives. Jetons --adm-*, icônes Lucide. */

const money = (c: number) => `${(c / 100).toLocaleString("fr-CA", { maximumFractionDigits: 0 })} $`;
const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
const LEVELS = ["Récréatif", "Intermédiaire", "Compétitif", "D3", "D2", "D1", "AA", "AAA", "P1", "Élite"];

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/matchs/adversaires", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur");
}

interface Draft {
  orgName: string;
  teamLabel: string;
  gender: "filles" | "garcons" | "mixte";
  birthYear: string;
  birthYearTo: string;
  level: string;
  players: string;
  count: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
}
const EMPTY: Draft = { orgName: "", teamLabel: "", gender: "filles", birthYear: "2015", birthYearTo: "", level: "", players: "", count: "1", contactName: "", contactEmail: "", contactPhone: "", notes: "" };

function TeamForm({ initial, lockClub, onDone, onCancel }: { initial: Draft; lockClub?: boolean; onDone: () => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));
  const label = { display: "grid", gap: 4, fontSize: "0.8125rem", color: "var(--adm-text-2)" } as const;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          await post({
            action: "add",
            orgName: d.orgName,
            teamLabel: d.teamLabel,
            gender: d.gender,
            birthYear: Number(d.birthYear),
            birthYearTo: d.birthYearTo ? Number(d.birthYearTo) : null,
            level: d.level,
            players: d.players ? Number(d.players) : null,
            count: Number(d.count) || 1,
            contactName: d.contactName,
            contactEmail: d.contactEmail,
            contactPhone: d.contactPhone,
            notes: d.notes || null
          });
          onDone();
        } catch (err) {
          setMsg(err instanceof Error ? err.message : "Erreur");
        } finally {
          setBusy(false);
        }
      }}
      style={{ display: "grid", gap: 12, padding: 16, borderRadius: 12, background: "var(--adm-surface-2)" }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {!lockClub ? (
          <label style={label}>
            Club *
            <input className="admin-input" required value={d.orgName} onChange={set("orgName")} placeholder="Ex. FC Laval" />
          </label>
        ) : null}
        <label style={label}>
          Nom de l&apos;équipe
          <input className="admin-input" value={d.teamLabel} onChange={set("teamLabel")} placeholder="Ex. U11 F AA" />
        </label>
        <label style={label}>
          Genre
          <select className="admin-input" value={d.gender} onChange={set("gender")}>
            <option value="filles">Filles</option>
            <option value="garcons">Garçons</option>
            <option value="mixte">Mixte</option>
          </select>
        </label>
        <label style={label}>
          Année de naissance *
          <input className="admin-input" required inputMode="numeric" value={d.birthYear} onChange={set("birthYear")} />
        </label>
        <label style={label}>
          Jusqu&apos;à (groupe de 2 ans)
          <input className="admin-input" inputMode="numeric" value={d.birthYearTo} onChange={set("birthYearTo")} placeholder="facultatif" />
        </label>
        <label style={label}>
          Calibre
          <input className="admin-input" list="nv-levels" value={d.level} onChange={set("level")} placeholder="Ex. AA" />
        </label>
        <label style={label}>
          Combien d&apos;équipes
          <input className="admin-input" inputMode="numeric" value={d.count} onChange={set("count")} />
        </label>
        <label style={label}>
          Joueurs par équipe
          <input className="admin-input" inputMode="numeric" value={d.players} onChange={set("players")} placeholder="facultatif" />
        </label>
        {!lockClub ? (
          <>
            <label style={label}>
              Responsable
              <input className="admin-input" value={d.contactName} onChange={set("contactName")} />
            </label>
            <label style={label}>
              Courriel
              <input className="admin-input" type="email" value={d.contactEmail} onChange={set("contactEmail")} />
            </label>
            <label style={label}>
              Téléphone
              <input className="admin-input" value={d.contactPhone} onChange={set("contactPhone")} />
            </label>
          </>
        ) : null}
      </div>
      <datalist id="nv-levels">{LEVELS.map((l) => <option key={l} value={l} />)}</datalist>
      <label style={label}>
        Précisions
        <input className="admin-input" value={d.notes} onChange={set("notes")} placeholder="Ex. veut 2 matchs au printemps" />
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="admin-btn-primary" disabled={busy}>Enregistrer</button>
        <button type="button" className="admin-btn-ghost" onClick={onCancel}>Annuler</button>
        {msg ? <span style={{ color: "var(--adm-bad)", fontSize: "0.8125rem" }}>{msg}</span> : null}
      </div>
    </form>
  );
}

function CountInput({ id, value }: { id: string; value: number }) {
  const router = useRouter();
  const [v, setV] = useState(String(value));
  return (
    <input
      className="admin-input"
      aria-label="Combien d'équipes"
      inputMode="numeric"
      value={v}
      style={{ width: 56, textAlign: "center" }}
      onChange={(e) => setV(e.target.value)}
      onBlur={async () => {
        const n = Math.max(1, Math.round(Number(v)) || 1);
        setV(String(n));
        if (n !== value) {
          await post({ action: "update", id, count: n }).catch(() => null);
          router.refresh();
        }
      }}
    />
  );
}

export function AdminOpponents({ opponents, archives }: { opponents: Opponent[]; archives: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [addTo, setAddTo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = opponents.filter((o) => !o.archived);
  const archived = opponents.filter((o) => o.archived);
  const list = archives ? archived : active;
  const act = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await post(body);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="admin-section mda" style={{ display: "grid", gap: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <div>
          <h1 className="mda-h1" style={{ margin: 0 }}>{archives ? `Adversaires archivés · ${archived.length}` : `Adversaires · ${active.length}`}</h1>
          <p className="mda-lead" style={{ margin: "4px 0 0" }}>Chaque club qui joue contre nous : ses équipes (catégorie, calibre, combien), ses matchs payés. Les équipes viennent du formulaire des clubs, ou s&apos;ajoutent à la main.</p>
        </div>
        {!archives ? (
          <button type="button" className="admin-btn-primary" onClick={() => setAdding((a) => !a)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={16} aria-hidden /> Ajouter un adversaire
          </button>
        ) : null}
      </header>

      <div className="mda-tabs" role="tablist" style={{ display: "flex", gap: 6 }}>
        <Link href="/admin/matchs/adversaires" className={archives ? "admin-btn-ghost" : "admin-btn-primary"} aria-current={!archives ? "page" : undefined} style={{ textDecoration: "none" }}>
          Actifs · {active.length}
        </Link>
        <Link href="/admin/matchs/adversaires?vue=archives" className={archives ? "admin-btn-primary" : "admin-btn-ghost"} aria-current={archives ? "page" : undefined} style={{ textDecoration: "none" }}>
          Archives · {archived.length}
        </Link>
      </div>

      {adding && !archives ? (
        <TeamForm
          initial={EMPTY}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      ) : null}
      {error ? <p style={{ margin: 0, color: "var(--adm-bad)" }} role="alert">{error}</p> : null}

      {list.length === 0 ? (
        <div className="mda-card">
          <p style={{ margin: 0, color: "var(--adm-text-2)" }}>{archives ? "Aucun adversaire archivé." : "Aucun adversaire pour l'instant. Ajoutez-en un, ou envoyez le lien de réservation des matchs aux clubs."}</p>
        </div>
      ) : (
        list.map((o) => (
          <section key={o.key} className="mda-card" style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                {o.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.logo} alt="" width={44} height={44} style={{ borderRadius: 10, objectFit: "contain", background: "var(--adm-surface-2)" }} />
                ) : (
                  <span aria-hidden style={{ width: 44, height: 44, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--adm-accent-soft)", color: "var(--adm-accent)", fontWeight: 700 }}>{o.name.trim().charAt(0).toUpperCase()}</span>
                )}
                <div style={{ minWidth: 0 }}>
                  <h2 className="mda-h2" style={{ margin: 0 }}>{o.name}</h2>
                  <p style={{ margin: "2px 0 0", color: "var(--adm-text-2)", fontSize: "0.875rem", fontVariantNumeric: "tabular-nums" }}>
                    {o.teamTotal} équipe{o.teamTotal > 1 ? "s" : ""} · {o.matchesPaid} match{o.matchesPaid > 1 ? "s" : ""} payé{o.matchesPaid > 1 ? "s" : ""} · {money(o.paidCents)}
                    {o.nextMatch ? ` · prochain match le ${day(o.nextMatch)}` : o.lastMatch ? ` · dernier match le ${day(o.lastMatch)}` : ""}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!archives ? (
                  <button type="button" className="admin-btn-ghost" onClick={() => setAddTo(addTo === o.key ? null : o.key)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Plus size={15} aria-hidden /> Ajouter une équipe
                  </button>
                ) : null}
                <button type="button" className="admin-btn-ghost" disabled={busy === o.key} onClick={() => act(o.key, { action: "archive", key: o.key, archived: !archives })} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {archives ? <ArchiveRestore size={15} aria-hidden /> : <Archive size={15} aria-hidden />}
                  {archives ? "Sortir des archives" : "Archiver"}
                </button>
              </div>
            </div>

            {o.contacts.length ? (
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--adm-text-2)" }}>
                {o.contacts.map((c, i) => (
                  <span key={`${c.email}-${i}`}>
                    {i ? " · " : ""}
                    {[c.name, c.email, c.phone].filter(Boolean).join(", ")}
                  </span>
                ))}
              </p>
            ) : null}

            {addTo === o.key ? (
              <TeamForm
                lockClub
                initial={{ ...EMPTY, orgName: o.name }}
                onCancel={() => setAddTo(null)}
                onDone={() => {
                  setAddTo(null);
                  router.refresh();
                }}
              />
            ) : null}

            {o.teams.length ? (
              <div className="mda-scroll">
                <table className="mda-table" style={{ minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th>Catégorie</th>
                      <th>Équipe</th>
                      <th className="r">Joueurs</th>
                      <th className="r">Combien</th>
                      <th>Ajoutée</th>
                      <th aria-label="Retirer" />
                    </tr>
                  </thead>
                  <tbody>
                    {o.teams.map((t) => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 600 }}>{categoryLabel(t)}</td>
                        <td>
                          {t.team_label}
                          {t.notes ? <span style={{ display: "block", fontSize: "0.75rem", color: "var(--adm-text-3)" }}>{t.notes}</span> : null}
                        </td>
                        <td className="r">{t.team_players ?? "—"}</td>
                        <td className="r">{archives ? t.team_count ?? 1 : <CountInput id={t.id} value={t.team_count ?? 1} />}</td>
                        <td style={{ color: "var(--adm-text-2)", fontSize: "0.8125rem" }}>{t.source === "manuel" ? "À la main" : "Formulaire du club"}</td>
                        <td>
                          {t.source === "manuel" && !archives ? (
                            <button type="button" className="admin-btn-ghost" aria-label={`Retirer ${t.team_label}`} disabled={busy === t.id} onClick={() => window.confirm("Retirer cette équipe ?") && act(t.id, { action: "remove", id: t.id })}>
                              <Trash2 size={15} aria-hidden />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ margin: 0, color: "var(--adm-text-3)", fontSize: "0.875rem" }}>Aucune équipe enregistrée (club connu par ses réservations seulement).</p>
            )}
          </section>
        ))
      )}
    </div>
  );
}
