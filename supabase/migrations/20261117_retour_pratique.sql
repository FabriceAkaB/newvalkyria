-- Retour de l'éducateur sur la pratique elle-même (JP, 17 nov. 2026) : ce qu'on a bien fait, ce qu'on a moins bien
-- fait, ce qu'on change la prochaine fois. Un retour par éducateur et par pratique ; le dernier retour du groupe est
-- montré avant la pratique suivante pour s'améliorer d'une fois à l'autre.
create table if not exists public.practice_debriefs (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.coach_activities(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  went_well text,
  to_improve text,
  next_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, coach_id)
);
create index if not exists practice_debriefs_activity_idx on public.practice_debriefs (activity_id);
alter table public.practice_debriefs enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'practice_debriefs' and policyname = 'service_role_all') then
    create policy service_role_all on public.practice_debriefs for all to service_role using (true) with check (true);
  end if;
end $$;
