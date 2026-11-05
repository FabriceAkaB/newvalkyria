"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { McsRules } from "@/lib/mcs-rules";

interface Report {
  ok: boolean;
  dryRun: boolean;
  skipped?: string;
  added: string[];
  photos: string[];
  opponents: string[];
  unlocked: string[];
  errors: string[];
}

const TOGGLES: { key: keyof McsRules; label: string; hint: string }[] = [
  { key: "inviteOnPaid", label: "Dès le paiement : la joueuse entre dans ses équipes", hint: "Le parent reçoit l'invitation MonClubSportif tout de suite." },
  { key: "assignAllEvents", label: "Elle reçoit tout le calendrier de l'équipe", hint: "Pratiques et matchs à venir." },
  { key: "photoAuto", label: "Sa photo est mise sur son profil, par défaut", hint: "Dès qu'une photo existe ou est remplacée dans le site." },
  { key: "opponentOnPaid", label: "Le nom du club adverse est écrit sur le match payé", hint: "Dès qu'il paie sa plage." },
  { key: "presenceAlwaysEditable", label: "Présence modifiable en tout temps", hint: "Aucun verrou avant les matchs et les pratiques." }
];

const list = (v: string) => v.split(/[,;\s]+/).map(Number).filter((n) => Number.isFinite(n));

