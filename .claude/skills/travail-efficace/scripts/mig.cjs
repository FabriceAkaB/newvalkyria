// Exécute une migration SQL (fichier) sur Supabase. Usage :
//   node .claude/skills/travail-efficace/scripts/mig.cjs supabase/migrations/AAAAMMJJ_nom.sql
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
  await c.query(fs.readFileSync(path.resolve(root, process.argv[2]), "utf8"));
  console.log("ok");
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
