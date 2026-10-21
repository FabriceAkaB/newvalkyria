-- Demandes de match : une équipe non admissible d'office voit la plage, ne peut pas payer,
-- mais peut faire une demande que l'académie approuve (elle peut alors payer) ou refuse.
alter table public.match_slots add column if not exists allow_requests boolean not null default true;

create table if not exists public.match_slot_requests (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.match_slots(id) on delete cascade,
  profile_id uuid not null references public.match_team_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  message text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (slot_id, profile_id)
);
create index if not exists idx_match_slot_requests_status on public.match_slot_requests(status);
alter table public.match_slot_requests enable row level security;
create policy match_slot_requests_service_role_all on public.match_slot_requests for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
