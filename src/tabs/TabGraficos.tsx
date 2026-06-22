// ─── ABA: GRÁFICOS / ESTATÍSTICAS ────────────────────────────────────────────
// ✅ Hierarquia visual clara: Casal = seção principal, Individual = informativa
// ✅ Gastos individuais mostram quem gastou, em quê e quando (sem metas)
// ✅ Seção casal com borda azul destacada, individual discreta
// ✅ Cards individuais por pessoa com lista de gastos detalhada
// ✅ Divisor visual claro entre as duas seções
// ✅ Metas apenas na seção do casal

import { useMemo, useState, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Loader2, BarChart3, Users, PieChart as PieIcon,
  Target, TrendingUp, TrendingDown, Minus, X, Heart,
  ShoppingBag, ChevronDown, Clock, ArrowUp,
} from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, ReferenceLine,
} from 'recharts';
import { formatCurrency, CHART_COLORS, USER_COLORS } from '../utils';
import { useGeminiAnalysis } from '../hooks/useGeminiAnalysis';
import type { Expense, Category, RecurringExpense, AIAnalysis } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date))     return 'hoje';
  if (isYesterday(date)) return 'ontem';
  return format(date, "d 'de' MMM", { locale: ptBR });
}

interface UserTotal { name: string; avatar?: string; value: number; }
interface CategoryChartEntry { name: string; value: number; color: string; }

