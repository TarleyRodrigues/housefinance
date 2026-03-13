// ─── ABA: GRÁFICOS / ESTATÍSTICAS ────────────────────────────────────────────
// Melhorias aplicadas:
// ✅ useMemo em chartData, userTotals e categoryGoals (performance)
// ✅ Tipos corretos — zero `any` (qualidade)
// ✅ Card comparativo com mês anterior — prevMonthExpenses usado (UX 🔥)
// ✅ Mês atual destacado no gráfico anual (UX)
// ✅ Categorias sem meta filtradas ou sinalizadas (UX)
// ✅ Prompt da IA enriquecido com comparativo (via hook)
// ✅ alert() substituído por mensagem inline (UX)
// ✅ Lógica Gemini extraída para useGeminiAnalysis (arquitetura)
// ✅ aria-label em gráficos e imagens (acessibilidade)
// ✅ showToast adicionado às props (consistência)
// ✅ Cores das categorias definidas em TabAjustes usadas nos gráficos (consistência 🔥)
// ✅ Gráfico de pizza por categoria com cores personalizadas
// ✅ Legenda com cor real da categoria
// ✅ Metas com barra colorida por categoria
// ✅ CHART_COLORS usado apenas como fallback quando categoria não tem cor

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Loader2, BarChart3, Users, PieChart as PieIcon,
  Target, TrendingUp, TrendingDown, Minus, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, ReferenceLine,
} from 'recharts';
import { formatCurrency, CHART_COLORS, USER_COLORS } from '../utils';
import { useGeminiAnalysis } from '../hooks/useGeminiAnalysis';
import type { Expense, Category } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos locais
// ─────────────────────────────────────────────────────────────────────────────
interface UserTotal {
  name: string;
  avatar?: string;
  value: number;
}

// chartData estende Category com a cor resolvida (própria ou fallback)
interface CategoryChartEntry {
  name: string;
  value: number;
  color: string; // cor real da categoria ou CHART_COLORS[i] como fallback
}

