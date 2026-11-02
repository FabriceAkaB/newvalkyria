---
name: mise-en-ligne
description: Vérifier, commiter, déployer et contrôler une modification du site New Valkyria sur la vraie production (www.newvalkyria.com), sans oubli. À utiliser à la fin de chaque changement de code ou de base de données, ou quand JP dit « mets en ligne », « déploie », « est-ce que c'est en ligne ».
---

# Mise en ligne

1. **Vérifier** : `export PATH="$HOME/.local/node/bin:$PATH"; npx tsc --noEmit` (et `npx eslint <fichiers modifiés>`) ;
   `npx vitest run` si une logique testée a changé. Migration SQL : déjà exécutée sur la base (node + `pg`) et commitée.
2. **Données de test** : supprimer toute donnée créée pour tester (`@example.com`, `TEST-`, `ZZ…`) et les fichiers `src/lib/tmp-*.test.ts`.
3. **Commit** : `git -c user.name="Jean-paul Aka" -c user.email="jean-paulaka@mac.home" commit -m "<résultat pour JP, en français>"`
   avec la ligne `Co-Authored-By` demandée par le harnais.
4. **Push** (réseau : Bash sans sandbox) :
   `T=$(grep '^GITHUB_TOKEN=' .env.local | cut -d= -f2- | tr -d '"'); git push "https://$T@github.com/FabriceAkaB/newvalkyria.git" main 2>&1 | sed "s/$T/***/g" | tail -3`
   Ne jamais afficher le jeton ni demander à JP de se connecter à GitHub.
5. **Attendre le déploiement Vercel** (2 à 4 min) avec une boucle `until curl … | grep -q "<texte nouveau>"; do sleep 15; done`
   (en arrière-plan ou avec une limite), jamais une suite de `sleep`. Si rien n'arrive après ~6 min, pousser un commit vide.
6. **Contrôler en production** : la page ou la route modifiée répond (200, ou 307 vers /admin pour l'admin), le texte attendu est là ;
   pour un paiement, `POST /api/offre/...` renvoie une URL `cs_live_`. Pour l'admin, JP doit se connecter : le dire s'il faut qu'il regarde.
7. **Dire à JP** ce qui est en ligne, ce qui a été vérifié et ce qui n'a pas pu l'être.
