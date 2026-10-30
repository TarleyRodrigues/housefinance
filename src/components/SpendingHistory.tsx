// ─── HISTÓRICO MENSAL POR CATEGORIA / ESTABELECIMENTO ────────────────────────
// ✅ Escolhe uma categoria ou estabelecimento e vê o total de cada mês (12 meses)
// ✅ Variação mês a mês (↑ gastou mais / ↓ gastou menos) + média e maior mês
// ✅ Toque no mês para ver os gastos que compõem o total
// Componente burro: recebe os gastos já carregados pelo useDashboardData

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, Tag, Store, TrendingUp, TrendingDown, Minus, ChevronDown } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, ReferenceLine, Cell } from 'recharts';
import { format, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency, HISTORY_MONTHS } from '../utils';
import type { Category, HistoryExpense } from '../types';

type Mode = 'category' | 'merchant';

interface Props {
  historyExpenses: HistoryExpense[];
  categories: Category[];
  currentDate: Date;
  isLoading: boolean;
}

interface Option { key: string; label: string; total: number; count: number; }

interface MonthRow {
  key: string;        // yyyy-MM
  short: string;      // "Out"
  long: string;       // "Outubro 2026"
  total: number;
  items: HistoryExpense[];
  diff: number | null; // vs mês anterior (null = sem mês anterior no período)
  pct: number | null;
}

