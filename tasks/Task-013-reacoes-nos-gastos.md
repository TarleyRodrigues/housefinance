# Task - 013 - Reações nos Gastos

**Status:** CONCLUÍDO
**Data de conclusão:** 2026-11-18
**Tipo:** Implementação
**Data de criação:** 2026-11-18

## Contexto
Interação leve entre o casal sobre os gastos.

## Objetivo
Toque longo num gasto para reagir com emoji (😂 😱 ❤️ 🙄).

## Detalhamento Técnico
- SQL: tabela `expense_reactions` (expense_id, user_id, emoji, created_at, PK expense_id+user_id) + RLS — rodar via CLI.
- Realtime para o parceiro ver a reação.

## Critérios de Aceitação
- [x] Reagir/remover reação
- [x] Reações visíveis no extrato

## Observações para o Claude
Seguir o checklist de nova feature do CLAUDE.md.

## Resultado
- SQL `supabase/sql/2026-11-18_expense_reactions_realtime.sql` aplicado via CLI: tabela `expense_reactions` (PK gasto+pessoa, RLS do casal; cada um só altera a própria reação).
- **Descoberta:** a publicação `supabase_realtime` estava vazia — o realtime de gastos/lista de compras que o app já escutava nunca disparava. O mesmo script adicionou `expenses`, `shopping_list` e `expense_reactions`.
- Extrato: segurar o dedo no gasto (450 ms) abre ❤️ 😂 😱 🙄 👏 🤑; reações aparecem como selinhos (a sua destacada; tocar remove). Mexer o dedo cancela, então o deslizar para editar/apagar continua igual.
- Dashboard: reação otimista (aparece na hora), erro com toast e recarga; realtime atualiza as reações do parceiro.
