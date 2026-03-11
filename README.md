# 📁 Estrutura do Dashboard Refatorado

## Antes vs Depois

| Antes | Depois |
|-------|--------|
| 1 arquivo `Dashboard.tsx` com ~1000 linhas | 10 arquivos pequenos e focados |
| Difícil de manter | Cada tela tem seu próprio arquivo |
| Alterar uma tela pode quebrar outra | Mudanças isoladas por arquivo |

---

## 📂 Estrutura de pastas

```
src/
├── pages/
│   └── Dashboard.tsx          ← Orquestrador (navegação + estado global)
│
├── tabs/                       ← Uma tela = um arquivo
│   ├── TabExtrato.tsx          ← Aba "Extrato" com filtros e lista
│   ├── TabNovoGasto.tsx        ← Aba "Novo Gasto" / editar despesa
│   ├── TabCompras.tsx          ← Aba "Lista de Compras"
│   ├── TabNotas.tsx            ← Aba "Notas" + editor fullscreen
│   ├── TabAvisos.tsx           ← Aba "Lembretes / Avisos"
│   ├── TabGraficos.tsx         ← Aba "Gráficos" + IA Gemini
│   └── TabAjustes.tsx          ← Aba "Configurações" + CategoryManager
│
├── hooks/
│   └── useDashboardData.ts     ← Todas as queries do Supabase
│
├── components/
│   └── ui/
│       └── index.tsx           ← Toast, SkeletonCard
│
├── types/
│   └── index.ts                ← Interfaces TypeScript (Expense, Category...)
│
└── utils/
    └── index.ts                ← formatCurrency, CHART_COLORS, etc.
```

---

## 🛠️ Como usar na prática

### "Quero mudar o visual do Extrato"
→ Abra **`src/tabs/TabExtrato.tsx`** — não toca em mais nada.

### "Quero mudar a lógica do Gemini"
→ Abra **`src/tabs/TabGraficos.tsx`** — está tudo no começo do arquivo.

### "Preciso adicionar um campo no formulário de despesa"
→ Abra **`src/tabs/TabNovoGasto.tsx`** — formulário isolado.

### "A busca de dados do Supabase está errada"
→ Abra **`src/hooks/useDashboardData.ts`** — todas as queries em um lugar.

### "Preciso adicionar um novo tipo TypeScript"
→ Abra **`src/types/index.ts`**.

---

## 📤 Enviando para uma IA corrigir

Agora você pode mandar **apenas o arquivo relevante** para o Claude/ChatGPT/Gemini,
em vez do arquivo inteiro de 500 linhas. Exemplo:

- Bug no formulário? → manda só `TabNovoGasto.tsx` (80 linhas)
- Bug nos gráficos? → manda só `TabGraficos.tsx` (120 linhas)
- Bug no banco? → manda só `useDashboardData.ts` (90 linhas)

---

## ⚠️ Lembrete importante

A chave do Gemini está no arquivo .env.
Para funcionar em produção, foi inserido a chave em em actions secrets do github em: https://github.com/TarleyRodrigues/housefinance/settings/secrets/actions/VITE_GEMINI_KEY

A chave API foi criada no aistudio em:
https://aistudio.google.com/api-keys

Para produção, mova para `.env`:

```env
VITE_GEMINI_KEY=sua_chave_aqui
```

```tsx
// TabGraficos.tsx
const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY;
```

Rodar no terminal do vs code:
npm run dev

Deploy no terminal do vs code:
npm run deploy