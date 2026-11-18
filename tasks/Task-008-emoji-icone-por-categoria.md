# Task - 008 - Emoji/Ícone por Categoria

**Status:** PLANEJADO
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
- [ ] Coluna criada
- [ ] Emoji editável em Ajustes
- [ ] Emoji aparece nas listas

## Observações para o Claude
Rodar o SQL via Supabase CLI (autorizado pelo usuário).
