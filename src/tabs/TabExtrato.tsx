// ─── ABA: EXTRATO ────────────────────────────────────────────────────────────
// Melhorias aplicadas:
// ✅ useMemo nos filtros (performance)
// ✅ Debounce na busca (UX)
// ✅ deleteExpense movida para prop/hook (arquitetura)
// ✅ aria-label em todos os botões (acessibilidade)
// ✅ alt descritivo em todas as imagens (acessibilidade)
// ✅ Modal de confirmação customizado no lugar do confirm() nativo
// ✅ ExpenseCard extraído como sub-componente
// ✅ ReceiptGallery extraído como sub-componente

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Edit2, Trash2, Search, Filter, ArrowUpRight, ArrowDownRight,
  Paperclip, Image as ImageIcon, X, AlertTriangle,
} from 'lucide-react';
import { SkeletonCard } from '../components/ui';
import { formatCurrency } from '../utils';
import type { Expense, Category } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: useDebounce
// ─────────────────────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTE: ConfirmDeleteModal
// Substitui o confirm() nativo do browser
// ─────────────────────────────────────────────────────────────────────────────
interface ConfirmDeleteModalProps {
  expense: Expense | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDeleteModal({ expense, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  if (!expense) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        onClick={onCancel}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <h3
              id="confirm-delete-title"
              className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight"
            >
              Remover gasto?
            </h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              <span className="font-bold text-slate-600 dark:text-slate-300">
                {expense.description || 'Sem descrição'}
              </span>{' '}
              · {formatCurrency(expense.amount)}
              <br />
              Esta ação não pode ser desfeita.
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider active:scale-95 transition-all"
              aria-label="Cancelar remoção"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-red-500/30"
              aria-label="Confirmar remoção do gasto"
            >
              Remover
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTE: ExpenseCard
// Card individual de despesa, extraído para isolamento e reuso
// ─────────────────────────────────────────────────────────────────────────────
interface ExpenseCardProps {
  expense: Expense;
  onEdit: (exp: Expense) => void;
  onDelete: (exp: Expense) => void;
  onViewReceipt: (url: string) => void;
}

function ExpenseCard({ expense, onEdit, onDelete, onViewReceipt }: ExpenseCardProps) {
  const avatarUrl =
    expense.profiles?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(expense.profiles?.full_name ?? 'U')}`;

  return (
    <motion.div
      layout
      key={expense.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-white dark:bg-slate-800 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between transition-all"
    >
      <div className="flex items-center gap-3 flex-1 overflow-hidden">
        <img
          src={avatarUrl}
          className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-50 dark:border-slate-700 shadow-sm"
          alt={`Avatar de ${expense.profiles?.full_name ?? 'usuário'}`}
        />
        <div className="flex flex-col min-w-0">
          <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest leading-none mb-1">
            {expense.category_name}
          </span>
          <span className="font-bold truncate text-sm leading-tight text-slate-800 dark:text-slate-200">
            {expense.description || 'Sem descrição'}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">
              {expense.profiles?.full_name}
            </span>
            {expense.receipt_url && (
              <button
                onClick={() => onViewReceipt(expense.receipt_url!)}
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
        <span className="font-black text-slate-900 dark:text-white text-base block mb-1">
          {formatCurrency(expense.amount)}
        </span>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => onEdit(expense)}
            aria-label={`Editar despesa: ${expense.description || 'sem descrição'}`}
            className="text-slate-300 dark:text-slate-500 hover:text-blue-500 transition-colors"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onDelete(expense)}
            aria-label={`Remover despesa: ${expense.description || 'sem descrição'}`}
            className="text-slate-300 dark:text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTE: ReceiptGallery
// Modal de galeria de recibos extraído para isolamento
// ─────────────────────────────────────────────────────────────────────────────
interface ReceiptGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: Expense[];
  currentDate: Date;
  onViewReceipt: (url: string) => void;
}

function ReceiptGallery({ isOpen, onClose, expenses, currentDate, onViewReceipt }: ReceiptGalleryProps) {
  const expensesWithReceipts = useMemo(() => expenses.filter((e) => e.receipt_url), [expenses]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-white dark:bg-slate-900 z-[200] flex flex-col transition-colors"
          role="dialog"
          aria-modal="true"
          aria-label="Galeria de recibos"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
            <div className="flex flex-col">
              <h3 className="font-black uppercase text-sm tracking-widest leading-none">
                Galeria de Recibos
              </h3>
              <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar galeria de recibos"
              className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 transition-transform active:scale-90"
            >
              <X size={20} />
            </button>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {expensesWithReceipts.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {expensesWithReceipts.map((e) => (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    key={e.id}
                    onClick={() => onViewReceipt(e.receipt_url!)}
                    aria-label={`Ver comprovante de ${e.description || 'despesa'} — ${formatCurrency(e.amount)}`}
                    className="aspect-square rounded-2xl overflow-hidden border-2 border-slate-50 dark:border-slate-800 shadow-sm relative group"
                  >
                    <img
                      src={e.receipt_url!}
                      className="w-full h-full object-cover"
                      alt={`Comprovante de ${e.description || 'despesa'}`}
                    />
                    <div className="absolute inset-0 bg-black/20 group-active:bg-black/0 transition-colors" />
                    <div className="absolute bottom-1 right-2 text-[8px] font-black text-white drop-shadow-md">
                      {formatCurrency(e.amount)}
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-300">
                <ImageIcon size={48} className="opacity-20" aria-hidden="true" />
                <p className="font-black uppercase text-[10px] tracking-widest">
                  Nenhum comprovante este mês
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
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
// COMPONENTE PRINCIPAL: TabExtrato
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
  onViewReceipt: (url: string) => void;
  // ✅ MELHORIA: deleteExpense vem de fora (hook/orquestrador)
  // Em useDashboardData.ts adicione:
  //   const deleteExpense = async (id: string) => {
  //     await supabase.from('expenses').update({ is_deleted: true }).eq('id', id);
  //   }
  onDelete: (id: string) => Promise<void>;
}

export function TabExtrato({
  expenses,
  categories,
  prevMonthTotal,
  isLoading,
  currentDate,
  fetchData,
  showToast,
  onEdit,
  onViewReceipt,
  onDelete,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  // ✅ MELHORIA: estado para modal de confirmação em vez de confirm() nativo
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // ✅ MELHORIA: debounce de 300ms — evita re-filtrar a cada tecla
  const debouncedSearch = useDebounce(searchTerm, 300);

  // ✅ MELHORIA: useMemo — filtros só recalculam quando dependências mudam
  const filtered = useMemo(
    () =>
      expenses
        .filter((exp) => !filterUserId || exp.user_id === filterUserId)
        .filter((exp) => !filterCategory || exp.category_name === filterCategory)
        .filter(
          (exp) =>
            !debouncedSearch ||
            exp.description?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            exp.category_name?.toLowerCase().includes(debouncedSearch.toLowerCase())
        ),
    [expenses, filterUserId, filterCategory, debouncedSearch]
  );

  // ✅ MELHORIA: useMemo em cálculos derivados
  const totalFiltered = useMemo(
    () => filtered.reduce((acc, curr) => acc + Number(curr.amount), 0),
    [filtered]
  );

  const totalMonth = useMemo(
    () => expenses.reduce((acc, curr) => acc + Number(curr.amount), 0),
    [expenses]
  );

  const uniqueUserIds = useMemo(
    () => Array.from(new Set(expenses.map((e) => e.user_id))),
    [expenses]
  );

  const activeCategories = useMemo(
    () => categories.filter((cat) => expenses.some((e) => e.category_name === cat.name)),
    [categories, expenses]
  );

  const expensesWithReceipts = useMemo(
    () => expenses.filter((e) => e.receipt_url),
    [expenses]
  );

  const diff = prevMonthTotal > 0 ? ((totalMonth - prevMonthTotal) / prevMonthTotal) * 100 : 0;

  // ✅ MELHORIA: handler de deleção isolado e tipado
  const handleDeleteRequest = useCallback((exp: Expense) => {
    setExpenseToDelete(exp);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!expenseToDelete) return;
    try {
      await onDelete(expenseToDelete.id);
      showToast('Gasto removido', 'info');
      fetchData();
    } catch {
      showToast('Erro ao remover gasto', 'error');
    } finally {
      setExpenseToDelete(null);
    }
  }, [expenseToDelete, onDelete, showToast, fetchData]);

  const handleDeleteCancel = useCallback(() => {
    setExpenseToDelete(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* 1. CARD DE RESUMO INTELIGENTE */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-[2.5rem] shadow-xl shadow-blue-500/20 text-white relative overflow-hidden transition-all">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
              Total Filtrado
            </span>
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black ${
                diff > 0 ? 'bg-red-400/30' : 'bg-emerald-400/30'
              }`}
              aria-label={`${Math.abs(diff).toFixed(0)}% ${diff > 0 ? 'a mais' : 'a menos'} que o mês anterior`}
            >
              {diff > 0 ? (
                <ArrowUpRight size={10} aria-hidden="true" />
              ) : (
                <ArrowDownRight size={10} aria-hidden="true" />
              )}
              {Math.abs(diff).toFixed(0)}% vs anterior
            </div>
          </div>

          <h1 className="text-4xl font-black tracking-tighter" aria-live="polite">
            {formatCurrency(totalFiltered)}
          </h1>

          {/* BARRA DE BUSCA */}
          <div className="flex items-center gap-2 mt-4 bg-black/10 p-1 rounded-2xl border border-white/5">
            <div className="bg-white/20 p-2 rounded-xl text-white" aria-hidden="true">
              <Search size={16} />
            </div>
            <label htmlFor="expense-search" className="sr-only">
              Buscar despesas
            </label>
            <input
              id="expense-search"
              className="bg-transparent border-none outline-none text-xs font-bold w-full placeholder:text-white/40 text-white"
              placeholder="O que você procura?"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Buscar despesas por descrição ou categoria"
            />
            {/* ✅ Botão de limpar busca */}
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                aria-label="Limpar busca"
                className="bg-white/10 p-2 rounded-xl text-white/60 hover:text-white transition-colors active:scale-90"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      </div>

      {/* 2. FILTROS POR USUÁRIO (AVATARES) */}
      <div
        className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1 px-1"
        role="group"
        aria-label="Filtrar por usuário"
      >
        <button
          onClick={() => setFilterUserId(null)}
          aria-pressed={!filterUserId}
          aria-label="Mostrar despesas de todos os usuários"
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
          const avatarUrl =
            exp.profiles?.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(exp.profiles?.full_name ?? 'U')}`;

          return (
            <button
              key={uid}
              onClick={() => setFilterUserId(filterUserId === uid ? null : uid)}
              aria-pressed={filterUserId === uid}
              aria-label={`Filtrar por ${exp.profiles?.full_name ?? 'usuário'}`}
              className={`flex items-center gap-2 p-1 pr-4 rounded-full border transition-all ${
                filterUserId === uid
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'
              }`}
            >
              <img
                src={avatarUrl}
                className="w-7 h-7 rounded-full object-cover"
                alt={`Foto de ${exp.profiles?.full_name ?? 'usuário'}`}
              />
              <span className="text-[10px] font-black uppercase tracking-tighter">{firstName}</span>
            </button>
          );
        })}
      </div>

      {/* 3. FILTRO POR CATEGORIA + BOTÃO GALERIA */}
      <div
        className="flex items-center gap-2 overflow-x-auto no-scrollbar px-1 border-b border-slate-100 dark:border-slate-800 pb-2"
        role="group"
        aria-label="Filtrar por categoria"
      >
        <button
          onClick={() => setFilterCategory(null)}
          aria-pressed={!filterCategory}
          aria-label="Mostrar todas as categorias"
          className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${
            !filterCategory
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white border-slate-200 dark:border-slate-600'
              : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
          }`}
        >
          <Filter size={10} aria-hidden="true" /> Categorias
        </button>

        <button
          onClick={() => setIsGalleryOpen(true)}
          aria-label={`Abrir galeria com ${expensesWithReceipts.length} recibos`}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 active:scale-95 transition-all whitespace-nowrap"
        >
          <ImageIcon size={10} aria-hidden="true" /> Recibos ({expensesWithReceipts.length})
        </button>

        {activeCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(filterCategory === cat.name ? null : cat.name)}
            aria-pressed={filterCategory === cat.name}
            aria-label={`Filtrar por categoria ${cat.name}`}
            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase whitespace-nowrap transition-all border ${
              filterCategory === cat.name
                ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-200 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* 4. LISTA DE DESPESAS */}
      <div className="space-y-3 pb-10" aria-live="polite" aria-label="Lista de despesas">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)
        ) : filtered.length > 0 ? (
          <AnimatePresence>
            {filtered.map((exp) => (
              <ExpenseCard
                key={exp.id}
                expense={exp}
                onEdit={onEdit}
                onDelete={handleDeleteRequest}
                onViewReceipt={onViewReceipt}
              />
            ))}
          </AnimatePresence>
        ) : (
          <p className="text-center text-slate-300 py-20 font-black uppercase text-[10px] tracking-[0.2em]">
            Nenhum registro encontrado
          </p>
        )}
      </div>

      {/* 5. MODAL: GALERIA DE RECIBOS */}
      <ReceiptGallery
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        expenses={expenses}
        currentDate={currentDate}
        onViewReceipt={onViewReceipt}
      />

      {/* 6. MODAL: CONFIRMAÇÃO DE DELEÇÃO */}
      <ConfirmDeleteModal
        expense={expenseToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}

