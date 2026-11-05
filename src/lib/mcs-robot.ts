import { parse, type HTMLElement } from "node-html-parser";

import { MCS_BASE, MCS_FIELDS, MCS_PATHS, MCS_PRESENCE_STATES, MCS_RELATIONSHIP_PARENT, type McsPresenceState } from "@/lib/mcs-site-map";

/** Le robot MonClubSportif (agent A12) : se connecte avec le compte robot du club et remplit les formulaires de MCS
 *  comme le ferait un gestionnaire. Toutes les adresses et tous les noms de champs viennent de `mcs-site-map.ts`.
 *  Les fonctions `parse*` ne font que lire du HTML : elles sont testées sans réseau. */

export class McsRobotError extends Error {}

/* ── Lecture des pages (pur) ─────────────────────────────────────── */

export function csrfOf(html: string): string | null {
  const root = parse(html);
  return (
    root.querySelector(`input[name="${MCS_FIELDS.csrf}"]`)?.getAttribute("value") ??
    root.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ??
    null
  );
}

export function isLoginPage(html: string): boolean {
  return html.includes(`name="${MCS_FIELDS.login.password}"`);
}

/** Les membres d'une équipe (page Membres) : numéro MCS et nom affiché. */
export function parseRoster(html: string, team: number, season: number): { id: number; name: string }[] {
  const root = parse(html);
  const re = new RegExp(`^/team/${team}/seasons/${season}/roster/(\\d+)$`);
  const seen = new Map<number, string>();
  for (const a of root.querySelectorAll("a")) {
    const m = (a.getAttribute("href") ?? "").match(re);
    const name = a.text.trim().replace(/\s+/g, " ");
    if (m && name && !seen.has(Number(m[1])) && !/^(modifier|assigner|supprimer)$/i.test(name)) seen.set(Number(m[1]), name);
  }
  return [...seen].map(([id, name]) => ({ id, name }));
}

/** Les cases « Assigner aux événements » du formulaire d'ajout (pour donner tout le calendrier à la nouvelle joueuse). */
export function parseAssignIds(html: string): string[] {
  return parse(html)
    .querySelectorAll(`input[name="${MCS_FIELDS.member.assign}"]`)
    .map((i) => i.getAttribute("value") ?? "")
    .filter(Boolean);
}

export interface PresenceGrid {
  events: { id: number; title: string }[];
  rows: { memberId: number; name: string; states: Record<number, McsPresenceState> }[];
}

/** La grille des présences (vue gestionnaire) : pour chaque membre et chaque événement, son état
 *  (`unknown` = pas encore répondu). */
export function parsePresences(html: string): PresenceGrid {
  const root = parse(html);
  const events: PresenceGrid["events"] = [];
  const rows: PresenceGrid["rows"] = [];
  for (const tr of root.querySelectorAll("tbody tr")) {
    const link = tr.querySelector("td.member a.rosters-details-link") ?? tr.querySelector("td.member a");
    const memberId = Number((link?.getAttribute("href") ?? "").match(/roster\/(\d+)/)?.[1]);
    if (!memberId) continue;
    const states: Record<number, McsPresenceState> = {};
    for (const td of tr.querySelectorAll("td.presence")) {
      const eventId = Number(td.querySelector('input[name="event_id"]')?.getAttribute("value"));
      if (!eventId) continue;
      if (!events.some((e) => e.id === eventId)) events.push({ id: eventId, title: "" });
      states[eventId] = presenceStateOf(td);
    }
    rows.push({ memberId, name: (link?.text ?? "").trim().replace(/\s+/g, " "), states });
  }
  const titles = root.querySelectorAll("thead th.presence").map((th) => th.text.trim().replace(/\s+/g, " "));
  events.forEach((e, i) => (e.title = titles[i] ?? ""));
  return { events, rows };
}

function presenceStateOf(td: HTMLElement): McsPresenceState {
  // La case du gestionnaire affiche l'état actuel : « status <état> no-past » (ou sans « no-past » pour un événement passé).
  const cls = td.querySelector(".manager .status")?.getAttribute("class") ?? "";
  return MCS_PRESENCE_STATES.find((s) => new RegExp(`\\b${s}\\b`).test(cls)) ?? "unknown";
}

/** Les adversaires connus du formulaire de match (nom → numéro MCS). */
export function parseOpponents(html: string): Map<string, string> {
  const sel = parse(html).querySelector(`select[name="${MCS_FIELDS.game.opponentId}"]`);
  const out = new Map<string, string>();
  for (const o of sel?.querySelectorAll("option") ?? []) {
    const v = o.getAttribute("value") ?? "";
    if (v && v !== MCS_FIELDS.game.newOpponent) out.set(o.text.trim(), v);
  }
  return out;
}

