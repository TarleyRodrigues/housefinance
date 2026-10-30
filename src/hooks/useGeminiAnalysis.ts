// ─── HOOK: useGeminiAnalysis ──────────────────────────────────────────────────
// Envia dados ricos do mês para o Gemini via proxy Cloudflare Worker.
// Após geração, chama onSave para persistir no banco (ai_analyses).

import { useState, useCallback } from 'react';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '../utils';
import type { Expense, Category, RecurringExpense } from '../types';

const PROXY_URL = import.meta.env.VITE_GEMINI_PROXY_URL as string | undefined;

interface UseGeminiAnalysisOptions {
  expenses: Expense[];
  prevMonthExpenses: Expense[];
  categories: Category[];
  recurringExpenses: RecurringExpense[];
  annualChartData: { name: string; total: number }[];
  currentDate: Date;
  onSave: (content: string, month: string, monthDisplay: string) => Promise<void>;
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
  categories,
  recurringExpenses,
  annualChartData,
  currentDate,
  onSave,
}: UseGeminiAnalysisOptions): UseGeminiAnalysisReturn {
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  const generateAnalysis = useCallback(async () => {
    if (!PROXY_URL) {
      setAiAnalysis('❌ Proxy não configurado. Adicione VITE_GEMINI_PROXY_URL no .env');
      return;
    }
    if (expenses.length === 0) {
      setAiAnalysis('📭 Nenhum gasto registrado neste mês para analisar.');
      return;
    }

    setLoadingAI(true);
    setAiAnalysis(null);

    try {
      const monthKey         = format(currentDate, 'yyyy-MM');
      const monthDisplay     = format(currentDate, 'MMMM yyyy', { locale: ptBR });
      const prevMonthDisplay = format(subMonths(currentDate, 1), 'MMMM yyyy', { locale: ptBR });

      const total     = expenses.reduce((a, e) => a + Number(e.amount), 0);
      const prevTotal = prevMonthExpenses.reduce((a, e) => a + Number(e.amount), 0);

      const daysInMonth    = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      const now            = new Date();
      const isCurrentMonth = now.getMonth() === currentDate.getMonth() && now.getFullYear() === currentDate.getFullYear();
      const daysElapsed    = isCurrentMonth ? Math.max(now.getDate(), 1) : daysInMonth;
      const dailyAvg       = total / daysElapsed;

      // Projeção: só após 7 dias e usando média dos últimos 7 dias.
      // Média linear do mês inteiro distorce quando contas fixas e mercado concentram
      // gastos no início do mês.
      let projection: number | null = null;
      if (isCurrentMonth && daysElapsed >= 7 && daysElapsed < daysInMonth) {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const sevenDaysAgoStr = format(sevenDaysAgo, 'yyyy-MM-dd');
        const todayStr = format(now, 'yyyy-MM-dd');
        const recent7Total = expenses.reduce((acc, e) => {
          const d = e.expense_date || e.created_at.split('T')[0];
          return d >= sevenDaysAgoStr && d <= todayStr ? acc + Number(e.amount) : acc;
        }, 0);
        const recentDailyAvg = recent7Total / 7;
        projection = Math.round(total + recentDailyAvg * (daysInMonth - daysElapsed));
      }

      // Casal vs individual
      const individualCatNames = new Set(
        categories.filter(c => c.type === 'individual').map(c => c.name)
      );
      const coupleTotal     = expenses.filter(e => !individualCatNames.has(e.category_name ?? '')).reduce((a, e) => a + Number(e.amount), 0);
      const individualTotal = total - coupleTotal;

      // Categorias com metas e comparativo com mês anterior
      const byCategory    = expenses.reduce<Record<string, number>>((acc, e) => { const c = e.category_name ?? 'Sem categoria'; acc[c] = (acc[c] ?? 0) + Number(e.amount); return acc; }, {});
      const prevByCat     = prevMonthExpenses.reduce<Record<string, number>>((acc, e) => { const c = e.category_name ?? 'Sem categoria'; acc[c] = (acc[c] ?? 0) + Number(e.amount); return acc; }, {});

      const categoryLines = Object.entries(byCategory)
        .sort(([, a], [, b]) => b - a)
        .map(([catName, amount]) => {
          const catDef  = categories.find(c => c.name === catName);
          const goal    = Number(catDef?.monthly_goal) || 0;
          const prevAmt = prevByCat[catName] ?? 0;
          const vsStr   = prevAmt > 0 ? ` [vs mês ant: ${amount > prevAmt ? '+' : ''}${formatCurrency(amount - prevAmt)}]` : '';
          let goalStr   = '';
          if (goal > 0) {
            const pct = (amount / goal) * 100;
            goalStr = pct > 100
              ? ` ⚠️ ${(pct - 100).toFixed(0)}% acima da meta de ${formatCurrency(goal)}`
              : ` ✅ ${pct.toFixed(0)}% da meta de ${formatCurrency(goal)}`;
          }
          return `  - ${catName}: ${formatCurrency(amount)}${goalStr}${vsStr}`;
        }).join('\n');

      // Gastos fixos
      const activeRecurring       = recurringExpenses.filter(r => r.is_active);
      const recurringMonthlyTotal = activeRecurring.reduce((a, r) => a + Number(r.amount), 0);
      const recurringLines        = activeRecurring.slice(0, 8)
        .map(r => `  - ${r.description}: ${formatCurrency(Number(r.amount))} (${r.category_name})`)
        .join('\n') || '  (nenhum gasto fixo ativo)';
      const variableTotal = Math.max(total - recurringMonthlyTotal, 0);

      // Padrão por dia da semana
      const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const weekdayTotals = new Array<number>(7).fill(0);
      expenses.forEach(e => {
        const d = e.expense_date || e.created_at.split('T')[0];
        weekdayTotals[new Date(d + 'T12:00:00').getDay()] += Number(e.amount);
      });
      const maxDayIdx  = weekdayTotals.reduce((best, v, i) => v > weekdayTotals[best] ? i : best, 0);
      const maxDayName = weekdayTotals[maxDayIdx] > 0 ? DAYS[maxDayIdx] : '—';
      const maxDayAmt  = weekdayTotals[maxDayIdx];

      // Contexto anual
      const annualMonths = annualChartData.filter(d => d.total > 0);
      const annualAvg    = annualMonths.length > 0 ? annualMonths.reduce((a, d) => a + d.total, 0) / annualMonths.length : 0;
      const annualCtx    = annualAvg > 0
        ? `Média mensal do ano: ${formatCurrency(annualAvg)}. Este mês está ${
            total > annualAvg
              ? `${((total - annualAvg) / annualAvg * 100).toFixed(0)}% ACIMA da média anual`
              : `${((annualAvg - total) / annualAvg * 100).toFixed(0)}% abaixo da média anual`
          }.`
        : 'Sem dados anuais suficientes para comparação.';

      // Participação por pessoa
      const byPerson    = expenses.reduce<Record<string, { name: string; total: number }>>((acc, e) => {
        if (!acc[e.user_id]) acc[e.user_id] = { name: e.profiles?.full_name ?? 'Usuário', total: 0 };
        acc[e.user_id].total += Number(e.amount); return acc;
      }, {});
      const personLines = Object.values(byPerson).sort((a, b) => b.total - a.total)
        .map(p => `  - ${p.name}: ${formatCurrency(p.total)} (${total > 0 ? ((p.total / total) * 100).toFixed(0) : 0}%)`)
        .join('\n');

      // Top 5 maiores gastos
      const topExpLines = [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5)
        .map((e, i) => `  ${i + 1}. ${formatCurrency(Number(e.amount))} — ${e.description ?? 'Sem descrição'} (${e.category_name ?? '—'})`)
        .join('\n');

      const diffTotal = total - prevTotal;
      const diffPct   = prevTotal > 0 ? ((diffTotal / prevTotal) * 100).toFixed(1) : null;

      const prompt = `
Você é um consultor financeiro pessoal experiente, especializado em finanças de casais.
Analise os dados financeiros do casal referentes a ${monthDisplay} e forneça uma análise profissional, personalizada e acionável.

━━━ PERÍODO: ${monthDisplay.toUpperCase()} ━━━
Dias contabilizados: ${daysElapsed} de ${daysInMonth}
Total gasto: ${formatCurrency(total)}
Número de transações: ${expenses.length}
Média por dia: ${formatCurrency(dailyAvg)}
${projection ? `Projeção para encerrar o mês (se mantida a média): ${formatCurrency(projection)}` : ''}

━━━ DISTRIBUIÇÃO DO GASTO ━━━
Gastos do casal (compartilhados): ${formatCurrency(coupleTotal)} — ${total > 0 ? ((coupleTotal / total) * 100).toFixed(0) : 0}%
Gastos individuais: ${formatCurrency(individualTotal)} — ${total > 0 ? ((individualTotal / total) * 100).toFixed(0) : 0}%
Gastos fixos mensais (recorrentes): ${formatCurrency(recurringMonthlyTotal)}
Gastos variáveis (sem os fixos): ${formatCurrency(variableTotal)}

━━━ GASTOS FIXOS CADASTRADOS ━━━
${recurringLines}

━━━ CATEGORIAS — MAIOR PARA MENOR ━━━
${categoryLines}

━━━ COMPARATIVO COM MÊS ANTERIOR (${prevMonthDisplay}) ━━━
Total anterior: ${formatCurrency(prevTotal)}
Variação: ${diffTotal > 0 ? '+' : ''}${formatCurrency(diffTotal)}${diffPct ? ` (${diffTotal > 0 ? '+' : ''}${diffPct}%)` : ' (sem dados anteriores)'}

━━━ CONTEXTO ANUAL ━━━
${annualCtx}

━━━ PADRÃO SEMANAL ━━━
Dia com maior volume de gastos: ${maxDayName} (${formatCurrency(maxDayAmt)})

━━━ PARTICIPAÇÃO POR PESSOA ━━━
${personLines}

━━━ TOP 5 MAIORES TRANSAÇÕES DO MÊS ━━━
${topExpLines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Responda em Markdown (pt-BR) com estas seções:

## 📊 Resumo do Mês
2-3 frases avaliando o mês usando os números reais. Seja honesto.

## ⚠️ Pontos de Atenção
Até 3 alertas concretos (categorias acima da meta, gastos incomuns, tendências). Use os valores.

## ✅ Destaques Positivos
Até 3 pontos onde o casal se saiu bem vs mês anterior ou vs meta.

## 💡 Recomendações para o Próximo Mês
3 ações práticas e específicas. Sugira valores quando possível.

## 💪 Mensagem do Consultor
1 frase motivacional e personalizada para o casal.

Seja direto. Cite os valores reais nos comentários. Máximo 400 palavras no total.
`.trim();

      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Resposta vazia do modelo');

      setAiAnalysis(text);

      // Persistir — erro aqui não impede a exibição
      try {
        await onSave(text, monthKey, monthDisplay);
      } catch (saveErr) {
        console.warn('[useGeminiAnalysis] Erro ao salvar análise:', saveErr);
      }

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
  }, [expenses, prevMonthExpenses, categories, recurringExpenses, annualChartData, currentDate, onSave]);

  const clearAnalysis = useCallback(() => setAiAnalysis(null), []);

  return { aiAnalysis, loadingAI, generateAnalysis, clearAnalysis };
}
