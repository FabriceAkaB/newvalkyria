-- Transfert d'une inscription Été 2026 (table `leads`) vers une inscription
-- d'une autre saison (table `registrations`) — le lead d'origine n'est
-- jamais modifié ni supprimé, seulement copié. Pas de clé étrangère (tables
-- différentes) ; traçabilité seulement.
alter table public.registrations add column if not exists transferred_from_lead_id uuid;
