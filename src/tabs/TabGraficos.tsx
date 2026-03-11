// ─── ABA: GRÁFICOS / ESTATÍSTICAS ───────────────────────────────────────────

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, BarChart3, Users, PieChart as PieIcon, Target } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis } from 'recharts';
import { formatCurrency, CHART_COLORS, USER_COLORS } from '../utils';
import type { Expense, Category } from '../types';

// ⚠️  Mova para variável de ambiente (.env) em produção
const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY;

interface Props {
  expenses: Expense[];
  prevMonthExpenses: Expense[]; // <-- ADICIONE ESTA LINHA
  categories: Category[];
  annualChartData: { name: string; total: number }[];
  currentDate: Date;
}

export function TabGraficos({ 
  expenses, 
  prevMonthExpenses, // <-- ADICIONE ESTA LINHA
  categories, 
  annualChartData, 
  currentDate 
}: Props) {
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // ── Dados dos gráficos ────────────────────────────────────────────────────
  const chartData = categories
    .map((cat) => ({
      name: cat.name,
      value: expenses.filter((e) => e.category_name === cat.name).reduce((acc, curr) => acc + Number(curr.amount), 0),
    }))
    .filter((d) => d.value > 0);

  const userTotals = Object.values(
    expenses.reduce((acc: any, curr: any) => {
      const uid = curr.user_id;
      if (!acc[uid]) acc[uid] = { name: curr.profiles?.full_name || 'Usuário', avatar: curr.profiles?.avatar_url, value: 0 };
      acc[uid].value += Number(curr.amount);
      return acc;
    }, {})
  ) as { name: string; avatar?: string; value: number }[];

  // ── Gemini ────────────────────────────────────────────────────────────────
  const generateAIAnalysis = async () => {
    if (expenses.length === 0) return alert('Lance alguns gastos primeiro!');
    setLoadingAI(true);
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const gastosTxt = expenses.map((e) => `${e.category_name}: ${formatCurrency(e.amount)}`).join(', ');
      const prompt = `Analise os gastos de ${format(currentDate, 'MMMM yyyy', { locale: ptBR })}. Gastos: ${gastosTxt}. Dê uma dica curta e motivadora de economia em até 3 linhas.`;
      const result = await model.generateContent(prompt);
      setAiAnalysis(result.response.text());
    } catch (err: any) {
      if (err?.message?.includes('429')) setAiAnalysis('⏳ Limite atingido. Aguarde alguns minutos.');
      else if (err?.message?.includes('503')) setAiAnalysis('🔄 Servidores sobrecarregados. Tente novamente.');
      else setAiAnalysis('Erro: ' + err.message);
    }
    setLoadingAI(false);
  };

  return (
    <div className="space-y-6 pb-10 px-1">
      {/* Assistente IA */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden relative transition-colors">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black uppercase tracking-tighter text-blue-600 flex items-center gap-2">
            <Sparkles size={16} /> Assistente Gemini
          </h3>
          <button onClick={generateAIAnalysis} disabled={loadingAI} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-90 disabled:opacity-50 transition-all">
            {loadingAI ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
          </button>
        </div>
        {/* CARD DA IA COM RENDERIZAÇÃO MELHORADA */}
<AnimatePresence mode="wait">
  {aiAnalysis ? (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed prose prose-slate dark:prose-invert max-w-none pt-2"
    >
      <ReactMarkdown
        components={{
          strong: ({node, ...props}) => <span className="font-black text-blue-600 dark:text-blue-400" {...props} />,
          p: ({node, ...props}) => <p className="mb-2" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-base font-black text-slate-800 dark:text-white mt-4 mb-2 uppercase tracking-tighter" {...props} />,
          li: ({node, ...props}) => <li className="ml-4 list-disc" {...props} />
        }}
      >
        {aiAnalysis}
      </ReactMarkdown>
    </motion.div>
  ) : (
    <p className="text-xs text-slate-400 italic font-medium">IA pronta para analisar seus gastos!</p>
  )}
</AnimatePresence>
        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Evolução anual */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
        <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2">
          <BarChart3 size={14} /> Evolução Anual
        </h3>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={annualChartData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
              <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gastos por pessoa */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
        <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2">
          <Users size={14} /> Gastos por Pessoa
        </h3>
        <div className="h-56 w-full">
          {expenses.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={userTotals} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value">
                  {userTotals.map((_, i) => <Cell key={i} fill={USER_COLORS[i % USER_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-slate-300 py-10 text-sm">Sem dados</p>}
        </div>
        <div className="mt-4 space-y-3">
          {userTotals.map((item, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 transition-colors">
              <div className="flex items-center gap-3">
                <img src={item.avatar || `https://ui-avatars.com/api/?name=${item.name}`} className="w-8 h-8 rounded-full object-cover border-2 border-white dark:border-slate-700" alt="" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest leading-none">{item.name.split(' ')[0]}</span>
              </div>
              <span className="font-black text-slate-900 dark:text-white text-sm">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gastos por categoria */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
        <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2">
          <PieIcon size={14} /> Gastos por Categoria
        </h3>
        <div className="h-56 w-full">
          {expenses.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" isAnimationActive>
                  {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-slate-300 py-10 text-sm italic">Sem dados</p>}
        </div>
      </div>

      {/* Metas do mês */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
        <h3 className="text-[10px] font-bold text-slate-400 mb-6 uppercase tracking-widest flex items-center gap-2">
          <Target size={14} /> Metas do Mês
        </h3>
        <div className="space-y-6">
          {categories.map((cat) => {
            const total = expenses.filter((e) => e.category_name === cat.name).reduce((acc, curr) => acc + Number(curr.amount), 0);
            const meta = Number(cat.monthly_goal) || 0;
            const barMax = Math.max(total, meta);
            const blueWidth = barMax > 0 ? (Math.min(total, meta) / barMax) * 100 : 0;
            const redWidth = barMax > 0 && total > meta ? ((total - meta) / barMax) * 100 : 0;
            const isOver = meta > 0 && total > meta;
            return (
              <div key={cat.id} className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-slate-700 dark:text-slate-300">{cat.name}</span>
                  <span className={isOver ? 'text-red-500' : 'text-slate-400'}>
                    {formatCurrency(total)} / <span className="text-slate-500 font-black">{formatCurrency(meta)}</span>
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                  <div className={`h-full transition-all duration-700 ${total >= meta && meta > 0 ? 'bg-blue-600' : 'bg-blue-400'}`} style={{ width: `${blueWidth}%` }} />
                  <div className="h-full bg-red-500 transition-all duration-700 shadow-[0_0_8px_rgba(239,68,68,0.4)]" style={{ width: `${redWidth}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
