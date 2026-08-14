-- Miroir de registrations.transferred_from_lead_id (20260812) : permet de
-- transférer une inscription d'une autre saison vers Été 2026 (créée comme
-- un nouveau lead, jamais en modifiant l'inscription d'origine). Pas de
-- contrainte FK — deux tables différentes, même logique que l'existant.
alter table public.leads add column if not exists transferred_from_registration_id uuid;
