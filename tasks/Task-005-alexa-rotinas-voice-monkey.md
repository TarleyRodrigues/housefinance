# Task - 005 - Rotinas Amazon Alexa (Voice Monkey)

**Status:** PLANEJADO  
**Tipo:** Implementação  
**Data de criação:** 2026-06-22  
**Depende de:** Task-002 (Tab Casa Inteligente e Worker devem existir)

---

## Contexto

O Amazon Alexa permite disparar Rotinas via HTTP através do serviço **Voice Monkey** — um middleman que cria "monkeys" (botões virtuais) no app Alexa. Quando o Housefinance chama a API do Voice Monkey, a Alexa executa a Rotina configurada.

O plano gratuito do Voice Monkey permite disparar rotinas ilimitadas (o limite do free é em anúncios de voz TTS, que não usaremos aqui). Para apenas disparar rotinas, o free é suficiente.

Esta task adiciona uma seção de "Rotinas" ao Tab Casa Inteligente, com botões para cada rotina configurada pelo usuário no app Alexa.

---

## Pré-requisitos (usuário deve fazer antes)

1. Criar conta gratuita em **voicemonkey.io**
2. Instalar o Skill "Voice Monkey" no Echo Dot via app Alexa
3. No painel Voice Monkey: criar um "Monkey" para cada Rotina que quer disparar
   - Ex: Monkey "boa-noite" → Rotina "Boa Noite" no Alexa
   - Ex: Monkey "acordar" → Rotina "Bom dia" no Alexa
4. No app Alexa: configurar cada Rotina com trigger "Voice Monkey: [nome-do-monkey]"
5. Copiar o **API Token** do painel Voice Monkey (em "Account" → "API Token")
6. Anotar os nomes dos monkeys criados

Variáveis a adicionar no Worker existente:
- `VOICEMONKEY_TOKEN` → API Token do painel Voice Monkey

As rotinas (monkey names) não são secretas — podem ficar no código frontend como constantes configuráveis.

---

## O Que Implementar

### 1. Worker — `smart-home-proxy` (adicionar rota)

Adicionar rota:
```
POST /alexa/trigger   body: { monkey: string }  → dispara a rotina Alexa
```

**Implementação:**

```javascript
if (url.pathname === '/alexa/trigger' && request.method === 'POST') {
  const { monkey } = await request.json();
  
  const res = await fetch('https://api-v3.voicemonkey.io/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: env.VOICEMONKEY_TOKEN,
      device: monkey,   // nome do monkey criado no painel Voice Monkey
    }),
  });
  
  if (!res.ok) return Response.json({ ok: false, error: 'Falha ao disparar rotina' }, { status: 500 });
  return Response.json({ ok: true });
}
```

O Worker apenas envia o request para o Voice Monkey com o token secreto — o frontend nunca vê o token.

---

### 2. Tipos — `src/types/index.ts`

```typescript
export interface AlexaRotina {
  id: string;          // slug único, ex: "boa-noite"
  label: string;       // nome exibido na UI, ex: "Boa Noite"
  monkey: string;      // nome do monkey no Voice Monkey, ex: "boa-noite"
  icon: string;        // nome do ícone Lucide, ex: "Moon"
  color: string;       // classe Tailwind de cor, ex: "blue"
}
```

---

### 3. Configuração das rotinas no frontend

Criar constante em `src/utils/index.ts` com as rotinas configuradas pelo usuário:

```typescript
// Rotinas Alexa — editar para adicionar/remover rotinas disponíveis no dashboard
export const ALEXA_ROTINAS: AlexaRotina[] = [
  { id: 'boa-noite',  label: 'Boa Noite',   monkey: 'boa-noite',  icon: 'Moon',    color: 'indigo' },
  { id: 'bom-dia',    label: 'Bom Dia',     monkey: 'bom-dia',    icon: 'Sun',     color: 'yellow' },
  // Adicionar mais rotinas aqui conforme o usuário criar no Voice Monkey
];
```

