"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { formatMoney } from "@/lib/private-programs";
import type { CodeRow, CreditFamilyRow, FinancialSummary, ReferralAdminRow } from "@/lib/private-programs-admin";

type Tab = "references" | "credits" | "codes" | "finances" | "campagne";

const STATUS_LABELS: Record<string, string> = { a_verifier: "À vérifier", confirme: "Confirmée", valide: "Validée", rejete: "Refusée", annule: "Annulée" };
const STATUS_COLORS: Record<string, string> = { a_verifier: "#f0c878", confirme: "#9ec9ff", valide: "#8fce9f", rejete: "#ff9999", annule: "#ff9999" };
const REWARD_LABELS: Record<string, string> = {
  aucune: "—",
  a_choisir: "À choisir par le parent",
  sac_a_remettre: "Sac — À remettre",
  sac_remis: "Sac — Remis",
  credit_accorde: "Crédit de 50 $",
  annulee: "Annulée"
};
const KIND_LABELS: Record<string, string> = {
  recompense: "Récompense",
  utilisation: "Utilisation",
  annulation_utilisation: "Utilisation annulée",
  correction: "Correction admin",
  rabais_verification: "Rabais après vérification"
};
const MATCH_LABELS: Record<string, string> = { code: "Code", courriel: "Courriel", nom: "Nom (à confirmer)", ambigu: "Plusieurs familles", aucune: "Introuvable" };

