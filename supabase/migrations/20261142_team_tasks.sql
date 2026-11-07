-- Espace JP (6 nov. 2026) : les tâches de JP (les siennes, au jour le jour) et celles qu'il confie à Christine,
-- à Annie, à un éducateur ou à n'importe qui (lien personnel /tache/[token] pour dire « je m'en occupe » ou « c'est fait »).
-- Une tâche du Mandalart confiée garde son code : quand la personne la termine, la case du Mandalart se coche.
create table if not exists public.team_tasks (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  title text not null,
  details text,
  mandalart_code text,
  assignee text not null default 'JP',
  assignee_email text,
  created_by text not null default 'JP',
  due date,
  status text not null default 'a_faire' check (status in ('a_faire', 'en_cours', 'fait', 'abandonne')),
  token text unique,
  sent_at timestamptz,
  seen_at timestamptz,
  reminded_at timestamptz,
  done_at timestamptz,
  done_note text,
  evidence_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_tasks_club_status_idx on public.team_tasks (club_id, status, due);
create index if not exists team_tasks_mandalart_idx on public.team_tasks (club_id, mandalart_code);
alter table public.team_tasks enable row level security;
do $$ begin
  create policy team_tasks_service_role_all on public.team_tasks for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;