Os nomes e monkeys reais devem ser confirmados com o usuário antes de executar a task, ou a task deve incluir uma UI de configuração (ver Observações).

---

### 4. Hook — `src/hooks/useSmartHomeData.ts` (adicionar ação)

```typescript
const [triggeringRotina, setTriggeringRotina] = useState<string | null>(null); // id da rotina sendo disparada

const triggerRotina = useCallback(async (rotina: AlexaRotina) => {
  setTriggeringRotina(rotina.id);
  try {
    const res = await fetch(`${SMART_HOME_PROXY_URL}/alexa/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monkey: rotina.monkey }),
    });
    if (!res.ok) throw new Error('Falha');
    showToast(`Rotina "${rotina.label}" ativada!`, 'success');
  } catch {
    showToast('Erro ao ativar rotina. Verifique o Voice Monkey.', 'error');
  } finally {
    setTriggeringRotina(null);
  }
}, []);
```

Alexa não tem API de status — não há polling aqui. Apenas o disparo.

---

### 5. Tab — `src/tabs/TabCasaInteligente.tsx` (adicionar seção)

**Props adicionais:**
```typescript
triggeringRotina: string | null;
onTriggerRotina: (rotina: AlexaRotina) => Promise<void>;
```

**Seção "Rotinas Alexa":**

- Título da seção com ícone `Mic2` (Lucide)
- Grid de botões 2 colunas, um por rotina da constante `ALEXA_ROTINAS`
- Cada botão:
  - Ícone da rotina (do campo `icon` — mapear string para componente Lucide)
  - Label da rotina
  - Cor de destaque definida pelo campo `color`
  - Estado de loading (spinner) quando `triggeringRotina === rotina.id`
  - `disabled` durante o loading
  - Feedback visual de "disparado" (pulse rápido de 500ms após sucesso)
  - `min-h-[72px]` para touch target adequado
- Nota informativa pequena embaixo: "As rotinas são executadas no Echo Dot"

**Organização final do tab:**
```
Tab Casa Inteligente
├── Seção "Tomadas"
│   └── Card Tomada Inteligente
├── Seção "Iluminação"
│   └── Card Lâmpada T100
├── Seção "Eletrodomésticos"
│   └── Card Lava-roupa Samsung
└── Seção "Rotinas Alexa"
    └── Grid de botões de rotinas
```

---

### 6. Dashboard — `src/pages/Dashboard.tsx`

```typescript
triggeringRotina={triggeringRotina}
onTriggerRotina={triggerRotina}
```

---

## Critérios de Aceitação

- [ ] Botões de rotina exibidos no grid
- [ ] Clique em um botão dispara o `POST /alexa/trigger` via Worker
- [ ] Toast de sucesso/erro após o disparo
- [ ] Spinner no botão durante o loading (apenas o botão clicado, não todos)
- [ ] Botões desabilitados durante qualquer disparo em andamento
- [ ] Dark mode na seção
- [ ] `npm run build` limpo

---

## Observações para o Claude

- **Confirmar com o usuário quais rotinas existem** antes de preencher a constante `ALEXA_ROTINAS` — os nomes dos monkeys devem bater exatamente com o que foi criado no painel Voice Monkey
- Alexa não confirma se a rotina foi executada com sucesso — o Voice Monkey retorna 200 se o request chegou, mas o Echo Dot pode estar offline. Toast de sucesso significa apenas "o pedido foi enviado"
- O ícone `icon` na interface `AlexaRotina` é uma string com o nome do componente Lucide — criar um mapa de lookup ou usar uma abordagem de componente dinâmico
- Voice Monkey free tier: disparos de rotinas são ilimitados no plano gratuito — apenas TTS (text-to-speech) tem limite. Confirmar em voicemonkey.io/pricing se isso mudou
- Se quiser que o usuário configure as rotinas pela UI (sem editar código), pode adicionar futuramente uma seção em TabAjustes para gerenciar a lista de rotinas salva no Supabase. Por ora, constante em utils é suficiente
- Não há polling nesta seção — Alexa não expõe status de dispositivos via Voice Monkey API
