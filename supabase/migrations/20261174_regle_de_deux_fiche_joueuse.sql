-- Règle de deux (Mandalart P8.3.01, JP 19 nov. 2026) : « jamais un adulte seul avec une mineure ». Chaque éducateur
-- lit la règle dans Mon dossier et s'engage (signature électronique simple : nom tapé, date, IP, navigateur).
-- Une ligne par éducateur et par version du texte : un texte modifié se signe à nouveau.
create table if not exists public.coach_rule_of_two (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  coach_id uuid not null references public.coaches(id) on delete cascade,
  version text not null,
  signer_name text not null,
  signed_at timestamptz not null default now(),
  signer_ip text,
  user_agent text,
  unique (coach_id, version)
);
create index if not exists coach_rule_of_two_coach_idx on public.coach_rule_of_two (coach_id, signed_at desc);
do $$
begin
  execute 'alter table public.coach_rule_of_two enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'coach_rule_of_two' and policyname = 'coach_rule_of_two_service_role_all') then
    execute 'create policy coach_rule_of_two_service_role_all on public.coach_rule_of_two for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end $$;

-- Fiche joueuse (Mandalart P4.1.03, JP 19 nov. 2026) : le parent dit ce que sa fille aime, ce qui la stresse, son
-- expérience, la santé à connaître, son objectif de la saison et comment l'encourager ; l'éducatrice la lit dans le
-- briefing de 5 minutes. Données d'enfant (Loi 25) : table privée, lue seulement par le serveur (service_role).
create table if not exists public.player_family_sheets (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  registration_id uuid not null unique,
  player_id uuid,
  likes text,
  stress text,
  experience text,
  health text,
  season_goal text,
  encouragement text,
  filled_by_user_id uuid,
  filled_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists player_family_sheets_player_idx on public.player_family_sheets (player_id);
do $$
begin
  execute 'alter table public.player_family_sheets enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'player_family_sheets' and policyname = 'player_family_sheets_service_role_all') then
    execute 'create policy player_family_sheets_service_role_all on public.player_family_sheets for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end $$;
