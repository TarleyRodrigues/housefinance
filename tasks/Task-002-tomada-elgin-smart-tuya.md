# Task - 002 - Tomada Inteligente Elgin Smart (Tuya IoT Platform)

**Status:** PLANEJADO  
**Tipo:** Implementação  
**Data de criação:** 2026-06-22  
**Depende de:** Task-001 (concluída — análise de viabilidade)  
**Próxima task relacionada:** Task-003 (lâmpada — usa mesma infraestrutura criada aqui)

---

## Contexto

A tomada inteligente Elgin Smart usa o Tuya IoT Platform por baixo. A Tuya tem uma REST API gratuita para desenvolvedores com até 1 milhão de chamadas/mês e 10 dispositivos — suficiente para uso pessoal.

Esta task cria toda a infraestrutura base para o módulo de Casa Inteligente:
- Um novo Cloudflare Worker `smart-home-proxy` que assina e proxy todas as chamadas para a Tuya API
- Um novo hook `useSmartHomeData.ts`
- A nova tab `TabCasaInteligente.tsx`
- A tomada como primeiro card funcional

---

## Pré-requisitos (usuário deve fazer antes de executar a task)

1. Criar conta de desenvolvedor gratuita em **iot.tuya.com**
2. Criar um projeto IoT no console Tuya
3. Em "Cloud" → "Link Tuya App Account" → vincular a conta do app Elgin Smart (escanear QR code)
4. Os dispositivos Elgin aparecerão no console com seus `device_id`s — anotar o `device_id` da tomada
5. Copiar o `Access ID` (= client_id) e `Access Secret` (= client_secret) do projeto

Variáveis de ambiente a configurar no Worker (via `wrangler secret put`):
- `TUYA_CLIENT_ID`
- `TUYA_CLIENT_SECRET`
- `TUYA_DEVICE_TOMADA` → device_id da tomada
- `TUYA_REGION` → `us` (Brasil usa endpoint US da Tuya: `openapi.tuyaus.com`)

---

## O Que Implementar

### 1. Cloudflare Worker — `smart-home-proxy`

Criar um novo projeto Worker **fora** do repositório housefinance (projeto Wrangler separado) em:
`C:\Users\tarley.divino\Desktop\Projetos\smart-home-proxy\`

O Worker deve ter as seguintes rotas:

```
GET  /tuya/devices/:deviceId/status   → GET status do dispositivo Tuya
POST /tuya/devices/:deviceId/commands → enviar comando ao dispositivo Tuya
```

**Autenticação Tuya (implementar no Worker):**

A Tuya exige assinatura HMAC-SHA256 em todas as requisições. O fluxo é:

```
1. Obter access_token:
   GET https://openapi.tuyaus.com/v1.0/token?grant_type=1
   Header: client_id, sign, t (timestamp ms), sign_method=HMAC-SHA256
   
   sign = HMAC-SHA256(
     client_id + t + "GET\n\n\n/v1.0/token?grant_type=1",
     client_secret
   ).toUpperCase()
   
   Response: { result: { access_token, expire_time } }

2. Cachear o access_token em memória (válido por 7200s / 2h)

3. Para cada request subsequente:
   sign = HMAC-SHA256(
     client_id + access_token + t + stringToSign,
     client_secret
   ).toUpperCase()
   
   stringToSign = METHOD + "\n" + sha256(body || "") + "\n\n" + path
```

**Endpoint de status da tomada:**
```
GET https://openapi.tuyaus.com/v1.0/devices/{deviceId}/status
Response: {
  result: [
    { code: "switch_1", value: true/false },   // ligada/desligada
    { code: "countdown_1", value: 0 },          // timer
    { code: "cur_power", value: 123 },           // potência em W (se suportado)
    { code: "cur_voltage", value: 2200 },        // voltagem em 0.1V (se suportado)
  ]
}
```

**Endpoint de comando:**
```
POST https://openapi.tuyaus.com/v1.0/devices/{deviceId}/commands
Body: { "commands": [{ "code": "switch_1", "value": true }] }
```

O Worker deve:
- Expor CORS para `https://tarleyrodrigues.github.io`
- Cachear o access_token em memória (variável global no Worker, não KV — simplicidade)
- Retornar JSON limpo para o frontend

---

### 2. Novo hook — `src/hooks/useSmartHomeData.ts`

