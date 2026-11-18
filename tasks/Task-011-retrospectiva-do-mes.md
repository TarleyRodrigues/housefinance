# Task - 011 - Retrospectiva do Mês (estilo Wrapped)

**Status:** CONCLUÍDO
**Data de conclusão:** 2026-11-18
**Tipo:** Implementação
**Data de criação:** 2026-11-18

## Contexto
Momento "uau" mensal para o casal acompanhar os gastos juntos.

## Objetivo
Stories deslizáveis no início do mês com os destaques do mês anterior, exportáveis como imagem.

## Detalhamento Técnico
- Telas: total, categoria campeã, dia mais caro, estabelecimento favorito, quem lançou mais, comparação com mês anterior.
- Navegação por toque (stories), Motion; exportar slide como PNG (canvas/SVG).
- Disponível a partir do dia 1º; atalho na Home.

## Critérios de Aceitação
- [x] Stories funcionando no mobile
- [x] Exportar imagem
- [x] Dark mode

## Observações para o Claude
Seguir o checklist de nova feature do CLAUDE.md.

## Resultado
- `utils/monthRecap.ts` — cálculo dos destaques (função pura).
- `components/MonthRecapStories.tsx` — stories em tela cheia (lazy): intro, total + comparação, categoria campeã (top 3), dia mais caro, lugar favorito, quem mais lançou, maior gasto, metas, curiosidade do fim de semana e encerramento. Toque à direita avança, à esquerda volta, segurar pausa, Esc/setas no desktop.
- `utils/recapImage.ts` — imagem 1080×1350 em Canvas; menu de compartilhar do celular ou download.
- `useDashboardData.fetchRecapData(mês)` — 2 consultas em paralelo; abertura em `Dashboard.openRecap`.
- Home: banner "A retrospectiva de {mês} chegou!" nos 7 primeiros dias do mês e botão ao ver meses passados.
- Os stories têm visual próprio (gradientes) e ficam iguais no modo claro e escuro; o banner da Home também é em gradiente.
