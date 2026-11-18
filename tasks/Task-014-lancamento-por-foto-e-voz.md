# Task - 014 - Lançamento por Foto da Nota e por Voz

**Status:** PLANEJADO
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
- [ ] Foto preenche o formulário
- [ ] Voz preenche o formulário
- [ ] Fallback amigável se falhar

## Observações para o Claude
A chave Gemini nunca vai para o frontend.
