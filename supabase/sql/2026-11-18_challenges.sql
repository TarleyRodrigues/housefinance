-- Desafios do casal (ex: "Menos de R$ 400 em delivery em dezembro")
-- Tabela nova — não altera dados existentes. RLS no padrão das tabelas do casal.
create table if not exists public.challenges (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  emoji         text,
  category_name text,                      -- null = gasto total do período
  limit_amount  numeric not null check (limit_amount > 0),
  start_date    date not null,
  end_date      date not null,
  reward        text,                      -- prêmio combinado (ex: "jantar fora")
  created_by    uuid not null default auth.uid() references auth.users(id),
  created_at    timestamptz not null default now(),
  constraint challenges_period_check check (end_date >= start_date)
);

alter table public.challenges enable row level security;

drop policy if exists challenges_select on public.challenges;
create policy challenges_select on public.challenges
  for select to authenticated using (is_household_member());

drop policy if exists challenges_insert on public.challenges;
create policy challenges_insert on public.challenges
  for insert to authenticated with check (is_household_member() and created_by = auth.uid());

drop policy if exists challenges_update on public.challenges;
create policy challenges_update on public.challenges
  for update to authenticated using (is_household_member()) with check (is_household_member());

drop policy if exists challenges_delete on public.challenges;
create policy challenges_delete on public.challenges
  for delete to authenticated using (is_household_member());
