-- Les pièces justificatives des dépenses (factures de fournisseurs) se rangent dans les documents, reliées à la dépense,
-- pour la fin de mois et le comptable (JP, 17 nov. 2026 : facture d'Azimut Nexus Conseil).
alter table documents drop constraint if exists documents_entity_type_check;
alter table documents add constraint documents_entity_type_check check (entity_type = any (array['registration', 'lead', 'coach', 'coach_activity', 'sponsor', 'expense']));
