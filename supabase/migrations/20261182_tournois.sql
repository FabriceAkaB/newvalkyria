-- Tournois (JP, 25 nov. 2026) : un tournoi est un programme à dates fixes (session_programs, program_kind « tournoi »,
-- réglages dans presentation.tournament) ; le paiement passe par l'inscription habituelle (session_program_registrations,
-- checkoutType « sessionprogram »). Seule nouveauté : la réponse de chaque famille AVANT le go (intéressée, disponible,
-- pas cette fois), puis la place offerte au go (lien personnel, date limite, rappel, place passée à la suivante).
create table if not exists public.tournament_responses (
  id uuid primary key default gen_random_uuid(),
  program_slug text not null references public.session_programs(slug) on delete cascade,
  player_key text not null,
  player_id uuid,
  player_first_name text not null,
  player_last_name text not null default '',
  birth_year integer,
  parent_email text,
  parent_name text,
  parent_user_id uuid,
  response text not null check (response in ('interessee', 'disponible', 'pas_cette_fois')),
  source text not null default 'famille' check (source in ('famille', 'sondage', 'admin')),
  responded_at timestamptz not null default now(),
  token text not null unique,
  offer_status text check (offer_status is null or offer_status in ('offerte', 'payee', 'expiree', 'retiree')),
  offered_at timestamptz,
  pay_deadline timestamptz,
  reminder_sent_at timestamptz,
  registration_id uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_slug, player_key)
);
create index if not exists tournament_responses_slug_idx on public.tournament_responses (program_slug);
create index if not exists tournament_responses_offer_idx on public.tournament_responses (offer_status, pay_deadline) where offer_status = 'offerte';

do $$
begin
  execute 'alter table public.tournament_responses enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'tournament_responses' and policyname = 'tournament_responses_service_role_all') then
    execute 'create policy tournament_responses_service_role_all on public.tournament_responses for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end $$;
