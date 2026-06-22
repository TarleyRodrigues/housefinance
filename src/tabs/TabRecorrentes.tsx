// ─── ABA: GASTOS RECORRENTES / FIXOS ─────────────────────────────────────────

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Repeat2, Plus, Edit2, Trash2, Pause, Play, Send, CheckCircle2,
  X, AlertTriangle, ChevronDown, Loader2, CreditCard, History,
  Calendar, Minus,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency, handleCurrencyInput, parseAmount, addMonths } from '../utils';
import type { RecurringExpense, Category, Expense } from '../types';

// ─── tipos locais ─────────────────────────────────────────────────────────────

interface InstallmentData {
  description: string;
  amount_per_installment: number;
  total_installments: number;
  first_payment_date: string;
  category_name: string;
  day_of_month: number;
}

interface Props {
  recurringExpenses: RecurringExpense[];
  expenses: Expense[];
  categories: Category[];
  currentDate: Date;
  isLoading: boolean;
  showToast: (msg: string, type?: string) => void;
  onAdd: (data: { description: string; amount: number; category_name: string; day_of_month: number }) => Promise<void>;
  onAddInstallment: (data: InstallmentData) => Promise<void>;
  onUpdate: (id: string, data: { description?: string; amount?: number; category_name?: string; day_of_month?: number }) => Promise<void>;
  onToggle: (id: string, is_active: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeleteInstallment: (id: string, description: string, category_name: string) => Promise<void>;
  onLaunch: (recurring: RecurringExpense) => Promise<void>;
  fetchData: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: HistoryModal
// ─────────────────────────────────────────────────────────────────────────────
function HistoryModal({ item, expenses, todayStr, onClose }: {
  item: RecurringExpense;
  expenses: Expense[];
  todayStr: string;
  onClose: () => void;
}) {
  const isInstallment = item.plan_type === 'installment';
  const history = useMemo(() =>
    expenses
      .filter(e => !e.is_deleted && e.description === item.description && e.category_name === item.category_name)
      .sort((a, b) => (a.expense_date ?? '').localeCompare(b.expense_date ?? '')),
    [expenses, item]
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="bg-white dark:bg-slate-800 rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-800 dark:text-white text-base leading-tight">{item.description}</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">
                {isInstallment
                  ? `${history.filter(e => (e.expense_date ?? '') <= todayStr).length} / ${item.total_installments ?? history.length} parcelas pagas`
                  : `${history.length} lançamento${history.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 active:scale-90 transition-all shrink-0">
              <X size={15} />
            </button>
          </div>

          {/* Lista */}
          <div className="max-h-[55vh] overflow-y-auto p-4 space-y-2">
            {history.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-slate-300 dark:text-slate-600">
                <History size={32} strokeWidth={1.5} />
                <p className="text-[10px] font-black uppercase tracking-widest">Sem registros</p>
              </div>
            ) : history.map((e, i) => {
              const isPast = (e.expense_date ?? '') <= todayStr;
              return (
                <div key={e.id} className={`flex items-center gap-3 p-3 rounded-2xl ${isPast ? 'bg-slate-50 dark:bg-slate-900/50' : 'bg-blue-50/50 dark:bg-blue-900/10'}`}>
                  {isInstallment && (
                    <span className="text-[9px] font-black text-slate-400 w-6 shrink-0">{i + 1}x</span>
                  )}
                  <span className={`text-[9px] font-black px-2 py-1 rounded-lg shrink-0 ${
                    isPast
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  }`}>
                    {isPast ? 'Pago' : 'Futuro'}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex-1">
                    {e.expense_date
                      ? format(new Date(e.expense_date + 'T12:00:00'), 'dd MMM yyyy', { locale: ptBR })
                      : '—'}
                  </span>
                  <span className="font-black text-sm text-slate-800 dark:text-slate-200 shrink-0">
                    {formatCurrency(e.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: ConfirmDeleteModal
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmDeleteModal({ item, isInstallment, onConfirm, onCancel }: {
  item: RecurringExpense | null;
  isInstallment?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!item) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">
              {isInstallment ? 'Remover parcelamento?' : 'Remover gasto fixo?'}
            </h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              <span className="font-bold text-slate-600 dark:text-slate-300">{item.description}</span>
              {' '}· {formatCurrency(item.amount)}{isInstallment ? '/parcela' : '/mês'}<br />
              {isInstallment
                ? 'As parcelas futuras serão removidas do extrato. As já pagas permanecem.'
                : 'Esta ação não pode ser desfeita.'}
            </p>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onCancel}
              className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider active:scale-95 transition-all">
              Cancelar
            </button>
            <button onClick={onConfirm}
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
// SUB: RecurringForm — add / edit assinatura
// ─────────────────────────────────────────────────────────────────────────────
function RecurringForm({ editing, categories, onSave, onClose }: {
  editing: RecurringExpense | null;
  categories: Category[];
  onSave: (data: { description: string; amount: number; category_name: string; day_of_month: number; id?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [description, setDescription] = useState(editing?.description ?? '');
  const [amount, setAmount]           = useState(editing ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(editing.amount) : '');
  const [category, setCategory]       = useState(editing?.category_name ?? '');
  const [dayOfMonth, setDayOfMonth]   = useState(String(editing?.day_of_month ?? 1));
  const [saving, setSaving]           = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseAmount(amount);
    if (!num || !description || !category) return;
    setSaving(true);
    try {
      await onSave({ id: editing?.id, description, amount: num, category_name: category, day_of_month: Math.min(Math.max(parseInt(dayOfMonth) || 1, 1), 31) });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-black text-base uppercase tracking-tight text-violet-600">
            {editing ? 'Editar Assinatura' : 'Nova Assinatura'}
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-violet-600 text-lg">R$</span>
            <input type="text" inputMode="numeric" placeholder="0,00" required value={amount}
              onChange={e => setAmount(handleCurrencyInput(e.target.value))}
              className="w-full p-4 pl-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl text-2xl font-black outline-none text-violet-600 border-2 border-transparent focus:border-violet-500 transition-all" />
          </div>
          <input type="text" placeholder="Descrição (ex: Netflix, Aluguel)" required value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200 font-medium" />
          <select required value={category} onChange={e => setCategory(e.target.value)}
            className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold uppercase text-xs">
            <option value="">Categoria...</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <label className="flex items-center gap-1.5 px-4 pt-3 pb-1">
              <Repeat2 size={11} className="text-slate-400" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Todo dia do mês</span>
            </label>
            <input type="number" min={1} max={31} required value={dayOfMonth}
              onChange={e => setDayOfMonth(e.target.value)}
              className="w-full px-4 pb-3 bg-transparent outline-none text-slate-800 dark:text-slate-200 font-bold text-lg" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-violet-500/30 active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 size={18} className="animate-spin" />}
            Salvar
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: InstallmentForm — novo parcelamento
// ─────────────────────────────────────────────────────────────────────────────
function InstallmentForm({ categories, onSave, onClose }: {
  categories: Category[];
  onSave: (data: InstallmentData) => Promise<void>;
  onClose: () => void;
}) {
  const [description, setDescription]   = useState('');
  const [totalAmount, setTotalAmount]   = useState('');
  const [installments, setInstallments] = useState(2);
  const [firstDate, setFirstDate]       = useState('');
  const [category, setCategory]         = useState('');
  const [saving, setSaving]             = useState(false);

  const parsedTotal        = parseAmount(totalAmount) || 0;
  const amountPerInstall   = installments > 0 && parsedTotal > 0 ? parsedTotal / installments : 0;
  const lastPaymentDate    = firstDate && installments > 0 ? addMonths(firstDate, installments - 1) : '';
  const dayOfMonth         = firstDate ? parseInt(firstDate.split('-')[2]) : 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedTotal || installments < 1 || !firstDate || !category || !description) return;
    setSaving(true);
    try {
      await onSave({
        description,
        amount_per_installment: parseFloat(amountPerInstall.toFixed(2)),
        total_installments: installments,
        first_payment_date: firstDate,
        category_name: category,
        day_of_month: dayOfMonth,
      });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-black text-base uppercase tracking-tight text-blue-600">Novo Parcelamento</h3>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Valor total */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-blue-600 text-lg">R$</span>
            <input type="text" inputMode="numeric" placeholder="Valor total da compra" required value={totalAmount}
              onChange={e => setTotalAmount(handleCurrencyInput(e.target.value))}
              className="w-full p-4 pl-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl text-xl font-black outline-none text-blue-600 border-2 border-transparent focus:border-blue-500 transition-all" />
          </div>

          {/* Descrição */}
          <input type="text" placeholder="Descrição (ex: TV Samsung, Notebook)" required value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200 font-medium" />

          {/* Categoria */}
          <select required value={category} onChange={e => setCategory(e.target.value)}
            className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold uppercase text-xs">
            <option value="">Categoria...</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>

          {/* Nº de parcelas */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">Número de parcelas</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setInstallments(n => Math.max(2, n - 1))}
                className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-90 transition-all">
                <Minus size={16} />
              </button>
              <input type="number" min={2} max={60} required value={installments}
                onChange={e => setInstallments(Math.min(60, Math.max(2, parseInt(e.target.value) || 2)))}
                className="flex-1 text-center bg-transparent outline-none text-slate-800 dark:text-slate-200 font-black text-2xl" />
              <button type="button" onClick={() => setInstallments(n => Math.min(60, n + 1))}
                className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-90 transition-all">
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Primeira parcela */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <label className="flex items-center gap-1.5 px-4 pt-3 pb-1">
              <Calendar size={11} className="text-slate-400" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Data da 1ª parcela</span>
            </label>
            <input type="date" required value={firstDate} onChange={e => setFirstDate(e.target.value)}
              className="w-full px-4 pb-3 bg-transparent outline-none text-slate-800 dark:text-slate-200 font-bold" />
          </div>

          {/* Preview */}
          {amountPerInstall > 0 && firstDate && lastPaymentDate && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 text-center space-y-1">
              <p className="font-black text-blue-700 dark:text-blue-300 text-base">
                {installments}× de {formatCurrency(amountPerInstall)}
              </p>
              <p className="text-[10px] text-blue-500 dark:text-blue-400 font-bold">
                de {format(new Date(firstDate + 'T12:00:00'), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                {' '}até{' '}
                {format(new Date(lastPaymentDate + 'T12:00:00'), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          )}

          <button type="submit" disabled={saving}
            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 size={18} className="animate-spin" />}
            Criar Parcelamento
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: RecurringCard — assinatura
// ─────────────────────────────────────────────────────────────────────────────
function RecurringCard({ item, categoryColor, isLaunched, onEdit, onDelete, onToggle, onLaunch, onHistory }: {
  item: RecurringExpense;
  categoryColor?: string;
  isLaunched: boolean;
  onEdit: (item: RecurringExpense) => void;
  onDelete: (item: RecurringExpense) => void;
  onToggle: (item: RecurringExpense) => void;
  onLaunch: (item: RecurringExpense) => void;
  onHistory: (item: RecurringExpense) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      className={`bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-[2rem] border shadow-sm p-4 space-y-3 ${
        item.is_active ? 'border-slate-200 dark:border-slate-700' : 'border-slate-100 dark:border-slate-800 opacity-60'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: (categoryColor ?? '#8b5cf6') + '20' }}>
          <Repeat2 size={18} style={{ color: categoryColor ?? '#8b5cf6' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md"
              style={{ backgroundColor: (categoryColor ?? '#8b5cf6') + '25', color: categoryColor ?? '#8b5cf6' }}>
              {item.category_name}
            </span>
            <span className="text-[9px] text-slate-400 font-bold">· dia {item.day_of_month}</span>
          </div>
          <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{item.description}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="font-black text-base text-slate-900 dark:text-white block">{formatCurrency(item.amount)}</span>
          <span className="text-[9px] text-slate-400 font-bold">/mês</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
        {isLaunched ? (
          <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-wide">
            <CheckCircle2 size={12} /> Lançado este mês
          </div>
        ) : (
          <button onClick={() => onLaunch(item)} disabled={!item.is_active}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-violet-600 text-white font-black text-[10px] uppercase tracking-wide active:scale-95 transition-all shadow-sm shadow-violet-500/20 disabled:opacity-30">
            <Send size={12} /> Lançar este mês
          </button>
        )}
        <button onClick={() => onHistory(item)} aria-label="Histórico"
          className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-700 text-slate-400 flex items-center justify-center active:scale-90 transition-all">
          <History size={15} />
        </button>
        <button onClick={() => onToggle(item)} aria-label={item.is_active ? 'Pausar' : 'Ativar'}
          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${
            item.is_active ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'
          }`}>
          {item.is_active ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button onClick={() => onEdit(item)} aria-label="Editar"
          className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-700 text-slate-400 flex items-center justify-center active:scale-90 transition-all">
          <Edit2 size={15} />
        </button>
        <button onClick={() => onDelete(item)} aria-label="Remover"
          className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-400 flex items-center justify-center active:scale-90 transition-all">
          <Trash2 size={15} />
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: InstallmentCard — parcelamento
// ─────────────────────────────────────────────────────────────────────────────
function InstallmentCard({ item, categoryColor, paidCount, nextDate, onHistory, onDelete }: {
  item: RecurringExpense;
  categoryColor?: string;
  paidCount: number;
  nextDate: string | null;
  onHistory: (item: RecurringExpense) => void;
  onDelete: (item: RecurringExpense) => void;
}) {
  const total    = item.total_installments ?? 1;
  const progress = Math.min(paidCount / total, 1);
  const isDone   = paidCount >= total;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-3"
    >
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: (categoryColor ?? '#3b82f6') + '20' }}>
          <CreditCard size={18} style={{ color: categoryColor ?? '#3b82f6' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md"
              style={{ backgroundColor: (categoryColor ?? '#3b82f6') + '25', color: categoryColor ?? '#3b82f6' }}>
              {item.category_name}
            </span>
            {isDone
              ? <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-md">Concluído</span>
              : nextDate && (
                <span className="text-[9px] text-slate-400 font-bold">
                  · próx. {format(new Date(nextDate + 'T12:00:00'), 'dd/MM', { locale: ptBR })}
                </span>
              )
            }
          </div>
          <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{item.description}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="font-black text-base text-slate-900 dark:text-white block">{formatCurrency(item.amount)}</span>
          <span className="text-[9px] text-slate-400 font-bold">{total}x</span>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide">
            {paidCount} de {total} parcelas
          </span>
          <span className="text-[9px] font-black" style={{ color: isDone ? '#10b981' : (categoryColor ?? '#3b82f6') }}>
            {Math.round(progress * 100)}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: isDone ? '#10b981' : (categoryColor ?? '#3b82f6') }}
          />
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
        <button onClick={() => onHistory(item)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-wide active:scale-95 transition-all">
          <History size={12} /> Ver parcelas
        </button>
        <button onClick={() => onDelete(item)} aria-label="Remover parcelamento"
          className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-400 flex items-center justify-center active:scale-90 transition-all">
          <Trash2 size={15} />
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function TabRecorrentes({
  recurringExpenses, expenses, categories, currentDate, isLoading,
  showToast, onAdd, onAddInstallment, onUpdate, onToggle, onDelete, onDeleteInstallment, onLaunch, fetchData,
}: Props) {
  const [viewMode, setViewMode]         = useState<'subscriptions' | 'installments'>('subscriptions');
  const [showSubForm, setShowSubForm]   = useState(false);
  const [showInstForm, setShowInstForm] = useState(false);
  const [editingItem, setEditingItem]   = useState<RecurringExpense | null>(null);
  const [deletingItem, setDeletingItem] = useState<RecurringExpense | null>(null);
  const [historyItem, setHistoryItem]   = useState<RecurringExpense | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const todayStr = useMemo(() => {
    const d = currentDate;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [currentDate]);

  const subscriptions    = useMemo(() => recurringExpenses.filter(r => !r.plan_type || r.plan_type === 'subscription'), [recurringExpenses]);
  const installmentPlans = useMemo(() => recurringExpenses.filter(r => r.plan_type === 'installment'), [recurringExpenses]);
  const activeSubs       = useMemo(() => subscriptions.filter(r => r.is_active),  [subscriptions]);
  const inactiveSubs     = useMemo(() => subscriptions.filter(r => !r.is_active), [subscriptions]);

  const categoryColorMap = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    categories.forEach(c => { map[c.name] = c.color ?? undefined; });
    return map;
  }, [categories]);

  const launchedIds = useMemo(() => {
    const prefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const ids = new Set<string>();
    subscriptions.forEach(r => {
      const hit = expenses.some(e =>
        !e.is_deleted && e.description === r.description &&
        e.category_name === r.category_name && e.expense_date?.startsWith(prefix)
      );
      if (hit) ids.add(r.id);
    });
    return ids;
  }, [subscriptions, expenses, currentDate]);

  const installmentStats = useMemo(() => {
    const stats: Record<string, { paidCount: number; nextDate: string | null; remainingTotal: number }> = {};
    installmentPlans.forEach(plan => {
      const matching = expenses
        .filter(e => !e.is_deleted && e.description === plan.description && e.category_name === plan.category_name)
        .sort((a, b) => (a.expense_date ?? '').localeCompare(b.expense_date ?? ''));
      const paid   = matching.filter(e => (e.expense_date ?? '') <= todayStr);
      const future = matching.filter(e => (e.expense_date ?? '') > todayStr);
      stats[plan.id] = {
        paidCount: paid.length,
        nextDate: future[0]?.expense_date ?? null,
        remainingTotal: future.reduce((s, e) => s + Number(e.amount), 0),
      };
    });
    return stats;
  }, [installmentPlans, expenses, todayStr]);

  const subMonthlyTotal      = useMemo(() => activeSubs.reduce((a, r) => a + Number(r.amount), 0), [activeSubs]);
  const installRemainingTotal = useMemo(() => installmentPlans.reduce((s, p) => s + (installmentStats[p.id]?.remainingTotal ?? 0), 0), [installmentPlans, installmentStats]);
  const activeInstallPlans   = useMemo(() => installmentPlans.filter(p => (installmentStats[p.id]?.paidCount ?? 0) < (p.total_installments ?? 1)), [installmentPlans, installmentStats]);

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleSubSave = useCallback(async (data: { description: string; amount: number; category_name: string; day_of_month: number; id?: string }) => {
    try {
      if (data.id) { const { id, ...u } = data; await onUpdate(id, u); showToast('Assinatura atualizada!'); }
      else { const { id: _id, ...rest } = data; await onAdd(rest); showToast('Assinatura adicionada!'); }
      fetchData();
    } catch { showToast('Erro ao salvar', 'error'); throw new Error('err'); }
  }, [onAdd, onUpdate, fetchData, showToast]);

  const handleAddInstallment = useCallback(async (data: InstallmentData) => {
    try {
      await onAddInstallment(data);
      showToast(`Parcelamento criado! ${data.total_installments} parcelas de ${formatCurrency(data.amount_per_installment)}`);
    } catch { showToast('Erro ao criar parcelamento', 'error'); throw new Error('err'); }
  }, [onAddInstallment, showToast]);

  const handleToggle = useCallback(async (item: RecurringExpense) => {
    try {
      await onToggle(item.id, !item.is_active);
      showToast(item.is_active ? 'Assinatura pausada' : 'Assinatura reativada');
      fetchData();
    } catch { showToast('Erro ao alterar status', 'error'); }
  }, [onToggle, fetchData, showToast]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingItem) return;
    try {
      if (deletingItem.plan_type === 'installment') {
        await onDeleteInstallment(deletingItem.id, deletingItem.description, deletingItem.category_name);
        showToast('Parcelamento removido', 'info');
      } else {
        await onDelete(deletingItem.id);
        showToast('Assinatura removida', 'info');
      }
      fetchData();
    } catch { showToast('Erro ao remover', 'error'); }
    finally { setDeletingItem(null); }
  }, [deletingItem, onDelete, onDeleteInstallment, fetchData, showToast]);

  const handleLaunch = useCallback(async (item: RecurringExpense) => {
    try { await onLaunch(item); showToast(`${item.description} lançado no extrato!`); }
    catch { showToast('Erro ao lançar', 'error'); }
  }, [onLaunch, showToast]);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-10">

      {/* ── Header ── */}
      <AnimatePresence mode="wait">
        {viewMode === 'subscriptions' ? (
          <motion.div key="sub-header"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-gradient-to-br from-violet-600 to-purple-700 p-6 rounded-[2.5rem] shadow-2xl shadow-purple-500/30 text-white relative overflow-hidden"
          >
            <div className="absolute -right-10 -top-10 w-44 h-44 bg-white/8 rounded-full pointer-events-none" />
            <div className="absolute -left-6 -bottom-10 w-32 h-32 bg-purple-400/20 rounded-full pointer-events-none" />
            <div className="relative z-10">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })} · Assinaturas
              </span>
              <p className="text-4xl font-black tracking-tighter mt-1">{formatCurrency(subMonthlyTotal)}</p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <div className="flex items-center gap-1 bg-white/10 rounded-xl px-2.5 py-1">
                  <span className="text-[10px] font-black">{activeSubs.length}</span>
                  <span className="text-[9px] opacity-70">ativas</span>
                </div>
                {inactiveSubs.length > 0 && (
                  <div className="flex items-center gap-1 bg-white/10 rounded-xl px-2.5 py-1">
                    <span className="text-[10px] font-black">{inactiveSubs.length}</span>
                    <span className="text-[9px] opacity-70">pausadas</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="inst-header"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-[2.5rem] shadow-2xl shadow-blue-500/30 text-white relative overflow-hidden"
          >
            <div className="absolute -right-10 -top-10 w-44 h-44 bg-white/8 rounded-full pointer-events-none" />
            <div className="absolute -left-6 -bottom-10 w-32 h-32 bg-blue-400/20 rounded-full pointer-events-none" />
            <div className="relative z-10">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Parcelamentos · a pagar</span>
              <p className="text-4xl font-black tracking-tighter mt-1">{formatCurrency(installRemainingTotal)}</p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <div className="flex items-center gap-1 bg-white/10 rounded-xl px-2.5 py-1">
                  <span className="text-[10px] font-black">{installmentPlans.length}</span>
                  <span className="text-[9px] opacity-70">planos</span>
                </div>
                <div className="flex items-center gap-1 bg-white/10 rounded-xl px-2.5 py-1">
                  <span className="text-[10px] font-black">{activeInstallPlans.length}</span>
                  <span className="text-[9px] opacity-70">em andamento</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tabs de modo ── */}
      <div className="flex gap-2 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-2xl">
        {(['subscriptions', 'installments'] as const).map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
              viewMode === mode
                ? mode === 'subscriptions'
                  ? 'bg-white dark:bg-slate-700 text-violet-600 shadow-sm'
                  : 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                : 'text-slate-400 dark:text-slate-500'
            }`}>
            {mode === 'subscriptions' ? <><Repeat2 size={12} /> Assinaturas</> : <><CreditCard size={12} /> Parcelas</>}
          </button>
        ))}
      </div>

      {/* ── Botão adicionar ── */}
      <button
        onClick={() => viewMode === 'subscriptions' ? (setEditingItem(null), setShowSubForm(true)) : setShowInstForm(true)}
        className={`w-full flex items-center justify-center gap-2 py-4 rounded-[2rem] border-2 border-dashed font-black text-xs uppercase tracking-widest active:scale-95 transition-all bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm ${
          viewMode === 'subscriptions'
            ? 'border-violet-200 dark:border-violet-800 text-violet-500 dark:text-violet-400'
            : 'border-blue-200 dark:border-blue-800 text-blue-500 dark:text-blue-400'
        }`}>
        <Plus size={16} />
        {viewMode === 'subscriptions' ? 'Adicionar Assinatura' : 'Novo Parcelamento'}
      </button>

      {/* ── Conteúdo ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-[2rem] animate-pulse" />)}
        </div>
      ) : viewMode === 'subscriptions' ? (
        <>
          {activeSubs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-slate-300 dark:text-slate-600">
              <Repeat2 size={40} strokeWidth={1.5} />
              <p className="font-black uppercase text-[10px] tracking-widest">Nenhuma assinatura ativa</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">{activeSubs.length} ativa{activeSubs.length !== 1 ? 's' : ''}</p>
              <AnimatePresence>
                {activeSubs.map(item => (
                  <RecurringCard key={item.id} item={item}
                    categoryColor={categoryColorMap[item.category_name]}
                    isLaunched={launchedIds.has(item.id)}
                    onEdit={i => { setEditingItem(i); setShowSubForm(true); }}
                    onDelete={setDeletingItem}
                    onToggle={handleToggle}
                    onLaunch={handleLaunch}
                    onHistory={setHistoryItem}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {inactiveSubs.length > 0 && (
            <div className="space-y-2">
              <button onClick={() => setShowInactive(v => !v)}
                className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 px-1 active:scale-95 transition-all">
                <motion.div animate={{ rotate: showInactive ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown size={14} />
                </motion.div>
                {inactiveSubs.length} pausada{inactiveSubs.length !== 1 ? 's' : ''}
              </button>
              <AnimatePresence>
                {showInactive && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                    className="overflow-hidden space-y-3">
                    {inactiveSubs.map(item => (
                      <RecurringCard key={item.id} item={item}
                        categoryColor={categoryColorMap[item.category_name]}
                        isLaunched={launchedIds.has(item.id)}
                        onEdit={i => { setEditingItem(i); setShowSubForm(true); }}
                        onDelete={setDeletingItem}
                        onToggle={handleToggle}
                        onLaunch={handleLaunch}
                        onHistory={setHistoryItem}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      ) : (
        <>
          {installmentPlans.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-slate-300 dark:text-slate-600">
              <CreditCard size={40} strokeWidth={1.5} />
              <p className="font-black uppercase text-[10px] tracking-widest">Nenhum parcelamento</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {installmentPlans.map(item => {
                  const stats = installmentStats[item.id] ?? { paidCount: 0, nextDate: null, remainingTotal: 0 };
                  return (
                    <InstallmentCard key={item.id} item={item}
                      categoryColor={categoryColorMap[item.category_name]}
                      paidCount={stats.paidCount}
                      nextDate={stats.nextDate}
                      onHistory={setHistoryItem}
                      onDelete={setDeletingItem}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* ── Modais ── */}
      <AnimatePresence>
        {showSubForm && (
          <RecurringForm editing={editingItem} categories={categories}
            onSave={handleSubSave}
            onClose={() => { setShowSubForm(false); setEditingItem(null); }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInstForm && (
          <InstallmentForm categories={categories}
            onSave={handleAddInstallment}
            onClose={() => setShowInstForm(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyItem && (
          <HistoryModal item={historyItem} expenses={expenses} todayStr={todayStr} onClose={() => setHistoryItem(null)} />
        )}
      </AnimatePresence>

      <ConfirmDeleteModal
        item={deletingItem}
        isInstallment={deletingItem?.plan_type === 'installment'}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingItem(null)}
      />
    </div>
  );
}
