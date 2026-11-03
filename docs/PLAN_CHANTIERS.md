# Plan des prochains chantiers (code), par priorité

Écrit le 3 novembre 2026 à partir du Mandalart (tâches pas faites des niveaux 1 et 2, automatisations AU01 à AU23,
agents A01 à A12) et de ce qui existe déjà sur le site. Ordre = ce qui fait le plus pour le bon fonctionnement de
l'académie et pour le niveau en cours (niveau 1 « Fondations », jusqu'au 31 décembre ; niveau 2 « Vendre l'été
d'avance », de janvier à mars). On construit un chantier à la fois, en mode assistant d'abord.

## Chantier n° 1 : l'agent administratif qui répond aux courriels à ta place

Mandalart P8.5.01 puis P8.5.02, agent A01, automatisation AU16. Échéance du plan : 31 décembre.

Pourquoi en premier : c'est ce qui te prend le plus de temps chaque jour, une famille qui attend une réponse est une
famille qu'on perd, et tout ce qu'il faut est déjà là (boîte info@ lisible, inscriptions, horaires, paiements, liens
Stripe, journal des relances).

1. **Lire la boîte info@** toutes les 10 minutes (Gmail IMAP, déjà testé le 3 novembre) et reconnaître la famille
   (courriel croisé avec toutes les inscriptions, par nom de joueuse aussi).
2. **Classer** le message : essai, inscription, paiement, horaire ou absence, annulation ou remboursement, partenaire, autre.
3. **Rédiger la réponse** avec Claude à partir des vraies données : le groupe et l'horaire de la joueuse, ce qui est
   payé, les liens de paiement, la FAQ et la politique d'annulation. Réponse dans le même fil, Christine en copie
   quand la règle le demande, chaque envoi noté dans le journal des relances.
4. **Mode assistant** (étape 1) : une page « Courriels à répondre » dans l'admin. Le brouillon est prêt ; tu touches
   Envoyer, ou tu corriges d'abord. Avis dans « Aujourd'hui » et sur ton téléphone.
5. **Semi-automatique** (étape 2, après 2 ou 3 semaines sans correction) : les questions fréquentes partent seules.
   L'argent (remboursement, rabais, bourse), les plaintes et les cas délicats restent toujours pour toi. On mesure les
   heures sauvées.

Ce qu'il faut de toi :

- une clé API Anthropic (console.anthropic.com → API Keys), à mettre dans Vercel ;
- la FAQ et la politique d'annulation que l'agent a le droit de citer.

## Ensuite, dans l'ordre

2. **Vendre l'été 2027 d'avance et la prévente des camps** (P2.4.05 ⭐ 15 déc., P5.2.10 ⭐ 20 déc., P2.5.01,
   calculateur P7.2.02 / AU11). C'est tout le niveau 2. Prix planchers recalculés, pages, prix hâtifs, liste des familles
   intéressées, courriel prêt. Le calculateur de lancement est déjà commencé dans une autre session (pas encore en ligne).
3. **Droit à l'image à l'inscription** (P8.1.01), et la même question aux familles déjà inscrites. Petit chantier qui
   débloque les photos des gagnantes du jour, les réseaux et le Valkyria Lab. Aujourd'hui, aucune famille n'a donné son accord.
4. **Relance automatique des paiements en retard** (AU04, P2.7.03). Les prélèvements des versements tournent déjà chaque
   jour. Ce qui manque :
   - les rappels à 1, 7 et 14 jours ;
   - la règle « pas sur le terrain après 30 jours de retard sans entente » ;
   - le lien de paiement envoyé tout seul ;
   - désactiver tout seul l'autre lien quand une famille paie l'un des deux (comme pour la bourse de Laurianne).
5. **MonClubSportif sans manipulation** (P8.4.05, P8.4.08, P8.4.09, AU19, agent A12) :
   - la liste « à faire dans MonClubSportif » après chaque paiement ou remboursement ;
   - le calendrier lu en iCal (déjà en cours dans une autre session) ;
   - plus tard, le robot qui fait les clics à ta place.
6. **Tableaux de bord du lundi** (AU14, P7.7.01 ⭐, P3.8.03 ⭐) :
   - finance : chiffre d'affaires de la semaine, encaissements à venir, marge par programme ;
   - marketing : essais, inscriptions et coût par inscription, par canal ;
   - les deux dans le courriel du lundi.
7. **Coaching, la suite**, une pièce à la fois :
   - le test du mois saisi par l'éducateur dans son portail (P1.2.05) ;
   - les exercices de la banque proposés selon le thème de la semaine et le lieu (P1.3.17) ;
   - la certification interne des coachs (P1.4.02, il faut tes critères) ;
   - la réunion technique du mois (P1.4.04) ;
   - le curriculum U8 à U12 ;
   - la vidéo et l'analyse de chaque match (P1.8.06).
8. **Valkyria Lab, phase 1** (P1.7.02 ⭐ 30 nov.) : la routine maison du mois et le bouton « Envoyer ma vidéo ». C'est déjà
   codé dans une autre session, mais pas encore en ligne : il reste à le finir, le vérifier et le pousser.

## Déjà en cours ailleurs (pas encore en ligne)

D'autres sessions ont du code pas encore commité :

- Valkyria Lab ;
- calculateur de lancement ;
- inventaire ;
- réseaux sociaux ;
- registre des contrats ;
- structure et recrutement ;
- source d'acquisition et « Avez-vous une entreprise ? » à l'inscription.

À terminer et mettre en ligne avant d'ouvrir un nouveau chantier sur les mêmes écrans.

## Fait le 3 novembre (cette session)

- Sondage de fin de pratique : présence, plaisir, fatigue, ce qu'elles veulent plus (Coaching → Cette semaine → Sondage de fin, et portail des éducateurs).
- « Ce que chaque entraînement doit avoir » : ta ligne directrice point par point (Coaching → Méthode Valkyria).
- Bilan de la semaine : 3 questions chaque semaine (Mandalart → Bilan de la semaine, rappel dans Aujourd'hui et le courriel du lundi).
- Galerie des exercices en diapos (Banque d'exercices → Galerie en diapos, et Exercices dans le portail des éducateurs).
