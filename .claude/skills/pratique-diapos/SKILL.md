---
name: pratique-diapos
description: Créer une pratique (séance d'entraînement) New Valkyria comme JP les fait : une présentation en diapos sur claude.ai (type « Slides ») avec les clous du thème, les corrections prévues, le déroulé minuté par groupe, une diapo par exercice avec schéma du terrain et une diapo de progression ; puis la ranger dans le site (activité, pratique du jour, banque d'exercices, galerie en diapos). À utiliser dès que JP demande de préparer, créer ou planifier une pratique, une séance, un entraînement, un thème de la semaine, ou des exercices pour un groupe.
---

# Préparer une pratique en diapos

JP prépare ses pratiques sur claude.ai comme des **présentations « Slides »** (artifacts du type Slides). Exemples de référence,
à relire avant d'en faire une nouvelle (outils `claude-artifacts` : `list_files` puis `read_file` des fichiers `project/…`) :

- « New Valkyria · U10 et U11 · Jouer entre les lignes · 2 novembre » (slug `f8a5ee05-91f9-4cfb-9072-c161321d2913`) : **le modèle**.
- « Pratique fin de semaine 4 · Utiliser la profondeur » (`b7c1f6b4-d53b-4bc8-8168-724fe552ed47`).
- « New Valkyria · U10 et U11 · 19 octobre » (`bab7fa75-0373-4e7f-8dc2-9898c8861056`).
- Banques : « Banque d'exercices U7/U9 » (`ecb1b9c4-…`), « Création d'exercices » (`bdd8e26a-…`) ; fichiers locaux
  `~/Downloads/Banque_exercices_U11-U13_New_Valkyria.pptx`, `~/Downloads/conception_exercices_par_les_parametres.docx`
  (méthode : faire ressortir le thème **par les paramètres**, sans corriger : terrain, matériel, nombre, cognitif, règles, opposition, type de supériorité).

Avant d'écrire : lire le `SKILL.md` du type Slides (`read_file` path `SKILL.md` d'un deck existant) et commencer par `list_types` / créer
depuis le type Slides ; une nouvelle pratique = un **nouveau deck** (ne pas modifier un ancien sans que JP le demande).

## La colonne vertébrale : la planification annuelle du PSG Academy

Les thèmes suivent la **planification annuelle PSG Academy** (fichier `~/Downloads/planifications ACADEMY 2019(1).xlsx`),
résumée semaine par semaine dans [psg-planification.md](psg-planification.md) : phase de jeu, principe, technique, physique,
perception, mental, pour U8/U11 et U12/U16. Le bloc en cours (4 à 6 semaines, même thème, de plus en plus difficile) se lit dans
Coaching → Plan de l'année ; le 2 novembre 2026 = **semaine 1 de « Jeu entre les lignes »** (PSG : jeu dans les intervalles).
D'une semaine à l'autre du même bloc : garder les mêmes clous et les mêmes mots, monter la difficulté (espace plus petit, moins de
touches, défense active, opposition équilibrée), changer les exercices.

## Ce qu'il faut savoir avant (le demander seulement si introuvable)

1. **Thème** de la semaine : Coaching → Plan de l'année (`season_themes`, thème propre à une catégorie possible), sinon le bloc PSG.
2. **Groupes** et **nombre de joueuses** : l'effectif réel de la plage (`rosterForActivity`, ou la liste du sondage de fin) ; date, heure, lieu
   (gymnase = technique et ball mastery ; synthétique = tactique, grand espace, prise de décision).
3. **Durée** : 85 ou 90 minutes selon la plage (`time_slot_templates`).
4. **Composantes obligatoires** de JP (Coaching → Méthode → « Ce que chaque entraînement doit avoir », `getComponents()`) et la
   **structure de séance** (`getStructure()`) : la pratique doit les respecter toutes.
5. Exercices déjà **approuvés** de la banque pour cet âge et ce thème (`getBank()`), et ceux « à changer » ou notés sous 8 cette semaine
   (à ne pas reprendre).

## Groupes multi-âges (règle de JP, 4 nov. 2026)

La plupart des groupes mélangent 2 années, parfois 3 : 2016-2017, 2014-2015, 2013-2012, ou 2015 avec 2014-2013 au même gymnase à la même heure. Les équipes MonClubSportif sont aussi multi-âges (Équipe 2016-2017 AV/INT, Lundi 2014-2015…). Quand on monte une pratique :

- **Prendre l'effectif réel de la plage**, toutes années confondues (liste du sondage ou `rosterForActivity`, groupes fusionnés), avec l'âge de chaque fille, pas seulement le nom du groupe.
- **Un seul thème pour tout le groupe**, mais chaque exercice précise la différence par âge :
  - pour les plus jeunes : plus d'espace, plus de touches, défense passive plus longtemps ;
  - pour les plus vieilles : moins d'espace, 1 ou 2 touches, une contrainte de plus ;
  - c'est la ligne « Pour simplifier / Pour corser » de la diapo de progression.
- **Former les équipes en mélangeant les âges**, et noter qui joue le rôle clé (la cachée, la jokeuse), pour que les plus jeunes aient aussi le ballon.
- **Avancé et intermédiaire** (AV / INT) : même thème, mais la diapo de progression monte plus vite pour le groupe avancé.
- **Le PSG** donne U8/U11 et U12/U16 : pour un groupe à cheval, prendre l'objectif de la catégorie de la majorité, et mettre en variante la technique de l'autre.

