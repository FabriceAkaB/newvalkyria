---
name: rapport
description: Produire un rapport ou un bilan complet de l'académie New Valkyria (page web privée et/ou PDF téléchargeable, dossier détaillé à donner à une autre IA) à partir des données réelles du site. À utiliser quand JP demande un rapport, un bilan, un résumé de tout, un PDF de l'entreprise, ou un document pour le comptable, un partenaire ou une autre conversation Claude.
---

# Rapport / bilan

1. **Données à jour** : `buildAcademySnapshot()` (`src/lib/academy-history.ts`) dans un test vitest temporaire qui écrit un JSON
   dans le dossier scratchpad ; compléter au besoin par des requêtes `pg` (programmes, horaires, dépenses, contrats, offres, relances).
2. **Contenu** (adapter à la demande) : en bref (chiffres clés), identité et équipe, chronologie, programmes et prix, horaires et
   remplissage, clientèle, finances et marges (skill `finances`), contrats de terrains, partenaires, outils du site, enjeux,
   dossiers en cours avec dates, recommandations. Pour une autre IA : ajouter une section « Comment lire ce document »,
   un résumé en 12 lignes, des sections numérotées (§) et un glossaire.
3. **Confidentialité** : aucune liste nominative de familles ni d'enfants ; seulement les noms nécessaires à un dossier en cours.
4. **Format** :
   - Page web privée : outil Artifact (quickstart puis page HTML soignée, thème clair et sombre).
   - PDF : HTML d'impression puis Chrome sans interface :
     `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer --generate-pdf-document-outline --print-to-pdf=SORTIE.pdf file://ENTRÉE.html`
     (table des matières cliquable avec ancres + signets). Vérifier quelques pages en image avant de livrer.
   - Livrer : envoyer le fichier à JP et le copier dans `~/Downloads` si demandé.
5. Toujours dater le rapport et rappeler que la version vivante est dans Admin → Outils → Historique de l'académie.
