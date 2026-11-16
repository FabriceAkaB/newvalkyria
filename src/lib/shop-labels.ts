/** Libellés des commandes de la boutique, sans accès à la base : utilisables dans les écrans du navigateur. */

export type DistributionStatus = "a_commander" | "en_production" | "recu" | "pret_a_remettre" | "partiellement_remis" | "remis";

export const DISTRIBUTION_STATUS_LABELS: Record<DistributionStatus, string> = {
  a_commander: "À commander",
  en_production: "En production",
  recu: "Reçu par l'académie",
  pret_a_remettre: "Prêt à remettre",
  partiellement_remis: "Partiellement remis",
  remis: "Remis"
};

export type ProblemType =
  | "mauvaise_taille" | "article_manquant" | "mauvais_article" | "quantite_incorrecte"
  | "article_endommage" | "commande_incomplete" | "echange_demande" | "retour_fournisseur" | "autre";

export const PROBLEM_TYPE_LABELS: Record<ProblemType, string> = {
  mauvaise_taille: "Mauvaise taille",
  article_manquant: "Article manquant",
  mauvais_article: "Mauvais article",
  quantite_incorrecte: "Quantité incorrecte",
  article_endommage: "Article endommagé",
  commande_incomplete: "Commande incomplète",
  echange_demande: "Échange demandé",
  retour_fournisseur: "Retour fournisseur",
  autre: "Autre"
};
