import { wallInZone, zonedToUtc } from "@/lib/ical";

/** Les 30 premiers jours d'une nouvelle famille (Mandalart P4.2.03, avec la vidéo de bienvenue de JP P4.1.01) :
 *  règles pures. Une famille est « nouvelle » si aucune inscription payée (saison, programme, Sport-Études) n'existe
 *  pour son courriel ou pour le nom de son enfant avant ce paiement. Cinq courriels, programmés d'avance dans
 *  `scheduled_emails` (envoyés par le cron horaire `sendDueEmails`), une référence par famille et par étape :
 *  - bienvenue : le jour du paiement (espace famille, vidéo de JP si le lien est enregistré, 1re séance si connue) ;
 *  - rappel : 2 jours avant la 1re séance, 18 h (jour, heure, lieu, quoi apporter) ;
 *  - après : le lendemain de la 1re séance, 10 h (comment ça s'est passé, boîte à suggestions) ;
 *  - jour 14 : points Valkyria et Valkyria Lab ;
 *  - jour 30 : « Comment se passent vos 30 premiers jours ? » (réponse par courriel ou boîte à idées).
 *  Les jours 14 et 30 se comptent depuis le début des activités (la 1re séance si elle est après le paiement) :
 *  une famille inscrite d'avance ne reçoit pas un « deux semaines déjà » avant d'avoir commencé. */

export const ONBOARDING_CAMPAIGN = "Accueil 30 jours";
export const ONBOARDING_ACTIVE_KEY = "accueil_30_jours_actif";
export const WELCOME_VIDEO_KEY = "video_bienvenue_url";
export const ONBOARDING_REF_PREFIX = "accueil30:";
/** Une autre inscription payée plus de 2 jours avant celle-ci = famille déjà connue (un frère et une sœur inscrits
 *  ensemble restent une nouvelle famille). */
export const SIBLING_GRACE_MS = 2 * 86_400_000;
const TZ = "America/Toronto";
const SITE = "https://www.newvalkyria.com";

export type OnboardingStep = "bienvenue" | "rappel" | "apres" | "jour14" | "jour30";

export const ONBOARDING_STEPS: { step: OnboardingStep; label: string; when: string }[] = [
  { step: "bienvenue", label: "Bienvenue et espace famille", when: "Le jour du paiement" },
  { step: "rappel", label: "Rappel de la 1re séance", when: "2 jours avant la 1re séance, 18 h" },
  { step: "apres", label: "Comment s'est passée la 1re séance ?", when: "Le lendemain de la 1re séance, 10 h" },
  { step: "jour14", label: "Points Valkyria et Valkyria Lab", when: "Jour 14, 10 h" },
  { step: "jour30", label: "Vos 30 premiers jours", when: "Jour 30, 10 h" }
];

export interface PaidRegistration {
  id: string;
  source: "saison" | "programme" | "sport-etudes";
  email: string | null;
  parentName: string | null;
  playerFirstName: string | null;
  playerLastName: string | null;
  /** Moment du paiement (événement Stripe, sinon création de la ligne). */
  paidAt: string;
  programLabel: string | null;
}

export interface FirstSession {
  /** AAAA-MM-JJ, heure de Montréal. */
  date: string;
  start: string;
  end: string | null;
  location: string | null;
  source: "monclubsportif" | "horaire";
}

export interface OnboardingFamily {
  key: string;
  email: string;
  parentName: string | null;
  children: string[];
  programs: string[];
  paidAt: string;
  registrationIds: string[];
  firstSession: FirstSession | null;
}

export interface PlannedEmail {
  step: OnboardingStep;
  ref: string;
  sendAt: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  parentName: string | null;
  playerName: string | null;
}

export const normEmail = (e: string | null | undefined) => String(e ?? "").trim().toLowerCase();

