# Housefinance — CLAUDE.md

## Visão Geral

App de finanças pessoais compartilhadas para casal, focado em **acesso mobile via navegador**. Interface em português (pt-BR). Dados reais no Supabase há mais de 3 meses de uso contínuo — nunca alterar schema sem confirmar SQL com o usuário antes.

**Produção:** https://TarleyRodrigues.github.io/housefinance/
**Stack:** React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 4 + Supabase + Motion

---

## Prioridades de Desenvolvimento

1. **Qualidade** — código limpo, tipado, sem `any`
2. **Funcionalidade** — features que funcionam de ponta a ponta
3. **Eficiência** — performance mobile, lazy loading, useMemo/useCallback
4. **Modernidade** — UI polida, animações suaves, UX fluida

---

## Arquitetura

### Fluxo de Dados (imutável por design)
```
Supabase → useDashboardData (hook) → Dashboard.tsx (state) → Props → Tabs
                                            ↑
                                    Callbacks de mutação
```

- **Regra absoluta:** Tabs são componentes "burros" — recebem dados via props e chamam callbacks. **Nunca fazer queries Supabase direto em tabs.**
- Todo acesso ao banco fica em `useDashboardData.ts` (leitura) e em `Dashboard.tsx` (escrita).
- Após toda mutação, chamar `fetchData()` para recarregar os dados relevantes.

### Estrutura de Arquivos
```
src/
├── pages/          # Login, Profile, Dashboard (orquestrador)
├── tabs/           # Um arquivo por aba: Tab*.tsx
├── hooks/          # useDashboardData.ts, useGeminiAnalysis.ts
├── components/     # BottomNav, ui/index (Toast, SkeletonCard)
├── types/          # index.ts — todas as interfaces TypeScript
├── utils/          # index.ts — formatação, cores, constantes
├── supabase.ts     # Cliente Supabase
├── AuthContext.tsx # Estado de autenticação
└── App.tsx         # Roteamento (HashRouter)
```

### Convenções de Nomenclatura
- Componentes de tab: `TabNomeTab` (PascalCase, prefixo `Tab`)
- Hooks: `use*`
- Interfaces: singular sem sufixo (`Expense`, não `IExpense` ou `ExpenseType`)
- Arquivos de tab: `Tab*.tsx` em `/tabs/`

---

## Banco de Dados (Supabase)

### Tabelas Principais
| Tabela | Finalidade |
|--------|-----------|
| `profiles` | Perfil do usuário (nome, avatar_url) |
| `expenses` | Gastos — soft delete via `is_deleted` |
| `categories` | Categorias com cor, meta mensal, tipo (`couple`/`individual`) |
| `shopping_list` | Lista de compras com quantidade e preço estimado |
| `reminders` | Avisos com data/hora |
| `notes` | Notas coloridas |
| `logs` | Trilha de auditoria de gastos |
| `dreams` | Sonhos/metas financeiras com imagem |
| `watchlist_categories` | Categorias de filmes/séries |
| `watchlist_items` | Itens da watchlist (TMDB) |
| `watchlist_ratings` | Avaliações 1-5 estrelas por usuário |
| `recipes` | Receitas com steps em JSONB |
| `recipe_ingredients` | Ingredientes normalizados |

### Storage Buckets
- `receipts` — comprovantes de gastos
- `avatars` — fotos de perfil
- `dream-images` — imagens dos sonhos
- `recipe-images` — fotos de receitas

### Regras de Schema
- **Soft delete em expenses:** `is_deleted = true` (nunca deletar fisicamente)
- **Profiles join:** sempre fazer join para obter `full_name` e `avatar_url`
- **Steps de receita:** JSONB (`RecipeStep[]`) — não criar coluna separada
- Se precisar de nova tabela/coluna, **gerar o SQL e mostrar ao usuário** para ele rodar no Supabase, ou perguntar se quer rodar direto.

---

## UI e Estilização

### Mobile First (Obrigatório)
- Container max-width, centralizado
- `pb-32` no conteúdo para não ficar atrás da BottomNav
- Touch targets mínimos: `min-h-[44px]` em elementos interativos
- Testar sempre com viewport mobile (375px)

### Tailwind CSS 4
- Dark mode via classe `dark` no `document.documentElement` (persistido em localStorage)
- Prefixo `dark:` em todos os elementos que precisam de variante escura
- Border radius customizado: preferir `rounded-2xl` ou `rounded-3xl` para cards
- Usar `rounded-[2rem]` apenas quando o design exigir curvatura maior

### Animações (Motion/Framer Motion)
- Usar `motion.div` com `AnimatePresence` para entradas/saídas
- Padrão de entrada de cards: `initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}`
- Não animar elementos que já têm performance crítica (listas longas)

### Paleta de Cores e Tema
- Fundo principal: `bg-slate-50 dark:bg-slate-900`
- Cards: `bg-white dark:bg-slate-800`
- Bordas: `border-slate-200 dark:border-slate-700`
- Texto primário: `text-slate-800 dark:text-slate-100`
- Texto secundário: `text-slate-500 dark:text-slate-400`
- Acento primário: azul (`blue-500`/`blue-600`)
- Acento casal: azul — Acento individual: roxo

### Ícones
- Usar exclusivamente **Lucide React** (`lucide-react`)
- Não misturar com outras bibliotecas de ícones

---

## Formatação e Localização

```typescript
// Moeda
const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Resultado: "R$ 1.234,56"

// Data relativa
// "hoje", "ontem", "12 mar" — lógica em utils/index.ts

// Locale padrão: pt-BR em todas as chamadas Date/Intl
```

---

## Padrões de Código

