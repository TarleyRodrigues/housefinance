// ─── ABA: EXTRATO ────────────────────────────────────────────────────────────
// ✅ Data e hora de inserção no card (formatada como "hoje às 14:32")
// ✅ Agrupamento por data com cabeçalho separador
// ✅ Total por dia no cabeçalho do grupo
// ✅ Cor da categoria no badge (usa a cor definida em Ajustes)
// ✅ Ordenação manual: mais recentes / maior valor
// ✅ useMemo nos filtros (performance)
// ✅ Debounce na busca (UX)
// ✅ Modal de confirmação customizado
// ✅ aria-label em todos os botões (acessibilidade)

import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { haptic } from '../utils/haptic';
import { motion, AnimatePresence } from 'motion/react';
import {
  Edit2, Trash2, Search, Filter, ArrowUpRight, ArrowDownRight,
  Paperclip, Image as ImageIcon, X, AlertTriangle, ArrowUpDown,
  Clock, CalendarDays, Copy, CreditCard,
} from 'lucide-react';
import { SkeletonCard } from '../components/ui';
import { formatCurrency } from '../utils';
import type { Expense, Category } from '../types';
import { format, isToday, isYesterday, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Converte string de data (yyyy-MM-dd ou ISO) para Date local sem problema de UTC
function parseDateSafe(dateStr: string): Date {
  if (dateStr.includes('T')) return new Date(dateStr);
  // date-only: adiciona meio-dia local para evitar problema de midnight UTC
  return new Date(dateStr + 'T12:00:00');
}

// Exibe a data do gasto (expense_date) + hora de inserção (created_at)
// Ex: "hoje às 14:32", "ontem às 09:15", "12 mar às 20:00"
function formatExpenseDateTime(expense: Expense): string {
  const expDate = parseDateSafe(expense.expense_date || expense.created_at);
  const timeStr = format(new Date(expense.created_at), 'HH:mm');
  if (isToday(expDate))     return `hoje às ${timeStr}`;
  if (isYesterday(expDate)) return `ontem às ${timeStr}`;
  return `${format(expDate, "d MMM", { locale: ptBR })} às ${timeStr}`;
}

// Formata cabeçalho do grupo de dia
function formatDayHeader(dateStr: string): string {
  const date = parseDateSafe(dateStr);
  if (isToday(date))     return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de ordenação
// ─────────────────────────────────────────────────────────────────────────────
type SortMode    = 'newest' | 'oldest' | 'highest' | 'lowest';
type PeriodFilter = 'all' | 'today' | 'week' | '7days' | 'custom';

const SORT_LABELS: Record<SortMode, string> = {
  newest:  'Mais recentes',
  oldest:  'Mais antigos',
  highest: 'Maior valor',
  lowest:  'Menor valor',
};

const SORT_CYCLE: SortMode[] = ['newest', 'oldest', 'highest', 'lowest'];

// ─────────────────────────────────────────────────────────────────────────────
// SUB: ConfirmDeleteModal
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmDeleteModal({ expense, onConfirm, onCancel }: {
  expense: Expense | null; onConfirm: () => void; onCancel: () => void;
}) {
  if (!expense) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
        role="dialog" aria-modal="true" onClick={onCancel}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">
              Remover gasto?
            </h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              <span className="font-bold text-slate-600 dark:text-slate-300">
                {expense.description || 'Sem descrição'}
              </span>{' '}· {formatCurrency(expense.amount)}
              <br />Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onCancel}
              className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider active:scale-95 transition-all">
              Cancelar
            </button>
            <button onClick={() => { haptic('heavy'); onConfirm(); }}
              className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-red-500/30">
              Remover
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: ExpenseCard — swipe-to-reveal com Copy / Edit / Delete
// ─────────────────────────────────────────────────────────────────────────────
const ExpenseCard = memo(function ExpenseCard({ expense, categoryColor, onEdit, onDelete, onDuplicate, onViewReceipt }: {
  expense: Expense;
  categoryColor?: string;
  onEdit: (exp: Expense) => void;
  onDelete: (exp: Expense) => void;
  onDuplicate: (exp: Expense) => void;
  onViewReceipt: (url: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const avatarUrl =
    expense.profiles?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(expense.profiles?.full_name ?? 'U')}`;

  // 3 botões × 40px = 120px de revelação
  const OPEN_X = -120;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="relative overflow-hidden rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700"
    >
      {/* Acento colorido da categoria */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 z-10 rounded-l-[2rem]"
        style={{ backgroundColor: categoryColor ?? '#3b82f6' }}
      />

      {/* Botões revelados (fixos atrás do card) */}
      <div className="absolute inset-y-0 right-0 flex items-stretch">
        <button
          onClick={() => { onDuplicate(expense); setIsOpen(false); }}
          aria-label={`Duplicar despesa: ${expense.description || 'sem descrição'}`}
          className="w-10 flex items-center justify-center bg-blue-500 text-white active:opacity-80"
        >
          <Copy size={15} />
        </button>
        <button
          onClick={() => { onEdit(expense); setIsOpen(false); }}
          aria-label={`Editar despesa: ${expense.description || 'sem descrição'}`}
          className="w-10 flex items-center justify-center bg-indigo-500 text-white active:opacity-80"
        >
          <Edit2 size={15} />
        </button>
        <button
          onClick={() => { onDelete(expense); setIsOpen(false); }}
          aria-label={`Remover despesa: ${expense.description || 'sem descrição'}`}
          className="w-10 flex items-center justify-center bg-red-500 text-white active:opacity-80"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Card deslizável */}
      <motion.div
        drag="x"
        dragConstraints={{ left: OPEN_X, right: 0 }}
        dragElastic={{ left: 0.05, right: 0 }}
        animate={{ x: isOpen ? OPEN_X : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        onDragEnd={(_, info) => {
          setIsOpen(info.offset.x < -50);
        }}
        onClick={() => { if (isOpen) setIsOpen(false); }}
        className="bg-white dark:bg-slate-800 p-4 flex items-center justify-between transition-colors relative"
        style={{ userSelect: 'none', touchAction: 'pan-y' }}
      >
        <div className="flex items-center gap-3 flex-1 overflow-hidden">
          <img
            src={avatarUrl}
            className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-50 dark:border-slate-700 shadow-sm shrink-0"
            alt={`Avatar de ${expense.profiles?.full_name ?? 'usuário'}`}
            loading="lazy"
            decoding="async"
          />
          <div className="flex flex-col min-w-0">
            <span
              className="text-[9px] font-black uppercase tracking-widest leading-none mb-1 px-1.5 py-0.5 rounded-md w-fit"
              style={
                categoryColor
                  ? { backgroundColor: categoryColor + '25', color: categoryColor }
                  : undefined
              }
            >
              <span className={!categoryColor ? 'text-blue-500' : undefined}>
                {expense.category_name}
              </span>
            </span>

            <span className="font-bold truncate text-sm leading-tight text-slate-800 dark:text-slate-200">
              {expense.description || 'Sem descrição'}
            </span>

            {expense.merchant && (
              <span className="text-[9px] text-slate-400 font-medium truncate leading-none mt-0.5">
                {expense.merchant}
              </span>
            )}

            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">
                {expense.profiles?.full_name?.split(' ')[0]}
              </span>
              <span className="text-[8px] text-slate-300 dark:text-slate-600">·</span>
              <span className="text-[9px] text-slate-400 font-bold flex items-center gap-0.5">
                <Clock size={8} className="shrink-0" />
                {formatExpenseDateTime(expense)}
              </span>
              {expense.payment_month && (
                <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 rounded-lg border border-violet-100 dark:border-violet-800">
                  <CreditCard size={9} strokeWidth={3} />
                  <span className="text-[8px] font-black uppercase">
                    {new Date(expense.payment_month + '-02').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')}
                  </span>
                </span>
              )}
              {expense.receipt_url && (
                <button
                  onClick={(e) => { e.stopPropagation(); onViewReceipt(expense.receipt_url!); }}
                  aria-label={`Ver comprovante de ${expense.description || 'despesa'}`}
                  className="flex items-center gap-1 text-blue-500 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-lg border border-blue-100 dark:border-blue-900 shadow-sm transition-all active:scale-90"
                >
                  <Paperclip size={10} strokeWidth={3} />
                  <span className="text-[8px] font-black uppercase">Anexo</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="text-right ml-2 shrink-0">
          <span className="font-black text-slate-900 dark:text-white text-base block">
            {formatCurrency(expense.amount)}
          </span>
          {/* Hint de swipe */}
          {!isOpen && (
            <div className="flex flex-col items-end gap-0.5 mt-1">
              <span className="w-3 h-0.5 bg-slate-200 dark:bg-slate-600 rounded-full" />
              <span className="w-2 h-0.5 bg-slate-200 dark:bg-slate-600 rounded-full" />
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SUB: DayGroup — cabeçalho de agrupamento por dia com total
// ─────────────────────────────────────────────────────────────────────────────
function DayGroup({ dateStr, total, children }: {
  dateStr: string; total: number; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {/* Cabeçalho do dia */}
      <div className="flex items-center justify-between px-1 pt-2">
        <div className="flex items-center gap-2">
          <CalendarDays size={12} className="text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 capitalize">
            {formatDayHeader(dateStr)}
          </span>
        </div>
        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">
          {formatCurrency(total)}
        </span>
      </div>
      {/* Linha separadora */}
      <div className="h-px bg-slate-100 dark:bg-slate-800" />
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: ReceiptGallery
// ─────────────────────────────────────────────────────────────────────────────
function ReceiptGallery({ isOpen, onClose, expenses, currentDate, onViewReceipt }: {
  isOpen: boolean; onClose: () => void; expenses: Expense[];
  currentDate: Date; onViewReceipt: (url: string) => void;
}) {
  const expensesWithReceipts = useMemo(() => expenses.filter((e) => e.receipt_url), [expenses]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-white dark:bg-slate-900 z-[200] flex flex-col transition-colors"
          role="dialog" aria-modal="true" aria-label="Galeria de recibos"
        >
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
            <div className="flex flex-col">
              <h3 className="font-black uppercase text-sm tracking-widest leading-none">Galeria de Recibos</h3>
              <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
              </span>
            </div>
            <button onClick={onClose} aria-label="Fechar galeria"
              className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 transition-transform active:scale-90">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {expensesWithReceipts.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {expensesWithReceipts.map((e) => (
                  <motion.button
                    whileTap={{ scale: 0.95 }} key={e.id}
                    onClick={() => onViewReceipt(e.receipt_url!)}
                    aria-label={`Ver comprovante de ${e.description || 'despesa'} — ${formatCurrency(e.amount)}`}
                    className="aspect-square rounded-2xl overflow-hidden border-2 border-slate-50 dark:border-slate-800 shadow-sm relative group"
                  >
                    <img src={e.receipt_url!} className="w-full h-full object-cover" alt={`Comprovante de ${e.description || 'despesa'}`} />
                    <div className="absolute inset-0 bg-black/20 group-active:bg-black/0 transition-colors" />
                    <div className="absolute bottom-1 right-2 text-[8px] font-black text-white drop-shadow-md">
                      {formatCurrency(e.amount)}
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-300">
                <ImageIcon size={48} className="opacity-20" />
                <p className="font-black uppercase text-[10px] tracking-widest">Nenhum comprovante este mês</p>
              </div>
            )}
          </div>
          <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
              Documentos salvos com segurança no Supabase Storage
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  expenses: Expense[];
  categories: Category[];
  prevMonthTotal: number;
  isLoading: boolean;
  currentDate: Date;
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
  onEdit: (exp: Expense) => void;
  onDuplicate: (exp: Expense) => void;
  onViewReceipt: (url: string) => void;
  onDelete: (id: string) => Promise<void>;
}

export function TabExtrato({
  expenses, categories, prevMonthTotal, isLoading,
  currentDate, fetchData, showToast, onEdit, onDuplicate, onViewReceipt, onDelete,
}: Props) {
  const [searchTerm, setSearchTerm]           = useState('');
  const [filterUserId, setFilterUserId]       = useState<string | null>(null);
  const [filterCategory, setFilterCategory]   = useState<string | null>(null);
  const [periodFilter, setPeriodFilter]       = useState<PeriodFilter>('all');
  const [customStart, setCustomStart]         = useState('');
  const [customEnd, setCustomEnd]             = useState('');
  const [isGalleryOpen, setIsGalleryOpen]     = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [sortMode, setSortMode]               = useState<SortMode>('newest');

  const debouncedSearch = useDebounce(searchTerm, 300);

  // ── Mapa de cor por categoria ──────────────────────────────────────────────
  const categoryColorMap = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    categories.forEach((c) => { map[c.name] = c.color ?? undefined; });
    return map;
  }, [categories]);

  // ── Filtro de período ──────────────────────────────────────────────────────
  const periodFiltered = useMemo(() => {
    if (periodFilter === 'all') return expenses;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (periodFilter === 'today') {
      return expenses.filter(e => (e.expense_date || e.created_at.split('T')[0]) === todayStr);
    }
    if (periodFilter === 'week') {
      const start = format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const end   = format(endOfWeek(new Date(),   { weekStartsOn: 0 }), 'yyyy-MM-dd');
      return expenses.filter(e => {
        const d = e.expense_date || e.created_at.split('T')[0];
        return d >= start && d <= end;
      });
    }
    if (periodFilter === 'custom') {
      if (customStart && customEnd && customEnd < customStart) return expenses;
      return expenses.filter(e => {
        const d = e.expense_date || e.created_at.split('T')[0];
        if (customStart && d < customStart) return false;
        if (customEnd   && d > customEnd)   return false;
        return true;
      });
    }
    // '7days'
    const sevenDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');
    return expenses.filter(e => {
      const d = e.expense_date || e.created_at.split('T')[0];
      return d >= sevenDaysAgo;
    });
  }, [expenses, periodFilter, customStart, customEnd]);

  // ── Filtros + ordenação ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = periodFiltered
      .filter((e) => !filterUserId   || e.user_id === filterUserId)
      .filter((e) => !filterCategory || e.category_name === filterCategory)
      .filter((e) =>
        !debouncedSearch ||
        e.description?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        e.category_name?.toLowerCase().includes(debouncedSearch.toLowerCase())
      );

    switch (sortMode) {
      case 'newest':
        list = [...list].sort((a, b) => {
          const da = a.expense_date || a.created_at.split('T')[0];
          const db = b.expense_date || b.created_at.split('T')[0];
          if (da !== db) return db.localeCompare(da);
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        break;
      case 'oldest':
        list = [...list].sort((a, b) => {
          const da = a.expense_date || a.created_at.split('T')[0];
          const db = b.expense_date || b.created_at.split('T')[0];
          if (da !== db) return da.localeCompare(db);
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        break;
      case 'highest': list = [...list].sort((a, b) => Number(b.amount) - Number(a.amount)); break;
      case 'lowest':  list = [...list].sort((a, b) => Number(a.amount) - Number(b.amount)); break;
    }
    return list;
  }, [expenses, filterUserId, filterCategory, debouncedSearch, sortMode]);

  // ── Agrupamento por dia (só quando ordenado por data) ─────────────────────
  const groupedByDay = useMemo(() => {
    if (sortMode === 'highest' || sortMode === 'lowest') return null;

    const groups: { dateStr: string; items: Expense[]; total: number }[] = [];
    filtered.forEach((exp) => {
      // Usa expense_date como chave de agrupamento (yyyy-MM-dd)
      const expDateStr = exp.expense_date || exp.created_at.split('T')[0];
      const existing = groups.find((g) => g.dateStr === expDateStr);
      if (existing) {
        existing.items.push(exp);
        existing.total += Number(exp.amount);
      } else {
        groups.push({ dateStr: expDateStr, items: [exp], total: Number(exp.amount) });
      }
    });
    return groups;
  }, [filtered, sortMode]);

  // ── Totais ────────────────────────────────────────────────────────────────
  const totalFiltered = useMemo(() => filtered.reduce((acc, e) => acc + Number(e.amount), 0), [filtered]);
  const totalMonth    = useMemo(() => expenses.reduce((acc, e) => acc + Number(e.amount), 0), [expenses]);

  const uniqueUserIds    = useMemo(() => Array.from(new Set(expenses.map((e) => e.user_id))), [expenses]);
  const activeCategories = useMemo(() => categories.filter((c) => expenses.some((e) => e.category_name === c.name)), [categories, expenses]);
  const expensesWithReceipts = useMemo(() => expenses.filter((e) => e.receipt_url), [expenses]);

  const diff = prevMonthTotal > 0 ? ((totalMonth - prevMonthTotal) / prevMonthTotal) * 100 : 0;

  const isAnyFilterActive = !!(filterUserId || filterCategory || debouncedSearch || periodFilter !== 'all' || customStart || customEnd);

  const daysElapsed = useMemo(() => {
    const today = new Date();
    const isCurrent = today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();
    return isCurrent ? Math.max(today.getDate(), 1) : new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  }, [currentDate]);

  const dailyAvg = totalMonth > 0 ? totalMonth / daysElapsed : 0;

  const individualCatNames = useMemo(
    () => new Set(categories.filter((c) => c.type === 'individual').map((c) => c.name)),
    [categories]
  );

  const coupleTotal = useMemo(
    () => expenses.filter((e) => !individualCatNames.has(e.category_name ?? '')).reduce((a, e) => a + Number(e.amount), 0),
    [expenses, individualCatNames]
  );

  const individualTotal = useMemo(
    () => expenses.filter((e) => individualCatNames.has(e.category_name ?? '')).reduce((a, e) => a + Number(e.amount), 0),
    [expenses, individualCatNames]
  );

  // ── Cycle de ordenação ────────────────────────────────────────────────────
  const cycleSort = () => {
    const idx = SORT_CYCLE.indexOf(sortMode);
    setSortMode(SORT_CYCLE[(idx + 1) % SORT_CYCLE.length]);
  };

  // ── Handlers deleção ──────────────────────────────────────────────────────
  const handleDeleteRequest = useCallback((exp: Expense) => setExpenseToDelete(exp), []);
  const handleDeleteConfirm = useCallback(async () => {
    if (!expenseToDelete) return;
    try {
      await onDelete(expenseToDelete.id);
      showToast('Gasto removido', 'info');
      fetchData();
    } catch { showToast('Erro ao remover gasto', 'error'); }
    finally { setExpenseToDelete(null); }
  }, [expenseToDelete, onDelete, showToast, fetchData]);

  return (
    <div className="space-y-4">

      {/* 1. CARD RESUMO ───────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-[2.5rem] shadow-2xl shadow-blue-500/30 text-white relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-44 h-44 bg-white/8 rounded-full pointer-events-none" />
        <div className="absolute -left-6 -bottom-10 w-32 h-32 bg-indigo-400/20 rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
              {isAnyFilterActive ? 'Total Filtrado' : 'Total do Mês'}
            </span>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black ${diff > 0 ? 'bg-red-400/30' : 'bg-emerald-400/30'}`}>
              {diff > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {Math.abs(diff).toFixed(0)}% vs anterior
            </div>
          </div>

          <h1 className="text-4xl font-black tracking-tighter" aria-live="polite">
            {formatCurrency(totalFiltered)}
          </h1>

          {/* Métricas rápidas — só quando sem filtro ativo */}
          {!isAnyFilterActive && expenses.length > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <div className="flex items-center gap-1 bg-white/10 rounded-xl px-2.5 py-1">
                <span className="text-[10px] font-black">{expenses.length}</span>
                <span className="text-[9px] opacity-70">gastos</span>
              </div>
              <div className="flex items-center gap-1 bg-white/10 rounded-xl px-2.5 py-1">
                <span className="text-[10px] font-black">{formatCurrency(dailyAvg)}</span>
                <span className="text-[9px] opacity-70">/dia</span>
              </div>
              {individualTotal > 0 && (
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-2.5 py-1">
                  <span className="text-[9px] font-black text-blue-200">♥ {formatCurrency(coupleTotal)}</span>
                  <span className="opacity-30 text-[9px]">·</span>
                  <span className="text-[9px] font-black text-purple-200">↗ {formatCurrency(individualTotal)}</span>
                </div>
              )}
            </div>
          )}

          {/* Busca */}
          <div className="flex items-center gap-2 mt-4 bg-black/10 p-1 rounded-2xl border border-white/5">
            <div className="bg-white/20 p-2 rounded-xl text-white"><Search size={16} /></div>
            <label htmlFor="expense-search" className="sr-only">Buscar despesas</label>
            <input
              id="expense-search"
              className="bg-transparent border-none outline-none text-xs font-bold w-full placeholder:text-white/40 text-white"
              placeholder="O que você procura?"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} aria-label="Limpar busca"
                className="bg-white/10 p-2 rounded-xl text-white/60 hover:text-white transition-colors active:scale-90">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 2. FILTROS DE PERÍODO ───────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 overflow-x-auto no-scrollbar">
          {(['all', 'today', 'week', '7days', 'custom'] as const).map(period => (
            <button
              key={period}
              onClick={() => setPeriodFilter(period)}
              aria-pressed={periodFilter === period}
              className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border shrink-0 ${
                periodFilter === period
                  ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-sm'
                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
              }`}
            >
              {period === 'all' ? 'Tudo' : period === 'today' ? 'Hoje' : period === 'week' ? 'Semana' : period === '7days' ? '7 dias' : 'Período'}
            </button>
          ))}
        </div>

        {/* Date pickers para período customizado */}
        {periodFilter === 'custom' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1.5 px-1"
          >
            <div className="flex gap-2">
              <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 px-3 pt-2">De</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="w-full px-3 pb-2 bg-transparent outline-none text-xs font-bold text-slate-700 dark:text-slate-300"
                />
              </div>
              <div className={`flex-1 bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden ${
                customStart && customEnd && customEnd < customStart
                  ? 'border-red-300 dark:border-red-700'
                  : 'border-slate-200 dark:border-slate-700'
              }`}>
                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 px-3 pt-2">Até</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="w-full px-3 pb-2 bg-transparent outline-none text-xs font-bold text-slate-700 dark:text-slate-300"
                />
              </div>
            </div>
            {customStart && customEnd && customEnd < customStart && (
              <p className="text-[9px] font-black text-red-500 uppercase tracking-wider px-1">
                A data final deve ser maior que a inicial
              </p>
            )}
          </motion.div>
        )}
      </div>

      {/* 3. FILTROS POR USUÁRIO ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1 px-1">
        <button
          onClick={() => setFilterUserId(null)} aria-pressed={!filterUserId}
          className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${
            !filterUserId
              ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-lg'
              : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'
          }`}
        >
          Todos
        </button>
        {uniqueUserIds.map((uid) => {
          const exp = expenses.find((e) => e.user_id === uid)!;
          const firstName = exp.profiles?.full_name?.split(' ')[0] ?? 'Usuário';
          const avatarUrl = exp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(exp.profiles?.full_name ?? 'U')}`;
          return (
            <button key={uid}
              onClick={() => setFilterUserId(filterUserId === uid ? null : uid)}
              aria-pressed={filterUserId === uid}
              className={`flex items-center gap-2 p-1 pr-4 rounded-full border transition-all ${
                filterUserId === uid
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'
              }`}
            >
              <img src={avatarUrl} className="w-7 h-7 rounded-full object-cover" alt={`Foto de ${exp.profiles?.full_name ?? 'usuário'}`} />
              <span className="text-[10px] font-black uppercase tracking-tighter">{firstName}</span>
            </button>
          );
        })}
      </div>

      {/* 3. FILTROS CATEGORIA + ORDENAÇÃO + GALERIA ──────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-1 border-b border-slate-100 dark:border-slate-800 pb-2">
        {/* Botão Categorias */}
        <button
          onClick={() => setFilterCategory(null)} aria-pressed={!filterCategory}
          className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase border transition-all shrink-0 ${
            !filterCategory
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white border-slate-200 dark:border-slate-600'
              : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
          }`}
        >
          <Filter size={10} /> Todas
        </button>

        {/* ✅ Botão de ordenação — cicla entre 4 modos */}
        <button
          onClick={cycleSort}
          aria-label={`Ordenação atual: ${SORT_LABELS[sortMode]}. Toque para mudar.`}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase border transition-all shrink-0 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800 active:scale-95"
        >
          <ArrowUpDown size={10} /> {SORT_LABELS[sortMode]}
        </button>

        {/* Galeria */}
        <button
          onClick={() => setIsGalleryOpen(true)}
          aria-label={`Abrir galeria com ${expensesWithReceipts.length} recibos`}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800 active:scale-95 transition-all shrink-0"
        >
          <ImageIcon size={10} /> Recibos ({expensesWithReceipts.length})
        </button>

        {/* Categorias filtráveis com cor */}
        {activeCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(filterCategory === cat.name ? null : cat.name)}
            aria-pressed={filterCategory === cat.name}
            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase whitespace-nowrap transition-all border active:scale-95 shrink-0 ${
              filterCategory === cat.name
                ? 'border-transparent text-white'
                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
            }`}
            style={
              filterCategory === cat.name && cat.color
                ? { backgroundColor: cat.color, borderColor: cat.color }
                : filterCategory === cat.name
                  ? { backgroundColor: '#3b82f6' }
                  : {}
            }
          >
            {/* Bolinha colorida quando não ativo */}
            {filterCategory !== cat.name && cat.color && (
              <span
                className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
                style={{ backgroundColor: cat.color }}
              />
            )}
            {cat.name}
          </button>
        ))}
      </div>

      {/* 4. LISTA DE DESPESAS ─────────────────────────────────────────────── */}
      <div className="space-y-4 pb-10" aria-live="polite">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-300 py-20 font-black uppercase text-[10px] tracking-[0.2em]">
            Nenhum registro encontrado
          </p>
        ) : groupedByDay ? (
          /* ── Agrupado por dia (ordenação por data) ── */
          <AnimatePresence>
            {groupedByDay.map((group) => (
              <DayGroup key={group.dateStr} dateStr={group.dateStr} total={group.total}>
                <div className="space-y-2">
                  {group.items.map((exp) => (
                    <ExpenseCard
                      key={exp.id}
                      expense={exp}
                      categoryColor={categoryColorMap[exp.category_name ?? '']}
                      onEdit={onEdit}
                      onDelete={handleDeleteRequest}
                      onDuplicate={onDuplicate}
                      onViewReceipt={onViewReceipt}
                    />
                  ))}
                </div>
              </DayGroup>
            ))}
          </AnimatePresence>
        ) : (
          /* ── Lista plana (ordenação por valor) ── */
          <AnimatePresence>
            {filtered.map((exp) => (
              <ExpenseCard
                key={exp.id}
                expense={exp}
                categoryColor={categoryColorMap[exp.category_name ?? '']}
                onEdit={onEdit}
                onDelete={handleDeleteRequest}
                onDuplicate={onDuplicate}
                onViewReceipt={onViewReceipt}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* 5. GALERIA ───────────────────────────────────────────────────────── */}
      <ReceiptGallery
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        expenses={expenses}
        currentDate={currentDate}
        onViewReceipt={onViewReceipt}
      />

      {/* 6. MODAL CONFIRMAÇÃO ─────────────────────────────────────────────── */}
      <ConfirmDeleteModal
        expense={expenseToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setExpenseToDelete(null)}
      />
    </div>
  );
}