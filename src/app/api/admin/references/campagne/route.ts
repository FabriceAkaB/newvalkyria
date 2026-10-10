import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { sendCampaignEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { getMailConfig } from "@/lib/mail-config";
import { jsonError } from "@/lib/http";
import { buildCampaignEmail, buildDirectMessage, campaignKey, CAMPAIGN_STEPS, getCampaignAudience, getCampaignPrograms, getFormerFamiliesAudience, phoneDigits, type CampaignStep } from "@/lib/referral-campaign";
import { getOrCreateReferralCode, normalizeEmail } from "@/lib/referrals-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type Audience = "current" | "former";

function keyFor(step: CampaignStep, audience: Audience): string {
  return audience === "former" ? `${campaignKey(step)}-anciennes` : campaignKey(step);
}

function parseStep(v: unknown): CampaignStep {
  const n = Number(v);
  return n === 2 || n === 3 ? n : 1;
}

function db() {
  return getSupabaseAdminClient() as any;
}

function csvCell(v: string): string {
  return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(request: Request) {
  const role = await getCurrentAdminRole();
  if (role !== "admin") return jsonError("Non autorisé", 401);
  const { searchParams } = new URL(request.url);
  const includePast = searchParams.get("includePast") === "1";
  const step = parseStep(searchParams.get("step"));
  const audienceKind: Audience = searchParams.get("audience") === "former" ? "former" : "current";
  const CAMPAIGN = keyFor(step, audienceKind);
  const origin = env.publicSiteUrl;

  const [current, all, former] = await Promise.all([getCampaignAudience(), getCampaignAudience({ includePast: true }), getFormerFamiliesAudience()]);
  const audience = audienceKind === "former" ? former : includePast ? all : current;

  // Export CSV : un lien et un message prêts à copier-coller par famille (SMS / WhatsApp / publipostage).
  if (searchParams.get("format") === "csv") {
    const header = ["Famille", "Courriel", "Téléphone", "Code", "Message prêt à envoyer (SMS/WhatsApp)"];
    const first = audience[0] ? await getCampaignPrograms(origin, audience[0].code) : [];
    for (const p of first) header.push(`Lien ${p.shortName}`);
    const lines = [header.map(csvCell).join(";")];
    for (const r of audience) {
      const programs = await getCampaignPrograms(origin, r.code);
      const row = [r.name, r.email, r.phone ?? "", r.code, buildDirectMessage(r.firstName, programs).replace(/\n+/g, " ")];
      for (const p of programs) row.push(p.link);
      lines.push(row.map(csvCell).join(";"));
    }
    return new NextResponse("﻿" + lines.join("\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="familles-liens-de-partage.csv"` }
    });
  }

  const mailCfg = await getMailConfig();
  const { data: sent } = await db().from("referral_campaign_sends").select("email, status").eq("campaign", CAMPAIGN);
  const sentSet = new Set((sent ?? []).filter((s: any) => s.status === "sent").map((s: any) => s.email));
  const sample = audience[0] ?? { firstName: "Marie", code: "ABC123" };
  const programs = await getCampaignPrograms(origin, sample.code);
  const preview = buildCampaignEmail({ step, firstName: sample.firstName, code: sample.code, programs, origin, audience: audienceKind });

  return NextResponse.json({
    campaign: CAMPAIGN,
    step,
    steps: CAMPAIGN_STEPS,
    audienceCurrent: current.length,
    audienceAll: all.length,
    audienceFormer: former.length,
    audienceKind,
    alreadySent: audience.filter((r) => sentSet.has(r.email)).length,
    programs: programs.map((p) => ({ slug: p.slug, name: p.shortName, priceCents: p.priceCents })),
    from: mailCfg ? `${mailCfg.fromName} <${mailCfg.user}>` : env.resendFrom,
    via: mailCfg ? "gmail" : "resend",
    preview: { subject: preview.subject, html: preview.html },
    families: await Promise.all(
      audience.map(async (r) => {
        const programs = await getCampaignPrograms(origin, r.code);
        const message = buildDirectMessage(r.firstName, programs);
        const digits = phoneDigits(r.phone);
        return {
          name: r.name,
          email: r.email,
          phone: r.phone,
          code: r.code,
          sent: sentSet.has(r.email),
          message,
          whatsapp: digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null,
          sms: r.phone ? `sms:${r.phone.replace(/\D/g, "")}?&body=${encodeURIComponent(message)}` : null
        };
      })
    )
  });
}

export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (role !== "admin") return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { action?: "test" | "send_all"; to?: string; includePast?: boolean; limit?: number; step?: number; audience?: Audience } | null;
  if (!body?.action) return jsonError("Action requise", 400);
  const step = parseStep(body.step);
  const audienceKind: Audience = body.audience === "former" ? "former" : "current";
  const CAMPAIGN = keyFor(step, audienceKind);
  const origin = env.publicSiteUrl;

  const programsProbe = await getCampaignPrograms(origin, "TEST00");
  if (programsProbe.length === 0) return jsonError("Aucun programme publié à promouvoir.", 409);

  // ── Courriel de test : un seul destinataire, jamais d'envoi aux familles ──
  if (body.action === "test") {
    const to = normalizeEmail(body.to);
    if (!to.includes("@")) return jsonError("Courriel de test invalide.", 400);
    const code = await getOrCreateReferralCode(to, "Test administrateur");
    const programs = await getCampaignPrograms(origin, code.code);
    const mail = buildCampaignEmail({ step, firstName: "Jean-Paul", code: code.code, programs, origin, audience: audienceKind });
    const result = await sendCampaignEmail({ to, subject: `[TEST] ${mail.subject}`, html: mail.html, text: mail.text });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error, from: env.resendFrom }, { status: 502 });
    return NextResponse.json({ ok: true, to, via: result.via });
  }

  // ── Envoi à toutes les familles (par lots, jamais deux fois la même) ──
  if (body.action === "send_all") {
    const audience = audienceKind === "former" ? await getFormerFamiliesAudience() : await getCampaignAudience({ includePast: Boolean(body.includePast) });
    if (audienceKind === "former") {
      // Leur lien donne le rabais à la famille référée, mais aucune récompense (sac/crédit).
      await db().from("referral_codes").update({ rewards_enabled: false }).in("family_email", audience.map((r) => r.email));
    }
    const { data: sent } = await db().from("referral_campaign_sends").select("email").eq("campaign", CAMPAIGN).eq("status", "sent");
    const done = new Set((sent ?? []).map((s: any) => s.email));
    const todo = audience.filter((r) => !done.has(r.email)).slice(0, Math.min(Math.max(body.limit ?? 40, 1), 60));

    let ok = 0;
    let failed = 0;
    let firstError: string | null = null;
    for (const r of todo) {
      const programs = await getCampaignPrograms(origin, r.code);
      const mail = buildCampaignEmail({ step, firstName: r.firstName, code: r.code, programs, origin, audience: audienceKind });
      const result = await sendCampaignEmail({ to: r.email, subject: mail.subject, html: mail.html, text: mail.text });
      await db().from("referral_campaign_sends").upsert({ campaign: CAMPAIGN, email: r.email, status: result.ok ? "sent" : "failed", error: result.ok ? null : result.error, sent_at: new Date().toISOString() }, { onConflict: "campaign,email" });
      if (result.ok) ok++;
      else {
        failed++;
        firstError ??= result.error;
        if (ok === 0 && failed >= 3) break; // inutile de continuer si rien ne passe (ex. domaine non vérifié)
      }
    }
    const remaining = audience.filter((r) => !done.has(r.email)).length - ok;
    return NextResponse.json({ ok: failed === 0, sent: ok, failed, remaining, error: firstError });
  }

  return jsonError("Action inconnue", 400);
}
