// ─── ABA: NOVO GASTO / EDITAR ────────────────────────────────────────────────
// ✅ expense_date — permite registrar gastos retroativos (mês passado, etc.)
// ✅ Templates de gastos padrão — auto-preenche o formulário com um clique

import { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, Image as ImageIcon, X, Zap, CalendarDays, Store, CreditCard } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { haptic } from '../utils/haptic';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { handleCurrencyInput, parseAmount, formatCurrency } from '../utils';
import type { Category, Expense, ExpenseTemplate, Merchant } from '../types';

interface Props {
  categories: Category[];
  expenses: Expense[];
  merchants: Merchant[];
  editingExpense: Expense | null;
  duplicateData?: Expense | null;
  templates: ExpenseTemplate[];
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
  onSaved: () => void;
  currentDate?: Date;
}

export function TabNovoGasto({ categories, expenses, merchants, editingExpense, duplicateData, templates, fetchData, showToast, onSaved, currentDate }: Props) {
  const { user } = useAuth();

  const today  = currentDate ?? new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const defaultPaymentMonth = format(addMonths(today, 1), 'yyyy-MM');

  const [amount, setAmount]         = useState('');
  const [category, setCategory]     = useState('');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant]     = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [date, setDate]             = useState(todayStr);
  const [isCredit, setIsCredit]     = useState(false);
  const [paymentMonth, setPaymentMonth] = useState(defaultPaymentMonth);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [showMerchantSuggestions, setShowMerchantSuggestions] = useState(false);
  const merchantRef = useRef<HTMLDivElement>(null);

  // Catálogo de estabelecimentos primeiro; depois histórico de gastos (sem duplicar)
  const allMerchants = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const m of merchants) {
      const key = m.name.trim();
      if (key && !seen.has(key.toLowerCase())) {
        seen.add(key.toLowerCase());
        result.push(key);
      }
    }
    for (const e of expenses) {
      const m = e.merchant?.trim();
      if (m && !seen.has(m.toLowerCase())) {
        seen.add(m.toLowerCase());
        result.push(m);
      }
    }
    return result;
  }, [merchants, expenses]);

  const merchantSuggestions = useMemo(() => {
    const q = merchant.trim().toLowerCase();
    if (!q) return allMerchants.slice(0, 6);
    return allMerchants.filter(m => m.toLowerCase().includes(q)).slice(0, 6);
  }, [merchant, allMerchants]);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (merchantRef.current && !merchantRef.current.contains(e.target as Node)) {
        setShowMerchantSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Preenche formulário ao editar ou duplicar
  useEffect(() => {
    if (editingExpense) {
      setAmount(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(editingExpense.amount));
      setCategory(editingExpense.category_name);
      setDescription(editingExpense.description ?? '');
      setMerchant(editingExpense.merchant ?? '');
      setReceiptUrl(editingExpense.receipt_url || '');
      setDate(editingExpense.expense_date || format(new Date(editingExpense.created_at), 'yyyy-MM-dd'));
      setIsCredit(!!editingExpense.payment_month);
      setPaymentMonth(editingExpense.payment_month ?? defaultPaymentMonth);
    } else if (duplicateData) {
      setAmount(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(duplicateData.amount));
      setCategory(duplicateData.category_name);
      setDescription(duplicateData.description ?? '');
      setMerchant(duplicateData.merchant ?? '');
      setReceiptUrl('');
      setDate(todayStr);
      setIsCredit(!!duplicateData.payment_month);
      setPaymentMonth(duplicateData.payment_month ?? defaultPaymentMonth);
    } else {
      setAmount('');
      setCategory('');
      setDescription('');
      setMerchant('');
      setReceiptUrl('');
      setDate(todayStr);
      setIsCredit(false);
      setPaymentMonth(defaultPaymentMonth);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingExpense, duplicateData]);

  // Aplica um template ao formulário
  const applyTemplate = (tpl: ExpenseTemplate) => {
    setAmount(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(tpl.amount));
    setCategory(tpl.category_name);
    setDescription(tpl.description);
  };

  const handleReceiptUpload = async (file: File) => {
    setUploadingReceipt(true);
    const fileName = `${user.id}-${Date.now()}-${file.name.replace(/\s/g, '_')}`;
    const { error } = await supabase.storage.from('receipts').upload(fileName, file);
    if (!error) {
      const { data } = supabase.storage.from('receipts').getPublicUrl(fileName);
      setReceiptUrl(data.publicUrl);
      showToast('Comprovante anexado!');
    } else {
      alert('Erro ao subir imagem: ' + error.message);
    }
    setUploadingReceipt(false);
  };

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!user) return;
    if (!category) {
      showToast('Selecione uma categoria', 'error');
      return;
    }

    const numericAmount = parseAmount(amount);
    const itemDesc = description || 'Gasto sem descrição';

    const payload = {
      amount: numericAmount,
      category_name: category,
      description: itemDesc,
      receipt_url: receiptUrl,
      expense_date: date,
      merchant: merchant.trim() || null,
      payment_month: isCredit ? paymentMonth : null,
    };

    try {
      if (editingExpense) {
        const { error: expError } = await supabase.from('expenses').update(payload).eq('id', editingExpense.id);
        if (expError) throw expError;

        await supabase.from('logs').insert({
          user_id: user.id,
          action: 'UPDATE',
          item_description: itemDesc,
          details: `Valor alterado para ${formatCurrency(numericAmount)} na categoria ${category}`,
        });
      } else {
        const { error: expError } = await supabase.from('expenses').insert({ ...payload, user_id: user.id });
        if (expError) throw expError;

        await supabase.from('logs').insert({
          user_id: user.id,
          action: 'INSERT',
          item_description: itemDesc,
          details: `Inseriu novo gasto de ${formatCurrency(numericAmount)}`,
        });
      }

      haptic('light');
      showToast('Salvo com sucesso!');
      fetchData();
      onSaved();
    } catch (err: unknown) {
      alert('Erro ao processar: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="space-y-4 w-full overflow-x-hidden">

      {/* ── TEMPLATES DE GASTOS PADRÃO ─────────────────────────────────────── */}
      {templates.length > 0 && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={13} className="text-amber-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Gastos Padrão
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="flex flex-col items-start px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl active:scale-95 transition-all text-left"
              >
                <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-tight leading-none">
                  {tpl.description}
                </span>
                <span className="text-[9px] font-bold text-amber-500 dark:text-amber-500 mt-0.5">
                  {formatCurrency(tpl.amount)} · {tpl.category_name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── FORMULÁRIO ────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 space-y-6 transition-colors">
        <h3 className="font-black text-xl uppercase tracking-tighter text-blue-600">
          {editingExpense ? 'Editar' : duplicateData ? 'Duplicar' : 'Novo'} Registro
        </h3>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Valor */}
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-blue-600 text-2xl">R$</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              required
              className="w-full p-6 pl-16 bg-slate-50 dark:bg-slate-900/50 rounded-3xl text-4xl font-black outline-none text-blue-600 border-2 border-transparent focus:border-blue-500 transition-all shadow-inner dark:text-white"
              value={amount}
              onChange={(e) => setAmount(handleCurrencyInput(e.target.value))}
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">
              Categoria {!category && <span className="text-red-400">*</span>}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.name)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 text-left ${
                    category === c.name
                      ? 'border-transparent text-white shadow-md'
                      : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                  style={
                    category === c.name
                      ? { backgroundColor: c.color ?? '#3b82f6', borderColor: c.color ?? '#3b82f6' }
                      : {}
                  }
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: c.color ?? '#64748b', opacity: category === c.name ? 0.7 : 1 }}
                  />
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <input
            type="text"
            placeholder="O que você comprou?"
            className="w-full p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200 font-medium"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* Estabelecimento */}
          <div ref={merchantRef} className="relative">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden focus-within:border-blue-300 dark:focus-within:border-blue-700 transition-colors">
              <label className="flex items-center gap-1.5 px-5 pt-3 pb-1 cursor-pointer">
                <Store size={12} className="text-slate-400" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Estabelecimento (opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Mercado Extra, iFood..."
                value={merchant}
                onChange={(e) => { setMerchant(e.target.value); setShowMerchantSuggestions(true); }}
                onFocus={() => setShowMerchantSuggestions(true)}
                className="w-full px-5 pb-4 bg-transparent outline-none text-slate-800 dark:text-slate-200 font-medium text-sm"
              />
            </div>

            {/* Dropdown de sugestões */}
            {showMerchantSuggestions && merchantSuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden">
                {merchantSuggestions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setMerchant(m);
                      setShowMerchantSuggestions(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/60 active:bg-slate-100 dark:active:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                  >
                    <Store size={13} className="text-slate-400 shrink-0" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{m}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Data do gasto — permite retroativo */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden focus-within:border-blue-300 dark:focus-within:border-blue-700 transition-colors">
            <label className="flex items-center gap-1.5 px-5 pt-3 pb-1 cursor-pointer">
              <CalendarDays size={12} className="text-slate-400" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Data do gasto</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-5 pb-4 bg-transparent outline-none text-slate-800 dark:text-slate-200 font-bold text-sm"
            />
          </div>

          {/* Toggle crédito */}
          <button
            type="button"
            onClick={() => setIsCredit(v => !v)}
            className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${
              isCredit
                ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-300 dark:border-violet-700'
                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CreditCard size={16} className={isCredit ? 'text-violet-500' : 'text-slate-400'} />
              <div className="text-left">
                <p className={`text-xs font-black uppercase tracking-wider ${isCredit ? 'text-violet-600 dark:text-violet-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  Compra no crédito
                </p>
                {isCredit && (
                  <p className="text-[10px] text-violet-500 dark:text-violet-400 font-medium mt-0.5">
                    Vai contar na fatura selecionada
                  </p>
                )}
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors relative ${isCredit ? 'bg-violet-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isCredit ? 'left-5' : 'left-0.5'}`} />
            </div>
          </button>

          {/* Mês da fatura (só aparece quando crédito ativo) */}
          {isCredit && (
            <div className="bg-violet-50 dark:bg-violet-900/20 rounded-2xl border border-violet-200 dark:border-violet-700 overflow-hidden">
              <label className="flex items-center gap-1.5 px-5 pt-3 pb-1 cursor-pointer">
                <CreditCard size={12} className="text-violet-400" />
                <span className="text-[9px] font-black text-violet-400 uppercase tracking-wider">Mês da fatura</span>
              </label>
              <input
                type="month"
                required={isCredit}
                value={paymentMonth}
                onChange={(e) => setPaymentMonth(e.target.value)}
                className="w-full px-5 pb-4 bg-transparent outline-none text-violet-700 dark:text-violet-300 font-bold text-sm"
              />
            </div>
          )}

          {/* Upload comprovante */}
          <div className="flex items-center gap-4">
            <label className="flex-1 flex items-center justify-center gap-2 p-4 bg-slate-100 dark:bg-slate-700 rounded-2xl text-[10px] font-black uppercase cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              {uploadingReceipt ? <Loader2 className="animate-spin" size={16} /> : <ImageIcon size={16} />}
              {receiptUrl ? 'Comprovante Anexado ✓' : 'Anexar Comprovante'}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => e.target.files && handleReceiptUpload(e.target.files[0])}
              />
            </label>
            {receiptUrl && (
              <button
                type="button"
                onClick={() => setReceiptUrl('')}
                className="p-4 bg-red-50 dark:bg-red-900/30 text-red-500 rounded-2xl transition-all active:scale-90"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black py-5 rounded-3xl shadow-xl shadow-blue-500/40 active:scale-95 active:shadow-blue-500/20 transition-all uppercase tracking-widest text-sm">
            Salvar Registro
          </button>
        </form>
      </div>
    </div>
  );
}
