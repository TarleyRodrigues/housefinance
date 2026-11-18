# Task - 015 - Gestos (Swipe)

**Status:** CONCLUÍDO
**Data de conclusão:** 2026-11-18
**Tipo:** Implementação
**Data de criação:** 2026-11-18

## Contexto
Interações mais nativas no celular.

## Objetivo
Arrastar gasto para apagar/duplicar; arrastar para trocar de mês.

## Detalhamento Técnico
- Motion `drag="x"` nos itens do extrato com ações reveladas.
- Confirmação antes de apagar (regra do projeto).

## Critérios de Aceitação
- [x] Swipe no extrato
- [x] Troca de mês por gesto

## Observações para o Claude
Seguir o checklist de nova feature do CLAUDE.md.

## Resultado
- Swipe no gasto do Extrato (duplicar/editar/apagar) já existia; segurar o dedo agora abre reações (Task-013).
- Cabeçalho: arrastar o nome do mês para a esquerda/direita troca de mês (com vibração); o nome desliza na direção certa.
- Setas do mês com área de toque de 44px.
