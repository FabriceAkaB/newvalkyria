/** Robot Veo : se connecte au compte Veo de JP (courriel et mot de passe gardés chiffrés dans l'admin), lit sa
 *  vidéothèque et range les enregistrements dont le titre commence par « Newval » (match → espace client des familles
 *  de l'équipe, pratique → portail des éducateurs). Le fichier 1080p est pris chez Veo directement par Cloudflare :
 *  rien ne passe par l'ordinateur de JP. Roule chaque soir (cron horaire mcs-robot, 23 h) et sur demande dans l'admin. */

import { CLUB_ID } from "@/lib/club";
import { env } from "@/lib/env";
import { OWNER_NOTIFY_EMAIL } from "@/lib/email";
import { getStreamConfig, importVeoRecordings, type VeoImportResult, type VeoRecording } from "@/lib/match-videos";
import { isNewvalRecording } from "@/lib/match-videos-core";
import { getResendClient } from "@/lib/resend";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getVeoCredentials } from "@/lib/veo-config";

const BASE = "https://app.veo.co";
const DEFAULT_CLUB = "anoble-76395aca";

export class VeoSession {
  private cookies = new Map<string, string>();

  private keep(res: Response) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      if (i > 0) this.cookies.set(kv.slice(0, i).trim(), kv.slice(i + 1));
    }
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json", Referer: `${BASE}/`, "User-Agent": "NewValkyria-robot" };
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    const csrf = this.cookies.get("csrftoken");
    if (csrf) h["X-CSRFToken"] = csrf;
    return h;
  }

  async login(email: string, password: string): Promise<void> {
    this.keep(await fetch(`${BASE}/accounts/login/`, { headers: this.headers(), cache: "no-store" }));
    const res = await fetch(`${BASE}/api/app/auth/login/`, { method: "POST", headers: this.headers(), body: JSON.stringify({ email, password }), cache: "no-store" });
    this.keep(res);
    if (!res.ok) throw new Error(res.status === 400 || res.status === 401 || res.status === 403 ? "Veo a refusé la connexion : vérifie le courriel et le mot de passe dans l'admin." : `Veo ne répond pas (${res.status}).`);
  }

  async get<T = any>(path: string): Promise<{ data: T; headers: Headers }> {
    const res = await fetch(`${BASE}${path}`, { headers: this.headers(), cache: "no-store" });
    this.keep(res);
    if (!res.ok) throw new Error(`Veo : ${path} (${res.status})`);
    return { data: (await res.json()) as T, headers: res.headers };
  }

  /** Toute la vidéothèque du club (pages de 20). */
  async recordings(club: string): Promise<any[]> {
    const all: any[] = [];
    for (let p = 1; p <= 40; p++) {
      const { data } = await this.get<any>(`/api/app/clubs/${club}/recordings/?filter=own&page=${p}`);
      const items = Array.isArray(data) ? data : (data?.results ?? []);
      all.push(...items);
      if (items.length < 20) break;
    }
    return all;
  }

  /** Le fichier vidéo de l'enregistrement (rendu « standard », la plus haute qualité). */
  async videoFile(slug: string): Promise<string | null> {
    const { data } = await this.get<any[]>(`/api/app/matches/${slug}/videos/`);
    const list = (Array.isArray(data) ? data : []).filter((v) => v?.url && v.mime_type === "video/mp4" && v.availability !== "unavailable");
    list.sort((a, b) => Number(a.render_type !== "standard") - Number(b.render_type !== "standard") || (b.height ?? 0) - (a.height ?? 0));
    return list[0]?.url ?? null;
  }
}

function db() {
  return getSupabaseAdminClient() as any;
}

const SEEN_KEY = "veo_signale";

/** Va chercher les enregistrements « Newval » dans Veo et les range. JP est averti par courriel de ce qui a été rangé
 *  et de ce qu'il doit classer lui-même (une seule fois par enregistrement). */
export async function syncVeo(opts: { dryRun?: boolean; notify?: boolean } = {}): Promise<{ ok: boolean; skipped?: string; results: VeoImportResult[] }> {
  const creds = await getVeoCredentials();
  if (!creds) return { ok: false, skipped: "Compte Veo pas encore enregistré dans l'admin.", results: [] };
  if (!opts.dryRun && !(await getStreamConfig())) return { ok: false, skipped: "Hébergement vidéo (Cloudflare Stream) pas encore branché.", results: [] };
  const s = new VeoSession();
  await s.login(creds.email, creds.password);
  const recs = (await s.recordings(creds.club || DEFAULT_CLUB)).filter((r) => isNewvalRecording(r.title) && r.is_accessible !== false && r.expiration_status !== "expired");
  const list: VeoRecording[] = [];
  for (const r of recs) list.push({ id: String(r.identifier ?? r.slug), title: String(r.title), start: String(r.start), durationS: r.duration ?? null, mp4: r.processing_status?.status === "preparing" ? null : await s.videoFile(r.slug).catch(() => null) });
  const results = await importVeoRecordings(list, { dryRun: opts.dryRun });

  if (opts.notify !== false && !opts.dryRun) {
    const { data } = await db().from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", SEEN_KEY).maybeSingle();
    const seen = new Set<string>(data?.value ? JSON.parse(data.value) : []);
    const fresh = results.filter((r) => (r.outcome === "importee" || r.outcome === "a-classer") && !seen.has(`${r.outcome}|${r.date}|${r.title}`));
    if (fresh.length) {
      const li = fresh.map((r) => `<li>${r.date} · ${r.title} : ${r.outcome === "importee" ? `rangé (${r.where})` : `à classer — ${r.reason}`}</li>`).join("");
      await getResendClient()
        .emails.send({ from: env.resendFrom, to: OWNER_NOTIFY_EMAIL, subject: `Veo : ${fresh.filter((r) => r.outcome === "importee").length} vidéo(s) rangée(s)`, html: `<ul>${li}</ul><p>Publier un match aux familles : <a href="${env.publicSiteUrl}/admin/matchs/videos">Matchs et pratiques filmés</a>.</p>` } as never)
        .catch(() => null);
      for (const r of fresh) seen.add(`${r.outcome}|${r.date}|${r.title}`);
      await db().from("app_settings").upsert({ club_id: CLUB_ID, key: SEEN_KEY, value: JSON.stringify([...seen].slice(-500)), updated_at: new Date().toISOString() }, { onConflict: "club_id,key" });
    }
  }
  return { ok: true, results };
}
