-- Traçabilité quand une inscription Sport-Études est créée en transférant
-- une inscription/lead existant (fille) — sans FK (systèmes différents),
-- même logique que leads.transferred_from_registration_id et
-- registrations.transferred_from_lead_id. L'inscription/lead d'origine
-- n'est jamais modifiée par ce transfert.
alter table public.sport_etudes_registrations add column if not exists transferred_from_registration_id uuid;
alter table public.sport_etudes_registrations add column if not exists transferred_from_lead_id uuid;
