-- Corrige un oubli de 20260801_payment_plans.sql : contrairement à son
-- équivalent Sport-Études (sport_etudes_payment_plans, qui a déjà
-- "on delete cascade"), ces FK bloquaient la suppression d'une inscription
-- de saison dès qu'elle avait un plan de paiement échelonné (erreur 500
-- "violates foreign key constraint" sur DELETE /api/admin/season/.../registrations/:id).
alter table public.registration_payment_plans drop constraint registration_payment_plans_registration_id_fkey;
alter table public.registration_payment_plans add constraint registration_payment_plans_registration_id_fkey
  foreign key (registration_id) references public.registrations(id) on delete cascade;

alter table public.registration_payment_plan_installments drop constraint registration_payment_plan_installments_plan_id_fkey;
alter table public.registration_payment_plan_installments add constraint registration_payment_plan_installments_plan_id_fkey
  foreign key (plan_id) references public.registration_payment_plans(id) on delete cascade;
