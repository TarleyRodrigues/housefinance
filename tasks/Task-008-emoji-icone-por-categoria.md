# Task - 008 - Emoji/Ícone por Categoria

**Status:** CONCLUÍDO
**Data de conclusão:** 2026-11-18
**Tipo:** Implementação
**Data de criação:** 2026-11-18

## Contexto
O extrato é lido por cor e nome; um emoji por categoria facilita o reconhecimento de relance.

## Objetivo
Cada categoria pode ter um emoji, exibido no extrato, Novo Gasto, gráficos e Home.

## Detalhamento Técnico
- SQL: `alter table categories add column if not exists emoji text;` (rodar via CLI).
- Seletor de emoji em Ajustes › Categorias (grade de sugestões + campo livre).

## Critérios de Aceitação
- [x] Coluna criada
- [x] Emoji editável em Ajustes
- [x] Emoji aparece nas listas

## Observações para o Claude
Rodar o SQL via Supabase CLI (autorizado pelo usuário).

## Resultado
- SQL `supabase/sql/2026-11-18_category_emoji.sql` aplicado via CLI (coluna `categories.emoji`, nullable).
- As 11 categorias já tinham emoji no início do nome; os nomes NÃO foram alterados (ligam os gastos às categorias).
- `utils/categoryEmoji.ts`: emoji = personalizado (coluna) → emoji do início do nome → sugestão por palavra-chave. `categoryLabel()` devolve o nome sem o emoji.
- `components/CategoryEmoji.tsx` (selo tingido com a cor da categoria) e `components/EmojiPickerSheet.tsx` (grade + campo livre + voltar ao do nome).
- Aplicado em: Novo Gasto (grade), Extrato (selo no avatar + rótulo limpo), Home (metas e últimos gastos), Gastos Fixos (ícone do card), Ajustes › Categorias (botão para trocar).
