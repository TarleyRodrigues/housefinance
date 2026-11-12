-- Carteirinha estudantil (modelo demonstrativo) — 1 linha por usuário
create table if not exists public.student_cards (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  full_name       text,
  photo_url       text,
  cpf             text,
  birth_date      date,
  institution     text,
  course          text,
  education_level text default 'Ensino Superior',
  usage_code      text,
  valid_until     date,
  updated_at      timestamptz not null default now()
);

alter table public.student_cards enable row level security;

-- Cada usuário vê e edita apenas a própria carteirinha
create policy "student_cards_select_own" on public.student_cards
  for select using (auth.uid() = user_id);
create policy "student_cards_insert_own" on public.student_cards
  for insert with check (auth.uid() = user_id);
create policy "student_cards_update_own" on public.student_cards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
