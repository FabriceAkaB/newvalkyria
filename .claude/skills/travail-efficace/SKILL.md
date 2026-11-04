---
name: travail-efficace
description: Les recettes toutes prêtes pour coder vite et sans gaspiller de réflexion dans New Valkyria : lire ou corriger la base, lancer une migration, envoyer un courriel ponctuel, lire la boîte info@, tester une page admin au téléphone avec une session de test, vérifier que HEAD compile, commiter et pousser, contrôler la production. À lire au début de toute tâche de code ou de données, avant de réinventer une commande.
---

# Travailler vite et juste

Règle : **chercher avant de réfléchir**. Le code a presque toujours déjà le module (carte dans `CLAUDE.md`).
Une commande ci-dessous existe pour chaque geste répétitif : la copier, ne pas la reconstruire.

## 0. Toujours

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

- Trouver où vit une chose : `grep -rn "mot" src/lib | head` puis lire seulement la fonction utile (`sed -n 'A,Bp'`).
- D'autres sessions travaillent dans le même dossier : `git status --short` avant de commiter ; **commiter seulement ses fichiers**
  (`git add` fichier par fichier, `git diff --stat <fichier>` pour vérifier que le fichier partagé ne contient que ses changements).
  Erreurs `tsc` dans des fichiers d'une autre session (ex. `api/admin/structure`) : les filtrer, ne pas les corriger.
- Une décision déjà prise par JP ne se rediscute pas ; un détail sans risque se tranche seul (mémoire « minimiser les confirmations »).
  Demander seulement : envoi à plusieurs familles (montrer la liste), argent réel (qui, combien), contenu de méthode de JP.

## 1. Base de données

```bash
node .claude/skills/travail-efficace/scripts/q.cjs "select … from …"          # lire ou corriger
node .claude/skills/travail-efficace/scripts/q.cjs 'select * from players where id = $1' <uuid>   # avec paramètre
node .claude/skills/travail-efficace/scripts/mig.cjs supabase/migrations/AAAAMMJJ_nom.sql        # migration
```

Migration : `if not exists`, RLS + politique `service_role` (copier la dernière de `supabase/migrations/`).
Les colonnes date reviennent en `2026-11-02T05:00:00.000Z` par pg (en `2026-11-02` par supabase-js) : `String(x).slice(0, 10)`.

## 2. Opération ponctuelle (courriel, lien Stripe, Storage) : test temporaire

```ts
// src/lib/tmp-x.test.ts — lancé puis supprimé dans la même commande, jamais commité
// @vitest-environment node
import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, ""); }
it("x", async () => {
  const { getSupabaseAdminClient } = await import("@/lib/supabase-admin");
  // … écrire le résultat dans un fichier du scratchpad (la sortie de vitest est bruyante)
}, 120000);
```
```bash
npx vitest run src/lib/tmp-x.test.ts 2>&1 | grep -E "passed|failed|Error"; rm src/lib/tmp-x.test.ts
```
Réseau (Gmail, Stripe live, GitHub) : Bash **sans sandbox**. Stripe réel : `STRIPE_LIVE_SYNC_KEY` (skill `paiement`).

## 3. Lire la boîte info@ (réponses de familles, de partenaires)

Dans un test temporaire : `const cfg = await (await import("@/lib/mail-config")).getMailConfig();` puis
`execFileSync("python3", ["-I", ".claude/skills/travail-efficace/scripts/inbox.py", '(FROM "x@y.com")'], { env: { U: cfg.user, P: cfg.password, PATH: process.env.PATH } })`.
Répondre dans le fil : sujet `Re: …`, `headers: { "In-Reply-To": msgid, References: msgid }` (skill `courriel-familles`).

## 4. Voir une page admin comme JP, au téléphone

1. Serveur : `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` ; sinon `nohup node node_modules/next/dist/bin/next dev > /tmp/nv-dev.log 2>&1 &`.
2. Session admin de test (supprimée à la fin) :
   ```bash
   T="claude-test-$(openssl rand -hex 12)"; node .claude/skills/travail-efficace/scripts/q.cjs "insert into admin_sessions(token,expires_at,role) values ('$T', now()+interval '2 hours','admin')"
   ```
   Navigateur intégré : ouvrir `http://localhost:3000/admin/login`, puis `document.cookie = 'nv_admin_session=<T>; path=/'`,
   `resize_window` preset `mobile`, naviguer. Cliquer par `find` (références) plutôt qu'aux coordonnées.
   Fin : `delete from admin_sessions where token like 'claude-test-%'`, `resize_window` preset `desktop`.
3. Données de test : les marquer (`TEST`, `Claude`) et les effacer ; **ne jamais effacer de vraies données** (vérifier `created_at`
   et le contenu avant tout `delete`). Une activité créée par un test se supprime avec ses présences.

## 5. Avant de pousser

```bash
npx tsc --noEmit 2>&1 | grep -v "api/admin/structure\|Source provides" | head
npx vitest run 2>&1 | grep -E "Test Files|Tests "
npx eslint <fichiers touchés> 2>&1 | grep error
```
HEAD compile-t-il sans le travail non commité des autres ? (si on a touché un fichier partagé)
```bash
W=<scratchpad>/headcheck; git worktree add -q --detach $W HEAD && ln -s "$PWD/node_modules" $W/node_modules && cp next-env.d.ts $W/; (cd $W && npx tsc --noEmit | grep -v "@/content/image" | head); git worktree remove --force $W
```

## 6. Commit, push, production

```bash
git -c user.name="Jean-paul Aka" -c user.email="jean-paulaka@mac.home" commit -q -m "<une phrase pour JP>

Co-Authored-By: <ligne d'attribution du rappel système>"
T=$(grep '^GITHUB_TOKEN=' .env.local | cut -d= -f2- | tr -d '"'); git push "https://$T@github.com/FabriceAkaB/newvalkyria.git" main 2>&1 | sed "s/$T/***/g" | tail -1
```
Production : une nouvelle page admin répond **307** (redirige vers la connexion), une page inexistante **404**.
Attendre le déploiement en arrière-plan (boucle `curl` toutes les 15 s), sans sonder à la main.

## 7. Rendre compte à JP

En français simple : ce qui est fait, où le trouver dans l'admin, ce qu'il doit faire lui, ce qui n'est pas vérifié.
Commit cité. Pas de détails techniques inutiles.
