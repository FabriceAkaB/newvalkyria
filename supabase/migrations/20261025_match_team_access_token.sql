-- Lien personnel de l'équipe : une équipe qui a déjà rempli le formulaire n'a jamais à le refaire.
alter table public.match_team_profiles add column if not exists access_token text;
update public.match_team_profiles set access_token = replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8) where access_token is null;
alter table public.match_team_profiles alter column access_token set default (replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
alter table public.match_team_profiles alter column access_token set not null;
create unique index if not exists match_team_profiles_access_token on public.match_team_profiles(access_token);
