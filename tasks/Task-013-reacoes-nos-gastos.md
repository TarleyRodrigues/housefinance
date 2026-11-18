# Task - 013 - Reações nos Gastos

**Status:** PLANEJADO
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
- [ ] Reagir/remover reação
- [ ] Reações visíveis no extrato

## Observações para o Claude
Seguir o checklist de nova feature do CLAUDE.md.
