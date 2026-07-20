-- NutriDash · schema Supabase per il sync cloud (opzionale).
-- Esegui questo SQL nell'editor SQL del tuo progetto Supabase.
-- Ogni utente vede solo i propri dati grazie alle policy RLS.

create table if not exists public.profiles (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sex text,
  "birthDate" text,
  "heightM" numeric,
  "createdAt" text,
  "updatedAt" text
);

create table if not exists public.plans (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  "profileId" uuid not null,
  version int not null,
  name text,
  "createdAt" text,
  active boolean,
  "targetKcal" numeric,
  "glucidiAllenamento" jsonb,
  "glucidiNonAllenamento" jsonb,
  proteine jsonb,
  frequencies jsonb,
  seasons jsonb
);

create table if not exists public.day_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  "profileId" uuid not null,
  "planId" uuid,
  "planVersion" int,
  date text not null,
  "dayType" text,
  water int,
  sel jsonb,
  chk jsonb,
  piatto jsonb,
  notes jsonb,
  "freeMeal" text,
  "updatedAt" text
);

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.day_logs enable row level security;

-- Policy: ogni utente accede solo alle proprie righe.
create policy "own profiles" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own plans" on public.plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own day_logs" on public.day_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
