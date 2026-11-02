import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { CLUB_ID } from "@/lib/club";
import { OWNER_NOTIFY_EMAIL } from "@/lib/email";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { isOpen, monthFocus } from "@/lib/mandalart-core";
import { formatKpi } from "@/lib/mandalart-kpis";
import { computeGap } from "@/lib/mandalart-levers";
import { getMandalartOverview } from "@/lib/mandalart-repo";
import { getResendClient, isEmailConfigured } from "@/lib/resend";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const pct = (x: number) => `${Math.round(x * 100)} %`;
const money = (c: number) => `${Math.round(c / 100).toLocaleString("fr-CA")} $`;
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const day = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]}`;
};

/** Instantané du lundi du Mandalart (AU02) : enregistre la semaine dans mandalart_snapshots
 *  et envoie à JP le résumé : niveau, ⭐ faites, retards, 5 priorités, indicateurs qui ont bougé.
 *  Vercel Cron chaque lundi à 11 h UTC (6 h à Montréal l'hiver) ; ?envoyer=0 pour l'instantané seul. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const cron = env.cronSecret && auth === `Bearer ${env.cronSecret}`;
  if (!cron && !(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const send = new URL(request.url).searchParams.get("envoyer") !== "0";

  const o = await getMandalartOverview();
  const db = getSupabaseAdminClient() as any;
  const { data: prev } = await db.from("mandalart_snapshots").select("week, kpis, execution").eq("club_id", CLUB_ID).lt("week", o.today).order("week", { ascending: false }).limit(1).maybeSingle();
  const kpiMap = Object.fromEntries(o.kpis.map((k) => [k.id, k.current]));
  await db.from("mandalart_snapshots").upsert(
    {
      club_id: CLUB_ID,
      week: o.today,
      execution: o.execution,
      results: o.results.progress,
      level: o.currentLevel,
      pillars: Object.fromEntries(o.pillars.map((p) => [p.code, p.progress])),
      kpis: kpiMap
    },
    { onConflict: "club_id,week" }
  );

  if (!send || !isEmailConfigured()) return NextResponse.json({ ok: true, emailed: false });

  const level = o.levels.find((l) => l.id === o.currentLevel)!;
  const gap = await computeGap(o.figures, o.today).catch(() => null);
  const focus = monthFocus(o.tasks, o.today);
  const next5 = o.tasks
    .filter((t) => isOpen(t) && !t.overdue && t.priority === "star")
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))
    .slice(0, 5);
  const moved = prev?.kpis
    ? o.kpis.filter((k) => k.current !== null && prev.kpis[k.id] !== undefined && prev.kpis[k.id] !== null && Number(prev.kpis[k.id]) !== k.current)
    : [];
  const site = env.publicSiteUrl;
  const li = (t: (typeof o.tasks)[number]) =>
    `<li style="margin:0 0 6px"><strong>${esc(t.title)}</strong><br><span style="color:#666;font-size:13px">${t.code} · ${t.due ? day(t.due) : ""}${t.owner ? ` · ${esc(t.owner)}` : ""}</span></li>`;

  const html = `
  <div style="font-family:-apple-system,Arial,sans-serif;line-height:1.55;color:#161419;max-width:620px">
    <p style="color:#666;margin:0">Mandalart · semaine du ${day(o.today)}</p>
    <h1 style="font-size:22px;margin:4px 0 12px">Niveau ${level.id} ${esc(level.name)} : ${level.starsDone}/${level.stars} ⭐ faites</h1>
    <p style="margin:0 0 4px">Encaissé en ${o.results.year} : <strong>${money(o.results.caYearCents)}</strong> (${pct(o.results.progress)} de 1,5 M$) · rythme 12 mois ${money(o.results.ca12mCents)}</p>
    <p style="margin:0 0 16px">Exécution du plan : <strong>${pct(o.execution)}</strong>${prev?.execution != null ? ` (${o.execution >= Number(prev.execution) ? "+" : ""}${Math.round((o.execution - Number(prev.execution)) * 100)} pts en une semaine)` : ""} · ${level.daysLeft} jours avant la fin du niveau</p>
    ${focus.overdue.length ? `<h2 style="font-size:17px;color:#b3261e;margin:20px 0 8px">En retard · ${focus.overdue.length}</h2><ul style="padding-left:18px;margin:0">${focus.overdue.slice(0, 8).map(li).join("")}</ul>` : `<p style="color:#2e7d32">Aucune tâche en retard. 👏</p>`}
    ${gap ? `<h2 style="font-size:17px;margin:20px 0 8px">Écart et rattrapage</h2>${gap.proposal.map((p) => `<p style="margin:0 0 6px">${esc(p)}</p>`).join("")}<ul style="padding-left:18px;margin:6px 0 0">${gap.levers.slice(0, 3).map((l) => `<li>${esc(l.title)} — jusqu'à ${money(l.potentialCents)} (${l.when})</li>`).join("")}</ul>` : ""}
    <h2 style="font-size:17px;margin:20px 0 8px">Les 5 priorités de la semaine</h2>
    <ul style="padding-left:18px;margin:0">${next5.map(li).join("")}</ul>
    ${moved.length ? `<h2 style="font-size:17px;margin:20px 0 8px">Ce qui a bougé</h2><ul style="padding-left:18px;margin:0">${moved.map((k) => `<li>${esc(k.label)} : ${formatKpi(Number(prev!.kpis[k.id]), k.targetN.unit || k.startN.unit)} → <strong>${formatKpi(k.current, k.targetN.unit || k.startN.unit)}</strong></li>`).join("")}</ul>` : ""}
    <p style="margin:28px 0"><a href="${site}/admin/mandalart" style="background:#7c4dff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">Ouvrir « Ce mois-ci »</a></p>
  </div>`;

  await getResendClient().emails.send({ from: env.resendFrom, to: OWNER_NOTIFY_EMAIL, subject: `Mandalart · N${level.id} ${level.starsDone}/${level.stars} ⭐ · ${focus.overdue.length} en retard`, html });
  return NextResponse.json({ ok: true, emailed: true });
}
