// ─── HOOK: useGeminiAnalysis ──────────────────────────────────────────────────
// ✅ CORREÇÃO DO VAZAMENTO DE CHAVE API:
//
// O problema anterior: VITE_GEMINI_KEY era embutida no bundle JS pelo Vite,
// ficando visível para qualquer pessoa que abrisse o DevTools no navegador.
// GitHub Secrets não resolve isso — ele só protege durante o CI/CD build,
// mas o valor já vai compilado no bundle público do GitHub Pages.
//
// A solução: um Cloudflare Worker gratuito atua como proxy.
// O frontend chama o Worker, o Worker chama a Gemini com a chave segura,
// e retorna só o texto da resposta. A chave NUNCA vai para o bundle.
//
// ─── COMO CRIAR O PROXY (1 vez, gratuito) ────────────────────────────────────
// 1. Crie conta em https://workers.cloudflare.com (plano gratuito)
// 2. Crie um novo Worker e cole este código:
//
//    export default {
//      async fetch(request, env) {
//        if (request.method === 'OPTIONS') {
//          return new Response(null, {
//            headers: {
//              'Access-Control-Allow-Origin': 'https://tarleyrodrigues.github.io',
//              'Access-Control-Allow-Headers': 'Content-Type',
//              'Access-Control-Allow-Methods': 'POST',
//            },
//          });
//        }
//        const body = await request.json();
//        const res = await fetch(
//          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_KEY}`,
//          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
//        );
//        const data = await res.json();
//        return new Response(JSON.stringify(data), {
//          headers: {
//            'Content-Type': 'application/json',
//            'Access-Control-Allow-Origin': 'https://tarleyrodrigues.github.io',
//          },
//        });
//      }
//    }
//
// 3. Em Settings > Variables, adicione: GEMINI_KEY = <sua chave> (como Secret)
// 4. Copie a URL do Worker (ex: https://gemini-proxy.SEU_USUARIO.workers.dev)
// 5. Cole essa URL em VITE_GEMINI_PROXY_URL no seu .env local e no GitHub Secrets
//    (A URL do proxy pode ser pública — ela não expõe sua chave Gemini)
//
// ─── .env ─────────────────────────────────────────────────────────────────────
// VITE_GEMINI_PROXY_URL=https://gemini-proxy.SEU_USUARIO.workers.dev
// (remova VITE_GEMINI_KEY — ela não é mais necessária no frontend)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '../utils';
import type { Expense } from '../types';

// URL do Cloudflare Worker (proxy seguro — pode ser pública, não expõe a chave)
const PROXY_URL = import.meta.env.VITE_GEMINI_PROXY_URL as string | undefined;

interface UseGeminiAnalysisOptions {
  expenses: Expense[];
  prevMonthExpenses: Expense[];
  currentDate: Date;
}

interface UseGeminiAnalysisReturn {
  aiAnalysis: string | null;
  loadingAI: boolean;
  generateAnalysis: () => Promise<void>;
  clearAnalysis: () => void;
}

export function useGeminiAnalysis({
  expenses,
  prevMonthExpenses,
  currentDate,
}: UseGeminiAnalysisOptions): UseGeminiAnalysisReturn {
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  const generateAnalysis = useCallback(async () => {
    if (!PROXY_URL) {
      setAiAnalysis(
        '❌ Proxy não configurado. Crie o Cloudflare Worker conforme o README e adicione VITE_GEMINI_PROXY_URL no .env'
      );
      return;
    }
    if (expenses.length === 0) {
      setAiAnalysis('📭 Nenhum gasto registrado neste mês para analisar.');
      return;
    }

    setLoadingAI(true);
    setAiAnalysis(null);

    try {
      const mesAtual      = format(currentDate, 'MMMM yyyy', { locale: ptBR });
      const totalAtual    = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
      const totalAnterior = prevMonthExpenses.reduce((acc, e) => acc + Number(e.amount), 0);
      const diffAbsoluta  = totalAtual - totalAnterior;
      const diffPercent   = totalAnterior > 0
        ? ((diffAbsoluta / totalAnterior) * 100).toFixed(1)
        : null;

      const comparativoTxt = totalAnterior > 0
        ? `Comparando com o mês anterior (total: ${formatCurrency(totalAnterior)}), ` +
          `este mês houve uma ${diffAbsoluta > 0 ? 'alta' : 'redução'} de ` +
          `${formatCurrency(Math.abs(diffAbsoluta))} (${Math.abs(Number(diffPercent))}%).`
        : 'Não há dados do mês anterior para comparação.';

      const porCategoria = expenses.reduce<Record<string, number>>((acc, e) => {
        const cat = e.category_name ?? 'Sem categoria';
        acc[cat] = (acc[cat] ?? 0) + Number(e.amount);
        return acc;
      }, {});

      const categoriasTxt = Object.entries(porCategoria)
        .sort(([, a], [, b]) => b - a)
        .map(([cat, val]) => `${cat}: ${formatCurrency(val)}`)
        .join(', ');

      const prompt = `
Você é um assistente financeiro pessoal gentil e direto. Analise os gastos de ${mesAtual}:

📊 Total do mês: ${formatCurrency(totalAtual)}
📂 Por categoria: ${categoriasTxt}
📈 Comparativo: ${comparativoTxt}

Responda com:
1. Uma avaliação honesta e curta (1-2 linhas) sobre o padrão de gastos
2. O maior ponto de atenção (categoria que merece cuidado)
3. Uma dica prática e motivadora de economia

Seja objetivo, use emojis com moderação e escreva em português.
`.trim();

      // ✅ Chama o proxy (Cloudflare Worker), não a API do Gemini diretamente
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) throw new Error('Resposta vazia do modelo');
      setAiAnalysis(text);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('429'))
        setAiAnalysis('⏳ Limite de requisições atingido. Aguarde alguns minutos e tente novamente.');
      else if (message.includes('503'))
        setAiAnalysis('🔄 Servidores do Gemini sobrecarregados. Tente novamente em instantes.');
      else if (message.includes('401') || message.includes('403'))
        setAiAnalysis('🔑 Chave da API inválida no proxy. Verifique o Secret GEMINI_KEY no Cloudflare Worker.');
      else
        setAiAnalysis(`❌ Erro: ${message}`);
    } finally {
      setLoadingAI(false);
    }
  }, [expenses, prevMonthExpenses, currentDate]);

  const clearAnalysis = useCallback(() => setAiAnalysis(null), []);

  return { aiAnalysis, loadingAI, generateAnalysis, clearAnalysis };
}