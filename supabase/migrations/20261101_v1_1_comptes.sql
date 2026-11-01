-- Escale v1.1 : ville facultative, comptes entre amis, compteur de l'assistant.
-- À coller dans Supabase > SQL Editor AVANT de tester la version du dossier "escale-web test".
-- Sans risque pour la version en ligne : on ajoute seulement des colonnes facultatives.

-- 1. La ville devient facultative (roadtrip sur tout un pays)
alter table public.trips alter column city drop not null;
do $$ declare c record; begin
  for c in select conname from pg_constraint
    where conrelid = 'public.trips'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%city%'
  loop execute format('alter table public.trips drop constraint %I', c.conname); end loop;
end $$;
alter table public.trips add constraint trips_city_len check (city is null or char_length(city) <= 80);

-- 2. Participants du voyage et remboursements (noms saisis par le propriétaire du carnet)
alter table public.trips add column if not exists members jsonb not null default '[]'::jsonb;
alter table public.trips add column if not exists settlements jsonb not null default '[]'::jsonb;
alter table public.trips add constraint trips_members_max check (jsonb_typeof(members) = 'array' and jsonb_array_length(members) <= 20);
alter table public.trips add constraint trips_settlements_max check (jsonb_typeof(settlements) = 'array' and jsonb_array_length(settlements) <= 500);

-- 3. Qui a payé et pour qui
alter table public.expenses add column if not exists paid_by text not null default 'me';
alter table public.expenses add column if not exists split jsonb;
alter table public.expenses add constraint expenses_paid_by_len check (char_length(paid_by) <= 40);
alter table public.expenses add constraint expenses_split_arr check (split is null or (jsonb_typeof(split) = 'array' and jsonb_array_length(split) <= 21));

-- 4. Compteur quotidien de l'assistant IA (limite les coûts d'API)
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;  -- aucune règle : seule la fonction serveur y accède