/** Tous les champs d'un formulaire (pour renvoyer les valeurs actuelles en ne changeant que ce qu'il faut). */
export function formFields(html: string, actionIncludes: string): [string, string][] {
  const form = parse(html)
    .querySelectorAll("form")
    .find((f) => (f.getAttribute("action") ?? "").includes(actionIncludes));
  if (!form) return [];
  const out: [string, string][] = [];
  for (const el of form.querySelectorAll("input, select, textarea")) {
    const name = el.getAttribute("name");
    if (!name) continue;
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute("type") ?? "").toLowerCase();
    if (type === "file" || type === "submit" || type === "button") continue;
    if ((type === "checkbox" || type === "radio") && el.getAttribute("checked") === undefined) continue;
    if (tag === "select") {
      const opt = el.querySelectorAll("option").find((o) => o.getAttribute("selected") !== undefined) ?? el.querySelector("option");
      out.push([name, opt?.getAttribute("value") ?? ""]);
    } else if (tag === "textarea") out.push([name, el.text]);
    else out.push([name, el.getAttribute("value") ?? ""]);
  }
  return out;
}

/* ── Session HTTP ────────────────────────────────────────────────── */

export interface McsMemberInput {
  firstName: string;
  lastName: string;
  gender: "female" | "male";
  birthYear?: number | null;
  parentEmail?: string | null;
  picture?: { data: ArrayBuffer; type: string; name: string } | null;
  note?: string | null;
}

export class McsSession {
  private cookies = new Map<string, string>();

