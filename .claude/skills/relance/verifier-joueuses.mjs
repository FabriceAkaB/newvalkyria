// Vérifie, AVANT une relance ou une offre, si chaque joueuse visée est déjà inscrite
// (payée) quelque part, par NOM de joueuse et par COURRIEL parent. Lecture seule.
//
// Usage (depuis la racine du dépôt) :
//   node .claude/skills/relance/verifier-joueuses.mjs liste.json
// où liste.json = [{ "player": "Prénom Nom", "parentEmail": "parent@exemple.com" }, ...]
import fs from "node:fs";
import pg from "pg";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const list = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const words = (s) => norm(s).split(" ").filter((w) => w.length > 1);

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const paid = [
  ...(await c.query("select 'saison ' || coalesce(program_id,'?') || ' (' || season_id || ')' as src, player_first_name || ' ' || player_last_name as player, parent_email from registrations where status = 'paid'")).rows,
  ...(await c.query("select 'programme ' || program_slug as src, player_first_name || ' ' || player_last_name as player, parent_email from session_program_registrations where status = 'paid'")).rows,
  ...(await c.query("select 'sport-etudes' as src, player_first_name || ' ' || player_last_name as player, parent_email from sport_etudes_registrations where status = 'paid'")).rows,
  ...(await c.query("select 'offre speciale ' || title as src, r->>'playerName' as player, parent_email from special_offers, jsonb_array_elements(registrations) r where paid_at is not null")).rows
];
await c.end();

let flagged = 0;
for (const target of list) {
  const tw = words(target.player);
  const hits = [];
  for (const p of paid) {
    const pw = words(p.player);
    const common = tw.filter((w) => pw.includes(w)).length;
    const sameEmail = target.parentEmail && norm(p.parent_email) === norm(target.parentEmail);
    // 2 mots en commun = même joueuse probable (gère « Adriana Sofia Lozano Vera » vs « Sofia Lozano ») ;
    // même nom de famille seulement = sœur ou même famille, à regarder aussi.
    const sameName = common >= 2;
    const sameFamily = !sameName && pw.length > 0 && tw.includes(pw[pw.length - 1]);
    if (sameEmail || sameName || sameFamily) {
      const why = [sameEmail && "MÊME COURRIEL", sameName && "MÊME NOM", sameFamily && "même nom de famille (sœur ?)"].filter(Boolean).join(" + ");
      hits.push(`${why} → ${p.player} · ${p.src} · ${p.parent_email}`);
    }
  }
  if (hits.length) flagged++;
  console.log(`${hits.length ? "⚠️  À VÉRIFIER" : "✅ libre     "}  ${target.player} <${target.parentEmail ?? "?"}>`);
  for (const h of hits) console.log(`      ${h}`);
}
console.log(`\n${list.length} joueuses vérifiées, ${flagged} à vérifier à la main avant l'envoi.`);
