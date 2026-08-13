-- Centre de communication (section 27 de l'audit) : journal des diffusions
-- envoyées, pour garder une trace de qui a reçu quoi et quand.

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  sender_role text not null,
  target_type text not null,
  target_label text not null,
  target_criteria jsonb not null default '{}'::jsonb,
  subject text not null,
  body text not null,
  recipient_count integer not null default 0,
  sent_at timestamptz not null default now()
);

alter table public.communications enable row level security;
create policy communications_service_role_all on public.communications
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
