# Design de l'admin New Valkyria (direction de JP, 17 nov. 2026)

JP trouvait l'admin « trop surchargée et difficile à naviguer ». Direction donnée : **sobre, premium, professionnelle,
avec une identité propre à New Valkyria**. Références : **Stripe** (principale), **Linear** (secondaire), **Hudl** pour les
fonctionnalités sportives. Images de référence : tableaux de bord clairs à menu latéral (OpsSuite, Sportinzo, planet.training).

## Le mandat (JP, 17 nov. 2026)

Refonte complète, visuellement très cohérente, moderne et harmonieuse : l'esprit Stripe (surtout pour l'espace financier),
une identité mauve élégante propre à New Valkyria, impeccable sur ordinateur **et** sur téléphone. Tous les écrans existants
sont repris : navigation, hiérarchie de l'information, typographie, espacements, couleurs, composants. Un seul design
system (boutons, tableaux, cartes, formulaires, navigation latérale) appliqué partout, sans exception. Chaque nouvel écran
est une pièce du même système, jamais une page isolée : toute nouvelle fonctionnalité réutilise ces composants et ces jetons.

## Les choix

| Élément | Direction |
|---|---|
| Fond | Blanc cassé (`#FAFAF9`) |
| Navigation | Menu latéral gris très clair (`#F4F4F5`), lien actif en mauve plein |
| Couleur principale | Mauve Valkyria (`#6D3FC0`, foncé `#4B1F78`, pâle `#F1EBFB`) : action principale et état actif seulement |
| Typographie | Inter (une seule police, 4 tailles : héros 28–32, titre 18, corps 14, légende 12–13) |
| Boutons | Simples et élégants : plein mauve pour l'action principale, contour gris pour le reste, rayon 8 px |
| Cartes | Peu nombreuses, bien espacées, blanches, bordure fine `#ECECEF`, rayon 12 px, pas d'ombre lourde |
| Graphiques | Minimalistes (skill `dataviz`) : une couleur, grille légère, pas de 3D |
| Icônes | Lucide (`lucide-react`), trait 1,75, 16–18 px |
| Ambiance | Stripe + Linear |
| États | vert = bon, ambre = à surveiller, rouge = problème ; jamais pour décorer |

## Structure d'un écran (comme Stripe)

1. **Menu latéral** (fixe) : marque « New Valkyria / Académie active », sélecteur d'espace, recherche, puis
   les groupes du menu en petites capitales grises, un lien par hub avec son icône Lucide.
2. **En-tête de page** : titre (une question de JP en clair) + une phrase grise ; les onglets du hub dessous, soulignés.
3. **3 ou 4 indicateurs** en cartes (chiffre en grand, libellé en petit, variation en vert ou rouge).
4. **Le détail** : une carte par sujet (tableau, liste, graphique), titre de carte à gauche, action discrète à droite.

Exemple de tableau de bord : Joueuses inscrites · Entraîneurs · Revenus · Séances prévues, puis « Activité récente »
(nouvelle inscription, paiement reçu, évaluation complétée).

## Règles

- Les couleurs passent **toujours** par les jetons `var(--adm-…)` (`globals.css`, bloc « ADMIN — Système de design v3 »),
  jamais `#fff` ou `rgba(255,255,255,…)` écrits à la main dans un composant admin.
- Le menu se décrit dans `src/lib/admin-nav.ts` (une seule source) ; les icônes dans `admin-topbar.tsx` (Lucide).
- Toute nouvelle page suit le skill `admin-page` (rangement) et `design-interface` (exigence visuelle) ; ce document est la charte.
- Mobile : une colonne, menu replié derrière « Menu », cibles de 44 px.