```typescript
// Estrutura do hook
export function useSmartHomeData() {
  const [tomada, setTomada] = useState<TomadaStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTomadaStatus = useCallback(async () => { ... }, []);
  const toggleTomada = useCallback(async (on: boolean) => { ... }, []);
  const refreshAll = useCallback(async () => { ... }, []);

  useEffect(() => {
    fetchTomadaStatus();
    // polling a cada 30 segundos enquanto a tab estiver ativa
    const interval = setInterval(fetchTomadaStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchTomadaStatus]);

  return { tomada, loading, error, toggleTomada, refreshAll };
}
```

O hook faz chamadas para o Worker (URL salva em `VITE_SMART_HOME_PROXY_URL` no `.env`).

---

### 3. Novos tipos — `src/types/index.ts`

Adicionar ao final do arquivo:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// Smart Home
// ─────────────────────────────────────────────────────────────────────────────
export interface TomadaStatus {
  on: boolean;
  power_w?: number;      // potência atual em Watts (nem todos os modelos suportam)
  voltage_v?: number;    // tensão em Volts
  last_updated: string;  // ISO timestamp da última consulta
}
```

---

### 4. Nova tab — `src/tabs/TabCasaInteligente.tsx`

**Props interface:**
```typescript
interface TabCasaInteligenteProps {
  tomada: TomadaStatus | null;
  loadingSmartHome: boolean;
  onToggleTomada: (on: boolean) => Promise<void>;
  onRefreshSmartHome: () => Promise<void>;
}
```

**Layout da tab:**
- Header: "Casa Inteligente" com ícone `Cpu` (Lucide) + botão de refresh
- Seção "Tomadas" com card da tomada:
  - Ícone `Plug` (Lucide) 
  - Nome: "Tomada Inteligente"
  - Toggle grande (ligado/desligado) com `motion` para animação suave
  - Badge de potência (ex: "123W") se disponível
  - Texto "Desconectado" se `tomada === null`
- Skeleton loading enquanto carrega
- Segue dark mode (`dark:` em todos os elementos)
- `pb-32` para não ficar atrás da BottomNav

---

### 5. Wiring no Dashboard — `src/pages/Dashboard.tsx`

```typescript
// Importar o hook
const { tomada, loading: loadingSmartHome, toggleTomada, refreshAll: refreshSmartHome } = useSmartHomeData();

// Passar para a tab
<TabCasaInteligente
  tomada={tomada}
  loadingSmartHome={loadingSmartHome}
  onToggleTomada={toggleTomada}
  onRefreshSmartHome={refreshSmartHome}
/>
```

---

### 6. Adicionar tab ao BottomNav — `src/components/BottomNav.tsx`

- Adicionar tab `'smart-home'` com ícone `Cpu` e label "Casa"
- Adicionar `'smart-home'` ao union type `TabName` em `src/types/index.ts`

---

### 7. Variável de ambiente — `.env`

```env
VITE_SMART_HOME_PROXY_URL=https://smart-home-proxy.tarley-divino.workers.dev
```

---

## Critérios de Aceitação

- [ ] Worker Tuya funcionando localmente (`wrangler dev`) e em produção
- [ ] Worker consegue obter access_token e fazer GET /status da tomada
- [ ] Tab "Casa Inteligente" aparece no BottomNav
- [ ] Card da tomada exibe status (ligada/desligada) com polling de 30s
- [ ] Toggle na UI envia comando e atualiza o estado otimisticamente
- [ ] Toast de erro se a chamada falhar
- [ ] Dark mode implementado na tab
- [ ] `npm run build` limpo sem erros TypeScript

---

## Observações para o Claude

- O Worker é um projeto separado do housefinance — criar em `C:\Users\tarley.divino\Desktop\Projetos\smart-home-proxy\` com `npm create cloudflare@latest`
- A URL do Worker pode ser diferente da sugerida — confirmar com o usuário após o deploy do Worker
- Tuya API usa endpoints regionais: Brasil → `openapi.tuyaus.com` (US). Se os dispositivos foram registrados na região EU, usar `openapi.tuya.eu.com`
- O polling de 30s é suficiente para uma tomada — não precisa de WebSocket
- Atualização otimista no toggle: mudar o estado no React imediatamente, depois confirmar com o status real do dispositivo
- CORS: o Worker deve aceitar requisições de `https://tarleyrodrigues.github.io` e de `localhost` (para dev)
