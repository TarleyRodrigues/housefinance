# Task - 016 - Transições de Página Nativas

**Status:** PLANEJADO
**Tipo:** Implementação
**Data de criação:** 2026-11-18

## Contexto
Transições mais fluidas entre lista e edição.

## Objetivo
Usar View Transitions API (com fallback) para o cartão do gasto "virar" a tela de edição.

## Detalhamento Técnico
- `document.startViewTransition` envolvendo a troca de aba; `view-transition-name` nos elementos compartilhados.

## Critérios de Aceitação
- [ ] Transição no Safari/Chrome atuais
- [ ] Fallback sem erro

## Observações para o Claude
Seguir o checklist de nova feature do CLAUDE.md.
