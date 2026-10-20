-- Équipes de deux années (ex. groupe 2014-2015) : année la plus récente du groupe.
alter table public.match_team_profiles add column if not exists team_birth_year_to integer;
alter table public.match_slot_bookings add column if not exists team_birth_year_to integer;
