import Link from "next/link";

import { requireAdmin } from "@/lib/admin-auth";
import { CLUB_ID } from "@/lib/club";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const metadata = { title: "Intentions des familles — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const short = (o: string) => o.replace(/\s*\(.*\)\s*$/, "").trim();
const day = (iso: string) => new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short", timeZone: "America/Toronto" });

interface Row {
  at: string;
  survey: string;
  surveyId: string;
  players: string;
  parent: string;
  email: string;
  choices: string[];
  comments: string[];
}

/** « Qui veut quoi, et qu'est-ce qu'ils nous ont écrit ? » (JP, 18 nov. 2026) : toutes les réponses des sondages
 *  d'intérêt, famille par famille, filtrables par projet, pour faire le suivi quand un projet se lance. Les familles
 *  qui n'ont pas répondu sont relancées toutes seules 2, 5 et 7 jours après l'envoi. */
export default async function IntentionsPage({ searchParams }: { searchParams: Promise<{ choix?: string }> }) {
  await requireAdmin();
  const filter = (await searchParams).choix ?? null;
  const db = getSupabaseAdminClient() as any;
  const { data: surveys } = await db.from("surveys").select("id, title, questions, status, sent_at").eq("club_id", CLUB_ID).eq("kind", "interet").order("created_at", { ascending: false });
  const ids = ((surveys ?? []) as any[]).map((s) => s.id);
  const [{ data: responses }, { data: invites }] = ids.length
    ? await Promise.all([
        db.from("survey_responses").select("survey_id, invite_id, answers, created_at, updated_at").in("survey_id", ids).order("created_at", { ascending: false }),
        db.from("survey_invites").select("id, survey_id, parent_name, parent_email, player_names, sent_at, responded_at, reminder_count").in("survey_id", ids)
      ])
    : [{ data: [] }, { data: [] }];
  const inviteById = new Map(((invites ?? []) as any[]).map((i) => [i.id, i]));
  const rows: Row[] = [];
  for (const r of (responses ?? []) as any[]) {
    const s = (surveys as any[]).find((x) => x.id === r.survey_id);
    const inv = inviteById.get(r.invite_id) ?? {};
    const choices: string[] = [];
    const comments: string[] = [];
    for (const q of (s?.questions ?? []) as any[]) {
      const a = r.answers?.[q.id];
      if (a === undefined || a === null || a === "") continue;
      if (q.type === "texte") comments.push(String(a));
      else if (q.type === "choix_multiple" && Array.isArray(a)) choices.push(...a.map((x: string) => (q.id === "tournois" ? `Tournoi : ${x.split(" :")[0]}` : short(x))));
      else if (q.type === "choix" && q.role === "interet" && /^(oui|peut)/i.test(String(a))) choices.push(`${short(q.label).replace(/ ?:.*$/, "")}${/^peut/i.test(String(a)) ? " (peut-être)" : ""}`);
    }
    rows.push({ at: r.updated_at ?? r.created_at, survey: s?.title ?? "", surveyId: r.survey_id, players: inv.player_names ?? "", parent: inv.parent_name ?? "", email: inv.parent_email ?? "", choices, comments });
  }
  const counts = new Map<string, number>();
  for (const r of rows) for (const c of new Set(r.choices)) counts.set(c, (counts.get(c) ?? 0) + 1);
  const shown = filter ? rows.filter((r) => r.choices.includes(filter)) : rows;
  const waiting = ((invites ?? []) as any[]).filter((i) => i.sent_at && !i.responded_at && !/@newvalkyria\.com$/i.test(i.parent_email ?? ""));
  return (
    <div className="admin-content">
      <div className="admin-section mda">
        <header>
          <p className="mda-eyebrow">Voix des familles · sondages d&apos;intérêt</p>
          <h1 className="mda-h1">{rows.length} famille{rows.length > 1 ? "s" : ""} ont dit ce qui les intéresse</h1>
          <p className="mda-lead">
            Chaque réponse, famille par famille, avec ce qu&apos;elles ont écrit. Clique un projet pour voir seulement les familles intéressées : ce sont elles qu&apos;on appelle en premier quand il se lance.{" "}
            {waiting.length ? `${waiting.length} famille${waiting.length > 1 ? "s" : ""} n'ont pas encore répondu : elles reçoivent un rappel par courriel 2, 5 et 7 jours après l'envoi.` : ""}
          </p>
        </header>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <Link href="/admin/sondages/intentions" className="mda-pill" data-tone={!filter ? "accent" : undefined}>Toutes ({rows.length})</Link>
          {[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => (
            <Link key={c} href={`/admin/sondages/intentions?choix=${encodeURIComponent(c)}`} className="mda-pill" data-tone={filter === c ? "accent" : undefined}>
              {c} ({n})
            </Link>
          ))}
        </div>

        <section className="mda-card-flush" style={{ marginTop: 16 }}>
          <div className="admin-table-wrap mda-scroll" style={{ margin: 0, border: 0, boxShadow: "none" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Famille</th>
                  <th>Intéressée par</th>
                  <th>Ce qu&apos;elle a écrit</th>
                  <th>Réponse</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={i}>
                    <td style={{ minWidth: 160 }}>
                      <strong>{r.players || r.parent}</strong>
                      <span style={{ display: "block", fontSize: "0.75rem", color: "var(--adm-text-3)" }}>{r.parent} · {r.email}</span>
                    </td>
                    <td style={{ fontSize: "0.8125rem" }}>{r.choices.length ? r.choices.join(" · ") : <span className="mda-muted">rien de coché</span>}</td>
                    <td style={{ fontSize: "0.8125rem", color: "var(--adm-text-2)", maxWidth: 360 }}>{r.comments.join(" — ")}</td>
                    <td style={{ fontSize: "0.75rem", color: "var(--adm-text-3)", whiteSpace: "nowrap" }}>
                      {day(r.at)}
                      <Link href={`/admin/sondages/${r.surveyId}`} style={{ display: "block" }}>{r.survey.slice(0, 28)}…</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!shown.length ? <p className="mda-muted" style={{ padding: "16px 20px", margin: 0 }}>Aucune réponse pour l&apos;instant.</p> : null}
        </section>
      </div>
    </div>
  );
}