/** Nom de l'enfant comparable : accents, majuscules, espaces et traits d'union ignorés. */
export function normPlayer(first: string | null | undefined, last: string | null | undefined): string {
  const n = `${first ?? ""} ${last ?? ""}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
  return n.includes(" ") ? n : "";
}

export const onboardingRef = (key: string, step: OnboardingStep) => `${ONBOARDING_REF_PREFIX}${key}:${step}`;

/** Le réglage `app_settings` (texte) : seul « true », « 1 », « oui » ou « on » allume la séquence. */
export function parseActive(value: unknown): boolean {
  return /^(true|1|oui|on)$/i.test(String(value ?? "").trim().replace(/^"|"$/g, ""));
}

/** Lien de la vidéo de bienvenue : seulement une adresse https, sinon pas de vidéo. */
export function parseVideoUrl(value: unknown): string | null {
  const v = String(value ?? "").trim().replace(/^"|"$/g, "");
  return /^https:\/\/\S+$/.test(v) ? v : null;
}

/** Regroupe par courriel les inscriptions payées dans la fenêtre et garde les familles nouvelles : aucune autre
 *  inscription payée du même courriel ou du même enfant plus de 2 jours avant le premier paiement de la fenêtre. */
export function findNewFamilies(
  recent: PaidRegistration[],
  history: PaidRegistration[],
  since: string
): { families: Omit<OnboardingFamily, "firstSession">[]; notNew: number } {
  const groups = new Map<string, PaidRegistration[]>();
  for (const r of recent) {
    const key = normEmail(r.email);
    if (!key || !key.includes("@") || r.paidAt < since) continue;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const families: Omit<OnboardingFamily, "firstSession">[] = [];
  let notNew = 0;
  for (const [key, regs] of groups) {
    regs.sort((a, b) => a.paidAt.localeCompare(b.paidAt));
    const firstPaid = regs[0].paidAt;
    const ids = new Set(regs.map((r) => r.id));
    const names = new Set(regs.map((r) => normPlayer(r.playerFirstName, r.playerLastName)).filter(Boolean));
    const limit = new Date(new Date(firstPaid).getTime() - SIBLING_GRACE_MS).toISOString();
    const known = history.some(
      (h) => !ids.has(h.id) && h.paidAt < limit && (normEmail(h.email) === key || names.has(normPlayer(h.playerFirstName, h.playerLastName)))
    );
    if (known) {
      notNew++;
      continue;
    }
    const children = [...new Set(regs.map((r) => String(r.playerFirstName ?? "").trim()).filter(Boolean))];
    const programs = [...new Set(regs.map((r) => String(r.programLabel ?? "").trim()).filter(Boolean))];
    families.push({ key, email: key, parentName: regs.find((r) => r.parentName)?.parentName ?? null, children, programs, paidAt: firstPaid, registrationIds: regs.map((r) => r.id) });
  }
  return { families, notNew };
}

// ---------- Dates (heure de Montréal) ----------

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** « Lundi » → 1 ; inconnu → -1. */
export function dayIndex(day: string | null | undefined): number {
  return DAYS.indexOf(strip(String(day ?? "")));
}

export function torontoDate(ms: number): string {
  const w = wallInZone(ms, TZ);
  return `${w.y}-${String(w.m).padStart(2, "0")}-${String(w.d).padStart(2, "0")}`;
}

/** Instant (ms) d'une heure murale à Montréal. */
export function torontoAt(date: string, time: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = (time || "00:00").split(/[:h]/).map((x) => Number(x) || 0);
  return zonedToUtc({ y, m, d, h, mi, s: 0 }, TZ);
}

export function addDays(date: string, n: number): string {
  const t = new Date(`${date}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** Prochaine séance d'une plage hebdomadaire (jour + heure) qui commence après `afterMs`, jamais avant le début
 *  de la saison. */
export function nextWeeklySession(
  slot: { day: string | null; start_time: string | null; end_time?: string | null; location?: string | null },
  afterMs: number,
  seasonStartsOn?: string | null
): FirstSession | null {
  const dow = dayIndex(slot.day);
  if (dow < 0 || !slot.start_time) return null;
  let date = torontoDate(afterMs);
  if (seasonStartsOn && seasonStartsOn.slice(0, 10) > date) date = seasonStartsOn.slice(0, 10);
  for (let i = 0; i < 15; i++) {
    const d = addDays(date, i);
    if (new Date(`${d}T12:00:00Z`).getUTCDay() !== dow) continue;
    if (torontoAt(d, slot.start_time) <= afterMs) continue;
    return { date: d, start: slot.start_time, end: slot.end_time ?? null, location: slot.location ?? null, source: "horaire" };
  }
  return null;
}

/** Première séance datée (MonClubSportif ou dates du programme) qui commence après `afterMs`. */
export function firstDatedSession(
  rows: { date: string; start: string | null; end?: string | null; location?: string | null }[],
  afterMs: number,
  source: FirstSession["source"]
): FirstSession | null {
  const next = rows
    .filter((r) => r.date && r.start && torontoAt(r.date.slice(0, 10), r.start) > afterMs)
    .sort((a, b) => `${a.date.slice(0, 10)} ${a.start}`.localeCompare(`${b.date.slice(0, 10)} ${b.start}`))[0];
  return next ? { date: next.date.slice(0, 10), start: next.start as string, end: next.end ?? null, location: next.location ?? null, source } : null;
}

/** Un courriel ne part jamais la nuit : avant 8 h → 8 h ; à partir de 21 h → le lendemain 8 h. */
export function daytime(ms: number): number {
  const w = wallInZone(ms, TZ);
  const date = torontoDate(ms);
  if (w.h < 8) return torontoAt(date, "08:00");
  if (w.h >= 21) return torontoAt(addDays(date, 1), "08:00");
  return ms;
}

// ---------- Textes ----------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function frenchDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

/** « 19:30 » → « 19 h 30 », « 18:00 » → « 18 h ». */
export function frenchTime(t: string | null | undefined): string {
  const [h, m] = String(t ?? "").split(/[:h]/).map((x) => x.trim());
  if (!h) return "";
  const hh = String(Number(h));
  return m && m !== "00" ? `${hh} h ${m}` : `${hh} h`;
}

/** « Emma », « Emma et Léa », « Emma, Léa et Zoé » ; sans prénom : « votre enfant ». */
export function childrenLabel(children: string[]): string {
  if (!children.length) return "votre enfant";
  if (children.length === 1) return children[0];
  return `${children.slice(0, -1).join(", ")} et ${children[children.length - 1]}`;
}

/** « de Emma » → « d'Emma » ; « de votre enfant ». */
export function de(name: string): string {
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(name) ? `d'${name}` : `de ${name}`;
}

const WRAP = (inner: string) => `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1730;line-height:1.6;max-width:620px">${inner}</div>`;
const BUTTON = (href: string, label: string) =>
  `<p><a href="${esc(href)}" style="display:inline-block;background:#5b2a86;color:#fff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:bold">${esc(label)}</a></p>`;
const P = (s: string) => `<p>${s}</p>`;

function sessionLines(s: FirstSession): { label: string; value: string }[] {
  const hours = s.end ? `${frenchTime(s.start)} à ${frenchTime(s.end)}` : frenchTime(s.start);
  return [
    { label: "Jour", value: frenchDay(s.date) },
    { label: "Heure", value: hours },
    ...(s.location ? [{ label: "Lieu", value: s.location }] : [])
  ];
}

function sessionTable(s: FirstSession): string {
  const rows = sessionLines(s)
    .map((l) => `<tr><td style="padding:8px 12px;font-weight:bold;width:80px">${l.label}</td><td style="padding:8px 12px">${esc(l.value)}</td></tr>`)
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;background:#f7f4fb;border-radius:8px;margin:6px 0 14px">${rows}</table>`;
}
const sessionText = (s: FirstSession) => sessionLines(s).map((l) => `${l.label} : ${l.value}`).join("\n");

const GEAR = [
  "Une tenue de sport confortable (le chandail New Valkyria si vous l'avez déjà reçu)",
  "Des souliers d'intérieur au gymnase, des crampons multi-surfaces sur le terrain synthétique",
  "Un ballon",
  "Une gourde d'eau identifiée à son nom"
];

export interface OnboardingContent {
  subject: string;
  html: string;
  text: string;
}

export function onboardingEmail(step: OnboardingStep, family: Pick<OnboardingFamily, "email" | "parentName" | "children" | "programs" | "firstSession">, videoUrl: string | null): OnboardingContent {
  const first = String(family.parentName ?? "").trim().split(/\s+/)[0];
  const hello = `Bonjour${first ? ` ${first}` : ""},`;
  const kids = childrenLabel(family.children);
  const kidsH = esc(kids);
  const program = family.programs[0] ?? null;
  const s = family.firstSession;
  const many = family.children.length > 1;
  const v = (one: string, several: string) => (many ? several : one);
  const account = `${SITE}/compte`;

  if (step === "bienvenue") {
    const subject = `Bienvenue dans la famille New Valkyria${first ? `, ${first}` : ""} !`;
    const video = videoUrl
      ? { html: P(`Avant tout, un mot de bienvenue de JP, le fondateur de l'académie (1 minute) :`) + BUTTON(videoUrl, "Voir la vidéo de bienvenue"), text: `Avant tout, un mot de bienvenue de JP, le fondateur de l'académie (1 minute) :\n${videoUrl}\n\n` }
      : { html: "", text: "" };
    const progH = program ? ` au programme <strong>${esc(program)}</strong>` : "";
    const progT = program ? ` au programme ${program}` : "";
    const sessH = s ? P(`<strong>La première séance ${de(kidsH)}</strong> :`) + sessionTable(s) + P("Nous vous enverrons un rappel deux jours avant, avec ce qu'il faut apporter.") : "";
    const sessT = s ? `La première séance ${de(kids)} :\n${sessionText(s)}\nNous vous enverrons un rappel deux jours avant, avec ce qu'il faut apporter.\n\n` : "";
    const html = WRAP(
      P(hello) +
        P(`Bienvenue dans la famille New Valkyria ! Toute l'équipe est très heureuse d'accueillir ${kidsH}${progH}.`) +
        video.html +
        P(`<strong>Votre espace famille</strong> réunit tout au même endroit : l'horaire, les points et les progrès ${de(kidsH)}, les vidéos des matchs et vos factures. Pour l'ouvrir :`) +
        `<ol style="margin:0 0 12px;padding-left:20px"><li>Allez sur <a href="${account}">www.newvalkyria.com/compte</a>.</li><li>Choisissez « Créer un compte » avec cette adresse courriel : <strong>${esc(family.email)}</strong> (celle de l'inscription, pour que tout s'y relie).</li><li>Sur votre téléphone, ajoutez la page à votre écran d'accueil : elle s'ouvre ensuite comme une application.</li></ol>` +
        BUTTON(account, "Ouvrir mon espace famille") +
        sessH +
        P("Vous recevrez aussi une invitation à MonClubSportif, l'application de nos groupes, où se trouvent le calendrier et les présences.") +
        P("Une question ? Répondez simplement à ce courriel, nous vous répondons rapidement.")
    );
    const text = `${hello}\n\nBienvenue dans la famille New Valkyria ! Toute l'équipe est très heureuse d'accueillir ${kids}${progT}.\n\n${video.text}Votre espace famille réunit tout au même endroit : l'horaire, les points et les progrès ${de(kids)}, les vidéos des matchs et vos factures. Pour l'ouvrir :\n1. Allez sur ${account}\n2. Choisissez « Créer un compte » avec cette adresse courriel : ${family.email} (celle de l'inscription, pour que tout s'y relie).\n3. Sur votre téléphone, ajoutez la page à votre écran d'accueil : elle s'ouvre ensuite comme une application.\n\n${sessT}Vous recevrez aussi une invitation à MonClubSportif, l'application de nos groupes, où se trouvent le calendrier et les présences.\n\nUne question ? Répondez simplement à ce courriel, nous vous répondons rapidement.`;
    return { subject, html, text };
  }

  if (step === "rappel") {
    const when = s ? frenchDay(s.date) : "bientôt";
    const subject = `Rappel : première séance ${de(kids)} ${s ? `${when}` : "bientôt"}`;
    const gearH = `<ul style="margin:0 0 12px;padding-left:20px">${GEAR.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>`;
    const html = WRAP(
      P(hello) +
        P(`C'est bientôt le grand jour : voici tout ce qu'il faut savoir pour la première séance ${de(kidsH)}.`) +
        (s ? sessionTable(s) : "") +
        P("<strong>Quoi apporter</strong>") +
        gearH +
        P(`Arrivez 10 minutes à l'avance : l'équipe d'éducateurs accueille ${kidsH} et fait les présentations avec le groupe.`) +
        P("En cas d'absence, indiquez-le dans MonClubSportif ou répondez à ce courriel.") +
        P("À très bientôt sur le terrain !")
    );
    const text = `${hello}\n\nC'est bientôt le grand jour : voici tout ce qu'il faut savoir pour la première séance ${de(kids)}.\n\n${s ? `${sessionText(s)}\n\n` : ""}Quoi apporter :\n${GEAR.map((g) => `- ${g}`).join("\n")}\n\nArrivez 10 minutes à l'avance : l'équipe d'éducateurs accueille ${kids} et fait les présentations avec le groupe.\n\nEn cas d'absence, indiquez-le dans MonClubSportif ou répondez à ce courriel.\n\nÀ très bientôt sur le terrain !`;
    return { subject, html, text };
  }

  if (step === "apres") {
    const ideas = `${SITE}/compte/idees`;
    const subject = `Comment s'est passée la première séance ${de(kids)} ?`;
    const html = WRAP(
      P(hello) +
        P(`Nous espérons que ${kidsH} ${v("a aimé sa", "ont aimé leur")} première séance chez New Valkyria. Les premiers jours dans un nouveau groupe comptent beaucoup, et nous voulons qu'aucune famille ne se sente perdue.`) +
        P("Comment ça s'est passé de votre côté ? Répondez simplement à ce courriel : un mot suffit, et nous le lisons tous.") +
        P("Une idée, une suggestion ou quelque chose qui vous a mêlé ? La boîte à suggestions de votre espace famille est faite pour ça : chaque idée reçoit une réponse.") +
        BUTTON(ideas, "Boîte à suggestions")
    );
    const text = `${hello}\n\nNous espérons que ${kids} ${v("a aimé sa", "ont aimé leur")} première séance chez New Valkyria. Les premiers jours dans un nouveau groupe comptent beaucoup, et nous voulons qu'aucune famille ne se sente perdue.\n\nComment ça s'est passé de votre côté ? Répondez simplement à ce courriel : un mot suffit, et nous le lisons tous.\n\nUne idée, une suggestion ou quelque chose qui vous a mêlé ? La boîte à suggestions de votre espace famille est faite pour ça : chaque idée reçoit une réponse.\n${ideas}`;
    return { subject, html, text };
  }

  if (step === "jour14") {
    const points = `${SITE}/compte/points`;
    const lab = `${SITE}/compte/lab`;
    const subject = `Deux semaines déjà : les points et le Valkyria Lab ${de(kids)}`;
    const html = WRAP(
      P(hello) +
        P(`Deux semaines déjà ! Voici deux choses à découvrir avec ${kidsH} dans votre espace famille.`) +
        P(`<strong>Les points Valkyria</strong> : à chaque pratique, ${kidsH} ${v("gagne", "gagnent")} des points (présence, attitude, victoires du jour). Ils s'échangent ensuite contre des récompenses.`) +
        BUTTON(points, v("Voir ses points", "Voir leurs points")) +
        P(`<strong>Le Valkyria Lab</strong> : une routine du mois à faire à la maison en quelques minutes, avec une courte vidéo pour montrer ${v("ses", "leurs")} progrès.`) +
        BUTTON(lab, "Ouvrir le Valkyria Lab")
    );
    const text = `${hello}\n\nDeux semaines déjà ! Voici deux choses à découvrir avec ${kids} dans votre espace famille.\n\nLes points Valkyria : à chaque pratique, ${kids} ${v("gagne", "gagnent")} des points (présence, attitude, victoires du jour). Ils s'échangent ensuite contre des récompenses.\n${points}\n\nLe Valkyria Lab : une routine du mois à faire à la maison en quelques minutes, avec une courte vidéo pour montrer ${v("ses", "leurs")} progrès.\n${lab}`;
    return { subject, html, text };
  }

  const ideas = `${SITE}/compte/idees`;
  const subject = "Comment se passent vos 30 premiers jours ?";
  const questions = [`Qu'est-ce que ${kids} ${v("aime", "aiment")} le plus jusqu'ici ?`, "Y a-t-il quelque chose qui vous a manqué ou qui n'était pas clair ?", "Sur 10, à quel point recommanderiez-vous l'académie à une autre famille ?"];
  const html = WRAP(
    P(hello) +
      P(`Voilà un mois que ${kidsH} ${v("fait", "font")} partie de New Valkyria. Votre avis nous aide à améliorer l'accueil des prochaines familles : trois petites questions, une minute.`) +
      `<ol style="margin:0 0 12px;padding-left:20px">${questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ol>` +
      P("Répondez directement à ce courriel, ou écrivez dans la boîte à idées de votre espace famille.") +
      BUTTON(ideas, "Donner mon avis") +
      P("Merci de faire partie de l'aventure !")
  );
  const text = `${hello}\n\nVoilà un mois que ${kids} ${v("fait", "font")} partie de New Valkyria. Votre avis nous aide à améliorer l'accueil des prochaines familles : trois petites questions, une minute.\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nRépondez directement à ce courriel, ou écrivez dans la boîte à idées de votre espace famille :\n${ideas}\n\nMerci de faire partie de l'aventure !`;
  return { subject, html, text };
}

// ---------- Calendrier de la séquence ----------

/** Les moments d'envoi de chaque étape. Le rappel saute s'il tomberait trop près de la bienvenue (la bienvenue donne
 *  alors déjà la 1re séance) ; rappel et « après » sautent si la 1re séance n'est pas connue. */
export function onboardingSchedule(family: Pick<OnboardingFamily, "paidAt" | "firstSession">, now: Date): { step: OnboardingStep; sendAt: string }[] {
  const welcome = daytime(Math.max(now.getTime(), new Date(family.paidAt).getTime()) + 10 * 60_000);
  const out: { step: OnboardingStep; sendAt: number }[] = [{ step: "bienvenue", sendAt: welcome }];
  const s = family.firstSession;
  const paidDay = torontoDate(new Date(family.paidAt).getTime());
  const anchor = s && s.date > paidDay ? s.date : paidDay;
  if (s) {
    const start = torontoAt(s.date, s.start);
    const reminder = torontoAt(addDays(s.date, -2), "18:00");
    if (reminder > welcome + 12 * 3_600_000 && reminder < start) out.push({ step: "rappel", sendAt: reminder });
    out.push({ step: "apres", sendAt: torontoAt(addDays(s.date, 1), "10:00") });
  }
  out.push({ step: "jour14", sendAt: torontoAt(addDays(anchor, 14), "10:00") });
  out.push({ step: "jour30", sendAt: torontoAt(addDays(anchor, 30), "10:00") });
  // Rien ne part avant la bienvenue (programmation en retard : une étape déjà passée saute).
  return out.filter((o) => o.step === "bienvenue" || o.sendAt > welcome).map((o) => ({ step: o.step, sendAt: new Date(o.sendAt).toISOString() }));
}

/** Les courriels à programmer pour une famille, sans ceux déjà programmés (références existantes). */
export function planOnboarding(family: OnboardingFamily, now: Date, videoUrl: string | null, existingRefs: Set<string> = new Set()): PlannedEmail[] {
  return onboardingSchedule(family, now)
    .filter((s) => !existingRefs.has(onboardingRef(family.key, s.step)))
    .map((s) => {
      const c = onboardingEmail(s.step, family, videoUrl);
      return { step: s.step, ref: onboardingRef(family.key, s.step), sendAt: s.sendAt, to: family.email, subject: c.subject, html: c.html, text: c.text, parentName: family.parentName, playerName: family.children.join(", ") || null };
    });
}
