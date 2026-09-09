-- NutriDash · schema Supabase per il sync cloud (opzionale).
-- Incolla ed esegui tutto questo nell'SQL Editor del tuo progetto Supabase.
-- Modello a JSONB: ogni riga conserva il record completo in `data`, così lo
-- schema non va aggiornato quando il piano cambia struttura. RLS: ogni utente
-- vede solo i propri dati.

create table if not exists public.profiles (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  data jsonb not null
);

create table if not exists public.plans (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  data jsonb not null
);

create table if not exists public.day_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  data jsonb not null
);

create table if not exists public.measurements (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  data jsonb not null
);

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.day_logs enable row level security;
alter table public.measurements enable row level security;

-- Policy idempotenti: ogni utente accede solo alle proprie righe.
do $$ begin
  create policy "own profiles" on public.profiles
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own plans" on public.plans
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own day_logs" on public.day_logs
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own measurements" on public.measurements
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