// Mês efetivo: fatura do crédito (payment_month) ou mês da data do gasto
const effectiveMonth = (e: HistoryExpense) => e.payment_month ?? e.expense_date?.slice(0, 7) ?? e.created_at.slice(0, 7);
const merchantKey = (name: string) => name.trim().toLowerCase();
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function SpendingHistory({ historyExpenses, categories, currentDate, isLoading }: Props) {
  const [mode, setMode] = useState<Mode>('category');
  const [selected, setSelected] = useState<Record<Mode, string>>({ category: '', merchant: '' });
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  const colorByCategory = useMemo(
    () => new Map(categories.map((c) => [c.name, c.color ?? '#3b82f6'])),
    [categories],
  );

  // Opções do seletor, ordenadas pelo total gasto no período
  const options = useMemo(() => {
    const map = new Map<string, Option & { spellings: Map<string, number> }>();
    for (const e of historyExpenses) {
      const raw = mode === 'category' ? e.category_name : e.merchant?.trim();
      if (!raw) continue;
      const key = mode === 'category' ? raw : merchantKey(raw);
      const opt = map.get(key) ?? { key, label: raw, total: 0, count: 0, spellings: new Map() };
      opt.total += Number(e.amount);
      opt.count += 1;
      opt.spellings.set(raw, (opt.spellings.get(raw) ?? 0) + 1);
      map.set(key, opt);
    }
    return [...map.values()]
      .map(({ spellings, ...o }) => ({
        ...o,
        // Estabelecimento: exibe a grafia mais usada ("Mercado Extra" vs "mercado extra")
        label: [...spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
      }))
      .sort((a, b) => b.total - a.total);
  }, [historyExpenses, mode]);

  const activeKey = options.some((o) => o.key === selected[mode]) ? selected[mode] : options[0]?.key ?? '';
  const activeOption = options.find((o) => o.key === activeKey);

  const months = useMemo<MonthRow[]>(() => {
    const filtered = historyExpenses.filter((e) =>
      mode === 'category'
        ? e.category_name === activeKey
        : !!e.merchant && merchantKey(e.merchant) === activeKey,
    );
    const rows: MonthRow[] = [];
    for (let i = HISTORY_MONTHS - 1; i >= 0; i--) {
      const d = subMonths(currentDate, i);
      const key = format(d, 'yyyy-MM');
      const items = filtered
        .filter((e) => effectiveMonth(e) === key)
        .sort((a, b) => (b.expense_date ?? '').localeCompare(a.expense_date ?? ''));
      const total = items.reduce((acc, e) => acc + Number(e.amount), 0);
      const prev = rows[rows.length - 1];
      const diff = prev ? total - prev.total : null;
      rows.push({
        key,
        short: capitalize(format(d, 'MMM', { locale: ptBR })).replace('.', ''),
        long: capitalize(format(d, 'MMMM yyyy', { locale: ptBR })),
        total, items, diff,
        pct: prev && prev.total > 0 && diff !== null ? (diff / prev.total) * 100 : null,
      });
    }
    return rows;
  }, [historyExpenses, mode, activeKey, currentDate]);

  const stats = useMemo(() => {
    const withSpend = months.filter((m) => m.total > 0);
    const total = months.reduce((acc, m) => acc + m.total, 0);
    const peak = withSpend.reduce<MonthRow | null>((best, m) => (!best || m.total > best.total ? m : best), null);
    return { total, avg: withSpend.length ? total / withSpend.length : 0, peak, activeMonths: withSpend.length };
  }, [months]);

  const barColor = mode === 'category' ? colorByCategory.get(activeKey) ?? '#3b82f6' : '#f59e0b';
  const currentKey = format(currentDate, 'yyyy-MM');

  return (
    <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border border-white/80 dark:border-slate-700/50 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 transition-colors overflow-hidden">
      <div className="p-6 space-y-4">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <div className="w-1 h-10 rounded-full shrink-0 bg-indigo-500" />
          <div>
            <div className="flex items-center gap-2 font-black text-xs uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              <History size={13} /> Histórico mensal
            </div>
            <p className="text-[9px] font-bold mt-0.5 text-indigo-400/70 dark:text-indigo-500/70">
              Últimos {HISTORY_MONTHS} meses até {format(currentDate, 'MMM/yy', { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* Alternar Categoria / Estabelecimento */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-2xl">
          {([
            { id: 'category', label: 'Categoria', icon: Tag },
            { id: 'merchant', label: 'Estabelecimento', icon: Store },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setMode(id); setOpenMonth(null); }}
              aria-pressed={mode === id}
              className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                mode === id
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-400'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {isLoading && historyExpenses.length === 0 ? (
          <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-700/50 animate-pulse" />
        ) : options.length === 0 ? (
          <p className="text-center text-slate-400 py-8 text-xs font-medium">
            {mode === 'merchant'
              ? 'Nenhum gasto com estabelecimento informado no período.'
              : 'Nenhum gasto no período.'}
          </p>
        ) : (
          <>
            {/* Seletor */}
            <select
              value={activeKey}
              onChange={(e) => { setSelected((s) => ({ ...s, [mode]: e.target.value })); setOpenMonth(null); }}
              aria-label={mode === 'category' ? 'Escolher categoria' : 'Escolher estabelecimento'}
              className="w-full min-h-[44px] p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-sm outline-none font-bold text-slate-800 dark:text-slate-200 focus:border-indigo-400 dark:focus:border-indigo-600 transition-colors"
            >
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label} — {formatCurrency(o.total)}
                </option>
              ))}
            </select>

            {/* Resumo */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Total', value: formatCurrency(stats.total), sub: `${activeOption?.count ?? 0} gasto${activeOption?.count === 1 ? '' : 's'}` },
                { label: 'Média/mês', value: formatCurrency(stats.avg), sub: `${stats.activeMonths} ${stats.activeMonths === 1 ? 'mês' : 'meses'} c/ gasto` },
                { label: 'Maior mês', value: stats.peak ? formatCurrency(stats.peak.total) : '—', sub: stats.peak?.long ?? '' },
              ].map((s) => (
                <div key={s.label} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
                  <p className="text-xs font-black text-slate-800 dark:text-white mt-1 truncate">{s.value}</p>
                  <p className="text-[8px] font-bold text-slate-400 mt-0.5 truncate">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Gráfico */}
            <div className="h-40 w-full" role="img" aria-label={`Gasto mensal com ${activeOption?.label ?? ''}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months}>
                  <XAxis dataKey="short" axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc08' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', fontSize: 12 }}
                    formatter={(v: number) => formatCurrency(v)}
                    labelFormatter={(_, payload) => (payload?.[0]?.payload as MonthRow | undefined)?.long ?? ''}
                  />
                  {stats.avg > 0 && (
                    <ReferenceLine y={stats.avg} stroke="#94a3b8" strokeDasharray="4 4"
                      label={{ value: 'média', position: 'insideTopRight', fontSize: 9, fill: '#94a3b8' }} />
                  )}
                  <Bar dataKey="total" name="Total" radius={[4, 4, 0, 0]}>
                    {months.map((m) => (
                      <Cell key={m.key} fill={barColor} fillOpacity={m.key === currentKey ? 1 : 0.45} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Lista mês a mês (mais recente primeiro) */}
            <div className="space-y-2">
              {[...months].reverse().map((m) => {
                const isOpen = openMonth === m.key;
                const up = m.diff !== null && m.diff > 0.009;
                const down = m.diff !== null && m.diff < -0.009;
                const TrendIcon = up ? TrendingUp : down ? TrendingDown : Minus;
                return (
                  <div key={m.key} className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenMonth(isOpen ? null : m.key)}
                      disabled={m.items.length === 0}
                      aria-expanded={isOpen}
                      className="w-full min-h-[44px] flex items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-black ${m.key === currentKey ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}>
                          {m.long}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                          {m.items.length === 0 ? 'Sem gastos' : `${m.items.length} gasto${m.items.length === 1 ? '' : 's'}`}
                        </p>
                      </div>
                      {m.diff !== null && (
                        <span className={`flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-lg ${
                          up   ? 'bg-red-50 dark:bg-red-900/20 text-red-500'
                          : down ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>
                          <TrendIcon size={10} />
                          {m.pct !== null
                            ? `${m.pct > 0 ? '+' : ''}${m.pct.toFixed(0)}%`
                            : up ? 'novo' : down ? '-100%' : '0%'}
                        </span>
                      )}
                      <span className="text-sm font-black text-slate-900 dark:text-white w-24 text-right shrink-0">
                        {formatCurrency(m.total)}
                      </span>
                      <ChevronDown
                        size={14}
                        className={`shrink-0 transition-transform ${m.items.length === 0 ? 'opacity-0' : 'text-slate-400'} ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-3 space-y-1.5 border-t border-slate-100 dark:border-slate-700 pt-3">
                            {m.items.map((e) => (
                              <div key={e.id} className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                    {e.description || 'Gasto sem descrição'}
                                  </p>
                                  <p className="text-[9px] font-medium text-slate-400 truncate">
                                    {e.expense_date ? format(parseISO(e.expense_date), "dd/MM/yy") : ''}
                                    {mode === 'category' ? (e.merchant ? ` · ${e.merchant}` : '') : ` · ${e.category_name}`}
                                    {e.payment_month ? ' · crédito' : ''}
                                  </p>
                                </div>
                                <span className="text-xs font-black text-slate-700 dark:text-slate-200 shrink-0">
                                  {formatCurrency(Number(e.amount))}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
