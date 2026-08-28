-- Paiement en 2 versements pour le programme Sport-Études — miroir de
-- registration_payment_plans/registration_payment_plan_installments, mais
-- avec sa propre FK vers sport_etudes_registrations (systèmes séparés).
create table public.sport_etudes_payment_plans (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.sport_etudes_registrations(id) on delete cascade,
  stripe_customer_id text,
  stripe_payment_method_id text,
  total_amount_cents integer not null,
  installment_count integer not null,
  created_at timestamptz not null default now()
);

create table public.sport_etudes_payment_plan_installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.sport_etudes_payment_plans(id) on delete cascade,
  sequence_no integer not null,
  amount_cents integer not null,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','paid','failed','failed_final')),
  attempt_count integer not null default 0,
  failure_notified boolean not null default false,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sport_etudes_payment_plans enable row level security;
alter table public.sport_etudes_payment_plan_installments enable row level security;

create policy sport_etudes_payment_plans_service_role_all on public.sport_etudes_payment_plans
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy sport_etudes_payment_plan_installments_service_role_all on public.sport_etudes_payment_plan_installments
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
