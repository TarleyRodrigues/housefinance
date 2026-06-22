# Task - 004 - Lava-roupa Samsung (SmartThings API)

**Status:** PLANEJADO  
**Tipo:** Implementação  
**Data de criação:** 2026-06-22  
**Depende de:** Task-002 (Tab Casa Inteligente e Worker devem existir)  
**Próxima task relacionada:** Task-005 (Alexa)

---

## Contexto

A lava-roupa Samsung está integrada ao SmartThings, que tem uma REST API oficial gratuita. A autenticação é feita por Personal Access Token (PAT) — sem OAuth complexo, sem app de terceiros. O PAT é um token fixo gerado no portal SmartThings e fica salvo como secret no Worker existente.

O status da lava-roupa (ciclo atual, tempo restante, estado da porta) é leitura via GET. O controle remoto (ligar um ciclo) pode ser limitado dependendo do modelo — o mais garantido é a leitura de status. Esta task implementa ao menos o monitoramento, e tenta o controle remoto se disponível.

---

## Pré-requisitos (usuário deve fazer antes)

1. Acessar **account.smartthings.com** → "Personal Access Tokens" → "Generate new token"
2. Nome: "Housefinance" | Scopes mínimos: `r:devices:*` e `x:devices:*`
3. Copiar o token gerado (aparece apenas uma vez)
4. Descobrir o `deviceId` da lava-roupa:
   - `GET https://api.smartthings.com/v1/devices` com header `Authorization: Bearer {TOKEN}`
   - Procurar o dispositivo Samsung com `deviceTypeName` "washer" ou similar
   - Anotar o `deviceId`

Variáveis a adicionar no Worker existente (`smart-home-proxy`):
- `SMARTTHINGS_TOKEN` → o PAT gerado
- `SMARTTHINGS_DEVICE_LAVADORA` → deviceId da lava-roupa

---

## O Que Implementar

### 1. Worker — `smart-home-proxy` (adicionar rota)

Adicionar ao Worker existente as rotas SmartThings:

```
GET  /smartthings/lavadora/status    → status atual da lava-roupa
POST /smartthings/lavadora/command   → enviar comando (ex: remote start)
```

**Implementação da rota de status:**

```javascript
// Dentro do Worker
if (url.pathname === '/smartthings/lavadora/status') {
  const deviceId = env.SMARTTHINGS_DEVICE_LAVADORA;
  const res = await fetch(
    `https://api.smartthings.com/v1/devices/${deviceId}/status`,
    { headers: { Authorization: `Bearer ${env.SMARTTHINGS_TOKEN}` } }
  );
  const data = await res.json();
  
  // Normalizar o retorno do SmartThings para formato limpo
  const components = data.components?.main;
  return Response.json({
    machineState: components?.['samsungce.washerOperatingState']?.machineState?.value,
    washerJobState: components?.['samsungce.washerOperatingState']?.washerJobState?.value,
    remainingTime: components?.['samsungce.washerOperatingState']?.remainingTime?.value,
    doorState: components?.['samsungce.doorState']?.doorState?.value,
    operatingState: components?.['switch']?.switch?.value, // 'on'/'off'
    last_updated: new Date().toISOString(),
  });
}
```

**Campos de status relevantes do SmartThings para lava-roupa Samsung:**

| Capability | Atributo | Valores possíveis |
|-----------|----------|-------------------|
| `samsungce.washerOperatingState` | `machineState` | `run`, `stop`, `pause`, `finished` |
| `samsungce.washerOperatingState` | `washerJobState` | `wash`, `rinse`, `spin`, `airWash`, `weightSensing` |
| `samsungce.washerOperatingState` | `remainingTime` | string `"HH:MM"` |
| `samsungce.doorState` | `doorState` | `open`, `closed` |
| `switch` | `switch` | `on`, `off` |

---

### 2. Tipos — `src/types/index.ts`

```typescript
export type WasherMachineState = 'run' | 'stop' | 'pause' | 'finished';
export type WasherJobState = 'wash' | 'rinse' | 'spin' | 'airWash' | 'weightSensing' | 'none';

