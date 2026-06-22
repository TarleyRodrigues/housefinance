# Task - 001 - Viabilidade — Módulo de Automação Residencial

**Status:** CONCLUÍDO  
**Tipo:** Investigação Técnica (sem código nesta task)  
**Data de criação:** 2026-06-22  
**Data de conclusão:** 2026-06-22  
**Próxima task relacionada:** Task-002 (implementação — a criar após aprovação desta análise)

---

## Contexto

O usuário quer criar um módulo de automação residencial dentro do Housefinance para centralizar o controle de dispositivos inteligentes da casa. O objetivo é ter uma nova aba (tab) no dashboard que permita controlar e visualizar o status dos dispositivos, sem precisar abrir múltiplos aplicativos.

O app roda em mobile via navegador (PWA-like), então qualquer integração deve funcionar via requisições HTTP do frontend ou via edge function no Supabase/Cloudflare Worker (como o proxy Gemini já existente).

---

## Ecossistema Atual do Usuário

| # | Dispositivo | App de Controle | Plataforma/Ecossistema |
|---|-------------|-----------------|------------------------|
| 1 | Ar-condicionado | SmartHome | Desconhecido (a identificar) |
| 2 | Lava-roupa Samsung | SmartThings | Samsung SmartThings |
| 3 | Rotinas de automação | Amazon Alexa | Amazon (Echo Dot físico) |
| 4 | Tomada inteligente | Elgin Smart | Elgin Smart (provável Tuya por baixo) |
| 5 | Lâmpada T100 Smart Bulb | Elgin Smart | Elgin Smart (provável Tuya por baixo) |

---

## Objetivo desta Task

Realizar análise técnica de viabilidade de integração de cada um dos 5 itens acima **diretamente no código** (frontend React ou backend via worker/edge function).

Para cada dispositivo, responder:

1. **Viabilidade** — é possível integrar via HTTP (REST/GraphQL/Webhooks) sem precisar de um app nativo?
2. **API/Plataforma** — qual é o nome da API oficial ou portal de desenvolvedor para buscar na documentação?
3. **Intermediários** — integração direta é a melhor escolha, ou recomenda-se um middleman (Home Assistant, IFTTT, Voice Monkey, n8n, etc.)?
4. **Complexidade** — nível Baixo / Médio / Alto na stack atual (React + Cloudflare Worker), e quais são os principais desafios (CORS, OAuth, WebSockets, tokens expirando, polling vs push)?

---

## Output Esperado desta Task

Claude deve gerar um relatório técnico no seguinte formato para cada dispositivo:

```
### [Número] — [Dispositivo] ([App])

**Viabilidade:** ✅ Sim / ⚠️ Parcial / ❌ Não

**API/Plataforma:** [Nome da API e link da documentação oficial]

**Recomendação de abordagem:**
- Integração direta via [método] OU
- Usar intermediário: [nome do middleman recomendado + justificativa]

**Complexidade:** [Baixo / Médio / Alto]

**Principais desafios:**
- [desafio 1]
- [desafio 2]

**Próximos passos práticos:**
1. [ação concreta para começar]
2. [ação concreta para continuar]
```

---

## Critérios de Aceitação desta Task

- [ ] Análise gerada para todos os 5 dispositivos
- [ ] Para cada um: viabilidade, API identificada, recomendação de abordagem e complexidade preenchidos
- [ ] Conclusão geral: qual a estratégia recomendada (integração direta vs. Home Assistant como hub central vs. mix)
- [ ] Indicar se é necessário criar uma Task-002 separada para cada dispositivo ou se podem ser agrupados

---

## Observações Técnicas para o Claude

- A stack atual é React 19 + Vite + Supabase + Cloudflare Worker (para proxies). Um novo Worker pode ser criado para qualquer API que exija tokens secretos ou tenha restrições de CORS.
- O app roda no GitHub Pages, então chamadas diretas de API com CORS bloqueado precisam passar pelo Worker.
- Preferência do usuário: **integração direta** (menos dependências), mas intermediários são aceitos se a integração direta for inviável ou muito complexa.
- Se a API exigir OAuth com refresh token, o Supabase pode ser usado para persistir os tokens com segurança (tabela separada, não exposta via RLS pública).

---

## Como Executar

Para rodar esta task, diga ao Claude:

> "Execute a Task-001"

Claude irá pesquisar e gerar o relatório de viabilidade completo para os 5 dispositivos.
