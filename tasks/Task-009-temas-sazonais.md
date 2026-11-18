# Task - 009 - Temas Sazonais

**Status:** CONCLUÍDO
**Data de conclusão:** 2026-11-18
**Tipo:** Implementação
**Data de criação:** 2026-11-18

## Contexto
O tema Brasil fez sucesso; dá para ter variações sazonais.

## Objetivo
Temas Natal, Copa e Aniversário do casal (surpresa na data).

## Detalhamento Técnico
- Estender o ciclo de temas no Dashboard (`theme`), classes CSS por tema.
- Data do aniversário configurável em Ajustes (localStorage ou coluna em profiles).

## Critérios de Aceitação
- [x] Temas selecionáveis
- [x] Tema surpresa aparece na data

## Observações para o Claude
Seguir o checklist de nova feature do CLAUDE.md.

## Resultado
- Temas novos `natal` e `amor` (variações do escuro, paletas em `index.css` no padrão do tema Brasil); Copa = tema Brasil existente.
- `components/SeasonalOverlay.tsx` — neve (Natal) e corações (Amor) leves no fundo; desligado com "reduzir movimento".
- Fundo do Dashboard generalizado (`THEME_DECOR`) para os 3 temas especiais.
- Ajustes › Aparência: 5 temas + "Data especial do casal" (salva no aparelho). No dia, o app usa o tema Amor sem mudar a preferência e comemora 1x por ano ("X anos juntos!").
- O botão do topo continua alternando Claro → Escuro → Brasil; Natal e Amor ficam em Ajustes.
