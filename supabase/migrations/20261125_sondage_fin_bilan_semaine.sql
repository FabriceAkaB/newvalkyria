-- Sondage de fin de pratique (demande de JP, 3 nov. 2026 ; P1.5.06) : en plus du plaisir (practice_rating) et de la
-- fatigue, ce que la joueuse aimerait avoir plus (choix rapides + un mot libre).
alter table public.activity_player_attendance add column if not exists wants_more text[] not null default '{}';
alter table public.activity_player_attendance add column if not exists wants_more_note text;

-- Bilan de la semaine de JP : 3 questions chaque lundi sur la semaine qui vient de finir.
create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  -- Lundi de la semaine dont on fait le bilan.
  week_start date not null,
  went_well text,
  do_differently text,
  next_priority text,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists weekly_reviews_club_week on public.weekly_reviews (club_id, week_start);

alter table public.weekly_reviews enable row level security;
drop policy if exists "service_role_all" on public.weekly_reviews;
create policy "service_role_all" on public.weekly_reviews
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
