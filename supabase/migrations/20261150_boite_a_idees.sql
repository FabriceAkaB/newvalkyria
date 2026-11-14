-- Boîte à idées de l'académie (13 nov. 2026) : toute personne (site public) ou chaque membre (espace parent)
-- propose une idée ; l'académie la lit, répond et la fait avancer (nouvelle → à l'étude → retenue → réalisée).
create table if not exists public.idea_box (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  source text not null default 'site' check (source in ('site', 'espace')),
  parent_user_id uuid,
  author_name text,
  author_email text,
  player_name text,
  category text not null default 'autre',
  message text not null,
  status text not null default 'nouvelle' check (status in ('nouvelle', 'a_l_etude', 'retenue', 'realisee', 'non_retenue')),
  response text,
  responded_at timestamptz,
  shown_publicly boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idea_box_status_idx on public.idea_box (club_id, status, created_at desc);
create index if not exists idea_box_parent_idx on public.idea_box (parent_user_id);

do $$
begin
  execute 'alter table public.idea_box enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'idea_box' and policyname = 'idea_box_service_role_all') then
    execute 'create policy idea_box_service_role_all on public.idea_box for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end $$;