interface Props {
  expenses: Expense[];
  prevMonthExpenses: Expense[];
  categories: Category[];
  recurringExpenses: RecurringExpense[];
  annualChartData: { name: string; total: number }[];
  aiAnalyses: AIAnalysis[];
  currentDate: Date;
  showToast: (msg: string, type?: string) => void;
  onSaveAnalysis: (content: string, month: string, monthDisplay: string) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: SectionHeader — cabeçalho de seção com linha lateral colorida
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeader({
  icon, label, sublabel, accent = 'blue',
}: {
  icon: React.ReactNode; label: string; sublabel?: string; accent?: 'blue' | 'purple';
}) {
  const colors = {
    blue:   { bar: 'bg-blue-500',   text: 'text-blue-600 dark:text-blue-400',   sub: 'text-blue-400/70 dark:text-blue-500/70' },
    purple: { bar: 'bg-purple-400', text: 'text-purple-600 dark:text-purple-400', sub: 'text-purple-400/70 dark:text-purple-500/70' },
  };
  const c = colors[accent];
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-1 h-10 rounded-full shrink-0 ${c.bar}`} />
      <div>
        <div className={`flex items-center gap-2 font-black text-xs uppercase tracking-widest ${c.text}`}>
          {icon} {label}
        </div>
        {sublabel && <p className={`text-[9px] font-bold mt-0.5 ${c.sub}`}>{sublabel}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
// Componentes ReactMarkdown reutilizáveis
const mdComponents = {
  strong: ({ ...props }) => <span className="font-black text-blue-600 dark:text-blue-400" {...props} />,
  p:      ({ ...props }) => <p className="mb-2" {...props} />,
  h2:     ({ ...props }) => <h2 className="text-[11px] font-black text-slate-800 dark:text-white mt-4 mb-1.5 uppercase tracking-tight" {...props} />,
  li:     ({ ...props }) => <li className="ml-4 list-disc mb-0.5" {...props} />,
  ul:     ({ ...props }) => <ul className="mb-2" {...props} />,
};

// ── Histórico de Análises ──────────────────────────────────────────────────
function AnalysisHistory({ analyses, currentMonthKey }: { analyses: AIAnalysis[]; currentMonthKey: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border border-white/80 dark:border-slate-700/50 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 overflow-hidden">
      {/* Header sempre visível */}
      <div className="flex items-center gap-2 p-5 pb-4">
        <Clock size={12} className="text-slate-400" />
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Análises Salvas
        </h3>
        {analyses.length > 0 && (
          <span className="text-[8px] font-black bg-blue-100 dark:bg-blue-900/30 text-blue-500 px-1.5 py-0.5 rounded-lg ml-1">
            {analyses.length}
          </span>
        )}
      </div>

      {/* Estado vazio */}
      {analyses.length === 0 && (
        <div className="px-5 pb-5">
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium italic text-center py-4 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
            Nenhuma análise gerada ainda. Toque em ✨ no card acima para começar.
          </p>
        </div>
      )}

      {/* Lista de análises */}
      {analyses.length > 0 && (
        <div className="px-5 pb-5 space-y-2">
          {analyses.map(analysis => {
            const isCurrentMonth = analysis.month === currentMonthKey;
            const isOpen = expandedId === analysis.id;
            return (
              <div key={analysis.id}
                className={`rounded-2xl border overflow-hidden transition-colors ${
                  isCurrentMonth
                    ? 'border-blue-200 dark:border-blue-700/60 bg-blue-50/50 dark:bg-blue-900/10'
                    : 'border-slate-100 dark:border-slate-700'
                }`}
              >
                <button
                  onClick={() => setExpandedId(isOpen ? null : analysis.id)}
                  className="w-full flex items-center justify-between p-4 text-left active:brightness-95 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isCurrentMonth ? 'bg-blue-600' : 'bg-slate-100 dark:bg-slate-700'
                    }`}>
                      <Sparkles size={13} className={isCurrentMonth ? 'text-white' : 'text-slate-400'} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-slate-800 dark:text-white capitalize leading-tight truncate">
                          {analysis.month_display}
                        </p>
                        {isCurrentMonth && (
                          <span className="text-[7px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                            Este mês
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                        {analysis.created_at ? format(parseISO(analysis.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 shrink-0 ml-3 ${
                      isOpen ? 'rotate-180 text-blue-500' : 'text-slate-400'
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className={`px-4 pb-4 pt-2 border-t ${
                        isCurrentMonth ? 'border-blue-100 dark:border-blue-800/40' : 'border-slate-100 dark:border-slate-700'
                      }`}>
                        <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed prose prose-slate dark:prose-invert max-w-none">
                          <ReactMarkdown components={mdComponents}>{analysis.content}</ReactMarkdown>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function TabGraficos({
  expenses, prevMonthExpenses, categories, recurringExpenses,
  annualChartData, aiAnalyses, currentDate, showToast, onSaveAnalysis,
}: Props) {

  // Análise do mês atual (salva no banco) e histórico dos meses anteriores
  const currentMonthKey = format(currentDate, 'yyyy-MM');
  const currentSavedAnalysis = useMemo(
    () => aiAnalyses.find(a => a.month === currentMonthKey) ?? null,
    [aiAnalyses, currentMonthKey]
  );
  // Wrapper para mostrar toast se o save falhar (ex: tabela ai_analyses não criada ainda)
  const handleSaveAnalysis = useCallback(
    async (content: string, month: string, monthDisplay: string) => {
      try {
        await onSaveAnalysis(content, month, monthDisplay);
      } catch {
        showToast('Análise gerada, mas não foi salva. Verifique se a tabela ai_analyses existe no Supabase.', 'error');
      }
    },
    [onSaveAnalysis, showToast]
  );

  const { aiAnalysis, loadingAI, generateAnalysis, clearAnalysis } = useGeminiAnalysis({
    expenses, prevMonthExpenses, categories, recurringExpenses,
    annualChartData, currentDate, onSave: handleSaveAnalysis,
  });

  // Exibe: análise recém-gerada (memória) > análise salva no banco > null
  const displayedAnalysis = aiAnalysis ?? currentSavedAnalysis?.content ?? null;

  // Análise expandida: colapsa ao carregar do banco, expande ao gerar nova
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false);
  useEffect(() => {
    if (aiAnalysis) setIsAnalysisExpanded(true); // Expande ao gerar nova análise
  }, [aiAnalysis]);

  // ── Separação por tipo ────────────────────────────────────────────────────
  const coupleCategories     = useMemo(() => categories.filter((c) => c.type !== 'individual'), [categories]);
  const individualCategories = useMemo(() => categories.filter((c) => c.type === 'individual'), [categories]);
  const individualCatNames   = useMemo(() => new Set(individualCategories.map((c) => c.name)), [individualCategories]);

  const coupleExpenses     = useMemo(() => expenses.filter((e) => !individualCatNames.has(e.category_name ?? '')), [expenses, individualCatNames]);
  const individualExpenses = useMemo(() => expenses.filter((e) => individualCatNames.has(e.category_name ?? '')), [expenses, individualCatNames]);

  const prevCoupleExpenses     = useMemo(() => prevMonthExpenses.filter((e) => !individualCatNames.has(e.category_name ?? '')), [prevMonthExpenses, individualCatNames]);
  const prevIndividualExpenses = useMemo(() => prevMonthExpenses.filter((e) => individualCatNames.has(e.category_name ?? '')), [prevMonthExpenses, individualCatNames]);

  // ── Totais ────────────────────────────────────────────────────────────────
  const totalCouple     = useMemo(() => coupleExpenses.reduce((acc, e) => acc + Number(e.amount), 0), [coupleExpenses]);
  const totalIndividual = useMemo(() => individualExpenses.reduce((acc, e) => acc + Number(e.amount), 0), [individualExpenses]);
  const totalAtual      = totalCouple + totalIndividual;

  const prevTotalCouple     = useMemo(() => prevCoupleExpenses.reduce((acc, e) => acc + Number(e.amount), 0), [prevCoupleExpenses]);
  const prevTotalIndividual = useMemo(() => prevIndividualExpenses.reduce((acc, e) => acc + Number(e.amount), 0), [prevIndividualExpenses]);
  const prevTotalGeral      = prevTotalCouple + prevTotalIndividual;

  // ── Comparativos ──────────────────────────────────────────────────────────
  const cmp = useMemo(() => {
    const diffGeral  = totalAtual      - prevTotalGeral;
    const diffCouple = totalCouple     - prevTotalCouple;
    const diffIndiv  = totalIndividual - prevTotalIndividual;
    return {
      diffGeral,  pctGeral:  prevTotalGeral      > 0 ? (diffGeral  / prevTotalGeral)      * 100 : null,
      diffCouple, pctCouple: prevTotalCouple     > 0 ? (diffCouple / prevTotalCouple)     * 100 : null,
      diffIndiv,  pctIndiv:  prevTotalIndividual > 0 ? (diffIndiv  / prevTotalIndividual) * 100 : null,
    };
  }, [totalAtual, totalCouple, totalIndividual, prevTotalGeral, prevTotalCouple, prevTotalIndividual]);

  // ── Projeção de gasto ─────────────────────────────────────────────────────
  const isCurrentMonth = useMemo(() => {
    const t = new Date();
    return t.getMonth() === currentDate.getMonth() && t.getFullYear() === currentDate.getFullYear();
  }, [currentDate]);

  const daysInMonth = useMemo(() =>
    new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate(),
  [currentDate]);

  const daysElapsed = useMemo(() =>
    isCurrentMonth ? Math.max(new Date().getDate(), 1) : daysInMonth,
  [isCurrentMonth, daysInMonth]);

  const projectedTotal = useMemo(() => {
    // Não projeta antes de 7 dias: dados insuficientes e gasto do início do mês
    // (contas fixas, mercado) distorce a média diária para cima.
    if (!isCurrentMonth || daysElapsed < 7 || daysElapsed >= daysInMonth || totalAtual === 0) return null;

    // Usa média dos últimos 7 dias (não do mês todo) para projetar o restante.
    // Isso descarta o pico do início do mês quando as contas já foram pagas.
    const todayStr      = format(new Date(), 'yyyy-MM-dd');
    const sevenDaysAgo  = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = format(sevenDaysAgo, 'yyyy-MM-dd');

    const recentTotal = expenses.reduce((acc, e) => {
      const d = e.expense_date || e.created_at.split('T')[0];
      return d >= sevenDaysAgoStr && d <= todayStr ? acc + Number(e.amount) : acc;
    }, 0);

    const recentDailyAvg = recentTotal / 7;
    const remainingDays  = daysInMonth - daysElapsed;
    return Math.round(totalAtual + recentDailyAvg * remainingDays);
  }, [isCurrentMonth, daysElapsed, daysInMonth, totalAtual, expenses]);

  // ── Gastos por dia da semana ──────────────────────────────────────────────
  const weekdayData = useMemo(() => {
    const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const totals = new Array<number>(7).fill(0);
    expenses.forEach((e) => {
      const d = e.expense_date || e.created_at.split('T')[0];
      const dow = new Date(d + 'T12:00:00').getDay();
      totals[dow] += Number(e.amount);
    });
    const maxTotal = Math.max(...totals);
    return DAYS.map((name, i) => ({
      name,
      total: totals[i],
      fill: maxTotal > 0 && totals[i] === maxTotal ? '#818cf8' : '#3b82f6',
    }));
  }, [expenses]);

  // ── Gráfico pizza categorias casal ────────────────────────────────────────
  const chartDataCouple = useMemo<CategoryChartEntry[]>(
    () => coupleCategories
      .map((cat, i) => ({
        name:  cat.name,
        value: coupleExpenses.filter((e) => e.category_name === cat.name).reduce((a, e) => a + Number(e.amount), 0),
        color: cat.color ?? CHART_COLORS[i % CHART_COLORS.length],
      }))
      .filter((d) => d.value > 0),
    [coupleCategories, coupleExpenses]
  );

  // ── Gastos por pessoa (casal) ─────────────────────────────────────────────
  const userTotals = useMemo(
    () => Object.values(
      coupleExpenses.reduce<Record<string, UserTotal>>((acc, e) => {
        const uid = e.user_id;
        if (!acc[uid]) acc[uid] = { name: e.profiles?.full_name ?? 'Usuário', avatar: e.profiles?.avatar_url, value: 0 };
        acc[uid].value += Number(e.amount);
        return acc;
      }, {})
    ),
    [coupleExpenses]
  );

  // ── Metas casal ───────────────────────────────────────────────────────────
  const coupleGoals = useMemo(
    () => coupleCategories
      .map((cat, i) => {
        const total = coupleExpenses.filter((e) => e.category_name === cat.name).reduce((a, e) => a + Number(e.amount), 0);
        const meta  = Number(cat.monthly_goal) || 0;
        const color = cat.color ?? CHART_COLORS[i % CHART_COLORS.length];
        return { cat, total, meta, color };
      })
      .filter(({ total, meta }) => total > 0 || meta > 0),
    [coupleCategories, coupleExpenses]
  );

  // ── Orçamento total (soma de todas as metas) ─────────────────────────────
  const totalBudget = useMemo(
    () => categories.reduce((acc, c) => acc + (Number(c.monthly_goal) || 0), 0),
    [categories]
  );
  const budgetUsedPct  = totalBudget > 0 ? (totalAtual / totalBudget) * 100 : 0;
  const budgetRemaining = totalBudget - totalAtual;
  const isOverBudget   = totalAtual > totalBudget;

  // ── Gráfico anual ─────────────────────────────────────────────────────────
  const currentMonthName = format(currentDate, 'MMM', { locale: ptBR });
  const annualHighlighted = useMemo(
    () => annualChartData.map((d) => ({
      ...d,
      fill: d.name.toLowerCase() === currentMonthName.toLowerCase() ? '#6366f1' : '#3b82f6',
    })),
    [annualChartData, currentMonthName]
  );

  // ── Gastos individuais por pessoa (com lista de gastos) ───────────────────
  const individualByPerson = useMemo(() => {
    const map: Record<string, {
      userId: string; name: string; avatar?: string; total: number;
      categories: { name: string; value: number; color: string }[];
      recentExpenses: { description: string; amount: number; date: string; category: string }[];
    }> = {};

    individualExpenses.forEach((exp) => {
      const uid = exp.user_id;
      if (!map[uid]) {
        map[uid] = {
          userId: uid,
          name:   exp.profiles?.full_name ?? 'Usuário',
          avatar: exp.profiles?.avatar_url,
          total:  0,
          categories: [],
          recentExpenses: [],
        };
      }
      map[uid].total += Number(exp.amount);

      // Agrupamento por categoria
      const catName  = exp.category_name ?? 'Sem categoria';
      const catDef   = individualCategories.find((c) => c.name === catName);
      const catIdx   = individualCategories.indexOf(catDef!);
      const catColor = catDef?.color ?? CHART_COLORS[catIdx >= 0 ? catIdx % CHART_COLORS.length : 0] ?? '#a855f7';
      const existing = map[uid].categories.find((c) => c.name === catName);
      if (existing) { existing.value += Number(exp.amount); }
      else { map[uid].categories.push({ name: catName, value: Number(exp.amount), color: catColor }); }

      // Lista dos últimos gastos (máximo 5 por pessoa)
      if (map[uid].recentExpenses.length < 5) {
        map[uid].recentExpenses.push({
          description: exp.description ?? 'Sem descrição',
          amount:      Number(exp.amount),
          date:        exp.created_at,
          category:    catName,
        });
      }
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [individualExpenses, individualCategories]);

  const handleGenerateAnalysis = async () => {
    if (expenses.length === 0) { showToast('Lance alguns gastos primeiro!', 'info'); return; }
    await generateAnalysis();
  };

  // ── Render de meta ────────────────────────────────────────────────────────
  const renderGoalList = (goals: typeof coupleGoals) => (
    <div className="space-y-5">
      {goals.map(({ cat, total, meta, color }) => {
        const barMax        = Math.max(total, meta);
        const filledWidth   = barMax > 0 ? (Math.min(total, meta) / barMax) * 100 : 0;
        const overflowWidth = barMax > 0 && total > meta ? ((total - meta) / barMax) * 100 : 0;
        const isOver        = meta > 0 && total > meta;
        const hasMeta       = meta > 0;
        const percentUsed   = hasMeta ? Math.min((total / meta) * 100, 100) : null;
        const overflowPct   = isOver ? ((total - meta) / meta) * 100 : 0;
        return (
          <div key={cat.id} className="space-y-1.5"
            role="meter" aria-label={`${cat.name}: ${formatCurrency(total)} de ${formatCurrency(meta)}`}
            aria-valuenow={total} aria-valuemax={meta || undefined}
          >
            {/* Linha do nome + valor */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{cat.name}</span>
              </div>
              <span className={`text-[11px] font-bold ${isOver ? 'text-red-500' : 'text-slate-400'}`}>
                {formatCurrency(total)}
                {hasMeta && <span className="text-slate-400 font-black"> / {formatCurrency(meta)}</span>}
              </span>
            </div>

            {hasMeta ? (
              <>
                {/* Indicador de excesso — só aparece se ultrapassou 100% */}
                {isOver && (
                  <div className="flex justify-end">
                    <div className="flex items-center gap-0.5 bg-red-50 dark:bg-red-900/30 rounded-lg px-1.5 py-0.5">
                      <ArrowUp size={9} className="text-red-500" />
                      <span className="text-[9px] font-black text-red-500">+{overflowPct.toFixed(0)}% da meta</span>
                    </div>
                  </div>
                )}
                {/* Barra + percentual à direita */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${filledWidth}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }} className="h-full" style={{ backgroundColor: color }} />
                    <motion.div initial={{ width: 0 }} animate={{ width: `${overflowWidth}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                      className="h-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                  </div>
                  {percentUsed !== null && (
                    <span className={`text-[10px] font-black w-8 text-right shrink-0 ${
                      isOver          ? 'text-red-500'
                      : percentUsed >= 80 ? 'text-amber-500'
                      : 'text-emerald-500'
                    }`}>{percentUsed.toFixed(0)}%</span>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full w-full opacity-30" style={{ backgroundColor: color }} />
                </div>
                <span className="text-[8px] font-black uppercase text-slate-300 dark:text-slate-600 whitespace-nowrap">Sem meta</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Badge de variação ─────────────────────────────────────────────────────
  const DiffBadge = ({ diff, pct, size = 'md' }: { diff: number; pct: number | null; size?: 'sm' | 'md' }) => {
    if (pct === null) return <span className={`font-bold ${size === 'sm' ? 'text-[8px]' : 'text-[9px]'} text-white/20`}>—</span>;
    const isUp = diff > 0;
    const isFlat = diff === 0;
    return (
      <div className={`inline-flex items-center gap-1 font-black rounded-lg ${
        size === 'sm' ? 'text-[8px] px-1.5 py-0.5' : 'text-xs px-2 py-1'
      } ${isFlat ? 'bg-white/10 text-white/40' : isUp ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
        {isFlat ? <Minus size={size === 'sm' ? 8 : 10} /> : isUp ? <TrendingUp size={size === 'sm' ? 8 : 10} /> : <TrendingDown size={size === 'sm' ? 8 : 10} />}
        {Math.abs(pct).toFixed(1)}%
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-10 px-1">

      {/* ══════════════════════════════════════════════════════════════════════
          1. CARD COMPARATIVO GERAL
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-800 dark:to-slate-950 p-6 rounded-[2.5rem] shadow-2xl shadow-black/30 text-white relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -left-8 -bottom-12 w-36 h-36 bg-indigo-500/10 rounded-full pointer-events-none" />
        <div className="relative z-10">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 block mb-3">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })} · comparativo
          </span>

          {/* Total geral */}
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="text-4xl font-black tracking-tighter">{formatCurrency(totalAtual)}</p>
              <p className="text-[10px] text-white/40 font-bold mt-1 uppercase tracking-widest">Total geral</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <DiffBadge diff={cmp.diffGeral} pct={cmp.pctGeral} />
              {cmp.pctGeral !== null && (
                <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider">
                  vs {formatCurrency(prevTotalGeral)}
                </span>
              )}
            </div>
          </div>

          {/* Mini-cards casal vs individual */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-500/10 border border-blue-400/20 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Heart size={10} className="text-blue-400" />
                <span className="text-[8px] font-black uppercase tracking-widest text-blue-300/80">Casal</span>
              </div>
              <p className="text-xl font-black tracking-tight">{formatCurrency(totalCouple)}</p>
              <DiffBadge diff={cmp.diffCouple} pct={cmp.pctCouple} size="sm" />
            </div>
            <div className="bg-purple-500/10 border border-purple-400/20 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <ShoppingBag size={10} className="text-purple-400" />
                <span className="text-[8px] font-black uppercase tracking-widest text-purple-300/80">Individual</span>
              </div>
              <p className="text-xl font-black tracking-tight">{formatCurrency(totalIndividual)}</p>
              <DiffBadge diff={cmp.diffIndiv} pct={cmp.pctIndiv} size="sm" />
            </div>
          </div>

          {/* Barra proporcional */}
          {totalAtual > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[8px] font-black uppercase tracking-wider opacity-40">
                <span>Casal · {((totalCouple / totalAtual) * 100).toFixed(0)}%</span>
                <span>Individual · {((totalIndividual / totalAtual) * 100).toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(totalCouple / totalAtual) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }} className="h-full bg-blue-400" />
                <motion.div initial={{ width: 0 }} animate={{ width: `${(totalIndividual / totalAtual) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }} className="h-full bg-purple-400" />
              </div>
            </div>
          )}

          {/* Projeção para o mês */}
          {projectedTotal !== null && (
            <div className="mt-4 bg-white/8 border border-white/10 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={11} className="opacity-50" />
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-50">
                    Projeção para {format(currentDate, 'MMMM', { locale: ptBR })}
                  </span>
                </div>
                {prevTotalGeral > 0 && (
                  <div className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${
                    projectedTotal > prevTotalGeral
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {projectedTotal > prevTotalGeral ? '+' : ''}
                    {(((projectedTotal - prevTotalGeral) / prevTotalGeral) * 100).toFixed(0)}% vs anterior
                  </div>
                )}
              </div>
              <p className="text-2xl font-black tracking-tighter">{formatCurrency(projectedTotal)}</p>
              <p className="text-[9px] opacity-30 font-bold">
                {daysElapsed} de {daysInMonth} dias · base: média dos últimos 7 dias
              </p>
            </div>
          )}
        </div>
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* ── Orçamento mensal total ─────────────────────────────────────────── */}
      {totalBudget > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 p-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isOverBudget
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : budgetUsedPct >= 80
                  ? 'bg-amber-100 dark:bg-amber-900/30'
                  : 'bg-emerald-100 dark:bg-emerald-900/30'
              }`}>
                <Target size={15} className={
                  isOverBudget
                    ? 'text-red-600 dark:text-red-400'
                    : budgetUsedPct >= 80
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                } />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Orçamento do Mês
              </p>
            </div>
            <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${
              isOverBudget
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : budgetUsedPct >= 80
                ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
            }`}>
              {budgetUsedPct.toFixed(0)}%
            </span>
          </div>

          {/* Valores */}
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-2xl font-black tracking-tighter text-slate-800 dark:text-white">
                {formatCurrency(totalAtual)}
              </p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5">gasto</p>
            </div>
            <div className="text-right">
              <p className="text-base font-black text-slate-400 dark:text-slate-500">
                {formatCurrency(totalBudget)}
              </p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5">orçamento total</p>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(budgetUsedPct, 100)}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                isOverBudget
                  ? 'bg-red-500'
                  : budgetUsedPct >= 80
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
            />
          </div>

          {/* Status */}
          <p className={`text-xs font-bold ${
            isOverBudget
              ? 'text-red-500 dark:text-red-400'
              : budgetUsedPct >= 80
              ? 'text-amber-500 dark:text-amber-400'
              : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            {isOverBudget
              ? `${formatCurrency(Math.abs(budgetRemaining))} acima do orçamento`
              : `${formatCurrency(budgetRemaining)} ainda disponíveis`}
          </p>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO PRINCIPAL — CASAL
          Borda azul lateral em todos os cards desta seção
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">

        {/* Cabeçalho da seção casal */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-blue-100 dark:bg-blue-900/40" />
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/60 rounded-2xl">
            <Heart size={13} className="text-blue-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">
              Gastos do Casal
            </span>
          </div>
          <div className="h-px flex-1 bg-blue-100 dark:bg-blue-900/40" />
        </div>

        {/* 2. Pizza categorias casal */}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border-l-4 border-l-blue-500 border border-white/80 dark:border-slate-700/50 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 transition-colors overflow-hidden"
          role="img" aria-label="Gastos por categoria do casal">
          <div className="p-6">
            <SectionHeader icon={<PieIcon size={13} />} label="Por categoria" sublabel="Categorias compartilhadas" accent="blue" />
            <div className="h-52 w-full">
              {chartDataCouple.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartDataCouple} innerRadius={52} outerRadius={72} paddingAngle={4} dataKey="value" isAnimationActive>
                      {chartDataCouple.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: 'none', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-300 py-10 text-sm italic">Sem dados</p>
              )}
            </div>
            {chartDataCouple.length > 0 && (
              <div className="mt-3 space-y-2">
                {[...chartDataCouple].sort((a, b) => b.value - a.value).map((d) => (
                  <div key={d.name} className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex-1 truncate">{d.name}</span>
                    <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }}
                        animate={{ width: `${(d.value / totalCouple) * 100}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className="h-full rounded-full" style={{ backgroundColor: d.color }} />
                    </div>
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 shrink-0 w-20 text-right">{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. Gastos por pessoa */}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border-l-4 border-l-blue-500 border border-white/80 dark:border-slate-700/50 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 transition-colors overflow-hidden"
          role="img" aria-label="Gastos por pessoa">
          <div className="p-6">
            <SectionHeader icon={<Users size={13} />} label="Quem gastou mais" sublabel="Participação de cada pessoa" accent="blue" />
            <div className="h-48 w-full">
              {userTotals.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={userTotals} innerRadius={56} outerRadius={76} paddingAngle={8} dataKey="value">
                      {userTotals.map((_, i) => <Cell key={i} fill={USER_COLORS[i % USER_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: 'none', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-300 py-10 text-sm">Sem dados</p>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {[...userTotals].sort((a, b) => b.value - a.value).map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <img src={item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}`}
                    className="w-8 h-8 rounded-full object-cover border-2 border-white dark:border-slate-700" alt={`Foto de ${item.name}`} loading="lazy" decoding="async" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex-1">{item.name.split(' ')[0]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-400 font-bold">
                      {totalCouple > 0 ? ((item.value / totalCouple) * 100).toFixed(0) : 0}%
                    </span>
                    <span className="font-black text-slate-900 dark:text-white text-sm">{formatCurrency(item.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Metas do casal */}
        {coupleGoals.length > 0 && (
          <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border-l-4 border-l-blue-500 border border-white/80 dark:border-slate-700/50 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 transition-colors overflow-hidden">
            <div className="p-6">
              <SectionHeader icon={<Target size={13} />} label="Metas do mês" sublabel="Acompanhamento por categoria" accent="blue" />
              {renderGoalList(coupleGoals)}
            </div>
          </div>
        )}

        {/* 5. Evolução anual */}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border-l-4 border-l-blue-500 border border-white/80 dark:border-slate-700/50 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 transition-colors overflow-hidden"
          role="img" aria-label="Evolução anual dos gastos">
          <div className="p-6">
            <SectionHeader icon={<BarChart3 size={13} />} label="Evolução anual" sublabel="Mês atual destacado" accent="blue" />
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={annualHighlighted}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: '#f8fafc08' }} contentStyle={{ borderRadius: '12px', border: 'none', fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                  <ReferenceLine
                    y={annualChartData.reduce((a, b) => a + b.total, 0) / (annualChartData.filter(d => d.total > 0).length || 1)}
                    stroke="#94a3b8" strokeDasharray="4 4"
                    label={{ value: 'média', position: 'insideTopRight', fontSize: 9, fill: '#94a3b8' }}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {annualHighlighted.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 6. Gastos por dia da semana */}
        {expenses.length > 0 && (
          <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border-l-4 border-l-blue-500 border border-white/80 dark:border-slate-700/50 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 transition-colors overflow-hidden"
            role="img" aria-label="Gastos por dia da semana">
            <div className="p-6">
              <SectionHeader icon={<BarChart3 size={13} />} label="Por dia da semana" sublabel="Dia mais movimentado destacado" accent="blue" />
              <div className="h-36 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekdayData} barCategoryGap="20%">
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip
                      cursor={{ fill: '#f8fafc08' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', fontSize: 12 }}
                      formatter={(v: number | undefined) => formatCurrency(v ?? 0)}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {weekdayData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center mt-2">
                Roxo = dia com maior gasto · {format(currentDate, 'MMMM', { locale: ptBR })}
              </p>
            </div>
          </div>
        )}

        {/* 7. Assistente IA */}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border-l-4 border-l-blue-500 border border-white/80 dark:border-slate-700/50 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 transition-colors overflow-hidden relative">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <SectionHeader icon={<Sparkles size={13} />} label="Assistente Gemini" sublabel="Análise inteligente dos seus gastos" accent="blue" />
              <div className="flex items-center gap-2 -mt-4">
                {aiAnalysis && (
                  <button onClick={clearAnalysis} aria-label="Limpar análise"
                    className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-xl active:scale-90 transition-all">
                    <X size={14} />
                  </button>
                )}
                <button onClick={handleGenerateAnalysis} disabled={loadingAI}
                  title={currentSavedAnalysis ? 'Regerar análise' : 'Analisar com IA'}
                  className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-90 disabled:opacity-50 transition-all">
                  {loadingAI ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                </button>
              </div>
            </div>
            <AnimatePresence mode="wait">
              {loadingAI ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2 py-2" aria-live="polite">
                  {[80, 60, 70].map((w, i) => (
                    <div key={i} className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full animate-pulse" style={{ width: `${w}%` }} />
                  ))}
                </motion.div>
              ) : displayedAnalysis ? (
                <motion.div key="result" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="pt-2" aria-live="polite">
                  {currentSavedAnalysis && !aiAnalysis && (
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                      <Clock size={9} />
                      Salvo em {currentSavedAnalysis.created_at ? format(parseISO(currentSavedAnalysis.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}
                    </p>
                  )}

                  {/* Conteúdo com clamp + fade quando colapsado */}
                  <div className={`relative overflow-hidden transition-all duration-300 ${isAnalysisExpanded ? '' : 'max-h-28'}`}>
                    <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed prose prose-slate dark:prose-invert max-w-none">
                      <ReactMarkdown components={mdComponents}>{displayedAnalysis}</ReactMarkdown>
                    </div>
                    {!isAnalysisExpanded && (
                      <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-white dark:from-slate-800 to-transparent pointer-events-none" />
                    )}
                  </div>

                  {/* Botão expandir / recolher */}
                  <button
                    onClick={() => setIsAnalysisExpanded(v => !v)}
                    className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-500 active:opacity-70 transition-opacity"
                  >
                    <ChevronDown size={12} className={`transition-transform duration-200 ${isAnalysisExpanded ? 'rotate-180' : ''}`} />
                    {isAnalysisExpanded ? 'Recolher' : 'Ver análise completa'}
                  </button>
                </motion.div>
              ) : (
                <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-slate-400 italic font-medium">
                  Toque no botão ✨ para analisar seus gastos com IA. O resultado fica salvo para consultas futuras.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        </div>
      </div>

      {/* ── Histórico de análises salvas ─────────────────────────────── */}
      <AnalysisHistory analyses={aiAnalyses} currentMonthKey={currentMonthKey} />

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO SECUNDÁRIA — GASTOS INDIVIDUAIS (eventuais, sem meta)
      ══════════════════════════════════════════════════════════════════════ */}
      {individualByPerson.length > 0 && (
        <div className="space-y-4">

          {/* Divisor + cabeçalho individual */}
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl">
              <ShoppingBag size={13} className="text-purple-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Gastos Individuais
              </span>
              <span className="text-[9px] font-bold text-purple-500 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-lg">
                {formatCurrency(totalIndividual)}
              </span>
            </div>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Explicação */}
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-center px-4">
            Gastos eventuais · presentes · roupas · ocasiões pessoais
          </p>

          {/* Card por pessoa */}
          {individualByPerson.map((person) => (
            <div key={person.userId}
              className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border border-white/80 dark:border-slate-700/50 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 overflow-hidden transition-colors">

              {/* Header: avatar + nome + total */}
              <div className="flex items-center justify-between p-5 pb-3">
                <div className="flex items-center gap-3">
                  <img
                    src={person.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}&background=8b5cf6&color=fff`}
                    alt={`Foto de ${person.name}`}
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-purple-100 dark:border-purple-900/50"
                  />
                  <div>
                    <p className="font-black text-sm uppercase tracking-tight text-slate-800 dark:text-white">
                      {person.name.split(' ')[0]}
                    </p>
                    <p className="text-[9px] text-purple-500 font-bold uppercase tracking-widest mt-0.5">
                      {person.recentExpenses.length} gasto{person.recentExpenses.length !== 1 ? 's' : ''} este mês
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-xl text-slate-900 dark:text-white tracking-tight">
                    {formatCurrency(person.total)}
                  </p>
                  {totalIndividual > 0 && (
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                      {((person.total / totalIndividual) * 100).toFixed(0)}% do individual
                    </p>
                  )}
                </div>
              </div>

              {/* Resumo por categoria (pills) */}
              {person.categories.length > 0 && (
                <div className="px-5 pb-3 flex flex-wrap gap-2">
                  {[...person.categories].sort((a, b) => b.value - a.value).map((cat) => (
                    <div key={cat.name}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wide"
                      style={{ backgroundColor: cat.color + '18', color: cat.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name} · {formatCurrency(cat.value)}
                    </div>
                  ))}
                </div>
              )}

              {/* Divisor */}
              <div className="h-px bg-slate-100 dark:bg-slate-700 mx-5" />

              {/* Lista de gastos recentes */}
              <div className="p-5 pt-4 space-y-2">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600 mb-3">
                  Últimos gastos
                </p>
                {person.recentExpenses.map((exp, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-1 h-full min-h-[16px] rounded-full bg-purple-200 dark:bg-purple-800/50 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
                          {exp.description}
                        </p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wide">
                          {exp.category} · {formatRelativeDate(exp.date)}
                        </p>
                      </div>
                    </div>
                    <span className="font-black text-[11px] text-slate-800 dark:text-slate-200 shrink-0">
                      {formatCurrency(exp.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}