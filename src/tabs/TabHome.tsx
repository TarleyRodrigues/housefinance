// ─── ABA: HOME — hub central do app ──────────────────────────────────────────

import { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Bell, ShoppingCart, Target, TrendingUp, TrendingDown, Minus,
  ArrowRight, Repeat2, Scale, Film, Tv, Bookmark, Play,
  FileText, Star,
} from 'lucide-react';
import { format, isBefore, parseISO, isToday as dateFnsIsToday, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SkeletonCard } from '../components/ui';
import { formatCurrency } from '../utils';
import type { Expense, Category, Reminder, ShoppingItem, Dream, RecurringExpense, WatchlistItem, Note } from '../types';

const TMDB_W92 = 'https://image.tmdb.org/t/p/w92';

interface Props {
  expenses: Expense[];
  prevMonthExpenses: Expense[];
  categories: Category[];
  reminders: Reminder[];
  shoppingList: ShoppingItem[];
  dreams: Dream[];
  recurringExpenses: RecurringExpense[];
  watchlistItems: WatchlistItem[];
  notes: Note[];
  currentDate: Date;
  isLoading: boolean;
  onNavigate: (tab: string) => void;
}

export function TabHome({
  expenses, prevMonthExpenses, categories, reminders,
  shoppingList, dreams, recurringExpenses,
  watchlistItems, notes,
  currentDate, isLoading, onNavigate,
}: Props) {
  const today = startOfToday();

  const totalMonth = useMemo(() =>
    expenses.reduce((a, e) => a + Number(e.amount), 0), [expenses]);

  const prevTotal = useMemo(() =>
    prevMonthExpenses.reduce((a, e) => a + Number(e.amount), 0), [prevMonthExpenses]);

  const diff = prevTotal > 0 ? ((totalMonth - prevTotal) / prevTotal) * 100 : null;

  const daysElapsed = useMemo(() => {
    const t = new Date();
    const isCurrent = t.getMonth() === currentDate.getMonth() && t.getFullYear() === currentDate.getFullYear();
    return isCurrent
      ? Math.max(t.getDate(), 1)
      : new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  }, [currentDate]);

  const dailyAvg = totalMonth > 0 ? totalMonth / daysElapsed : 0;

  const topGoals = useMemo(() =>
    categories
      .filter(c => (c.monthly_goal ?? 0) > 0)
      .map(c => {
        const spent = expenses
          .filter(e => e.category_name === c.name)
          .reduce((a, e) => a + Number(e.amount), 0);
        const pct = Math.min((spent / c.monthly_goal!) * 100, 100);
        return { ...c, spent, pct };
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3),
  [expenses, categories]);

  const upcomingReminders = useMemo(() =>
    [...reminders]
      .filter(r => !isBefore(parseISO(r.reminder_date), today))
      .sort((a, b) => new Date(a.reminder_date).getTime() - new Date(b.reminder_date).getTime())
      .slice(0, 3),
  [reminders, today]);

  const hasReminderToday = useMemo(() =>
    upcomingReminders.some(r => dateFnsIsToday(parseISO(r.reminder_date))),
  [upcomingReminders]);

  const pendingItems = useMemo(() => shoppingList.filter(i => i.is_pending), [shoppingList]);

  const shoppingEstimate = useMemo(() =>
    pendingItems
      .filter(i => i.estimated_price)
      .reduce((a, i) => a + Number(i.estimated_price) * (i.quantity ?? 1), 0),
  [pendingItems]);

  const activeDreams = useMemo(() =>
    dreams
      .filter(d => !d.is_completed)
      .map(d => {
        const current = expenses
          .filter(e => e.category_name === d.title)
          .reduce((a, e) => a + Number(e.amount), 0);
        return { ...d, current, percent: d.target_value > 0 ? Math.min((current / d.target_value) * 100, 100) : 0 };
      })
      .slice(0, 2),
  [dreams, expenses]);

  const recentExpenses = useMemo(() =>
    [...expenses]
      .sort((a, b) => {
        const da = a.expense_date || a.created_at.split('T')[0];
        const db = b.expense_date || b.created_at.split('T')[0];
        if (da !== db) return db.localeCompare(da);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, 5),
  [expenses]);

  const categoryColorMap = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    categories.forEach(c => { map[c.name] = c.color ?? undefined; });
    return map;
  }, [categories]);

  // ── Saldo do casal ──────────────────────────────────────────────────────────
  const individualCatNames = useMemo(
    () => new Set(categories.filter(c => c.type === 'individual').map(c => c.name)),
    [categories]
  );

  const coupleBalance = useMemo(() => {
    const coupleExps = expenses.filter(e => !individualCatNames.has(e.category_name ?? ''));
    if (coupleExps.length === 0) return null;
    const byUser: Record<string, { name: string; avatar?: string; total: number }> = {};
    coupleExps.forEach(e => {
      const uid = e.user_id;
      if (!byUser[uid]) byUser[uid] = { name: e.profiles?.full_name ?? 'Usuário', avatar: e.profiles?.avatar_url, total: 0 };
      byUser[uid].total += Number(e.amount);
    });
    const users = Object.values(byUser);
    if (users.length < 2) return null;
    const [a, b] = [...users].sort((x, y) => y.total - x.total);
    const totalCouple = a.total + b.total;
    return { a, b, totalCouple, owes: a.total - totalCouple / 2 };
  }, [expenses, individualCatNames]);

  // ── Gastos fixos ────────────────────────────────────────────────────────────
  const activeRecurring = useMemo(() => recurringExpenses.filter(r => r.is_active), [recurringExpenses]);
  const recurringMonthlyTotal = useMemo(() => activeRecurring.reduce((sum, r) => sum + Number(r.amount), 0), [activeRecurring]);

  // ── Watchlist ───────────────────────────────────────────────────────────────
  const recentWatchlist = useMemo(() =>
    [...watchlistItems]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10),
  [watchlistItems]);

  const watchlistCounts = useMemo(() => ({
    want:     watchlistItems.filter(i => i.status === 'want').length,
    watching: watchlistItems.filter(i => i.status === 'watching').length,
    watched:  watchlistItems.filter(i => i.status === 'watched').length,
  }), [watchlistItems]);

  // ── Notas recentes ──────────────────────────────────────────────────────────
  const recentNotes = useMemo(() =>
    notes.filter(n => !n.is_private).slice(0, 4),
  [notes]);

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>;
  }

  return (
    <div className="space-y-4 pb-10">

      {/* ── Resumo do mês ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 p-7 rounded-[2.5rem] shadow-2xl shadow-blue-500/30 text-white relative overflow-hidden"
      >
        <div className="absolute -right-10 -top-10 w-44 h-44 bg-white/10 rounded-full pointer-events-none" />
        <div className="absolute right-8 top-4 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 w-36 h-36 bg-indigo-400/20 rounded-full pointer-events-none" />
        <div className="absolute left-16 bottom-2 w-12 h-12 bg-blue-300/10 rounded-full pointer-events-none" />

        <div className="relative z-10">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <motion.p
            key={totalMonth}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="text-5xl font-black tracking-tighter mt-1 leading-none"
          >
            {formatCurrency(totalMonth)}
          </motion.p>

          <div className="w-12 h-0.5 bg-white/20 rounded-full my-3" />

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-2xl px-3 py-1.5">
              <span className="text-[11px] font-black">{expenses.length}</span>
              <span className="text-[10px] opacity-70">gastos</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-2xl px-3 py-1.5">
              <span className="text-[11px] font-black">{formatCurrency(dailyAvg)}</span>
              <span className="text-[10px] opacity-70">/dia</span>
            </div>
            {diff !== null && (
              <div className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-[10px] font-black backdrop-blur-sm ${
                diff > 0 ? 'bg-red-400/30' : 'bg-emerald-400/30'
              }`}>
                {diff > 0 ? <TrendingUp size={11} /> : diff < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                {Math.abs(diff).toFixed(0)}% vs anterior
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Grid: Compras + Lembretes ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Compras — com preview de itens */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35 }}
          onClick={() => onNavigate('shopping')}
          className="relative overflow-hidden bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border border-white/80 dark:border-slate-700/50 p-5 text-left shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 active:scale-95 transition-all"
        >
          <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-cyan-400/0 via-cyan-400/55 to-cyan-400/0 dark:via-cyan-400/25" />
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-3">
            <ShoppingCart size={18} className="text-blue-500" />
          </div>
          <p className="text-3xl font-black text-slate-800 dark:text-white leading-none">{pendingItems.length}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
            {pendingItems.length === 1 ? 'item pendente' : 'itens pendentes'}
          </p>
          {shoppingEstimate > 0 && (
            <p className="text-[10px] font-bold text-emerald-500 mt-1">{formatCurrency(shoppingEstimate)}</p>
          )}
          {pendingItems.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/50 space-y-1">
              {pendingItems.slice(0, 3).map(item => (
                <p key={item.id} className="text-[9px] text-slate-500 dark:text-slate-400 font-bold truncate flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0 flex-shrink-0" />
                  {item.item_name}
                </p>
              ))}
              {pendingItems.length > 3 && (
                <p className="text-[8px] text-blue-400 font-black">+{pendingItems.length - 3} mais</p>
              )}
            </div>
          )}
        </motion.button>

        {/* Lembretes */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          onClick={() => onNavigate('reminders')}
          className={`relative overflow-hidden backdrop-blur-sm rounded-3xl border p-5 text-left shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 active:scale-95 transition-all ${
            hasReminderToday
              ? 'bg-amber-50/90 dark:bg-amber-900/20 border-amber-200/70 dark:border-amber-700/50'
              : 'bg-white/90 dark:bg-slate-800/90 border-white/80 dark:border-slate-700/50'
          }`}
        >
          <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-amber-400/0 via-amber-400/55 to-amber-400/0 dark:via-amber-400/25" />
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${
            hasReminderToday ? 'bg-amber-400' : 'bg-amber-50 dark:bg-amber-900/20'
          }`}>
            <Bell size={18} className={hasReminderToday ? 'text-white' : 'text-amber-500'} />
          </div>
          <p className="text-3xl font-black text-slate-800 dark:text-white leading-none">{upcomingReminders.length}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
            {upcomingReminders.length === 1 ? 'lembrete' : 'lembretes'}
          </p>
          {hasReminderToday && (
            <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 mt-1">Tem hoje!</p>
          )}
          {upcomingReminders.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-amber-100 dark:border-amber-800/30 space-y-1">
              {upcomingReminders.slice(0, 2).map(rem => (
                <p key={rem.id} className="text-[9px] text-slate-500 dark:text-slate-400 font-bold truncate flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-amber-300 dark:bg-amber-700 shrink-0" />
                  {rem.text}
                </p>
              ))}
            </div>
          )}
        </motion.button>
      </div>

      {/* ── Saldo do casal ──────────────────────────────────────────────────── */}
      {coupleBalance && (() => {
        const pctA = (coupleBalance.a.total / coupleBalance.totalCouple) * 100;
        const pctB = (coupleBalance.b.total / coupleBalance.totalCouple) * 100;
        return (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}
            className="relative overflow-hidden bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border border-white/80 dark:border-slate-700/50 p-5 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30"
          >
            <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-indigo-400/0 via-indigo-400/50 to-indigo-400/0 dark:via-indigo-400/20" />
            <div className="flex items-center gap-2 mb-4">
              <Scale size={13} className="text-blue-500" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo do Casal</h3>
              <span className="ml-auto text-[9px] font-bold text-slate-300 dark:text-slate-600">
                {formatCurrency(coupleBalance.totalCouple)}
              </span>
            </div>
            <div className="flex justify-between items-end mb-2.5">
              <div className="flex items-center gap-2">
                {coupleBalance.a.avatar
                  ? <img src={coupleBalance.a.avatar} className="w-8 h-8 rounded-2xl object-cover border-2 border-blue-100 dark:border-blue-900/30" alt={coupleBalance.a.name} loading="lazy" decoding="async" />
                  : <div className="w-8 h-8 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border-2 border-blue-200 dark:border-blue-800">
                      <span className="text-[11px] font-black text-blue-600">{coupleBalance.a.name[0]}</span>
                    </div>
                }
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-none">{coupleBalance.a.name.split(' ')[0]}</p>
                  <p className="text-sm font-black text-blue-600 leading-tight">{formatCurrency(coupleBalance.a.total)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-right">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-none">{coupleBalance.b.name.split(' ')[0]}</p>
                  <p className="text-sm font-black text-indigo-500 leading-tight">{formatCurrency(coupleBalance.b.total)}</p>
                </div>
                {coupleBalance.b.avatar
                  ? <img src={coupleBalance.b.avatar} className="w-8 h-8 rounded-2xl object-cover border-2 border-indigo-100 dark:border-indigo-900/30" alt={coupleBalance.b.name} loading="lazy" decoding="async" />
                  : <div className="w-8 h-8 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center border-2 border-indigo-200 dark:border-indigo-800">
                      <span className="text-[11px] font-black text-indigo-600">{coupleBalance.b.name[0]}</span>
                    </div>
                }
              </div>
            </div>
            <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
              <motion.div initial={{ width: 0 }} animate={{ width: `${pctA}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} className="h-full bg-blue-500 rounded-full" />
              <motion.div initial={{ width: 0 }} animate={{ width: `${pctB}%` }} transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }} className="h-full bg-indigo-400 rounded-full" />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[9px] font-black text-blue-500">{pctA.toFixed(0)}%</span>
              <span className="text-[9px] font-black text-indigo-500">{pctB.toFixed(0)}%</span>
            </div>
            {coupleBalance.owes > 0.01 && (
              <p className="text-[10px] font-black text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-2xl px-3 py-2 mt-3">
                Diferença de{' '}
                <span className="text-blue-600 dark:text-blue-400">{formatCurrency(coupleBalance.owes)}</span>
                {' '}para o meio a meio
              </p>
            )}
          </motion.div>
        );
      })()}

      {/* ── Gastos fixos ativos ──────────────────────────────────────────── */}
      {activeRecurring.length > 0 && (
        <button
          onClick={() => onNavigate('recurrent')}
          className="relative overflow-hidden w-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border border-white/80 dark:border-slate-700/50 p-4 text-left shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 active:scale-95 transition-all"
        >
          <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-violet-400/0 via-violet-400/55 to-violet-400/0 dark:via-violet-400/25" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                <Repeat2 size={17} className="text-violet-500" />
              </div>
              <div>
                <p className="font-black text-slate-800 dark:text-white text-sm leading-none">{formatCurrency(recurringMonthlyTotal)}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                  {activeRecurring.length} fixo{activeRecurring.length !== 1 ? 's' : ''} ativos
                </p>
              </div>
            </div>
            <ArrowRight size={14} className="text-slate-300 dark:text-slate-500" />
          </div>
        </button>
      )}

      {/* ── Watchlist — últimos adicionados ──────────────────────────────── */}
      {recentWatchlist.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
          className="relative overflow-hidden bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border border-white/80 dark:border-slate-700/50 p-5 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30"
        >
          <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-slate-400/0 via-slate-400/45 to-slate-400/0 dark:via-slate-400/20" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Film size={12} className="text-slate-400" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Watchlist</h3>
              <span className="text-[8px] font-black bg-slate-100 dark:bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-lg">
                {watchlistItems.length}
              </span>
            </div>
            <button
              onClick={() => onNavigate('movies')}
              className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1 active:opacity-70 transition-opacity"
            >
              Ver lista <ArrowRight size={10} />
            </button>
          </div>

          {/* Posters em scroll horizontal */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
            {recentWatchlist.map((item, i) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                onClick={() => onNavigate('movies')}
                className="shrink-0 rounded-2xl overflow-hidden active:scale-90 transition-all shadow-md relative"
                style={{ width: 52 }}
              >
                {item.poster_url ? (
                  <img
                    src={`${TMDB_W92}${item.poster_url}`}
                    alt={item.title}
                    className="w-full object-cover"
                    style={{ aspectRatio: '2/3' }}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div
                    className="w-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center"
                    style={{ aspectRatio: '2/3' }}
                  >
                    {item.media_type === 'movie'
                      ? <Film size={14} className="text-slate-400" />
                      : <Tv size={14} className="text-slate-400" />
                    }
                  </div>
                )}
                {/* Badge de status */}
                <div className={`absolute bottom-0 inset-x-0 h-1 ${
                  item.status === 'watching' ? 'bg-blue-500' :
                  item.status === 'watched'  ? 'bg-emerald-500' : 'bg-transparent'
                }`} />
              </motion.button>
            ))}
          </div>

          {/* Contadores por status */}
          <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-700/50">
            {watchlistCounts.want > 0 && (
              <div className="flex items-center gap-1">
                <Bookmark size={9} className="text-slate-400" />
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                  {watchlistCounts.want} quero
                </span>
              </div>
            )}
            {watchlistCounts.watching > 0 && (
              <div className="flex items-center gap-1">
                <Play size={9} className="text-blue-400" />
                <span className="text-[8px] font-black text-blue-400 uppercase tracking-wider">
                  {watchlistCounts.watching} assistindo
                </span>
              </div>
            )}
            {watchlistCounts.watched > 0 && (
              <div className="flex items-center gap-1">
                <Star size={9} className="text-amber-400" />
                <span className="text-[8px] font-black text-amber-400 uppercase tracking-wider">
                  {watchlistCounts.watched} assistidos
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Metas do mês ──────────────────────────────────────────────────── */}
      {topGoals.length > 0 && (
        <div className="relative overflow-hidden bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border border-white/80 dark:border-slate-700/50 p-5 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 space-y-4">
          <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-emerald-400/0 via-emerald-400/55 to-emerald-400/0 dark:via-emerald-400/25" />
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Metas do Mês</h3>
            <button onClick={() => onNavigate('stats')} className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1">
              Ver mais <ArrowRight size={10} />
            </button>
          </div>
          {topGoals.map((cat, i) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07, duration: 0.3 }}
              className="space-y-1.5"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color ?? '#3b82f6' }} />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{cat.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg ${
                    cat.pct >= 100 ? 'bg-red-50 dark:bg-red-900/30 text-red-500'
                    : cat.pct >= 80 ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-500'
                    : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500'
                  }`}>{cat.pct.toFixed(0)}%</span>
                  <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">
                    {formatCurrency(cat.spent)}
                    <span className="text-slate-300 dark:text-slate-600"> / {formatCurrency(cat.monthly_goal!)}</span>
                  </span>
                </div>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${cat.pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.07 + 0.15 }}
                  className={`h-full rounded-full ${cat.pct >= 100 ? 'bg-red-500' : cat.pct >= 80 ? 'bg-amber-400' : ''}`}
                  style={cat.pct < 80 ? { backgroundColor: cat.color ?? '#3b82f6' } : undefined}
                />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Próximos lembretes ────────────────────────────────────────────── */}
      {upcomingReminders.length > 0 && (
        <div className="relative overflow-hidden bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border border-white/80 dark:border-slate-700/50 p-5 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30">
          <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-orange-400/0 via-orange-400/55 to-orange-400/0 dark:via-orange-400/25" />
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Próximos Lembretes</h3>
            <button onClick={() => onNavigate('reminders')} className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1">
              Ver todos <ArrowRight size={10} />
            </button>
          </div>
          <div className="space-y-2">
            {upcomingReminders.map((rem, i) => {
              const isHoje = dateFnsIsToday(parseISO(rem.reminder_date));
              return (
                <motion.div
                  key={rem.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.3 }}
                  className={`flex items-center gap-3 p-3 rounded-2xl ${
                    isHoje ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-slate-50 dark:bg-slate-900/50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isHoje ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}>
                    <Bell size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${isHoje ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>
                      {rem.text}
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">
                      {isHoje ? 'Hoje' : format(parseISO(rem.reminder_date), "dd 'de' MMM", { locale: ptBR })}
                      {rem.reminder_time && ` · ${rem.reminder_time.slice(0, 5)}`}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Notas recentes ────────────────────────────────────────────────── */}
      {recentNotes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.35 }}
          className="relative overflow-hidden bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border border-white/80 dark:border-slate-700/50 p-5 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30"
        >
          <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-yellow-400/0 via-yellow-400/55 to-yellow-400/0 dark:via-yellow-400/25" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={12} className="text-slate-400" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notas</h3>
            </div>
            <button
              onClick={() => onNavigate('notes')}
              className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1 active:opacity-70 transition-opacity"
            >
              Ver todas <ArrowRight size={10} />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
            {recentNotes.map((note, i) => {
              const hasColor = note.color && note.color !== '#ffffff';
              return (
                <motion.button
                  key={note.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.25 }}
                  onClick={() => onNavigate('notes')}
                  className="shrink-0 w-36 text-left rounded-2xl border shadow-sm p-3 active:scale-95 transition-all bg-white dark:bg-slate-800"
                  style={{
                    backgroundColor: hasColor ? `${note.color}12` : undefined,
                    borderColor:     hasColor ? `${note.color}35` : undefined,
                  }}
                >
                  {hasColor && (
                    <div className="h-1 w-full rounded-full mb-2.5" style={{ backgroundColor: note.color! }} />
                  )}
                  <p
                    className="text-[10px] font-black uppercase tracking-tight leading-snug line-clamp-2 text-slate-800 dark:text-slate-200"
                    style={{ color: hasColor ? note.color! : undefined }}
                  >
                    {note.title}
                  </p>
                  {note.content && (
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 font-medium leading-relaxed">
                      {note.content}
                    </p>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Objetivos ativos ─────────────────────────────────────────────── */}
      {activeDreams.length > 0 && (
        <div className="relative overflow-hidden bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border border-white/80 dark:border-slate-700/50 p-5 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30">
          <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-purple-400/0 via-purple-400/55 to-purple-400/0 dark:via-purple-400/25" />
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Objetivos</h3>
            <button onClick={() => onNavigate('dreams')} className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1">
              Ver todos <ArrowRight size={10} />
            </button>
          </div>
          <div className="space-y-3">
            {activeDreams.map(dream => (
              <div key={dream.id} className="space-y-1.5">
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {dream.image_url ? (
                      <img src={dream.image_url} className="w-7 h-7 rounded-xl object-cover shrink-0" alt={dream.title} loading="lazy" decoding="async" />
                    ) : (
                      <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                        <Target size={13} className="text-blue-400" />
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{dream.title}</span>
                  </div>
                  <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 shrink-0">{dream.percent.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${dream.percent}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className={`h-full rounded-full ${dream.percent >= 75 ? 'bg-emerald-400' : dream.percent >= 50 ? 'bg-amber-400' : 'bg-blue-500'}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Últimos gastos ───────────────────────────────────────────────── */}
      {recentExpenses.length > 0 && (
        <div className="relative overflow-hidden bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border border-white/80 dark:border-slate-700/50 p-5 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30">
          <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-blue-400/0 via-blue-400/55 to-blue-400/0 dark:via-blue-400/25" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Últimos Gastos</h3>
            <button onClick={() => onNavigate('list')} className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1">
              Extrato <ArrowRight size={10} />
            </button>
          </div>
          <div className="space-y-3">
            {recentExpenses.map((exp, i) => {
              const color = categoryColorMap[exp.category_name ?? ''] ?? '#3b82f6';
              const avatarUrl = exp.profiles?.avatar_url;
              const initial = exp.profiles?.full_name?.[0] ?? '?';
              return (
                <motion.div
                  key={exp.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  className="flex items-center gap-3"
                >
                  {avatarUrl
                    ? <img src={avatarUrl} className="w-9 h-9 rounded-2xl object-cover shrink-0 border border-slate-100 dark:border-slate-700" alt={exp.profiles?.full_name} loading="lazy" decoding="async" />
                    : <div className="w-9 h-9 rounded-2xl shrink-0 flex items-center justify-center border" style={{ backgroundColor: color + '18', borderColor: color + '30' }}>
                        <span className="text-[11px] font-black" style={{ color }}>{initial}</span>
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate leading-tight">
                        {exp.description || 'Sem descrição'}
                      </span>
                      <span className="font-black text-sm text-slate-800 dark:text-white shrink-0">
                        {formatCurrency(exp.amount)}
                      </span>
                    </div>
                    <span
                      className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md mt-0.5 inline-block"
                      style={{ backgroundColor: color + '20', color }}
                    >
                      {exp.category_name}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {expenses.length === 0 && topGoals.length === 0 && upcomingReminders.length === 0 && (
        <p className="text-center text-slate-300 dark:text-slate-600 py-16 font-black uppercase text-[10px] tracking-[0.2em]">
          Nenhum dado ainda este mês
        </p>
      )}
    </div>
  );
}