interface Props {
  expenses: Expense[];
  prevMonthExpenses: Expense[];
  categories: Category[];
  annualChartData: { name: string; total: number }[];
  currentDate: Date;
  showToast: (msg: string, type?: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function TabGraficos({
  expenses,
  prevMonthExpenses,
  categories,
  annualChartData,
  currentDate,
  showToast,
}: Props) {

  // ── Hook da IA ────────────────────────────────────────────────────────────
  const { aiAnalysis, loadingAI, generateAnalysis, clearAnalysis } = useGeminiAnalysis({
    expenses,
    prevMonthExpenses,
    currentDate,
  });

  // ── Dados memoizados ──────────────────────────────────────────────────────

  // ✅ Gráfico de pizza por categoria — cor real da categoria ou CHART_COLORS como fallback
  const chartData = useMemo<CategoryChartEntry[]>(
    () =>
      categories
        .map((cat, i) => ({
          name: cat.name,
          value: expenses
            .filter((e) => e.category_name === cat.name)
            .reduce((acc, curr) => acc + Number(curr.amount), 0),
          // usa cor definida em Ajustes, senão CHART_COLORS por índice
          color: cat.color ?? CHART_COLORS[i % CHART_COLORS.length],
        }))
        .filter((d) => d.value > 0),
    [categories, expenses]
  );

  // Gráfico de pizza por usuário — tipado corretamente
  const userTotals = useMemo(
    () =>
      Object.values(
        expenses.reduce<Record<string, UserTotal>>((acc, curr) => {
          const uid = curr.user_id;
          if (!acc[uid]) {
            acc[uid] = {
              name: curr.profiles?.full_name ?? 'Usuário',
              avatar: curr.profiles?.avatar_url,
              value: 0,
            };
          }
          acc[uid].value += Number(curr.amount);
          return acc;
        }, {})
      ),
    [expenses]
  );

  // ✅ Comparativo com mês anterior
  const monthComparison = useMemo(() => {
    const totalAtual = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
    const totalAnterior = prevMonthExpenses.reduce((acc, e) => acc + Number(e.amount), 0);
    const diff = totalAtual - totalAnterior;
    const percent = totalAnterior > 0 ? (diff / totalAnterior) * 100 : null;
    return { totalAtual, totalAnterior, diff, percent };
  }, [expenses, prevMonthExpenses]);

  // ✅ Metas — filtra categorias sem meta e sem gastos, inclui cor
  const categoryGoals = useMemo(
    () =>
      categories
        .map((cat, i) => {
          const total = expenses
            .filter((e) => e.category_name === cat.name)
            .reduce((acc, curr) => acc + Number(curr.amount), 0);
          const meta = Number(cat.monthly_goal) || 0;
          const color = cat.color ?? CHART_COLORS[i % CHART_COLORS.length];
          return { cat, total, meta, color };
        })
        .filter(({ total, meta }) => total > 0 || meta > 0),
    [categories, expenses]
  );

  // ✅ Gráfico anual — destaca o mês atual com cor diferente
  const currentMonthName = format(currentDate, 'MMM', { locale: ptBR });
  const annualChartDataHighlighted = useMemo(
    () =>
      annualChartData.map((d) => ({
        ...d,
        fill: d.name.toLowerCase() === currentMonthName.toLowerCase() ? '#6366f1' : '#3b82f6',
      })),
    [annualChartData, currentMonthName]
  );

  // ── Handler da IA com fallback de toast ───────────────────────────────────
  const handleGenerateAnalysis = async () => {
    if (expenses.length === 0) {
      showToast('Lance alguns gastos primeiro!', 'info');
      return;
    }
    await generateAnalysis();
  };

  return (
    <div className="space-y-6 pb-10 px-1">

      {/* ── 1. CARD COMPARATIVO COM MÊS ANTERIOR (NOVO 🔥) ──────────────────── */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-800 dark:to-slate-950 p-6 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 block mb-3">
            Comparativo — {format(currentDate, 'MMMM', { locale: ptBR })} vs anterior
          </span>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-4xl font-black tracking-tighter">
                {formatCurrency(monthComparison.totalAtual)}
              </p>
              <p className="text-[10px] text-white/40 font-bold mt-1 uppercase tracking-widest">
                Mês atual
              </p>
            </div>

            {/* Badge de variação */}
            {monthComparison.percent !== null ? (
              <div
                className={`flex flex-col items-end gap-1`}
                aria-label={`${Math.abs(monthComparison.percent).toFixed(1)}% ${monthComparison.diff > 0 ? 'a mais' : 'a menos'} que o mês anterior`}
              >
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black ${
                  monthComparison.diff > 0
                    ? 'bg-red-500/20 text-red-300'
                    : monthComparison.diff < 0
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-white/10 text-white/50'
                }`}>
                  {monthComparison.diff > 0
                    ? <TrendingUp size={12} aria-hidden="true" />
                    : monthComparison.diff < 0
                    ? <TrendingDown size={12} aria-hidden="true" />
                    : <Minus size={12} aria-hidden="true" />}
                  {Math.abs(monthComparison.percent).toFixed(1)}%
                </div>
                <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider">
                  vs {formatCurrency(monthComparison.totalAnterior)}
                </span>
              </div>
            ) : (
              <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider">
                Sem dados anteriores
              </span>
            )}
          </div>

          {/* Barra visual de comparação */}
          {monthComparison.totalAnterior > 0 && (
            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-[9px] font-black uppercase tracking-wider opacity-40">
                <span>Este mês</span>
                <span>Mês anterior</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(
                      (monthComparison.totalAtual / Math.max(monthComparison.totalAtual, monthComparison.totalAnterior)) * 100,
                      100
                    )}%`,
                  }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${monthComparison.diff > 0 ? 'bg-red-400' : 'bg-emerald-400'}`}
                />
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(
                      (monthComparison.totalAnterior / Math.max(monthComparison.totalAtual, monthComparison.totalAnterior)) * 100,
                      100
                    )}%`,
                  }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                  className="h-full rounded-full bg-white/30"
                />
              </div>
            </div>
          )}
        </div>
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      </div>

      {/* ── 2. ASSISTENTE IA ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden relative transition-colors">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black uppercase tracking-tighter text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <Sparkles size={16} aria-hidden="true" /> Assistente Gemini
          </h3>
          <div className="flex items-center gap-2">
            {aiAnalysis && (
              <button
                onClick={clearAnalysis}
                aria-label="Limpar análise da IA"
                className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-xl active:scale-90 transition-all"
              >
                <X size={14} />
              </button>
            )}
            <button
              onClick={handleGenerateAnalysis}
              disabled={loadingAI}
              aria-label={loadingAI ? 'Gerando análise...' : 'Gerar análise com Gemini'}
              className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-90 disabled:opacity-50 transition-all"
            >
              {loadingAI
                ? <Loader2 className="animate-spin" size={20} aria-hidden="true" />
                : <Sparkles size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {loadingAI ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2 py-2"
              aria-live="polite"
              aria-label="Gerando análise"
            >
              {[80, 60, 70].map((w, i) => (
                <div
                  key={i}
                  className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full animate-pulse"
                  style={{ width: `${w}%` }}
                />
              ))}
            </motion.div>
          ) : aiAnalysis ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed prose prose-slate dark:prose-invert max-w-none pt-2"
              aria-live="polite"
            >
              <ReactMarkdown
                components={{
                  strong: ({ node, ...props }) => (
                    <span className="font-black text-blue-600 dark:text-blue-400" {...props} />
                  ),
                  p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                  h2: ({ node, ...props }) => (
                    <h2 className="text-base font-black text-slate-800 dark:text-white mt-4 mb-2 uppercase tracking-tighter" {...props} />
                  ),
                  li: ({ node, ...props }) => <li className="ml-4 list-disc" {...props} />,
                }}
              >
                {aiAnalysis}
              </ReactMarkdown>
            </motion.div>
          ) : (
            <motion.p
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-slate-400 italic font-medium"
            >
              Toque no botão para analisar seus gastos com IA — inclui comparativo com o mês anterior.
            </motion.p>
          )}
        </AnimatePresence>

        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      </div>

      {/* ── 3. EVOLUÇÃO ANUAL ─────────────────────────────────────────────────── */}
      <div
        className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors"
        role="img"
        aria-label="Gráfico de evolução anual dos gastos"
      >
        <h3 className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest flex items-center gap-2">
          <BarChart3 size={14} aria-hidden="true" /> Evolução Anual
        </h3>
        {/* ✅ Legenda do destaque */}
        <p className="text-[9px] text-indigo-500 font-black uppercase tracking-widest mb-4">
          ● Mês atual destacado
        </p>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={annualChartDataHighlighted}>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc08' }}
                contentStyle={{ borderRadius: '12px', border: 'none', fontSize: 12 }}
                formatter={(v: number) => formatCurrency(v)}
              />
              {/* ✅ Linha de referência com a média */}
              <ReferenceLine
                y={annualChartData.reduce((a, b) => a + b.total, 0) / (annualChartData.filter(d => d.total > 0).length || 1)}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                label={{ value: 'média', position: 'insideTopRight', fontSize: 9, fill: '#94a3b8' }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {annualChartDataHighlighted.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 4. GASTOS POR PESSOA ──────────────────────────────────────────────── */}
      <div
        className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors"
        role="img"
        aria-label="Distribuição de gastos por pessoa"
      >
        <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2">
          <Users size={14} aria-hidden="true" /> Gastos por Pessoa
        </h3>
        <div className="h-56 w-full">
          {userTotals.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={userTotals}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {userTotals.map((_, i) => (
                    <Cell key={i} fill={USER_COLORS[i % USER_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-slate-300 py-10 text-sm">Sem dados</p>
          )}
        </div>
        <div className="mt-4 space-y-3">
          {userTotals.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <img
                  src={item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}`}
                  className="w-8 h-8 rounded-full object-cover border-2 border-white dark:border-slate-700"
                  alt={`Foto de ${item.name}`} // ✅ alt descritivo
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest leading-none">
                  {item.name.split(' ')[0]}
                </span>
              </div>
              <span className="font-black text-slate-900 dark:text-white text-sm">
                {formatCurrency(item.value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. GASTOS POR CATEGORIA ───────────────────────────────────────────── */}
      <div
        className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors"
        role="img"
        aria-label="Distribuição de gastos por categoria"
      >
        <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2">
          <PieIcon size={14} aria-hidden="true" /> Gastos por Categoria
        </h3>
        <div className="h-56 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  isAnimationActive
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-slate-300 py-10 text-sm italic">Sem dados</p>
          )}
        </div>
        {/* ✅ Legenda com cor real de cada categoria */}
        {chartData.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {chartData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ background: d.color }}
                  aria-hidden="true"
                />
                {d.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 6. METAS DO MÊS ──────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
        <h3 className="text-[10px] font-bold text-slate-400 mb-6 uppercase tracking-widest flex items-center gap-2">
          <Target size={14} aria-hidden="true" /> Metas do Mês
        </h3>

        {categoryGoals.length === 0 ? (
          <p className="text-center text-slate-300 py-6 text-xs font-bold uppercase tracking-widest">
            Nenhuma categoria com meta definida
          </p>
        ) : (
          <div className="space-y-6">
            {categoryGoals.map(({ cat, total, meta, color }) => {
              const barMax = Math.max(total, meta);
              const filledWidth = barMax > 0 ? (Math.min(total, meta) / barMax) * 100 : 0;
              const overflowWidth = barMax > 0 && total > meta ? ((total - meta) / barMax) * 100 : 0;
              const isOver = meta > 0 && total > meta;
              const hasMeta = meta > 0;
              const percentUsed = hasMeta ? Math.min((total / meta) * 100, 100) : null;

              return (
                <div
                  key={cat.id}
                  className="space-y-1.5"
                  role="meter"
                  aria-label={`${cat.name}: ${formatCurrency(total)} de ${formatCurrency(meta)}`}
                  aria-valuenow={total}
                  aria-valuemax={meta || undefined}
                >
                  <div className="flex justify-between items-center">
                    {/* ✅ Nome da categoria com bolinha colorida */}
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {percentUsed !== null && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg ${
                          isOver
                            ? 'bg-red-50 dark:bg-red-900/30 text-red-500'
                            : percentUsed >= 80
                            ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-500'
                            : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500'
                        }`}>
                          {percentUsed.toFixed(0)}%
                        </span>
                      )}
                      <span className={`text-[11px] font-bold ${isOver ? 'text-red-500' : 'text-slate-400'}`}>
                        {formatCurrency(total)}
                        {hasMeta && (
                          <span className="text-slate-400 font-black"> / {formatCurrency(meta)}</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {hasMeta ? (
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                      {/* ✅ Barra preenchida com a cor da categoria */}
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${filledWidth}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className="h-full"
                        style={{ backgroundColor: color }}
                      />
                      {/* Overflow em vermelho quando ultrapassa a meta */}
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${overflowWidth}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                        className="h-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        {/* ✅ Barra sem meta também usa a cor da categoria */}
                        <div className="h-full w-full opacity-30" style={{ backgroundColor: color }} />
                      </div>
                      <span className="text-[8px] font-black uppercase text-slate-300 dark:text-slate-600 whitespace-nowrap">
                        Sem meta
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}