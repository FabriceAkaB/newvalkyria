---
name: admin-page
description: Règles pour ajouter ou modifier un écran de l'espace administrateur New Valkyria (/admin) sans le désorganiser : où le ranger (6 sections + Outils), en-tête et onglets communs, rôles admin/gérante, page « Aujourd'hui ». À utiliser dès qu'une demande de JP touche l'admin : nouvelle page, nouvel onglet, nouveau tableau, nouvelle alerte.
---

# Ajouter quelque chose à l'admin

L'admin a été réorganisée le 1er nov. 2026 pour ne plus être « une interface avec un milliard de choses partout ».
Chaque ajout doit garder cette structure.

## 1. D'abord : réutiliser
1. Chercher l'écran existant le plus proche dans `src/lib/admin-nav.ts` (source unique du menu et des onglets).
2. Si un hub existant couvre le sujet, **ajouter un onglet** ou une carte dans sa page, pas une nouvelle section.
3. Une nouvelle page n'est créée que si aucun hub ne convient ; elle va alors dans un hub existant comme onglet.

## 2. Où ranger (sections de `ADMIN_NAV`)
| Section | Contenu |
|---|---|
| Aujourd'hui (`TODAY_HUB`) | Uniquement des **actions à faire** (`src/lib/admin-today.ts`, `getTodayActions`) |
| Familles & inscriptions | Saison en cours, essais, uniformes & boutique |
| Programmes & horaires | Garçons & Sport-Études, calendrier & terrains, évaluations |
| Communications | Messages aux familles, relances, références |
| Finances | Revenus & paiements (admin seulement) |
| Équipe & partenaires | Entraîneurs, contrats, commandites, vente de matchs |
| Outils (replié) | Historique, audit, exports, saisons passées |

Si l'ajout produit quelque chose que JP doit **traiter** (réponse, échéance, échec, paiement en retard), ajouter aussi
une ligne dans `getTodayActions` pour que ça apparaisse dans « Aujourd'hui ».

## 3. Format d'une page
- Le menu (`admin-topbar.tsx`) affiche automatiquement le titre du hub, sa phrase d'explication et ses onglets
  (`AdminPageHeader`, `AdminTabs` dans `src/components/admin-page-header.tsx`) : ne pas recréer d'en-tête ni de lien « ← retour ».
- Réutiliser les classes existantes : `admin-content`, `admin-section`, `admin-stats` / `admin-stat-card`, `admin-table-wrap`,
  `admin-btn-primary` / `admin-btn-ghost`, `admin-input`. Pas de nouveau style ad hoc.
- Libellés en français simple, du point de vue de JP (« Places disponibles », pas « capacity »).
- Doit marcher sur téléphone (le menu se replie derrière « Menu »).

## 4. Rôles
- `requireAdmin()` dans la page serveur ; `requireAdmin({ roles: ["admin"] })` + `adminOnly: true` dans `admin-nav.ts`
  pour tout ce qui montre de l'argent, des revenus, de la paie ou des données RH. La gérante (Christine) ne voit pas ça.
- Les routes API correspondantes vérifient le rôle elles aussi (`getCurrentAdminRole()` / `isAdminRequest`).

## 5. Avant de livrer
- `npx tsc --noEmit` ; vérifier que chaque lien du hub répond (200 ou redirection vers /admin si non connecté).
- Ne jamais changer une URL existante sans redirection (des courriels contiennent ces liens).
- Mettre à jour `CLAUDE.md` (carte des modules) si un module est ajouté. Puis skill `mise-en-ligne`.
