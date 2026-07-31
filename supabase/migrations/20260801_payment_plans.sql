-- Paiements échelonnés (2-3 fois) pour les inscriptions de saison.
-- Additive only : nouvelles tables, aucune table existante touchée.
-- Le premier versement est payé via la session Stripe Checkout initiale ;
-- les versements suivants sont prélevés automatiquement (carte enregistrée
-- via setup_future_usage) par la route cron /api/cron/charge-installments.

create table if not exists public.registration_payment_plans (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id),
  stripe_customer_id text,
  stripe_payment_method_id text,
  total_amount_cents integer not null,
  installment_count integer not null,
  created_at timestamptz not null default now()
);

alter table public.registration_payment_plans enable row level security;
drop policy if exists "service_role_all" on public.registration_payment_plans;
create policy "service_role_all" on public.registration_payment_plans
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create table if not exists public.registration_payment_plan_installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.registration_payment_plans(id),
  sequence_no integer not null,
  amount_cents integer not null,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'failed_final')),
  attempt_count integer not null default 0,
  failure_notified boolean not null default false,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.registration_payment_plan_installments enable row level security;
drop policy if exists "service_role_all" on public.registration_payment_plan_installments;
create policy "service_role_all" on public.registration_payment_plan_installments
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_payment_plan_installments_due
  on public.registration_payment_plan_installments(status, due_date, sequence_no);
create index if not exists idx_payment_plan_installments_plan
  on public.registration_payment_plan_installments(plan_id);
