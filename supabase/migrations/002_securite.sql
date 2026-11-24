-- ============================================================
-- Cap75 — renforcement de la sécurité (après 001_cap75_schema.sql)
-- 1. Une ligne ne peut référencer que des comptes, projets et
--    récurrences appartenant au même utilisateur.
-- 2. Longueurs maximales des textes (évite les abus de stockage).
-- 3. Validation des préférences (taux et règle budgétaire).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Appartenance des références
-- ------------------------------------------------------------
create or replace function public.check_same_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.account_id is not null and not exists (
    select 1 from public.accounts a where a.id = new.account_id and a.user_id = new.user_id) then
    raise exception 'Compte introuvable pour cet utilisateur' using errcode = '42501';
  end if;
  if new.to_account_id is not null and not exists (
    select 1 from public.accounts a where a.id = new.to_account_id and a.user_id = new.user_id) then
    raise exception 'Compte de destination introuvable pour cet utilisateur' using errcode = '42501';
  end if;
  if new.project_id is not null and not exists (
    select 1 from public.projects p where p.id = new.project_id and p.user_id = new.user_id) then
    raise exception 'Projet introuvable pour cet utilisateur' using errcode = '42501';
  end if;
  if tg_table_name = 'operations' and new.recurring_id is not null and not exists (
    select 1 from public.recurring r where r.id = new.recurring_id and r.user_id = new.user_id) then
    raise exception 'Récurrence introuvable pour cet utilisateur' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_same_owner() from public, anon, authenticated;

drop trigger if exists operations_same_owner on public.operations;
create trigger operations_same_owner before insert or update on public.operations
  for each row execute function public.check_same_owner();
drop trigger if exists recurring_same_owner on public.recurring;
create trigger recurring_same_owner before insert or update on public.recurring
  for each row execute function public.check_same_owner();

-- user_id ne peut jamais changer après création
create or replace function public.lock_user_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Le propriétaire ne peut pas être modifié' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['accounts', 'projects', 'recurring', 'operations'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_lock_user', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.lock_user_id()', t || '_lock_user', t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 2. Longueurs maximales
-- ------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_display_name_len;
alter table public.profiles add constraint profiles_display_name_len check (char_length(display_name) <= 60);
alter table public.projects drop constraint if exists projects_category_len;
alter table public.projects add constraint projects_category_len check (char_length(category) <= 60);
alter table public.operations drop constraint if exists operations_text_len;
alter table public.operations add constraint operations_text_len
  check (char_length(category) <= 120 and char_length(description) <= 500);
alter table public.recurring drop constraint if exists recurring_text_len;
alter table public.recurring add constraint recurring_text_len
  check (char_length(category) <= 120 and char_length(description) <= 500);
alter table public.operations drop constraint if exists operations_amount_max;
alter table public.operations add constraint operations_amount_max check (amount < 100000000000);
alter table public.recurring drop constraint if exists recurring_dates_order;
alter table public.recurring add constraint recurring_dates_order check (end_date is null or end_date >= start_date);

-- ------------------------------------------------------------
-- 3. Préférences valides
-- ------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_rates_valid;
alter table public.profiles add constraint profiles_rates_valid check (
  jsonb_typeof(rates) = 'object'
  and jsonb_typeof(rates -> 'CDF') = 'number' and (rates ->> 'CDF')::numeric > 0
  and jsonb_typeof(rates -> 'EUR') = 'number' and (rates ->> 'EUR')::numeric > 0
);
alter table public.profiles drop constraint if exists profiles_rules_valid;
alter table public.profiles add constraint profiles_rules_valid check (
  jsonb_typeof(rules) = 'object'
  and (rules ->> 'depensesMax')::numeric between 0 and 100
  and (rules ->> 'projetsMax')::numeric between 0 and 100
  and (rules ->> 'epargneMin')::numeric between 0 and 100
  and (rules ->> 'depensesMax')::numeric + (rules ->> 'projetsMax')::numeric + (rules ->> 'epargneMin')::numeric <= 100
);