### TypeScript
- Sem `any` — usar tipos explícitos ou `unknown` com narrowing
- Interfaces em `types/index.ts` — nunca definir inline em componentes
- Props tipadas com interface dedicada (ex: `interface TabExtrato Props { ... }`)

### Async/Supabase
```typescript
// Padrão de query
const { data, error } = await supabase
  .from('expenses')
  .select('*, profiles(full_name, avatar_url)')
  .eq('is_deleted', false)
  .order('created_at', { ascending: false });

if (error) throw error;
```

### Estado Local vs Global
- useState para forms e UI state local
- useMemo para listas filtradas/ordenadas (evitar recalcular no render)
- useCallback para funções passadas como props
- **Sem Redux/Zustand** — manter simplicidade intencional

### Feedback ao Usuário (obrigatório em toda mutação)
```typescript
// Toast de sucesso
showToast('Gasto salvo com sucesso!', 'success');

// Toast de erro
showToast('Erro ao salvar. Tente novamente.', 'error');

// Modal de confirmação antes de deletar
```

### Loading States
- Usar `SkeletonCard` de `components/ui/index.tsx` enquanto carrega
- Mostrar spinner inline em botões de ação (não bloquear a tela toda)
- Estado de loading nos botões: `disabled` + ícone de spinner

---

## Variáveis de Ambiente

```env
VITE_GEMINI_PROXY_URL=https://gemini-proxy.tarley-divino.workers.dev
VITE_TMDB_KEY=...         # TMDB (filmes) — público, ok no frontend
VITE_SPOONACULAR_KEY=...  # Não utilizado atualmente
```

- A chave Gemini **nunca** vai para o frontend — sempre via proxy Cloudflare Worker
- `.env` não é commitado — nunca incluir secrets no código

---

## Deploy

```bash
npm run build    # gera dist/
npm run deploy   # publica no GitHub Pages via gh-pages
```

- Base path: `/housefinance/`
- Roteamento: HashRouter (necessário para GitHub Pages — não mudar para BrowserRouter)
- Gemini proxy: Cloudflare Worker (deploy separado, não está neste repo)

---

## O Que Nunca Fazer

- Fazer queries Supabase dentro de tabs/componentes filhos
- Usar `any` no TypeScript
- Remover `is_deleted` check em queries de expenses
- Mudar de HashRouter para BrowserRouter (quebra o GitHub Pages)
- Expor API keys diretamente (Gemini vai sempre pelo proxy)
- Adicionar estado global (Redux/Zustand) sem necessidade clara
- Criar CSS customizado quando Tailwind resolve
- Commitar `.env` ou secrets

---

## Checklist de Nova Feature

- [ ] Tipos definidos em `types/index.ts`
- [ ] Query Supabase em `useDashboardData.ts`
- [ ] Mutação feita via callback em `Dashboard.tsx`
- [ ] Tab recebe dados via props, não faz fetch próprio
- [ ] Dark mode implementado (`dark:` em todos os elementos)
- [ ] Mobile-first: testado em viewport 375px
- [ ] Touch targets adequados (`min-h-[44px]`)
- [ ] Toast de feedback em toda ação do usuário
- [ ] Modal de confirmação antes de deletar
- [ ] Loading state no botão de ação
- [ ] TypeScript sem erros (`npm run build` limpo)

---

## Sistema de Tasks

Tasks ficam em `/tasks/`. Cada arquivo é uma unidade de trabalho planejada.

### Nomenclatura

```
tasks/Task-NNN-descricao-curta.md
```

### Tipos de Task

| Tipo | O que Claude faz |
|------|-----------------|
| `ANÁLISE` | Pesquisa + relatório técnico. Sem alterar código. |
| `IMPLEMENTAÇÃO` | Altera/cria arquivos do projeto seguindo o checklist de nova feature. |
| `SQL` | Gera e apresenta SQL para o usuário rodar no Supabase. Nunca executa sozinho. |
| `REFACTOR` | Melhora código existente sem alterar comportamento visível. |

### Como Executar uma Task

Ao receber "execute a Task-NNN" ou "rode a Task-NNN":

1. Ler o arquivo `tasks/Task-NNN-*.md` integralmente antes de qualquer ação.
2. Identificar o tipo da task (ANÁLISE, IMPLEMENTAÇÃO, SQL, REFACTOR).
3. Seguir o plano e os critérios de aceitação descritos na task.
4. Ao concluir, atualizar o campo `**Status:**` do arquivo para `CONCLUÍDO` e registrar a data.
5. Atualizar o índice em `tasks/README.md`.

### Estrutura Obrigatória de um Arquivo de Task

```markdown
# Task - NNN - Título da Task

**Status:** ANÁLISE | PLANEJADO | EM ANDAMENTO | CONCLUÍDO | CANCELADO
**Tipo:** Análise | Implementação | SQL | Refactor
**Data de criação:** YYYY-MM-DD

## Contexto
[Por que essa task existe. Qual problema resolve.]

## Objetivo
[O que deve ser entregue ao final.]

## Detalhamento Técnico
[Para ANÁLISE: perguntas a responder.
 Para IMPLEMENTAÇÃO: arquivos a criar/alterar, tipos, queries, UI.
 Para SQL: o que o script deve fazer.
 Para REFACTOR: o que mudar e por quê.]

## Critérios de Aceitação
- [ ] critério 1
- [ ] critério 2

## Observações para o Claude
[Restrições, preferências, dependências de outras tasks.]
```

---

## Contexto do Projeto

- App usado diariamente pelo casal (dados reais, banco em produção)
- Nunca rodar `DELETE` ou `TRUNCATE` no banco sem confirmação explícita
- Schema changes: mostrar SQL ao usuário antes de aplicar
- Usuário principal: Tarley Rodrigues (GitHub: TarleyRodrigues)