  private cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private keep(res: Response) {
    const raw = (res.headers as any).getSetCookie?.() ?? (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")!] : []);
    for (const c of raw as string[]) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (i > 0) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }

  /** Requête avec les témoins de session ; suit les redirections à la main (pour garder les témoins). */
  async request(path: string, init: { method?: string; body?: FormData | URLSearchParams } = {}): Promise<{ status: number; url: string; html: string }> {
    let url = path.startsWith("http") ? path : `${MCS_BASE}${path}`;
    let method = init.method ?? "GET";
    let body: FormData | URLSearchParams | undefined = init.body;
    for (let hop = 0; hop < 6; hop++) {
      const res = await fetch(url, { method, body, redirect: "manual", headers: { cookie: this.cookieHeader(), "user-agent": "NewValkyriaRobot/1.0", accept: "text/html" }, signal: AbortSignal.timeout(20_000) });
      this.keep(res);
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, url).toString();
        method = "GET";
        body = undefined;
        continue;
      }
      return { status: res.status, url, html: await res.text() };
    }
    throw new McsRobotError("Trop de redirections chez MonClubSportif.");
  }

  async login(email: string, password: string): Promise<void> {
    const page = await this.request(MCS_PATHS.login);
    const token = csrfOf(page.html);
    if (!token) throw new McsRobotError("Page de connexion MonClubSportif illisible (balises à revoir).");
    const form = new URLSearchParams();
    form.set(MCS_FIELDS.csrf, token);
    form.set(MCS_FIELDS.login.email, email);
    form.set(MCS_FIELDS.login.password, password);
    form.set(MCS_FIELDS.login.remember, "1");
    const res = await this.request(MCS_PATHS.login, { method: "POST", body: form });
    if (isLoginPage(res.html)) throw new McsRobotError("Connexion du robot refusée par MonClubSportif (courriel ou mot de passe).");
  }

  /** Charge une page et vérifie qu'on est toujours connecté. */
  async page(path: string): Promise<string> {
    const res = await this.request(path);
    if (isLoginPage(res.html)) throw new McsRobotError("Session du robot expirée.");
    if (res.status >= 400) throw new McsRobotError(`MonClubSportif a répondu ${res.status} pour ${path}.`);
    return res.html;
  }

  async roster(team: number, season: number) {
    return parseRoster(await this.page(MCS_PATHS.roster(team, season)), team, season);
  }

  /** Ajoute une joueuse dans une équipe ; MCS envoie l'invitation au parent et l'assigne aux événements cochés. */
  async addMember(team: number, season: number, m: McsMemberInput, opts: { assignAll: boolean }): Promise<void> {
    const html = await this.page(MCS_PATHS.rosterAdd(team, season));
    const token = csrfOf(html);
    if (!token) throw new McsRobotError("Formulaire d'ajout de membre illisible (balises à revoir).");
    const f = new FormData();
    const F = MCS_FIELDS.member;
    f.set(MCS_FIELDS.csrf, token);
    f.set(F.manager, "0");
    if (m.parentEmail) f.set(F.sendInvitation, "1");
    f.set(F.firstName, m.firstName);
    f.set(F.lastName, m.lastName);
    f.set(F.gender, m.gender);
    f.set(F.type, "player");
    if (m.birthYear) f.set(F.birthYear, String(m.birthYear));
    if (m.parentEmail) {
      f.append(F.email, m.parentEmail);
      f.append(F.relationship, MCS_RELATIONSHIP_PARENT);
    }
    if (m.note) f.set(F.privateNote, m.note);
    if (m.picture) f.set(F.picture, new Blob([m.picture.data], { type: m.picture.type }), m.picture.name);
    if (opts.assignAll) for (const id of parseAssignIds(html)) f.append(F.assign, id);
    const res = await this.request(MCS_PATHS.roster(team, season), { method: "POST", body: f });
    if (res.status >= 400 || /error|erreur/i.test(res.url)) throw new McsRobotError(`Ajout refusé par MonClubSportif (${res.status}).`);
  }

  /** Met (ou remplace) la photo du profil d'un membre. */
  async setPicture(team: number, season: number, memberId: number, picture: { data: ArrayBuffer; type: string; name: string }): Promise<void> {
    const html = await this.page(MCS_PATHS.memberModify(team, season, memberId));
    const fields = formFields(html, MCS_PATHS.member(team, season, memberId));
    if (!fields.length) throw new McsRobotError("Formulaire du membre illisible (balises à revoir).");
    const f = new FormData();
    for (const [k, v] of fields) f.append(k, v);
    f.set(MCS_FIELDS.member.picture, new Blob([picture.data], { type: picture.type }), picture.name);
    const res = await this.request(MCS_PATHS.member(team, season, memberId), { method: "POST", body: f });
    if (res.status >= 400) throw new McsRobotError(`Photo refusée par MonClubSportif (${res.status}).`);
  }

  /** Écrit le nom de l'adversaire sur un match (adversaire existant ou nouveau), sans courriel aux membres. */
  async setOpponent(team: number, season: number, gameId: number, name: string): Promise<void> {
    const html = await this.page(MCS_PATHS.gameEdit(team, season, gameId));
    const fields = formFields(html, MCS_PATHS.game(team, season, gameId)).filter(([k]) => k !== MCS_FIELDS.game.sendByEmail);
    if (!fields.length) throw new McsRobotError("Formulaire du match illisible (balises à revoir).");
    const known = parseOpponents(html);
    const existing = [...known].find(([n]) => n.toLowerCase() === name.toLowerCase())?.[1];
    const f = new URLSearchParams();
    for (const [k, v] of fields) if (k !== MCS_FIELDS.game.opponentId && k !== MCS_FIELDS.game.opponentName) f.append(k, v);
    f.set(MCS_FIELDS.game.opponentId, existing ?? MCS_FIELDS.game.newOpponent);
    if (!existing) f.set(MCS_FIELDS.game.opponentName, name);
    const res = await this.request(MCS_PATHS.game(team, season, gameId), { method: "POST", body: f });
    if (res.status >= 400) throw new McsRobotError(`Adversaire refusé par MonClubSportif (${res.status}).`);
  }

  /** Présences modifiables en tout temps (0 h de verrou avant les matchs et les pratiques), le reste inchangé. */
  async unlockPresences(team: number): Promise<boolean> {
    const html = await this.page(MCS_PATHS.settings(team));
    const fields = formFields(html, MCS_PATHS.teamUpdate(team));
    if (!fields.length) throw new McsRobotError("Paramètres de l'équipe illisibles (balises à revoir).");
    const T = MCS_FIELDS.team;
    const before = fields.filter(([k]) => k === T.lockHoursGame || k === T.lockHoursEvent).map(([, v]) => Number(v) || 0);
    if (before.every((h) => h === 0)) return false;
    const f = new URLSearchParams();
    for (const [k, v] of fields) f.append(k, k === T.lockHoursGame || k === T.lockHoursEvent ? "0" : v);
    const res = await this.request(MCS_PATHS.teamUpdate(team), { method: "POST", body: f });
    if (res.status >= 400) throw new McsRobotError(`Paramètres refusés par MonClubSportif (${res.status}).`);
    return true;
  }

  /** Pages 1 à `pages` de la grille (page 1 = les derniers événements passés, 2 = le bloc en cours, 3 = la suite). */
  async presences(team: number, season: number, pages = 3): Promise<PresenceGrid> {
    const grid: PresenceGrid = { events: [], rows: [] };
    for (let p = 1; p <= pages; p++) {
      const g = parsePresences(await this.page(MCS_PATHS.presences(team, season, p)));
      if (!g.events.length) break;
      grid.events.push(...g.events.filter((e) => !grid.events.some((x) => x.id === e.id)));
      for (const r of g.rows) {
        const row = grid.rows.find((x) => x.memberId === r.memberId);
        if (row) Object.assign(row.states, r.states);
        else grid.rows.push(r);
      }
    }
    return grid;
  }
}
