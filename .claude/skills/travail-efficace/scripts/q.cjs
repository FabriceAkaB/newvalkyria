// Requête SQL directe sur Supabase (lecture ou correction ponctuelle). Usage, depuis la racine du projet :
//   node .claude/skills/travail-efficace/scripts/q.cjs "select count(*) from registrations"
// Ne jamais afficher une clé : la connexion vient de SUPABASE_DB_URL dans .env.local.
const fs = require("fs");
const path = require("path");
const root = process.cwd();
const env = {};
for (const l of fs.readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { Client } = require(path.join(root, "node_modules/pg"));
(async () => {
  const c = new Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(process.argv[2], process.argv.slice(3));
  console.log(JSON.stringify(r.rows, null, 1));
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
