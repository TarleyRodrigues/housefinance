-- Reações nos gastos (😂 😱 ❤️ 🙄 …) — uma por pessoa por gasto
-- + liga o Realtime (publicação supabase_realtime) para gastos, lista de compras e reações.
-- Não altera dados existentes.

create table if not exists public.expense_reactions (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id),
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (expense_id, user_id)
);

alter table public.expense_reactions enable row level security;

drop policy if exists reactions_select on public.expense_reactions;
create policy reactions_select on public.expense_reactions
  for select to authenticated using (is_household_member());

drop policy if exists reactions_insert on public.expense_reactions;
create policy reactions_insert on public.expense_reactions
  for insert to authenticated with check (is_household_member() and user_id = auth.uid());

drop policy if exists reactions_update on public.expense_reactions;
create policy reactions_update on public.expense_reactions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists reactions_delete on public.expense_reactions;
create policy reactions_delete on public.expense_reactions
  for delete to authenticated using (user_id = auth.uid());

-- Realtime: o app já escuta essas tabelas, mas a publicação estava vazia
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['expenses', 'shopping_list', 'expense_reactions'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
