# Task - 012 - Desafios do Casal

**Status:** CONCLUÍDO
**Data de conclusão:** 2026-11-18
**Tipo:** Implementação
**Data de criação:** 2026-11-18

## Contexto
Metas pontuais e divertidas com prêmio combinado.

## Objetivo
Criar desafio (categoria + limite + período + prêmio) com barra de progresso compartilhada.

## Detalhamento Técnico
- SQL: tabela `challenges` (id, title, category_name, limit_amount, start_date, end_date, reward, created_by, created_at) + RLS — rodar via CLI.
- UI na Home + gerenciamento (provavelmente em Sonhos).

## Critérios de Aceitação
- [x] Tabela criada
- [x] CRUD de desafios
- [x] Progresso e celebração ao concluir

## Observações para o Claude
Seguir o checklist de nova feature do CLAUDE.md.

## Resultado
- SQL `supabase/sql/2026-11-18_challenges.sql` aplicado via CLI: tabela `challenges` + RLS (`is_household_member()`, insert exige `created_by = auth.uid()`).
- `useDashboardData.fetchChallenges` (junto do núcleo; tolera tabela ausente) + gastos do período coberto.
- `utils/challenges.ts` — progresso (expense_date no período, categoria opcional); status ativo/próximo/vencido/estourou.
- `components/ChallengesCard.tsx` (Home) e `components/ChallengeForm.tsx` (sugestões prontas, emoji, categoria ou total, limite, período rápido ou datas, prêmio, apagar com confirmação).
- Dashboard: salvar/apagar com toast; confete quando um desafio termina vencido (1x por desafio).
