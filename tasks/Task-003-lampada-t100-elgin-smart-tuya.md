# Task - 003 - Lâmpada T100 Smart Bulb Elgin (Tuya IoT Platform)

**Status:** PLANEJADO  
**Tipo:** Implementação  
**Data de criação:** 2026-06-22  
**Depende de:** Task-002 (Worker Tuya e Tab Casa Inteligente devem existir)  
**Próxima task relacionada:** Task-004 (Samsung lava-roupa)

---

## Contexto

A lâmpada T100 Smart Bulb da Elgin usa o mesmo Tuya IoT Platform da tomada (Task-002). O Worker já existirá, a tab já existirá — esta task apenas adiciona o card da lâmpada ao tab existente e os tipos/estado correspondentes.

O `device_id` da lâmpada precisa ser adicionado ao Worker como secret adicional.

---

## Pré-requisitos

- Task-002 concluída (Worker `smart-home-proxy` em produção, tab criada)
- `device_id` da lâmpada T100 copiado do console Tuya (aparece junto com a tomada ao linkar a conta Elgin Smart)

Variável a adicionar no Worker existente:
- `TUYA_DEVICE_LAMPADA` → device_id da lâmpada T100

---

## O Que Implementar

### 1. Worker — `smart-home-proxy` (adicionar rota, não reescrever)

As rotas `/tuya/devices/:deviceId/status` e `/tuya/devices/:deviceId/commands` já aceitam qualquer `deviceId`. Apenas adicionar o secret `TUYA_DEVICE_LAMPADA` ao Worker existente:

```bash
wrangler secret put TUYA_DEVICE_LAMPADA
```

Também expor uma rota helper (opcional) para listar os device_ids configurados:
```
GET /tuya/devices  → retorna { tomada: TUYA_DEVICE_TOMADA, lampada: TUYA_DEVICE_LAMPADA }
```
Isso facilita o frontend saber quais IDs usar sem hardcodar.

---

### 2. Tipos — `src/types/index.ts`

Adicionar interface de status da lâmpada:

```typescript
export type BulbColorMode = 'white' | 'colour';

export interface LampadaStatus {
  on: boolean;
  mode: BulbColorMode;
  brightness: number;    // 0–1000 (mapeado para 0–100% na UI)
  color_temp: number;    // 0–1000 (frio=0, quente=1000) — modo white
  hue: number;           // 0–360 — modo colour
  saturation: number;    // 0–1000 — modo colour
  last_updated: string;
}
```

Mapeamento dos `code` Tuya para a interface:
| Tuya code | Interface |
|-----------|-----------|
| `switch_led` | `on` |
| `work_mode` | `mode` (`'white'`/`'colour'`) |
| `bright_value_v2` | `brightness` |
| `temp_value_v2` | `color_temp` |
| `colour_data_v2` | `{ hue, saturation }` — JSON string do Tuya |

---

### 3. Hook — `src/hooks/useSmartHomeData.ts` (expandir)

Adicionar estado e ações da lâmpada ao hook existente:

```typescript
const [lampada, setLampada] = useState<LampadaStatus | null>(null);

const fetchLampadaStatus = useCallback(async () => { ... }, []);

const setLampadaOn    = useCallback(async (on: boolean) => { ... }, []);
const setLampadaBrightness = useCallback(async (value: number) => { ... }, []);
const setLampadaColorTemp  = useCallback(async (value: number) => { ... }, []);

// refreshAll já existente: adicionar fetchLampadaStatus() ao Promise.all
```

**Comandos Tuya para a lâmpada:**

Ligar/desligar:
```json
{ "commands": [{ "code": "switch_led", "value": true }] }
```

Ajustar brilho (modo branco):
```json
{ "commands": [
  { "code": "work_mode", "value": "white" },
  { "code": "bright_value_v2", "value": 500 }
]}
```

Mudar cor (modo colour):
```json
{ "commands": [
  { "code": "work_mode", "value": "colour" },
  { "code": "colour_data_v2", "value": "{\"h\":120,\"s\":1000,\"v\":1000}" }
]}
```

---

### 4. Tab — `src/tabs/TabCasaInteligente.tsx` (adicionar card)

**Props adicionais:**
```typescript
lampada: LampadaStatus | null;
onSetLampadaOn: (on: boolean) => Promise<void>;
onSetLampadaBrightness: (value: number) => Promise<void>;
onSetLampadaColorTemp: (value: number) => Promise<void>;
```

**Card da lâmpada (adicionar à seção "Iluminação"):**
- Ícone `Lightbulb` (Lucide), nome "Lâmpada T100"
- Toggle liga/desliga (mesmo padrão da tomada)
- Slider de brilho (0–100%) — visível apenas quando `on === true`
- Slider de temperatura de cor (🌡 Frio ↔ Quente) — visível apenas quando `mode === 'white'`
- Botões de cor rápida (vermelho, verde, azul, branco) — visível quando `mode === 'colour'`
- Fundo do card muda de tom conforme a lâmpada está ligada (leve amarelo/branco)
- Texto "Desconectada" com ícone desabilitado se `lampada === null`

**Organização do tab após esta task:**
```
Tab Casa Inteligente
├── Seção "Tomadas"
│   └── Card Tomada Inteligente (criado na Task-002)
└── Seção "Iluminação"
    └── Card Lâmpada T100 (criado nesta task)
```

---

### 5. Dashboard — `src/pages/Dashboard.tsx`

Passar as novas props para `<TabCasaInteligente>`:
```typescript
lampada={lampada}
onSetLampadaOn={setLampadaOn}
onSetLampadaBrightness={setLampadaBrightness}
onSetLampadaColorTemp={setLampadaColorTemp}
```

---

## Critérios de Aceitação

- [ ] Status da lâmpada (on/off, brilho, temperatura de cor) exibido no card
- [ ] Toggle liga/desliga funcional com atualização otimista
- [ ] Slider de brilho envia comando e reflete na UI
- [ ] Slider de temperatura de cor funcional no modo branco
- [ ] Botões de cor rápida funcionais no modo colour
- [ ] Card mostra "Desconectada" se a API falhar
- [ ] Polling de 30s junto com a tomada (um único setInterval no hook)
- [ ] Dark mode no card
- [ ] `npm run build` limpo

---

## Observações para o Claude

- O `colour_data_v2` retornado pelo Tuya é uma string JSON `'{"h":120,"s":1000,"v":1000}'` — fazer `JSON.parse()` ao processar o status
- `bright_value_v2` vai de 10 a 1000 no Tuya — mapear para 1–100% na UI (multiply/divide por 10)
- Nem todos os modelos T100 suportam temperatura de cor E cor RGB ao mesmo tempo — se `temp_value_v2` vier undefined, esconder o slider de temperatura
- Debounce de 300ms nos sliders para não disparar uma chamada API por pixel movido
- O polling de ambos os dispositivos deve ser um único `setInterval` chamando `Promise.all([fetchTomadaStatus(), fetchLampadaStatus()])` — não criar dois intervalos separados
