-- Emoji por categoria (ex: Mercado 🛒, Energia ⚡)
-- Só adiciona a coluna (nullable) — não altera dados existentes.
alter table public.categories
  add column if not exists emoji text;