/** Pilotage du robot MonClubSportif : ses règles (par club) et un bouton pour voir ce qu'il ferait ou le lancer. */
export function McsRobotPanel({ initial, hasAccount }: { initial: McsRules; hasAccount: boolean }) {
  const router = useRouter();
  const [rules, setRules] = useState<McsRules>(initial);
  const [before, setBefore] = useState(initial.reminders.hoursBefore.join(", "));
  const [sameDay, setSameDay] = useState(initial.reminders.sameDayHours.join(", "));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const save = async (next: McsRules, okText: string) => {
    setBusy("save");
    setMsg(null);
    const res = await fetch("/api/admin/monclubsportif/robot/regles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(null);
    if (!res?.ok) return setMsg({ ok: false, text: data?.error ?? "Pas enregistré." });
    setRules(data.rules);
    setBefore(data.rules.reminders.hoursBefore.join(", "));
    setSameDay(data.rules.reminders.sameDayHours.join(", "));
    setMsg({ ok: true, text: okText });
    router.refresh();
  };

  const run = async (dryRun: boolean) => {
    if (!dryRun && !confirm("Lancer le robot pour vrai dans MonClubSportif maintenant ?")) return;
    setBusy(dryRun ? "dry" : "run");
    setMsg(null);
    const res = await fetch("/api/admin/monclubsportif/robot/lancer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dryRun }) }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as Report | null;
    setBusy(null);
    if (!res?.ok || !data) return setMsg({ ok: false, text: "Le robot n'a pas répondu." });
    setReport(data);
  };

  const section = (title: string, items: string[]) =>
    items.length ? (
      <div>
        <p style={{ margin: "8px 0 2px", fontWeight: 600, fontSize: "0.85rem" }}>{title} · {items.length}</p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.82rem", color: "var(--adm-text-2)", lineHeight: 1.5 }}>{items.slice(0, 80).map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
    ) : null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", padding: 12, borderRadius: 10, background: rules.robotActive ? "color-mix(in srgb, var(--adm-good) 14%, transparent)" : "var(--adm-surface-2)" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700 }}>{rules.robotActive ? "Robot actif : il agit tout seul" : "Mode assistant : le robot montre ce qu'il ferait, sans rien toucher"}</p>
          <p className="mda-sub" style={{ margin: 0 }}>{hasAccount ? "Compte robot enregistré." : "Compte robot pas encore enregistré (plus bas)."} Il passe à chaque paiement et chaque heure.</p>
        </div>
        <button
          type="button"
          className={rules.robotActive ? "admin-btn-ghost" : "admin-btn-primary"}
          disabled={busy !== null || (!rules.robotActive && !hasAccount)}
          onClick={() => {
            if (!rules.robotActive && !confirm("Activer le robot ? Il fera seul dans MonClubSportif ce que montre l'essai.")) return;
            save({ ...rules, robotActive: !rules.robotActive }, rules.robotActive ? "Robot remis en mode assistant." : "Robot activé.");
          }}
          style={{ minHeight: 44 }}
        >
          {rules.robotActive ? "Remettre en mode assistant" : "Activer le robot"}
        </button>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {TOGGLES.map((t) => (
          <label key={t.key} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "0.88rem" }}>
            <input type="checkbox" checked={Boolean(rules[t.key])} onChange={(e) => setRules({ ...rules, [t.key]: e.target.checked })} style={{ marginTop: 3 }} />
            <span>
              <strong style={{ fontWeight: 600 }}>{t.label}</strong>
              <span className="mda-sub" style={{ display: "block", margin: 0 }}>{t.hint}</span>
            </span>
          </label>
        ))}
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "0.88rem" }}>
          <input type="checkbox" checked={rules.reminders.active} onChange={(e) => setRules({ ...rules, reminders: { ...rules.reminders, active: e.target.checked } })} style={{ marginTop: 3 }} />
          <span>
            <strong style={{ fontWeight: 600 }}>Rappels aux familles qui n&apos;ont pas mis leur présence</strong>
            <span style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              <span className="ct-field" style={{ minWidth: 180 }}><span>Heures avant (ex. 48, 24)</span><input className="admin-input" value={before} onChange={(e) => setBefore(e.target.value)} /></span>
              <span className="ct-field" style={{ minWidth: 180 }}><span>Le jour même, à (ex. 9, 15)</span><input className="admin-input" value={sameDay} onChange={(e) => setSameDay(e.target.value)} /></span>
            </span>
          </span>
        </label>
        <label className="ct-field" style={{ maxWidth: 420 }}>
          <span>Joueuse remboursée</span>
          <select className="admin-input" value={rules.removeOnRefund} onChange={(e) => setRules({ ...rules, removeOnRefund: e.target.value as McsRules["removeOnRefund"] })}>
            <option value="validation">La retirer de MonClubSportif après ma validation</option>
            <option value="auto">La retirer toute seule</option>
            <option value="jamais">Ne jamais la retirer</option>
          </select>
        </label>
        <p className="mda-sub" style={{ margin: 0 }}>
          Équipes de matchs : {Object.entries(rules.matchLevelByProgram).map(([p, l]) => `${p} → ${l}`).join(" · ")}
        </p>
        <div className="cm-actions" style={{ marginTop: 0 }}>
          <button type="button" className="admin-btn-primary" disabled={busy !== null} onClick={() => save({ ...rules, reminders: { ...rules.reminders, hoursBefore: list(before), sameDayHours: list(sameDay) } }, "Règles enregistrées.")} style={{ minHeight: 44 }}>
            {busy === "save" ? "Enregistrement…" : "Enregistrer les règles"}
          </button>
          {msg && <span role="status" style={{ color: msg.ok ? "var(--adm-good)" : "var(--adm-bad)", fontSize: "0.85rem" }}>{msg.text}</span>}
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--adm-border)", paddingTop: 12, display: "grid", gap: 8 }}>
        <div className="cm-actions" style={{ marginTop: 0 }}>
          <button type="button" className="admin-btn-ghost" disabled={busy !== null || !hasAccount} onClick={() => run(true)} style={{ minHeight: 44 }}>
            {busy === "dry" ? "Le robot regarde…" : "Voir ce que le robot ferait"}
          </button>
          <button type="button" className="admin-btn-ghost" disabled={busy !== null || !hasAccount} onClick={() => run(false)} style={{ minHeight: 44 }}>
            {busy === "run" ? "Le robot travaille…" : "Lancer maintenant pour vrai"}
          </button>
        </div>
        {report && (
          <div style={{ padding: 12, borderRadius: 10, background: "var(--adm-surface-2)" }}>
            <p style={{ margin: 0, fontWeight: 700 }}>
              {report.skipped ? report.skipped : report.dryRun ? "Essai : voici ce que le robot ferait (rien n'a été touché)." : report.ok ? "Fait dans MonClubSportif." : "Fait en partie : voir les erreurs."}
            </p>
            {section(report.dryRun ? "Joueuses à ajouter (invitation au parent)" : "Joueuses ajoutées", report.added)}
            {section(report.dryRun ? "Photos à mettre" : "Photos mises", report.photos)}
            {section(report.dryRun ? "Adversaires à écrire" : "Adversaires écrits", report.opponents)}
            {section("Équipes où les présences ont été déverrouillées", report.unlocked)}
            {section("Erreurs", report.errors)}
            {!report.skipped && !report.added.length && !report.photos.length && !report.opponents.length && !report.unlocked.length && !report.errors.length ? <p className="mda-sub" style={{ margin: "6px 0 0" }}>Rien à faire : tout concorde.</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
