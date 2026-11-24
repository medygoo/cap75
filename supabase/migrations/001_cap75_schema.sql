-- ============================================================
-- Cap75 — schéma Supabase v3
-- Chaque table est protégée par RLS : un utilisateur ne voit
-- et ne modifie que ses propres lignes (user_id = auth.uid()).
-- Les accès sont donnés par invitation (inscription publique désactivée).
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Horodatage automatique
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Profil utilisateur (préférences)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  base_currency text not null default 'USD' check (base_currency in ('USD', 'CDF', 'EUR')),
  rates jsonb not null default '{"USD": 1, "CDF": 2850, "EUR": 0.92}'::jsonb,
  rules jsonb not null default '{"depensesMax": 75, "projetsMax": 15, "epargneMin": 10}'::jsonb,
  auto_lock_minutes integer not null default 30 check (auto_lock_minutes between 0 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Comptes d'argent : caisse, banque, mobile money, épargne
-- ------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'cash' check (kind in ('cash', 'bank', 'mobile', 'savings', 'other')),
  currency text not null default 'USD' check (currency in ('USD', 'CDF', 'EUR')),
  opening_balance numeric(16, 2) not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Projets SMART
-- ------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  category text not null default 'Autre',
  priority text not null default 'Moyenne' check (priority in ('Haute', 'Moyenne', 'Basse')),
  target numeric(16, 2) not null check (target > 0),
  initial_saved numeric(16, 2) not null default 0 check (initial_saved >= 0),
  deadline date,
  status text not null default 'En cours' check (status in ('En cours', 'En pause', 'Atteint')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Opérations récurrentes (modèles : salaire, loyer, abonnements)
-- ------------------------------------------------------------
create table if not exists public.recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('Revenu', 'Dépense', 'Projet', 'Épargne', 'Transfert')),
  category text not null default '',
  description text not null default '',
  amount numeric(16, 2) not null check (amount > 0),
  currency text not null default 'USD' check (currency in ('USD', 'CDF', 'EUR')),
  account_id uuid references public.accounts (id) on delete set null,
  to_account_id uuid references public.accounts (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  frequency text not null default 'monthly' check (frequency in ('weekly', 'monthly', 'yearly')),
  start_date date not null,
  end_date date,
  last_generated date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Opérations
-- ------------------------------------------------------------
create table if not exists public.operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('Revenu', 'Dépense', 'Projet', 'Épargne', 'Transfert')),
  category text not null default '',
  description text not null default '',
  amount numeric(16, 2) not null check (amount > 0),
  currency text not null default 'USD' check (currency in ('USD', 'CDF', 'EUR')),
  date date not null,
  account_id uuid references public.accounts (id) on delete set null,
  to_account_id uuid references public.accounts (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  recurring_id uuid references public.recurring (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_user_idx on public.accounts (user_id);
create index if not exists projects_user_idx on public.projects (user_id);
create index if not exists recurring_user_idx on public.recurring (user_id);
create index if not exists operations_user_date_idx on public.operations (user_id, date desc);
create index if not exists operations_account_idx on public.operations (account_id);
create index if not exists operations_to_account_idx on public.operations (to_account_id);
create index if not exists operations_project_idx on public.operations (project_id);
create index if not exists operations_recurring_idx on public.operations (recurring_id);
create index if not exists recurring_account_idx on public.recurring (account_id);
create index if not exists recurring_to_account_idx on public.recurring (to_account_id);
create index if not exists recurring_project_idx on public.recurring (project_id);

-- Une occurrence récurrente ne peut être générée qu'une fois par date
create unique index if not exists operations_recurring_date_uniq
  on public.operations (recurring_id, date) where recurring_id is not null;

-- Horodatage
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists accounts_updated_at on public.accounts;
create trigger accounts_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
drop trigger if exists recurring_updated_at on public.recurring;
create trigger recurring_updated_at before update on public.recurring
  for each row execute function public.set_updated_at();
drop trigger if exists operations_updated_at on public.operations;
create trigger operations_updated_at before update on public.operations
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Droits d'accès à l'API : uniquement les utilisateurs connectés.
-- (Le projet n'expose pas automatiquement les nouvelles tables.)
-- ------------------------------------------------------------
revoke all on public.profiles, public.accounts, public.projects, public.recurring, public.operations from anon;
grant select, insert, update, delete
  on public.profiles, public.accounts, public.projects, public.recurring, public.operations
  to authenticated;

-- ------------------------------------------------------------
-- Sécurité ligne par ligne (RLS)
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.projects enable row level security;
alter table public.recurring enable row level security;
alter table public.operations enable row level security;

drop policy if exists "profil: lecture" on public.profiles;
create policy "profil: lecture" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profil: modification" on public.profiles;
create policy "profil: modification" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists "profil: création" on public.profiles;
create policy "profil: création" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['accounts', 'projects', 'recurring', 'operations'] loop
    execute format('drop policy if exists "propriétaire: tout" on public.%I', t);
    execute format(
      'create policy "propriétaire: tout" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- À la création d'un utilisateur (invitation) : profil + compte « Caisse »
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.accounts (user_id, name, kind, currency)
  values (new.id, 'Caisse', 'cash', 'USD');

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
