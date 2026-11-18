# Task - 006 - Pacote Visual 1 — Contagem animada, celebração e telas vazias

**Status:** CONCLUÍDO
**Data de conclusão:** 2026-11-18
**Tipo:** Implementação
**Data de criação:** 2026-11-18

## Contexto
Primeiro pacote de melhorias de "encanto" do app: pequeno, sem SQL, com impacto visual imediato.

## Objetivo
Valores principais animados, celebração ao atingir metas e telas vazias ilustradas e simpáticas.

## Detalhamento Técnico
- **Contagem animada:** componente `AnimatedNumber` (Motion `animate`) para valores em moeda; usar nos totais de destaque da Home, Extrato e Gastos Fixos. Respeitar `prefers-reduced-motion`.
- **Celebração:** componente `Celebration` (confete leve, CSS/Motion, sem lib nova) + `haptic('success')`. Disparos:
  - Sonho atingido (≥ 100%) ao marcar como conquistado;
  - Mês fechado dentro da meta (Home do mês anterior), no máximo 1x por mês (localStorage).
- **Telas vazias:** componente `EmptyState` (ícone Lucide em círculo + título + frase divertida + ação opcional); substituir os "Nenhum …" das abas.

## Critérios de Aceitação
- [x] Valores animam ao abrir e ao trocar de mês
- [x] Sem animação com `prefers-reduced-motion`
- [x] Confete ao conquistar sonho
- [x] Celebração de mês na meta aparece 1x por mês
- [x] Telas vazias padronizadas em todas as abas
- [x] Dark mode e 375px ok
- [x] `npm run build` limpo

## Observações para o Claude
Sem novas dependências. Não animar listas longas.

## Resultado
- `components/AnimatedNumber.tsx` — totais da Home, Extrato, Gráficos e Gastos Fixos.
- `components/Celebration.tsx` — confete + cartão; sonho conquistado e mês anterior dentro das metas (1x/mês, `localStorage`).
- `components/EmptyState.tsx` — Extrato, Home, Avisos, Compras (lista/catálogo/histórico), Notas, Receitas, Filmes, Gastos Fixos, Gastos Padrão e Histórico.
- `haptic('success')` para a celebração.
