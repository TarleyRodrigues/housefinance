# Task - 014 - Lançamento por Foto da Nota e por Voz

**Status:** CONCLUÍDO
**Data de conclusão:** 2026-11-18
**Tipo:** Implementação
**Data de criação:** 2026-11-18

## Contexto
Agilizar o lançamento de gastos no dia a dia.

## Objetivo
Fotografar a nota fiscal ou falar o gasto e ter o formulário preenchido automaticamente.

## Detalhamento Técnico
- Foto: enviar imagem ao Gemini (via proxy Cloudflare) pedindo JSON {valor, estabelecimento, data, categoria sugerida}.
- Voz: Web Speech API (pt-BR) → texto → Gemini para extrair os campos.
- Usuário sempre revisa antes de salvar.

## Critérios de Aceitação
- [x] Foto preenche o formulário
- [x] Voz preenche o formulário
- [x] Fallback amigável se falhar

## Observações para o Claude
A chave Gemini nunca vai para o frontend.

## Resultado
- `hooks/useExpenseAI.ts` — `readReceipt(file)` e `parseSpeech(texto)` via proxy Gemini (gemini-2.5-flash, resposta JSON). Imagem reduzida para JPEG 1600px no celular. Resposta validada: valor > 0, data válida (até amanhã), categoria só se existir (senão tenta pelo fornecedor padrão), estabelecimento normalizado para a grafia já usada.
- `components/VoiceExpenseSheet.tsx` — Web Speech API pt-BR (microfone liga no toque, exigência do iOS) + campo de texto como alternativa (ditado do teclado).
- Novo Gasto: botões "Foto da nota" e "Falar gasto"; a foto também é anexada como comprovante; campos sugeridos ficam destacados e há aviso para conferir antes de salvar. Nada é salvo automaticamente.
- Teste ponta a ponta (proxy real, nota fictícia): total R$ 95,00 lido corretamente (subtotal 98,70 com desconto), data, estabelecimento e categoria corretos em ~4s; frase "paguei duzentos e trinta e quatro e cinquenta na conta de luz ontem" → R$ 234,50, ontem, Energia.