export function AdminReferences({
  initial
}: {
  initial: { referrals: ReferralAdminRow[]; credits: CreditFamilyRow[]; codes: CodeRow[]; financials: FinancialSummary };
}) {
  const [tab, setTab] = useState<Tab>("references");
  const [data, setData] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [openCredit, setOpenCredit] = useState<string | null>(null);
  const [adjust, setAdjust] = useState({ email: "", amount: "", note: "" });
  const [assign, setAssign] = useState<Record<string, string>>({});

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(null), 4500);
  };

  const reload = async () => {
    const res = await fetch("/api/admin/references");
    if (res.ok) setData(await res.json());
  };

  const post = async (url: string, body: unknown, ok: string, key: string) => {
    setBusy(key);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      flash(ok + (json.created != null ? ` (${json.created} nouveaux codes sur ${json.total} familles)` : ""));
      await reload();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const referrals = data.referrals.filter((r) => {
    if (filter === "bags" && !(r.reward_choice === "sac")) return false;
    if (filter === "bags_pending" && r.reward_status !== "sac_a_remettre") return false;
    if (filter === "verify" && r.status !== "a_verifier") return false;
    if (filter === "choose" && r.reward_status !== "a_choisir") return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${r.referrer_name ?? ""} ${r.referrer_email ?? ""} ${r.new_family_name ?? ""} ${r.player_name ?? ""} ${r.claimed_referrer_name ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const tabBtn = (t: Tab, label: string, count?: number) => (
    <button key={t} onClick={() => setTab(t)} data-active={String(tab === t)} className="admin-filter-btn">
      {label}
      {count != null && <span className="admin-filter-count">{count}</span>}
    </button>
  );

  const cell: React.CSSProperties = { padding: "0.45rem 0.5rem", borderBottom: "1px solid #1f1d25", color: "#c3c2c8", verticalAlign: "top" };
  const head: React.CSSProperties = { padding: "0.45rem 0.5rem", borderBottom: "1px solid #251f30", color: "#9d9da0", fontWeight: 600, textAlign: "left" };
  const f = data.financials;

  /* ── Campagne « Partagez New Valkyria » ── */
  interface CampaignData {
    audienceCurrent: number;
    audienceAll: number;
    alreadySent: number;
    programs: { slug: string; name: string; priceCents: number }[];
    from: string;
    preview: { subject: string; html: string };
    families: { name: string; email: string; phone: string | null; code: string; sent: boolean; message: string; whatsapp: string | null; sms: string | null }[];
  }
  const [camp, setCamp] = useState<CampaignData | null>(null);
  const [includePast, setIncludePast] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [testTo, setTestTo] = useState("");
  const [campMsg, setCampMsg] = useState<string | null>(null);
  const [campBusy, setCampBusy] = useState(false);
  const [famSearch, setFamSearch] = useState("");

  const loadCampaign = useCallback(async () => {
    const res = await fetch(`/api/admin/references/campagne?includePast=${includePast ? 1 : 0}&step=${step}`);
    if (res.ok) setCamp(await res.json());
    else setCampMsg((await res.json().catch(() => ({}))).error ?? "Erreur de chargement");
  }, [includePast, step]);

  useEffect(() => {
    if (tab === "campagne") loadCampaign();
  }, [tab, loadCampaign]);

  const sendTest = async () => {
    setCampBusy(true);
    setCampMsg(null);
    try {
      const res = await fetch("/api/admin/references/campagne", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test", to: testTo, step }) });
      const json = await res.json().catch(() => ({}));
      setCampMsg(res.ok ? `✓ Courriel de test envoyé à ${json.to}.` : `✗ Envoi impossible : ${json.error ?? "erreur"}`);
    } finally {
      setCampBusy(false);
    }
  };

  const sendAll = async () => {
    if (!camp) return;
    const count = includePast ? camp.audienceAll : camp.audienceCurrent;
    if (!confirm(`Envoyer ce courriel à ${count - camp.alreadySent} famille(s) ? Chaque famille reçoit son propre code. Cette action ne peut pas être annulée.`)) return;
    setCampBusy(true);
    setCampMsg(null);
    let sent = 0;
    try {
      for (let i = 0; i < 20; i++) {
        const res = await fetch("/api/admin/references/campagne", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_all", includePast, limit: 40, step }) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok && !json.sent) throw new Error(json.error ?? "Erreur");
        sent += json.sent ?? 0;
        setCampMsg(`Envoi en cours… ${sent} envoyé(s), ${json.remaining ?? 0} restant(s).`);
        if (json.failed > 0) throw new Error(json.error ?? "Des envois ont échoué");
        if (!json.remaining) break;
      }
      setCampMsg(`✓ Campagne terminée : ${sent} courriel(s) envoyé(s).`);
    } catch (err) {
      setCampMsg(`✗ ${err instanceof Error ? err.message : "Erreur"} (${sent} envoyé(s) avant l'arrêt)`);
    } finally {
      setCampBusy(false);
      loadCampaign();
    }
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Références, crédits et finances</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1rem" }}>
            Programmes garçons privés : recommandations entre familles, récompenses (sac ou crédit de 50 $), registre de crédits et tableau financier.
          </p>
          {message && <p style={{ fontSize: "0.78rem", color: "#8fce9f", marginBottom: "0.8rem" }}>{message}</p>}

          <div className="admin-filters" style={{ marginBottom: "1rem" }}>
            {tabBtn("references", "Références", data.referrals.length)}
            {tabBtn("credits", "Crédits", data.credits.length)}
            {tabBtn("codes", "Codes", data.codes.length)}
            {tabBtn("finances", "Finances")}
            {tabBtn("campagne", "Campagne de partage")}
          </div>

          {/* ─────────── Références ─────────── */}
          {tab === "references" && (
            <>
              <div className="admin-filters-row" style={{ marginBottom: "0.8rem", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                <select className="admin-group-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">Toutes</option>
                  <option value="verify">À vérifier</option>
                  <option value="choose">Récompense à choisir</option>
                  <option value="bags">Sacs choisis</option>
                  <option value="bags_pending">Sacs à remettre</option>
                </select>
                <input type="search" className="admin-search-input" placeholder="Rechercher famille, joueur…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem", minWidth: "1050px" }}>
                  <thead>
                    <tr>{["Famille référente", "Nouvelle famille", "Joueur", "Programme", "Date", "Rabais", "Paiement", "Validation", "Récompense", "Crédit réf."].map((h) => <th key={h} style={head}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {referrals.map((r) => (
                      <Fragment key={r.id}>
                        <tr>
                          <td style={cell}>
                            <strong style={{ color: "#fff" }}>{r.referrer_name ?? r.claimed_referrer_name ?? "—"}</strong>
                            <br /><span style={{ color: "#6d6b71" }}>{r.referrer_email ?? "non identifié"}{r.referrer_code ? ` · ${r.referrer_code}` : ""}</span>
                            <br /><span style={{ color: "#6d6b71" }}>Reconnu par : {MATCH_LABELS[r.match_method] ?? r.match_method}</span>
                          </td>
                          <td style={cell}>{r.new_family_name}<br /><span style={{ color: "#6d6b71" }}>{r.new_family_email}</span></td>
                          <td style={cell}>{r.player_name}</td>
                          <td style={cell}>{r.program_name}</td>
                          <td style={cell}>{r.created_at.slice(0, 10)}</td>
                          <td style={cell}>{r.discount_cents > 0 ? formatMoney(r.discount_cents) : "—"}</td>
                          <td style={cell}>{r.registration_status === "paid" || r.registration_status === "confirmed" ? <span style={{ color: "#8fce9f" }}>Payé</span> : r.registration_status === "pending" ? <span style={{ color: "#f0c878" }}>En attente</span> : r.registration_status}</td>
                          <td style={cell}><span style={{ color: STATUS_COLORS[r.status], fontWeight: 700 }}>{STATUS_LABELS[r.status] ?? r.status}</span></td>
                          <td style={cell}>
                            {REWARD_LABELS[r.reward_status] ?? r.reward_status}
                            {r.reward_status === "sac_a_remettre" && (
                              <><br /><button className="admin-btn-primary" style={{ fontSize: "0.66rem", padding: "0.2rem 0.5rem", marginTop: "0.3rem" }} disabled={busy === r.id} onClick={() => post(`/api/admin/references/${r.id}`, { action: "bag_delivered" }, "Sac marqué comme remis.", r.id)}>Marquer remis</button></>
                            )}
                            {r.reward_status === "sac_remis" && (
                              <><br /><button className="admin-btn-ghost" style={{ fontSize: "0.66rem", padding: "0.2rem 0.5rem", marginTop: "0.3rem" }} disabled={busy === r.id} onClick={() => post(`/api/admin/references/${r.id}`, { action: "bag_undo" }, "Remise annulée.", r.id)}>Annuler la remise</button></>
                            )}
                          </td>
                          <td style={cell}>{formatMoney(r.referrer_credit_cents)}</td>
                        </tr>
                        {(r.status === "a_verifier" || r.status === "confirme") && (
                          <tr>
                            <td colSpan={10} style={{ ...cell, background: "#0d0b13" }}>
                              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                                <span style={{ color: "#f0c878" }}>
                                  {r.status === "a_verifier"
                                    ? `Déclaré : « ${r.claimed_referrer_name ?? "—"} »${r.claimed_player_name ? ` (joueur : ${r.claimed_player_name})` : ""}${r.claimed_contact ? ` · contact : ${r.claimed_contact}` : ""} — à vérifier.`
                                    : "Confirmée — la récompense sera créée dès que le paiement est reçu."}
                                </span>
                                {r.status === "a_verifier" && (
                                  <>
                                    {r.referrer_email && (
                                      <button className="admin-btn-primary" style={{ fontSize: "0.68rem" }} disabled={busy === r.id} onClick={() => post(`/api/admin/references/${r.id}`, { action: "confirm" }, "Recommandation confirmée.", r.id)}>
                                        Confirmer {r.referrer_name ?? r.referrer_email}
                                      </button>
                                    )}
                                    <input className="admin-input" placeholder="Courriel du bon parent référent" style={{ width: "230px" }} value={assign[r.id] ?? ""} onChange={(e) => setAssign((prev) => ({ ...prev, [r.id]: e.target.value }))} />
                                    <button className="admin-btn-ghost" style={{ fontSize: "0.68rem" }} disabled={busy === r.id || !(assign[r.id] ?? "").includes("@")} onClick={() => post(`/api/admin/references/${r.id}`, { action: "confirm", referrerEmail: assign[r.id] }, "Référent assigné et confirmé.", r.id)}>
                                      Assigner ce référent
                                    </button>
                                  </>
                                )}
                                <button className="admin-btn-ghost" style={{ fontSize: "0.68rem", color: "#ff9999" }} disabled={busy === r.id} onClick={() => confirm("Refuser cette recommandation ?") && post(`/api/admin/references/${r.id}`, { action: "reject" }, "Recommandation refusée.", r.id)}>
                                  Refuser
                                </button>
                              </div>
                              {r.notes && <p style={{ margin: "0.4rem 0 0", color: "#6d6b71" }}>Notes : {r.notes}</p>}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
                {referrals.length === 0 && <p className="admin-empty-text">Aucune recommandation pour l&apos;instant.</p>}
              </div>
            </>
          )}

          {/* ─────────── Crédits ─────────── */}
          {tab === "credits" && (
            <>
              <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "0.9rem", marginBottom: "1rem" }}>
                <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.5rem", fontSize: "0.82rem" }}>Corriger un crédit</p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <input className="admin-input" placeholder="Courriel de la famille" style={{ width: "230px" }} value={adjust.email} onChange={(e) => setAdjust({ ...adjust, email: e.target.value })} />
                  <input className="admin-input" placeholder="Montant ($, négatif pour retirer)" style={{ width: "200px" }} value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} />
                  <input className="admin-input" placeholder="Raison (obligatoire)" style={{ flex: 1, minWidth: "200px" }} value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} />
                  <button
                    className="admin-btn-primary"
                    style={{ fontSize: "0.74rem" }}
                    disabled={busy === "adjust"}
                    onClick={async () => {
                      const dollars = parseFloat(adjust.amount.replace(",", "."));
                      if (!adjust.email.includes("@") || !Number.isFinite(dollars) || dollars === 0 || !adjust.note.trim()) {
                        flash("Courriel, montant et raison sont requis.");
                        return;
                      }
                      await post("/api/admin/references/credits", { email: adjust.email, deltaCents: Math.round(dollars * 100), note: adjust.note }, "Crédit corrigé.", "adjust");
                      setAdjust({ email: "", amount: "", note: "" });
                    }}
                  >
                    Enregistrer la correction
                  </button>
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                <thead><tr>{["Famille", "Code", "Accordé", "Utilisé", "Disponible", ""].map((h) => <th key={h} style={head}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.credits.map((c) => (
                    <Fragment key={c.email}>
                      <tr>
                        <td style={cell}><strong style={{ color: "#fff" }}>{c.name ?? c.email}</strong><br /><span style={{ color: "#6d6b71" }}>{c.email}</span></td>
                        <td style={cell}>{c.code ?? "—"}</td>
                        <td style={cell}>{formatMoney(c.grantedCents)}</td>
                        <td style={cell}>{formatMoney(c.usedCents)}</td>
                        <td style={{ ...cell, color: c.balanceCents > 0 ? "#8fce9f" : "#c3c2c8", fontWeight: 700 }}>{formatMoney(c.balanceCents)}</td>
                        <td style={cell}><button className="admin-btn-ghost" style={{ fontSize: "0.68rem" }} onClick={() => setOpenCredit(openCredit === c.email ? null : c.email)}>{openCredit === c.email ? "Masquer" : "Historique"}</button></td>
                      </tr>
                      {openCredit === c.email && (
                        <tr>
                          <td colSpan={6} style={{ ...cell, background: "#0d0b13" }}>
                            {c.entries.map((e) => (
                              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.2rem 0" }}>
                                <span>{new Date(e.createdAt).toLocaleString("fr-CA")} · {KIND_LABELS[e.kind] ?? e.kind}{e.note ? ` — ${e.note}` : ""}{e.createdBy ? ` (${e.createdBy})` : ""}</span>
                                <span style={{ color: e.deltaCents >= 0 ? "#8fce9f" : "#ffb464", fontWeight: 700 }}>{e.deltaCents >= 0 ? "+" : "−"} {formatMoney(Math.abs(e.deltaCents))}</span>
                              </div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              {data.credits.length === 0 && <p className="admin-empty-text">Aucun crédit enregistré pour l&apos;instant.</p>}
            </>
          )}

          {/* ─────────── Codes ─────────── */}
          {tab === "codes" && (
            <>
              <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", marginBottom: "0.9rem", flexWrap: "wrap" }}>
                <button className="admin-btn-primary" style={{ fontSize: "0.76rem" }} disabled={busy === "codes"} onClick={() => post("/api/admin/references/codes", {}, "Codes générés.", "codes")}>
                  {busy === "codes" ? "..." : "Générer les codes de toutes les familles"}
                </button>
                <span style={{ fontSize: "0.72rem", color: "#6d6b71" }}>Un code est aussi créé automatiquement quand un parent ouvre « Mes recommandations ».</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                <thead><tr>{["Code", "Famille", "Courriel", "Recommandations", "Créé le"].map((h) => <th key={h} style={head}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.codes.map((c) => (
                    <tr key={c.code}>
                      <td style={{ ...cell, color: "#c4a4e4", fontWeight: 700, letterSpacing: "0.08em" }}>{c.code}</td>
                      <td style={cell}>{c.family_name ?? "—"}</td>
                      <td style={cell}>{c.family_email}</td>
                      <td style={cell}>{c.referralsCount}</td>
                      <td style={cell}>{c.created_at.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.codes.length === 0 && <p className="admin-empty-text">Aucun code encore.</p>}
            </>
          )}

          {/* ─────────── Campagne de partage ─────────── */}
          {tab === "campagne" && (
            <>
              <p style={{ fontSize: "0.8rem", color: "#c3c2c8", margin: "0 0 0.9rem" }}>
                Chaque famille reçoit <strong>son propre code et ses liens</strong>, avec des boutons prêts à l&apos;emploi (WhatsApp, courriel, SMS). Seuls les programmes <em>publiés</em> sont promus.
              </p>
              {!camp ? (
                <p style={{ color: "#9d9da0" }}>Chargement…</p>
              ) : (
                <>
                  <div style={{ background: "#1c1408", border: "1px solid #5a4410", borderRadius: "10px", padding: "0.8rem 1rem", marginBottom: "1rem", fontSize: "0.76rem", color: "#f0c878" }}>
                    Expéditeur configuré : <strong>{camp.from}</strong>. Pour que les courriels partent vers les familles, le domaine d&apos;envoi doit être vérifié dans Resend (resend.com/domains). Tant que ce n&apos;est pas fait, utilisez les boutons WhatsApp / SMS ci-dessous ou l&apos;export CSV.
                  </div>

                  <div className="admin-stats" style={{ marginBottom: "1rem" }}>
                    <div className="admin-stat-card"><p className="admin-stat-value">{camp.audienceCurrent}</p><p className="admin-stat-label">Familles de la saison en cours</p></div>
                    <div className="admin-stat-card"><p className="admin-stat-value">{camp.audienceAll}</p><p className="admin-stat-label">Toutes les familles connues</p></div>
                    <div className="admin-stat-card"><p className="admin-stat-value">{camp.alreadySent}</p><p className="admin-stat-label">Déjà envoyés</p></div>
                  </div>

                  <div className="admin-filters" style={{ marginBottom: "0.9rem" }}>
                    {[1, 2, 3].map((n) => {
                      const info = [{ l: "1. Annonce — aujourd'hui" }, { l: "2. Rappel simple — dimanche" }, { l: "3. Dernières places — mercredi" }][n - 1];
                      return (
                        <button key={n} className="admin-filter-btn" data-active={String(step === n)} onClick={() => setStep(n as 1 | 2 | 3)}>{info.l}</button>
                      );
                    })}
                  </div>

                  <label style={{ fontSize: "0.76rem", color: "#c3c2c8", display: "flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.9rem" }}>
                    <input type="checkbox" checked={includePast} onChange={(e) => setIncludePast(e.target.checked)} />
                    Inclure aussi les familles des saisons passées (Été 2026, essais…)
                  </label>

                  <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "0.9rem", marginBottom: "1rem" }}>
                    <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.5rem", fontSize: "0.82rem" }}>1. Recevoir un courriel de test</p>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <input className="admin-input" placeholder="Votre courriel" style={{ width: "260px" }} value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                      <button className="admin-btn-primary" style={{ fontSize: "0.74rem" }} disabled={campBusy || !testTo.includes("@")} onClick={sendTest}>Envoyer le test</button>
                    </div>
                    <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0.5rem 0 0" }}>Objet : {camp.preview.subject}</p>
                  </div>

                  <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "0.9rem", marginBottom: "1rem" }}>
                    <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.6rem", fontSize: "0.82rem" }}>Aperçu (exemple avec une famille)</p>
                    <iframe title="Aperçu du courriel" srcDoc={camp.preview.html} style={{ width: "100%", height: "640px", border: "1px solid #302e36", borderRadius: "8px", background: "#fff" }} />
                  </div>

                  <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "0.9rem", marginBottom: "1rem" }}>
                    <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.5rem", fontSize: "0.82rem" }}>2. Envoyer à toutes les familles</p>
                    <button className="admin-btn-primary" style={{ fontSize: "0.76rem" }} disabled={campBusy} onClick={sendAll}>
                      {campBusy ? "Envoi…" : `Envoyer à ${(includePast ? camp.audienceAll : camp.audienceCurrent) - camp.alreadySent} famille(s)`}
                    </button>
                    <span style={{ fontSize: "0.72rem", color: "#6d6b71", marginLeft: "0.6rem" }}>Une famille ne reçoit jamais deux fois ce courriel.</span>
                  </div>

                  {campMsg && <p style={{ fontSize: "0.8rem", color: campMsg.startsWith("✗") ? "#ff9999" : "#8fce9f", margin: "0 0 1rem" }}>{campMsg}</p>}

                  <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "0.9rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.6rem", alignItems: "center" }}>
                      <p style={{ fontWeight: 700, color: "#fff", margin: 0, fontSize: "0.82rem" }}>Envoi direct par WhatsApp / SMS (un clic par famille)</p>
                      <a className="admin-export-btn" href={`/api/admin/references/campagne?format=csv&includePast=${includePast ? 1 : 0}`}>↓ Exporter CSV (liens + messages)</a>
                    </div>
                    <input type="search" className="admin-search-input" placeholder="Rechercher une famille…" value={famSearch} onChange={(e) => setFamSearch(e.target.value)} style={{ marginBottom: "0.6rem" }} />
                    <div style={{ maxHeight: "460px", overflowY: "auto" }}>
                      {camp.families
                        .filter((x) => !famSearch.trim() || `${x.name} ${x.email}`.toLowerCase().includes(famSearch.trim().toLowerCase()))
                        .map((x) => (
                          <div key={x.email} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center", padding: "0.4rem 0", borderBottom: "1px solid #1f1d25", fontSize: "0.76rem", flexWrap: "wrap" }}>
                            <span style={{ color: "#fff" }}>
                              {x.name || x.email} <span style={{ color: "#6d6b71" }}>· {x.code}{x.phone ? ` · ${x.phone}` : ""}</span>
                              {x.sent && <span style={{ color: "#8fce9f" }}> ✓ courriel envoyé</span>}
                            </span>
                            <span style={{ display: "flex", gap: "0.35rem" }}>
                              {x.whatsapp && <a className="admin-btn-ghost" style={{ fontSize: "0.66rem", textDecoration: "none" }} href={x.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>}
                              {x.sms && <a className="admin-btn-ghost" style={{ fontSize: "0.66rem", textDecoration: "none" }} href={x.sms}>SMS</a>}
                              <button
                                className="admin-btn-ghost"
                                style={{ fontSize: "0.66rem" }}
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(x.message);
                                    flash("Message copié.");
                                  } catch {
                                    window.prompt("Copiez ce message :", x.message);
                                  }
                                }}
                              >
                                Copier le message
                              </button>
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ─────────── Finances ─────────── */}
          {tab === "finances" && (
            <>
              <div className="admin-stats" style={{ marginBottom: "1.5rem" }}>
                {[
                  ["Inscriptions payées", String(f.totals.registrations)],
                  ["Revenus bruts", formatMoney(f.totals.grossCents)],
                  ["Rabais accordés", formatMoney(f.totals.referralDiscountCents)],
                  ["Revenus encaissés", formatMoney(f.totals.collectedCents)],
                  ["Paiements à venir", formatMoney(f.totals.upcomingCents)],
                  ["Paiements échoués", formatMoney(f.totals.failedCents)],
                  ["Crédits accordés", formatMoney(f.creditsGrantedCents)],
                  ["Crédits utilisés", formatMoney(f.creditsUsedCents)],
                  ["Recommandations converties", String(f.referralsConverted)],
                  ["Recommandations à traiter", String(f.referralsPending)]
                ].map(([label, value]) => (
                  <div key={label} className="admin-stat-card">
                    <p className="admin-stat-value">{value}</p>
                    <p className="admin-stat-label">{label}</p>
                  </div>
                ))}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                <thead><tr>{["Programme", "Inscrits", "Attente", "Remplissage", "Brut", "Rabais", "Crédits", "Suppléments", "Encaissé", "À venir", "Échoué", "Coûts est.", "Marge"].map((h) => <th key={h} style={head}>{h}</th>)}</tr></thead>
                <tbody>
                  {f.programs.map((p) => (
                    <tr key={p.slug}>
                      <td style={{ ...cell, color: "#fff", fontWeight: 600 }}>{p.name}</td>
                      <td style={cell}>{p.registrations}/{p.capacity}</td>
                      <td style={cell}>{p.waitlist}</td>
                      <td style={cell}>{Math.round(p.fillRate * 100)} %</td>
                      <td style={cell}>{formatMoney(p.grossCents)}</td>
                      <td style={cell}>{formatMoney(p.referralDiscountCents)}</td>
                      <td style={cell}>{formatMoney(p.creditUsedCents)}</td>
                      <td style={cell}>{formatMoney(p.feesCents)}</td>
                      <td style={{ ...cell, color: "#8fce9f", fontWeight: 700 }}>{formatMoney(p.collectedCents)}</td>
                      <td style={cell}>{formatMoney(p.upcomingCents)}</td>
                      <td style={{ ...cell, color: p.failedCents > 0 ? "#ff9999" : "#c3c2c8" }}>{formatMoney(p.failedCents)}</td>
                      <td style={cell}>{p.costCents > 0 ? formatMoney(p.costCents) : "—"}</td>
                      <td style={{ ...cell, color: p.costCents > 0 ? (p.marginCents >= 0 ? "#8fce9f" : "#ff9999") : "#c3c2c8", fontWeight: 700 }}>{p.costCents > 0 ? formatMoney(p.marginCents) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </>
  );
}
