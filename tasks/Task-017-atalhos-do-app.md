# Task - 017 - Atalhos do App Instalado

**Status:** CONCLUÍDO
**Data de conclusão:** 2026-11-18
**Tipo:** Implementação
**Data de criação:** 2026-11-18

## Contexto
Abrir ações frequentes direto do ícone do app.

## Objetivo
Atalhos "Novo gasto" e "Lista de compras" no manifest.

## Detalhamento Técnico
- `shortcuts` no `public/manifest.json` com URLs `#/?tab=add` e `#/?tab=shopping`; Dashboard lê o parâmetro.

## Critérios de Aceitação
- [x] Atalhos aparecem no Android
- [x] Abrem a aba certa

## Observações para o Claude
Seguir o checklist de nova feature do CLAUDE.md.

## Resultado
- `public/manifest.json` → `shortcuts`: Novo gasto, Lista de compras, Extrato do mês, Avisos (`/housefinance/#/?tab=...`).
- Dashboard abre na aba do parâmetro `tab` (lista permitida) e limpa a URL em seguida.
- Aparecem ao segurar o ícone do app instalado no Android (Chrome). O iOS não suporta atalhos de PWA.
