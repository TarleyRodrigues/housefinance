// ─── HOOK: useGeminiAnalysis ──────────────────────────────────────────────────
// Encapsula toda a lógica de chamada à API Gemini, isolando do componente.
// Seguindo a filosofia do projeto: cada responsabilidade no seu arquivo.

import { useState, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '../utils';
import type { Expense } from '../types';

// ⚠️  A chave fica no .env — nunca hardcode aqui.
// Em produção ideal, mova a chamada para um backend/proxy para não expor a chave no bundle.
const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY;

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
    if (!GEMINI_KEY) {
      setAiAnalysis('❌ Chave da API não configurada. Adicione VITE_GEMINI_KEY no .env');
      return;
    }
    if (expenses.length === 0) {
      setAiAnalysis('📭 Nenhum gasto registrado neste mês para analisar.');
      return;
    }

    setLoadingAI(true);
    setAiAnalysis(null);

    try {
      // ── Prepara contexto do mês atual ─────────────────────────────────────
      const mesAtual = format(currentDate, 'MMMM yyyy', { locale: ptBR });
      const totalAtual = expenses.reduce((acc, e) => acc + Number(e.amount), 0);

      // ── Prepara contexto do mês anterior (se disponível) ─────────────────
      const totalAnterior = prevMonthExpenses.reduce((acc, e) => acc + Number(e.amount), 0);
      const diffAbsoluta = totalAtual - totalAnterior;
      const diffPercent = totalAnterior > 0
        ? ((diffAbsoluta / totalAnterior) * 100).toFixed(1)
        : null;

      const comparativoTxt = totalAnterior > 0
        ? `Comparando com o mês anterior (total: ${formatCurrency(totalAnterior)}), ` +
          `este mês houve uma ${diffAbsoluta > 0 ? 'alta' : 'redução'} de ` +
          `${formatCurrency(Math.abs(diffAbsoluta))} (${Math.abs(Number(diffPercent))}%).`
        : 'Não há dados do mês anterior para comparação.';

      // ── Agrupa gastos por categoria para contexto mais rico ───────────────
      const porCategoria = expenses.reduce<Record<string, number>>((acc, e) => {
        const cat = e.category_name ?? 'Sem categoria';
        acc[cat] = (acc[cat] ?? 0) + Number(e.amount);
        return acc;
      }, {});

      const categoriasTxt = Object.entries(porCategoria)
        .sort(([, a], [, b]) => b - a)
        .map(([cat, val]) => `${cat}: ${formatCurrency(val)}`)
        .join(', ');

      // ── Prompt enriquecido ────────────────────────────────────────────────
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

      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      setAiAnalysis(result.response.text());

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('429'))
        setAiAnalysis('⏳ Limite de requisições atingido. Aguarde alguns minutos e tente novamente.');
      else if (message.includes('503'))
        setAiAnalysis('🔄 Servidores do Gemini sobrecarregados. Tente novamente em instantes.');
      else if (message.includes('API_KEY') || message.includes('401'))
        setAiAnalysis('🔑 Chave da API inválida. Verifique o valor de VITE_GEMINI_KEY no .env');
      else
        setAiAnalysis(`❌ Erro inesperado: ${message}`);
    } finally {
      setLoadingAI(false);
    }
  }, [expenses, prevMonthExpenses, currentDate]);

  const clearAnalysis = useCallback(() => setAiAnalysis(null), []);

  return { aiAnalysis, loadingAI, generateAnalysis, clearAnalysis };
}