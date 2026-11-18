-- Estabelecimento no gasto padrão + fornecedor padrão por categoria
-- Só adiciona colunas (nullable) — não altera nem apaga dados existentes.

-- Gasto padrão pode vir com o estabelecimento já preenchido
alter table public.expense_templates
  add column if not exists merchant text;

-- Fornecedor padrão da categoria (ex: Energia → Enel, Água → Sabesp).
-- Ao escolher a categoria no Novo Gasto, o estabelecimento é preenchido (editável).
alter table public.categories
  add column if not exists default_merchant text;
