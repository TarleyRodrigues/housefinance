// ─── HOOK: useExpenseAI ──────────────────────────────────────────────────────
// Lê a foto de uma nota/comprovante ou uma frase falada e devolve uma sugestão
// de gasto (valor, estabelecimento, data, descrição, categoria).
// Gemini via proxy Cloudflare Worker — a chave nunca vai para o frontend.

import { useCallback, useRef, useState } from 'react';
import { format, isValid, parseISO, addDays } from 'date-fns';
import type { Category, ExpenseSuggestion } from '../types';

const PROXY_URL  = import.meta.env.VITE_GEMINI_PROXY_URL as string | undefined;
const TIMEOUT_MS = 45_000;
const MAX_SIDE   = 1600;   // px — reduz upload e custo sem perder legibilidade

interface Context {
  categories: Category[];
  merchantNames: string[];
}

type Mode = 'image' | 'text';

// ── Imagem → base64 (reduzida para JPEG) ────────────────────────────────────
async function toInlineImage(file: File): Promise<{ mime: string; data: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const url = canvas.toDataURL('image/jpeg', 0.85);
    return { mime: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) };
  } catch {
    // Formato que o navegador não decodifica (ex: HEIC fora do Safari): envia o original
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { mime: file.type || 'image/jpeg', data: btoa(bin) };
  }
}

// ── Prompt ───────────────────────────────────────────────────────────────────
function buildPrompt(mode: Mode, ctx: Context, text?: string): string {
  const today = format(new Date(), 'yyyy-MM-dd (EEEE)');
  const cats = ctx.categories.map(c => `"${c.name}"`).join(', ');
  const merchants = ctx.merchantNames.slice(0, 80).map(m => `"${m}"`).join(', ') || '(nenhum)';
  const source = mode === 'image'
    ? `A imagem é uma nota fiscal, cupom (NFC-e), comprovante de maquininha, recibo, print de Pix/transferência ou fatura de conta brasileira.
- "valor": o TOTAL efetivamente pago (após descontos; não use subtotal nem troco).
- "data": a data da compra/pagamento impressa no documento.`
    : `O texto é uma frase falada pelo usuário descrevendo um gasto: "${text}".
- "valor": o valor citado (ex: "cinquenta e dois e noventa" = 52.90).
- "data": interprete referências como "hoje", "ontem", "sexta passada" a partir de hoje; se não houver, use null.`;

  return `Você ajuda a lançar gastos num app de finanças de um casal brasileiro. Hoje é ${today}.
${source}
- "estabelecimento": nome fantasia curto e legível (sem CNPJ, sem "LTDA"/"ME"/"EIRELI", sem endereço). Se for igual a um destes já usados, use exatamente a mesma grafia: ${merchants}.
- "descricao": 2 a 5 palavras em português descrevendo o gasto (ex: "Compra do mês", "Almoço", "Conta de luz", "Farmácia").
- "categoria": escolha EXATAMENTE uma destas (mesma grafia) ou null se nenhuma servir: ${cats}.
Se a ${mode === 'image' ? 'imagem não for um comprovante de gasto' : 'frase não descrever um gasto'}, devolva todos os campos null.
Responda SOMENTE com JSON no formato:
{"valor": number|null, "estabelecimento": string|null, "data": "yyyy-MM-dd"|null, "descricao": string|null, "categoria": string|null}`;
}

// ── Validação da resposta ────────────────────────────────────────────────────
function sanitize(raw: unknown, ctx: Context): ExpenseSuggestion {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  const valor = typeof o.valor === 'number' ? o.valor
    : typeof o.valor === 'string' ? Number(o.valor.replace(/\./g, '').replace(',', '.')) : NaN;
  const amount = Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : null;

  // Data: válida e no máximo amanhã (evita ano errado na leitura)
  const d = str(o.data);
  const parsed = d ? parseISO(d) : null;
  const date = parsed && isValid(parsed) && parsed <= addDays(new Date(), 1) && parsed.getFullYear() > 2000
    ? format(parsed, 'yyyy-MM-dd') : null;

  let merchant = str(o.estabelecimento);
  if (merchant) {
    const known = ctx.merchantNames.find(m => m.toLowerCase() === merchant!.toLowerCase());
    if (known) merchant = known;
  }

  // Categoria: só aceita uma existente; senão tenta pelo fornecedor padrão
  const catRaw = str(o.categoria)?.toLowerCase();
  let category = ctx.categories.find(c => c.name.toLowerCase() === catRaw)?.name ?? null;
  if (!category && merchant) {
    category = ctx.categories.find(c => c.default_merchant?.trim().toLowerCase() === merchant!.toLowerCase())?.name ?? null;
  }

  return { amount, merchant, date, description: str(o.descricao), category };
}

export function useExpenseAI(ctx: Context) {
  const [loading, setLoading] = useState<Mode | null>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const run = useCallback(async (mode: Mode, parts: object[]): Promise<ExpenseSuggestion> => {
    if (!PROXY_URL) throw new Error('Proxy do Gemini não configurado');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    setLoading(mode);
    try {
      const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
      const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
      return sanitize(JSON.parse(json || '{}'), ctxRef.current);
    } finally {
      clearTimeout(timer);
      setLoading(null);
    }
  }, []);

  const readReceipt = useCallback(async (file: File) => {
    const img = await toInlineImage(file);
    return run('image', [
      { inline_data: { mime_type: img.mime, data: img.data } },
      { text: buildPrompt('image', ctxRef.current) },
    ]);
  }, [run]);

  const parseSpeech = useCallback(
    (text: string) => run('text', [{ text: buildPrompt('text', ctxRef.current, text) }]),
    [run],
  );

  return { readReceipt, parseSpeech, loading, available: !!PROXY_URL };
}
