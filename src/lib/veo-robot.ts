/** Robot Veo : se connecte au compte Veo de JP (courriel et mot de passe gardés chiffrés dans l'admin), lit sa
 *  vidéothèque et range les enregistrements dont le titre commence par « Newval » (match → espace client des familles
 *  de l'équipe, pratique → portail des éducateurs). Les vidéos restent chez Veo : le site garde le lien du fichier
 *  1080p, l'aperçu, les périodes et les temps forts. Roule chaque soir (cron horaire mcs-robot, 23 h) et sur demande. */

import { CLUB_ID } from "@/lib/club";
import { env } from "@/lib/env";
import { OWNER_NOTIFY_EMAIL } from "@/lib/email";
import { importVeoRecordings, type VeoImportResult, type VeoRecording } from "@/lib/match-videos";
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

  /** Le fichier vidéo de l'enregistrement (rendu « standard », la plus haute qualité) et son aperçu. */
  async videoFile(slug: string): Promise<{ url: string; thumbnail: string | null } | null> {
    const { data } = await this.get<any[]>(`/api/app/matches/${slug}/videos/`);
    const list = (Array.isArray(data) ? data : []).filter((v) => v?.url && v.mime_type === "video/mp4" && v.availability !== "unavailable");
    list.sort((a, b) => Number(a.render_type !== "standard") - Number(b.render_type !== "standard") || (b.height ?? 0) - (a.height ?? 0));
    return list[0] ? { url: list[0].url, thumbnail: list[0].thumbnail ?? null } : null;
  }

  /** Tout ce qu'il faut pour le lecteur du site : fichier, aperçu, périodes de jeu et temps forts. */
  async recording(r: any): Promise<VeoRecording> {
    const base = { slug: String(r.slug), title: String(r.title), start: String(r.start), durationS: r.duration ?? null };
    if (r.processing_status?.status === "preparing") return { ...base, mp4: null, thumbnail: null, periods: [], highlights: [] };
    const [file, periods, highlights] = await Promise.all([
      this.videoFile(r.slug).catch(() => null),
      this.get(`/api/app/matches/${r.slug}/periods/`).then((x) => x.data).catch(() => []),
      this.get(`/api/app/matches/${r.slug}/highlights/?include_ai=true`).then((x) => x.data).catch(() => [])
    ]);
    return { ...base, mp4: file?.url ?? null, thumbnail: file?.thumbnail ?? (typeof r.thumbnail === "string" ? r.thumbnail : null), periods, highlights };
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
  const s = new VeoSession();
  await s.login(creds.email, creds.password);
  const recs = (await s.recordings(creds.club || DEFAULT_CLUB)).filter((r) => isNewvalRecording(r.title) && r.is_accessible !== false && r.expiration_status !== "expired");
  const list: VeoRecording[] = [];
  for (const r of recs) list.push(await s.recording(r));
  const results = await importVeoRecordings(list, { dryRun: opts.dryRun });

  if (opts.notify !== false && !opts.dryRun) {
    const { data } = await db().from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", SEEN_KEY).maybeSingle();
    const seen = new Set<string>(data?.value ? JSON.parse(data.value) : []);
    const fresh = results.filter((r) => (r.outcome === "rangee" || r.outcome === "a-classer") && !seen.has(`${r.outcome}|${r.date}|${r.title}`));
    if (fresh.length) {
      const li = fresh.map((r) => `<li>${r.date} · ${r.title} : ${r.outcome === "rangee" ? `rangé (${r.where})` : `à classer — ${r.reason}`}</li>`).join("");
      await getResendClient()
        .emails.send({ from: env.resendFrom, to: OWNER_NOTIFY_EMAIL, subject: `Veo : ${fresh.filter((r) => r.outcome === "rangee").length} vidéo(s) rangée(s)${fresh.some((r) => r.outcome === "a-classer") ? ", à classer" : ""}`, html: `<ul>${li}</ul><p>Les matchs sont déjà dans l'espace client des familles de l'équipe. À voir ou à classer : <a href="${env.publicSiteUrl}/admin/matchs/videos">Matchs et pratiques filmés</a>.</p>` } as never)
        .catch(() => null);
      for (const r of fresh) seen.add(`${r.outcome}|${r.date}|${r.title}`);
      await db().from("app_settings").upsert({ club_id: CLUB_ID, key: SEEN_KEY, value: JSON.stringify([...seen].slice(-500)), updated_at: new Date().toISOString() }, { onConflict: "club_id,key" });
    }
  }
  return { ok: true, results };
}

/** Le code d'un enregistrement Veo tiré de son lien (« app.veo.co/matches/20261101-match-…/ ») ou du code lui-même. */
export function veoSlugOf(input: string): string | null {
  const s = input.trim();
  const m = s.match(/veo\.co\/matches\/([a-z0-9][a-z0-9_-]{5,200})\/?/i) ?? s.match(/^([0-9]{8}-[a-z0-9_-]{3,200})$/i);
  return m ? m[1] : null;
}

/** Range des enregistrements Veo donnés par leur lien ou leur code. Un match « public » de Veo se lit sans se
 *  connecter ; sinon le compte Veo de l'admin est utilisé. Même règle : seuls les titres « Newval » sont rangés. */
export async function importVeoLinks(inputs: string[]): Promise<VeoImportResult[]> {
  const slugs = [...new Set(inputs.map(veoSlugOf).filter((x): x is string => Boolean(x)))];
  if (!slugs.length) return [];
  const s = new VeoSession();
  const creds = await getVeoCredentials();
  if (creds) await s.login(creds.email, creds.password).catch(() => null);
  const list: VeoRecording[] = [];
  const out: VeoImportResult[] = [];
  for (const slug of slugs) {
    try {
      const { data } = await s.get(`/api/app/matches/${slug}/`);
      list.push(await s.recording({ ...data, slug }));
    } catch {
      out.push({ title: slug, date: "", outcome: "erreur", reason: "Veo ne montre pas cet enregistrement (lien privé : enregistre le compte Veo dans l'admin)." });
    }
  }
  return [...out, ...(await importVeoRecordings(list))];
}
