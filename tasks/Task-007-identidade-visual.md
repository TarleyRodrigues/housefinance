# Task - 007 - Identidade Visual — Fonte, cartões e ícones padronizados

**Status:** PLANEJADO
**Tipo:** Refactor
**Data de criação:** 2026-11-18

## Contexto
Cada aba tem raios, sombras e estilos de cartão diferentes; o app não tem uma "cara" única.

## Objetivo
Design system mínimo aplicado em todas as abas.

## Detalhamento Técnico
- Fonte com personalidade (ex: Plus Jakarta Sans) via `@fontsource` (sem Google Fonts em runtime).
- Componentes base em `components/ui`: `Card`, `SectionHeader`, `IconPill`.
- Padronizar raios (`rounded-3xl` cards / `rounded-2xl` inputs) e sombras.

## Critérios de Aceitação
- [ ] Fonte nova aplicada
- [ ] Cards usam o componente base
- [ ] Sem regressão visual no dark/Brasil

## Observações para o Claude
Refactor sem alterar comportamento.
