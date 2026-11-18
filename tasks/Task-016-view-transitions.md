# Task - 016 - Transições de Página Nativas

**Status:** CONCLUÍDO
**Data de conclusão:** 2026-11-18
**Tipo:** Implementação
**Data de criação:** 2026-11-18

## Contexto
Transições mais fluidas entre lista e edição.

## Objetivo
Usar View Transitions API (com fallback) para o cartão do gasto "virar" a tela de edição.

## Detalhamento Técnico
- `document.startViewTransition` envolvendo a troca de aba; `view-transition-name` nos elementos compartilhados.

## Critérios de Aceitação
- [x] Transição no Safari/Chrome atuais
- [x] Fallback sem erro

## Observações para o Claude
Seguir o checklist de nova feature do CLAUDE.md.

## Resultado
- `utils/viewTransition.ts` — `runViewTransition(update, origem?)` com View Transitions API + `flushSync`; revelação circular a partir do ponto tocado.
- Aplicado na troca de tema (botão do topo e Ajustes › Aparência). Classe do tema passou para `useLayoutEffect` para entrar na transição.
- Troca de abas continua com Motion (já animada; uma 2ª animação só pesaria).
- Sem suporte (navegadores antigos) ou com "reduzir movimento": troca instantânea.
