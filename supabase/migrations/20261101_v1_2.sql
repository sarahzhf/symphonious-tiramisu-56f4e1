-- Escale v1.2 : réactions aux commentaires et membres PRO.
-- À lancer dans Supabase > SQL Editor (après 20261101_v1_1_comptes.sql).

-- 1. Réactions aux commentaires (une par personne et par commentaire)
-- (le type de comment_id suit automatiquement celui de comments.id)
do $$ declare typ text; begin
  select format_type(atttypid, atttypmod) into typ from pg_attribute where attrelid = 'public.comments'::regclass and attname = 'id';
  execute format($f$create table if not exists public.comment_reactions (
    comment_id %s not null references public.comments(id) on delete cascade,
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    emoji text not null check (char_length(emoji) between 1 and 16),
    created_at timestamptz not null default now(),
    primary key (comment_id, user_id))$f$, typ);
end $$;
alter table public.comment_reactions enable row level security;
-- on voit les réactions des commentaires qu'on a le droit de voir (les règles de "comments" s'appliquent)
create policy "voir les réactions" on public.comment_reactions for select to authenticated
  using (exists (select 1 from public.comments c where c.id = comment_id));
create policy "réagir" on public.comment_reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.comments c where c.id = comment_id));
create policy "changer sa réaction" on public.comment_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "retirer sa réaction" on public.comment_reactions for delete to authenticated
  using (user_id = auth.uid());

-- 2. Membres PRO : seule l'administration (toi, ou plus tard le système de paiement) peut écrire ici
create table if not exists public.pro_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  until date,                 -- vide = PRO sans date de fin
  created_at timestamptz not null default now()
);
alter table public.pro_members enable row level security;
create policy "voir son statut" on public.pro_members for select to authenticated using (user_id = auth.uid());
-- aucune règle d'écriture : un membre ne peut pas se mettre PRO tout seul

-- Pour tester le scan par l'IA avec ton propre compte :
-- insert into public.pro_members (user_id) select id from auth.users where email = 'TON_EMAIL';
