# Task - 010 - Sequências e Selos (Gamificação)

**Status:** CONCLUÍDO
**Data de conclusão:** 2026-11-18
**Tipo:** Implementação
**Data de criação:** 2026-11-18

## Contexto
Reforçar bons hábitos de forma leve e divertida.

## Objetivo
Selos calculados a partir dos dados (ex: 3 meses dentro do orçamento, semana sem delivery) exibidos na Home.

## Detalhamento Técnico
- Calcular no cliente a partir de expenses/categorias (sem tabela nova no início).
- Componente `BadgeShelf` na Home; celebração (Task-006) ao ganhar selo.

## Critérios de Aceitação
- [x] Pelo menos 5 selos
- [x] Selo novo dispara celebração

## Observações para o Claude
Depende da Task-006.

## Resultado
- `utils/badges.ts` — 14 selos calculados no app: Mês na meta, 2/3/6 meses na meta (sequência), Semana sem delivery, Economizou, Mês tranquilo, Dupla dinâmica, Sempre em dia, Comprovante em dia, Cliente VIP, 100/500 lançamentos, Semana ativa. Selos de hábito usam a data de lançamento (created_at).
- `useDashboardData.fetchBadgeData` — 12 meses, colunas enxutas, carregado ao abrir a Home (cache 5 min; invalidado por realtime de gastos).
- `components/BadgeShelf.tsx` na Home (anel de progresso, detalhe ao tocar via portal).
- Dashboard celebra selo novo (1x por selo; na primeira vez só registra em `localStorage`).
- Validado com os dados reais (leitura): 193 lançamentos, 3 selos conquistados.
