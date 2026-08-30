-- Champs nécessaires à la création rapide d'un athlète externe/essai
-- (section 3) — capturés sur la participation, pas sur players, car un
-- athlète déjà connu du club a déjà ces informations ailleurs
-- (registrations/leads) ; seuls les externes en ont besoin ici.
alter table public.tryout_participants add column if not exists current_club text;
alter table public.tryout_participants add column if not exists parent_name text;
alter table public.tryout_participants add column if not exists parent_email text;
alter table public.tryout_participants add column if not exists parent_phone text;