export interface LavadoraStatus {
  machineState: WasherMachineState | null;
  washerJobState: WasherJobState | null;
  remainingTime: string | null;   // "HH:MM" ex: "00:43"
  doorState: 'open' | 'closed' | null;
  on: boolean;
  last_updated: string;
}
```

---

### 3. Hook — `src/hooks/useSmartHomeData.ts` (expandir)

```typescript
const [lavadora, setLavadora] = useState<LavadoraStatus | null>(null);

const fetchLavadoraStatus = useCallback(async () => { ... }, []);

// Polling mais frequente quando lavando (a cada 60s); quando parada, a cada 5 min
// Implementar: se machineState === 'run', intervalo de 60s; caso contrário, 300s
```

Adicionar `fetchLavadoraStatus()` ao `Promise.all` do `refreshAll`.

---

### 4. Tab — `src/tabs/TabCasaInteligente.tsx` (adicionar card)

**Props adicionais:**
```typescript
lavadora: LavadoraStatus | null;
loadingLavadora: boolean;
```

**Card da lava-roupa (nova seção "Eletrodomésticos"):**

- Ícone: `WashingMachine` do Lucide (ou `Waves` se não existir)
- Nome: "Lava-roupa Samsung"
- Estado principal em destaque: pill colorido com o `machineState`
  - `run` → azul "Lavando"
  - `pause` → amarelo "Pausado"
  - `finished` → verde "Concluído" + animação de celebração (pulse)
  - `stop` → cinza "Parado"
- Sub-estado: texto menor com `washerJobState` traduzido para PT-BR
  - `wash` → "Lavagem"
  - `rinse` → "Enxágue"
  - `spin` → "Centrifugação"
- Tempo restante em destaque: `remainingTime` se `machineState === 'run'`
- Status da porta: ícone pequeno + "Porta aberta" / "Porta fechada"
- Nota: sem botão de controle (SmartThings limita remote start para a maioria dos modelos) — somente monitoramento

**Tradução dos estados para PT-BR (constante na tab ou em utils):**
```typescript
const MACHINE_STATE_LABEL: Record<string, string> = {
  run: 'Lavando',
  pause: 'Pausado',
  finished: 'Concluído',
  stop: 'Parado',
};

const JOB_STATE_LABEL: Record<string, string> = {
  wash: 'Lavagem',
  rinse: 'Enxágue',
  spin: 'Centrifugação',
  airWash: 'Lavagem a ar',
  weightSensing: 'Pesando roupa',
};
```

**Organização do tab após esta task:**
```
Tab Casa Inteligente
├── Seção "Tomadas"
│   └── Card Tomada Inteligente
├── Seção "Iluminação"
│   └── Card Lâmpada T100
└── Seção "Eletrodomésticos"
    └── Card Lava-roupa Samsung
```

---

### 5. Dashboard — `src/pages/Dashboard.tsx`

```typescript
lavadora={lavadora}
loadingLavadora={loadingSmartHome}
```

---

## Critérios de Aceitação

- [ ] Status da lava-roupa (estado, ciclo, tempo restante, porta) exibido no card
- [ ] Pill de estado com cor correta por `machineState`
- [ ] Tempo restante exibido e atualizado via polling
- [ ] Polling de 60s quando lavando, 300s quando parada
- [ ] Card mostra "Desconectada" / skeleton se status null
- [ ] Mensagem "Concluído! 🎉" com destaque visual quando ciclo terminar
- [ ] Dark mode no card
- [ ] `npm run build` limpo

---

## Observações para o Claude

- A lava-roupa Samsung às vezes retorna `machineState: null` mesmo quando está parada (mas conectada). Tratar null como "Parado"
- O campo `remainingTime` pode vir como `"00:00"` mesmo quando parada — só exibir se `machineState === 'run'`
- SmartThings API pode retornar 404 se o device ficar offline (Wi-Fi desconectado). Tratar como "Desconectada" na UI, não como erro fatal
- Para o polling adaptativo: usar `useRef` para guardar o intervalo atual e `clearInterval` + `setInterval` quando o estado mudar de `run` → outro
- O PAT do SmartThings não expira, mas pode ser revogado manualmente — se o Worker retornar 401, mostrar "Token inválido" na UI
- NUNCA expor o PAT ou o deviceId no código do frontend — tudo fica no Worker como secret
