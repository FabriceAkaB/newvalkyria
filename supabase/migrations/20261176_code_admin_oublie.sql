-- Code administrateur oublié (JP, 20 nov. 2026) : un lien à usage unique, valable 30 minutes, envoyé au courriel de JP.
create table if not exists public.admin_code_resets (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
do $$
begin
  execute 'alter table public.admin_code_resets enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'admin_code_resets' and policyname = 'admin_code_resets_service_role_all') then
    execute 'create policy admin_code_resets_service_role_all on public.admin_code_resets for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end $$;