## Le deck (ordre des diapos du modèle)

1. **Couverture** : « New Valkyria · <groupes> · <thème> · <date> ».
2. **Les clous** (fond foncé `#18141D`) : 3 à 4 comportements clés numérotés, chacun avec son **mot clé entre guillemets** (jaune `#F2C230`)
   et une phrase en langage d'enfant. On tape sur ces clous toute la séance, toujours avec les mêmes mots.
3. **Les corrections prévues** : tableau « Ce que je vois · Ce que je dis · Arrêt flash (20 secondes, on rejoue) ».
4. Pour **chaque groupe** (ex. U10, U11) :
   - diapo titre du groupe (âge, nombre de joueuses, durée) ;
   - **déroulé minuté** : tableau Temps · Bloc · Exercice · Montage ; blocs Échauffement, Eau (2 min, on remonte le matériel),
     Ball mastery, Technique 1, Technique 2, Tournoi / forme jouée, Bilan (les clous, 3 questions, rangement) ; ligne **Matériel** totale ;
   - **une diapo par exercice** : titre en capitales, pastille « Groupe · Bloc · 0:00 → 0:08 », colonnes Organisation · Points et progression
     · encadré **Critères de réalisation** (3 courts), et à droite le **schéma SVG** du terrain (sol de gymnase bois `#D7A86E` ou gazon),
     joueuses mauves `#734A9B` / blanches / noires, coach carré bleu `C`, flèches passe (pleine) et course (pointillée), étiquettes
     de dimensions ; légende sous le schéma ; note pour le coach dans `<aside>` (source de l'exercice, comment coacher) ;
   - pour les exercices de Technique et de Tournoi : une diapo **« · progression »** : tableau Temps · Étape · Ce qui change · Le clou,
     puis 3 encadrés « Rotation et répétitions » (foncé), « Pour simplifier », « Pour corser ».
5. Pied de chaque diapo : logo, « New Valkyria · <thème> · <date> », numéro « n / total ».

Style : fond `#F6F3F9`, texte `#3A3145`, titres Oswald 700 capitales, texte Public Sans 24 px au moins, mauve `#734A9B`,
pastilles `#E6DAF1`. Sections du `deck.json` : intro (couverture, clous, corrections) puis une section par groupe.

## Règles de la méthode Valkyria (à respecter dans chaque exercice)

- Un ballon par fille autant que possible, aucune file d'attente ; viser beaucoup de touches.
- Explications de moins de 30 secondes ; le coach parle moins de 20 % du temps ; questions plutôt que réponses.
- Dossards de couleurs pour forcer la prise d'information ; une forme jouée avec prises de décision à chaque séance.
- Échauffement FIFA 11+ Kids intégré au jeu d'entrée. Plan B pour le nombre de joueuses (« si vous êtes 15 : … »).
- Points et petits tournois individuels pour l'engagement ; pas de classement humiliant (chaque fille comparée à elle-même).
- Le thème ressort par les **paramètres** (doc conception par les paramètres), pas par des arrêts répétés.

## Ensuite : la déposer et la décortiquer (obligatoire, historique exact depuis le 1er novembre 2026)

- **Déposer :** l'historique est dans Coaching → Pratiques → Historique (`practice-history-repo.ts`, `depositPractice`). Le lien du deck va dans `coach_activities.deck_url`.
- **Décortiquer bloc par bloc :** une ligne `activity_session_blocks` par exercice, dans l'ordre du déroulé, sans les pauses d'eau.
  - Chaque ligne contient : le type, le titre, les minutes, `setup` (organisation), `material`, `key_points` (critères, un par ligne), `progressions` (étapes minutées), `variants` (simplifier, corser).
  - `notes` commence par « Lien avec le thème : … ».
  - Pour lire les diapos, confier la lecture à un agent qui rend un JSON par groupe : c'est ce qui a été fait pour le 2 novembre.
- **Analyse et note :** l'analyse d'après pratique va dans `analysis`. La **note de pertinence au thème** (`theme_score`, sur 10) est donnée par **JP seulement**. À 8 et plus, la pratique entre dans la galerie des pratiques modèles.

## Ensuite : la ranger dans le site (sinon le portail des éducateurs ne la voit pas)

1. Créer ou retrouver l'activité de la pratique : `listPractices` puis `createActivityFor` (`practices-repo.ts`).
2. Plan de séance bloc par bloc dans `activity_session_blocks` (champs pratique du jour : setup, material, roles, key_points, variants,
   progressions ; `session-plan-repo.ts`) : c'est ce que l'éducateur lit à l'étape « Avant ».
3. Chaque **nouvel** exercice dans la banque (`createExercise`, `exercises-repo.ts`) : titre, type, place dans la séance, âges, lieu,
   joueuses min/max, durée, organisation selon 5-7 / 8-10 / 11-16, critères = `coaching_points`, variantes plus facile / plus difficile.
   La diapo exportée en image va dans `image_url` (« Ajouter une photo ») : elle apparaît alors dans la **Galerie en diapos**.
4. Mettre le lien du deck dans les notes de l'activité, et donner à JP le lien du deck et ce qui a été rangé.
