---
name: design-interface
description: Dessiner et construire des écrans New Valkyria (admin, pages parents, pages d'offre, tableaux de bord) avec l'exigence d'un designer d'interface Apple : hiérarchie claire, sobriété, une seule action principale, chiffres lisibles d'un coup d'œil, finition au pixel, mobile. À utiliser AVANT de coder tout nouvel écran ou toute refonte visuelle, et quand JP trouve qu'une section « n'est pas belle ».
---

# Design d'interface — niveau « designer Apple »

JP trouve souvent les sections « pas très belles ». Objectif : chaque écran doit sembler conçu, pas empilé.
Si les plugins `frontend-design` / `Design` sont activés, les utiliser en plus de ce skill.

## Principes (inspirés des Human Interface Guidelines)
1. **Clarté** : l'écran répond à UNE question de JP (ex. « qu'est-ce que je dois faire aujourd'hui ? », « combien j'ai encaissé ? »).
   Le titre dit cette question en langage simple ; la réponse est la plus grande chose à l'écran.
2. **Hiérarchie** : 1 chiffre ou message héros → 2 à 4 indicateurs → le détail (tableau, liste). Jamais 12 cartes de même poids.
3. **Retenue** : une couleur d'accent (mauve New Valkyria) réservée à l'action principale et à l'état actif ; le vert/orange/rouge
   seulement pour un état (bon, à surveiller, problème). Pas de bordures partout : l'espace sépare, pas les traits.
4. **Une action principale par écran**, en bouton plein ; les autres en boutons discrets ou dans un menu.
5. **Chiffres** : alignés à droite, `font-variant-numeric: tabular-nums`, arrondis au dollar sauf détail comptable, toujours avec la période.
6. **États prévus** : vide (une phrase + l'action pour commencer), chargement, erreur (ce qui s'est passé + quoi faire), succès.
7. **Mobile d'abord** pour tout ce que JP consulte en déplacement (Aujourd'hui, finances, relances) : une colonne, cibles de 44 px.

## Système (s'y tenir, ne pas inventer de style ad hoc)
- **Espacement** : multiples de 4 px (4, 8, 12, 16, 24, 32, 48). Marges internes des cartes : 20–24 px.
- **Typographie** : 4 tailles seulement — héros (32–40 px, 600), titre de section (18–20 px, 600), corps (14–15 px, 400),
  légende (12–13 px, couleur atténuée). Pas de majuscules sur plus de 3 mots.
- **Rayons** : 12 px cartes, 8 px boutons et champs, 999 px pastilles d'état.
- **Profondeur** : surfaces légèrement plus claires que le fond plutôt que des ombres ; une seule élévation pour ce qui flotte.
- **Couleurs** : passer par des variables CSS (tokens) plutôt que des couleurs en dur dans le JSX ; vérifier le contraste (4.5:1 texte).
- **Composants admin existants** à réutiliser et améliorer plutôt que dupliquer : `AdminPageHeader`, `AdminTabs`
  (`src/components/admin-page-header.tsx`), classes `admin-stat-card`, `admin-table-wrap`, `admin-btn-primary`/`-ghost`, `admin-input`.
  Les graphiques suivent le skill intégré `dataviz`.

## Méthode
1. **Comprendre** : quelle question l'écran règle, pour qui (JP, gérante, parent), sur quel appareil.
2. **Esquisser avant de coder** : décrire (ou montrer en maquette/Artifact) la hiérarchie en 3 niveaux et l'action principale ;
   pour un écran important, proposer 2 directions à JP et le laisser choisir.
3. **Construire** avec le système ci-dessus, contenu réel (pas de faux chiffres).
4. **Critiquer comme un designer** : capture à 1280 px et à 375 px (navigateur intégré), puis se demander :
   qu'est-ce qui attire l'œil en premier ? peut-on enlever un élément ? les alignements tombent-ils juste ? les textes sont-ils
   simples ? Corriger, recapturer une fois.
5. **Livrer** : skill `admin-page` (rangement) puis `mise-en-ligne` ; montrer la capture à JP.
