// ─── ABA: NOVO GASTO / EDITAR ────────────────────────────────────────────────
// Formulário para adicionar ou editar uma despesa com registro de auditoria (Logs)

import { useState, useEffect } from 'react';
import { Loader2, Image as ImageIcon, X } from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { handleCurrencyInput, parseAmount, formatCurrency } from '../utils';
import type { Category, Expense } from '../types';

interface Props {
  categories: Category[];
  editingExpense: Expense | null;        // null = novo registro
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
  onSaved: () => void;                   // volta para aba list
}

export function TabNovoGasto({ categories, editingExpense, fetchData, showToast, onSaved }: Props) {
  const { user } = useAuth();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Preenche formulário ao editar
  useEffect(() => {
    if (editingExpense) {
      setAmount(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(editingExpense.amount));
      setCategory(editingExpense.category_name);
      setDescription(editingExpense.description);
      setReceiptUrl(editingExpense.receipt_url || '');
    } else {
      setAmount('');
      setCategory('');
      setDescription('');
      setReceiptUrl('');
    }
  }, [editingExpense]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const numericAmount = parseAmount(amount);
    const itemDesc = description || 'Gasto sem descrição';
    
    const payload = {
      amount: numericAmount,
      category_name: category,
      description: itemDesc,
      receipt_url: receiptUrl,
    };

    try {
      if (editingExpense) {
        // 1. Atualiza a Despesa
        const { error: expError } = await supabase.from('expenses').update(payload).eq('id', editingExpense.id);
        if (expError) throw expError;

        // 2. Registra o Log de Edição
        await supabase.from('logs').insert({
          user_id: user.id,
          action: 'UPDATE',
          item_description: itemDesc,
          details: `Valor alterado para ${formatCurrency(numericAmount)} na categoria ${category}`
        });

      } else {
        // 1. Insere a nova Despesa
        const { error: expError } = await supabase.from('expenses').insert({ ...payload, user_id: user.id });
        if (expError) throw expError;

        // 2. Registra o Log de Inserção
        await supabase.from('logs').insert({
          user_id: user.id,
          action: 'INSERT',
          item_description: itemDesc,
          details: `Inseriu novo gasto de ${formatCurrency(numericAmount)}`
        });
      }

      showToast('Salvo com sucesso!');
      fetchData();
      onSaved();
    } catch (err: any) {
      alert("Erro ao processar: " + err.message);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 space-y-6 transition-colors">
      <h3 className="font-black text-xl uppercase tracking-tighter text-blue-600">
        {editingExpense ? 'Editar' : 'Novo'} Registro
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
        <select
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold uppercase text-xs"
        >
          <option value="">Categoria...</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>

        {/* Descrição */}
        <input
          type="text"
          placeholder="O que você comprou?"
          className="w-full p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200 font-medium"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

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
            <button type="button" onClick={() => setReceiptUrl('')} className="p-4 bg-red-50 dark:bg-red-900/30 text-red-500 rounded-2xl transition-all active:scale-90">
              <X size={16} />
            </button>
          )}
        </div>

        <button className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl shadow-xl shadow-blue-500/30 active:scale-95 transition-all uppercase tracking-widest">
          Salvar Registro
        </button>
      </form>
    </div>
  );
}