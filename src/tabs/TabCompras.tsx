// ─── ABA: LISTA DE COMPRAS ───────────────────────────────────────────────────
// Melhorias aplicadas:
// ✅ supabase removido — lógica de banco via props onAdd/onToggle/onDelete (arquitetura)
// ✅ confirm() → modal customizado (UX)
// ✅ useMemo + useCallback (performance)
// ✅ Comprados afundam automaticamente para o fim (UX)
// ✅ Contador pendentes / total no header (UX)
// ✅ Botão "Limpar comprados" (UX)
// ✅ Campo de quantidade por item (Feature 🔥)
// ✅ Estimativa de valor total (Feature 🔥)
// ✅ Modo mercado — tela cheia para usar no supermercado (Feature 🔥)
// ✅ aria-label em todos os botões (acessibilidade)

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Circle, CheckCircle2, Trash2, ShoppingCart,
  X, AlertTriangle, DollarSign, Minus, ChevronDown,
} from 'lucide-react';
import { formatCurrency } from '../utils';
import type { ShoppingItem } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos locais
// ─────────────────────────────────────────────────────────────────────────────
interface FormState {
  name: string;
  qty: number;
  price: string; // string para controle do input, convertido na submissão
}

const EMPTY_FORM: FormState = { name: '', qty: 1, price: '' };

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTE: ConfirmDeleteModal
// ─────────────────────────────────────────────────────────────────────────────
interface ConfirmDeleteModalProps {
  item: ShoppingItem | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDeleteModal({ item, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  if (!item) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-item-title"
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
              <AlertTriangle size={24} className="text-red-500" aria-hidden="true" />
            </div>
            <h3 id="confirm-delete-item-title" className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">
              Apagar item?
            </h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              <span className="font-bold text-slate-600 dark:text-slate-300">{item.item_name}</span>
              <br />Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              aria-label="Cancelar remoção"
              className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider active:scale-95 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              aria-label="Confirmar remoção do item"
              className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-red-500/30"
            >
              Apagar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTE: ModoMercado
// Tela cheia para usar no supermercado — fonte grande, fácil de marcar
// ─────────────────────────────────────────────────────────────────────────────
interface ModoMercadoProps {
  items: ShoppingItem[];
  onToggle: (id: string, current: boolean) => Promise<void>;
  onClose: () => void;
}

function ModoMercado({ items, onToggle, onClose }: ModoMercadoProps) {
  const pending = items.filter((i) => i.is_pending);
  const done = items.filter((i) => !i.is_pending);
  const total = done.length;
  const allDone = pending.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-[250] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Modo mercado"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
        <div>
          <h2 className="font-black text-lg uppercase tracking-tighter text-slate-800 dark:text-white flex items-center gap-2">
            <ShoppingCart size={20} className="text-blue-500" aria-hidden="true" />
            Modo Mercado
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
            {done.length} de {items.length} itens marcados
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar modo mercado"
          className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 active:scale-90 transition-all"
        >
          <X size={20} />
        </button>
      </div>

      {/* Barra de progresso */}
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 w-full">
        <motion.div
          className="h-full bg-emerald-500 rounded-full"
          animate={{ width: items.length > 0 ? `${(total / items.length) * 100}%` : '0%' }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {allDone ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-full gap-4 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
            <p className="font-black text-xl text-slate-800 dark:text-white uppercase tracking-tight">
              Tudo comprado!
            </p>
            <p className="text-sm text-slate-400 font-medium">
              Todos os {items.length} itens foram marcados.
            </p>
          </motion.div>
        ) : (
          <>
            {/* Pendentes */}
            <AnimatePresence>
              {pending.map((item) => (
                <motion.button
                  layout
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10, height: 0 }}
                  onClick={() => onToggle(item.id, item.is_pending)}
                  aria-label={`Marcar ${item.item_name} como comprado`}
                  className="w-full bg-white dark:bg-slate-800 p-5 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-all text-left"
                >
                  <Circle size={28} className="text-slate-200 dark:text-slate-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-black text-lg text-slate-800 dark:text-white block truncate">
                      {item.item_name}
                    </span>
                    <div className="flex items-center gap-3 mt-0.5">
                      {(item.quantity ?? 1) > 1 && (
                        <span className="text-[10px] font-black text-blue-500 uppercase">
                          x{item.quantity}
                        </span>
                      )}
                      {item.estimated_price && (
                        <span className="text-[10px] font-black text-slate-400 uppercase">
                          {formatCurrency(item.estimated_price)}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>

            {/* Comprados (seção menor) */}
            {done.length > 0 && (
              <div className="pt-2 space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600 px-1">
                  Já no carrinho ({done.length})
                </p>
                {done.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onToggle(item.id, item.is_pending)}
                    aria-label={`Desmarcar ${item.item_name}`}
                    className="w-full bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3 opacity-50 active:scale-[0.98] transition-all"
                  >
                    <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
                    <span className="font-bold text-sm text-slate-400 line-through truncate">
                      {item.item_name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer com estimativa */}
      {items.some((i) => i.estimated_price) && (
        <div className="p-5 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Estimativa total
            </span>
            <span className="font-black text-lg text-slate-800 dark:text-white">
              {formatCurrency(
                items
                  .filter((i) => i.estimated_price)
                  .reduce((acc, i) => acc + Number(i.estimated_price) * (i.quantity ?? 1), 0)
              )}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS DO COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  shoppingList: ShoppingItem[];
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
  onAdd: (payload: { name: string; qty: number; price: number | null }) => Promise<void>;
  onToggle: (id: string, current: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClearDone: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL: TabCompras
// ─────────────────────────────────────────────────────────────────────────────
export function TabCompras({
  shoppingList,
  fetchData,
  showToast,
  onAdd,
  onToggle,
  onDelete,
  onClearDone,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const patch = (partial: Partial<FormState>) => setForm((f) => ({ ...f, ...partial }));

  const [itemToDelete, setItemToDelete] = useState<ShoppingItem | null>(null);
  const [isMercadoOpen, setIsMercadoOpen] = useState(false);
  const [showPriceField, setShowPriceField] = useState(false);

  // ✅ Listas separadas e ordenadas — comprados afundam para o fim
  const { pending, done } = useMemo(
    () => ({
      pending: shoppingList.filter((i) => i.is_pending),
      done: shoppingList.filter((i) => !i.is_pending),
    }),
    [shoppingList]
  );

  // ✅ Estimativa total de todos os itens pendentes
  const estimativaTotal = useMemo(
    () =>
      pending
        .filter((i) => i.estimated_price)
        .reduce((acc, i) => acc + Number(i.estimated_price) * (i.quantity ?? 1), 0),
    [pending]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.name.trim()) return;
      try {
        await onAdd({
          name: form.name.trim(),
          qty: form.qty,
          price: form.price ? parseFloat(form.price.replace(',', '.')) : null,
        });
        setForm(EMPTY_FORM);
        setShowPriceField(false);
        showToast('Item adicionado!');
        fetchData();
      } catch {
        showToast('Erro ao adicionar item', 'error');
      }
    },
    [form, onAdd, showToast, fetchData]
  );

  const handleToggle = useCallback(
    async (id: string, current: boolean) => {
      try {
        await onToggle(id, current);
        fetchData();
      } catch {
        showToast('Erro ao atualizar item', 'error');
      }
    },
    [onToggle, fetchData, showToast]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!itemToDelete) return;
    try {
      await onDelete(itemToDelete.id);
      showToast('Item removido', 'info');
      fetchData();
    } catch {
      showToast('Erro ao remover item', 'error');
    } finally {
      setItemToDelete(null);
    }
  }, [itemToDelete, onDelete, showToast, fetchData]);

  const handleClearDone = useCallback(async () => {
    try {
      await onClearDone();
      showToast(`${done.length} itens removidos`, 'info');
      fetchData();
    } catch {
      showToast('Erro ao limpar itens', 'error');
    }
  }, [onClearDone, done.length, showToast, fetchData]);

  return (
    <div className="space-y-4">

      {/* ── 1. HEADER COM CONTADOR + BOTÃO MODO MERCADO ──────────────────────── */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-[2.5rem] shadow-xl shadow-blue-500/20 text-white relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 block mb-1">
              Lista de Compras
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tighter">{pending.length}</span>
              <span className="text-sm font-black opacity-50">
                / {shoppingList.length} itens
              </span>
            </div>
            {estimativaTotal > 0 && (
              <span className="text-[10px] font-bold opacity-70 mt-1 block">
                Estimativa: {formatCurrency(estimativaTotal)}
              </span>
            )}
          </div>

          {/* Botão Modo Mercado */}
          {shoppingList.length > 0 && (
            <button
              onClick={() => setIsMercadoOpen(true)}
              aria-label="Abrir modo mercado"
              className="flex flex-col items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20 px-4 py-3 rounded-2xl active:scale-95 transition-all"
            >
              <ShoppingCart size={22} aria-hidden="true" />
              <span className="text-[9px] font-black uppercase tracking-wider">
                Ir às compras
              </span>
            </button>
          )}
        </div>

        {/* Mini progresso */}
        {shoppingList.length > 0 && done.length > 0 && (
          <div className="relative z-10 mt-4 space-y-1">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-400 rounded-full"
                animate={{ width: `${(done.length / shoppingList.length) * 100}%` }}
                transition={{ duration: 0.5 }}
                aria-hidden="true"
              />
            </div>
            <p className="text-[9px] font-black opacity-40 uppercase tracking-widest">
              {done.length} comprado{done.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      </div>

      {/* ── 2. FORMULÁRIO DE NOVO ITEM ────────────────────────────────────────── */}
      <form
        onSubmit={handleAdd}
        className="bg-white dark:bg-slate-800 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-3"
        aria-label="Adicionar item à lista de compras"
      >
        {/* Input principal + botão adicionar */}
        <div className="flex gap-2">
          <label htmlFor="item-name" className="sr-only">Nome do item</label>
          <input
            id="item-name"
            className="flex-1 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 font-medium focus:border-blue-300 dark:focus:border-blue-700 transition-colors"
            placeholder="O que comprar?"
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
          <button
            type="submit"
            aria-label="Adicionar item"
            className="bg-blue-600 text-white p-4 rounded-2xl active:scale-90 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-40"
            disabled={!form.name.trim()}
          >
            <Plus size={22} aria-hidden="true" />
          </button>
        </div>

        {/* Linha de opções: quantidade + preço estimado */}
        <div className="flex items-center gap-2">
          {/* Quantidade */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-2xl p-1">
            <button
              type="button"
              onClick={() => patch({ qty: Math.max(1, form.qty - 1) })}
              aria-label="Diminuir quantidade"
              className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm active:scale-90 transition-all text-slate-600 dark:text-slate-300"
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <span className="text-sm font-black text-slate-700 dark:text-slate-200 w-6 text-center" aria-label={`Quantidade: ${form.qty}`}>
              {form.qty}
            </span>
            <button
              type="button"
              onClick={() => patch({ qty: form.qty + 1 })}
              aria-label="Aumentar quantidade"
              className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm active:scale-90 transition-all text-slate-600 dark:text-slate-300"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>

          {/* Toggle campo de preço */}
          <button
            type="button"
            onClick={() => setShowPriceField((v) => !v)}
            aria-label={showPriceField ? 'Ocultar campo de preço estimado' : 'Adicionar preço estimado'}
            aria-expanded={showPriceField}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-wider transition-all ${
              showPriceField
                ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 text-slate-400'
            }`}
          >
            <DollarSign size={12} aria-hidden="true" />
            Preço
            <ChevronDown
              size={10}
              aria-hidden="true"
              className={`transition-transform ${showPriceField ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Campo de preço (expansível) */}
        <AnimatePresence>
          {showPriceField && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-black" aria-hidden="true">R$</span>
                <label htmlFor="item-price" className="sr-only">Preço estimado (opcional)</label>
                <input
                  id="item-price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="w-full p-4 pl-10 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-white text-sm font-medium placeholder:text-slate-300 focus:border-emerald-300 dark:focus:border-emerald-700 transition-colors"
                  placeholder="0,00 (opcional)"
                  value={form.price}
                  onChange={(e) => patch({ price: e.target.value })}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* ── 3. ITENS PENDENTES ────────────────────────────────────────────────── */}
      <div className="space-y-3" role="region" aria-label="Itens para comprar">
        <AnimatePresence>
          {pending.map((item) => (
            <motion.div
              layout
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20, height: 0 }}
              className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-slate-700 shadow-sm"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  onClick={() => handleToggle(item.id, item.is_pending)}
                  aria-label={`Marcar "${item.item_name}" como comprado`}
                  className="shrink-0 active:scale-90 transition-all"
                >
                  <Circle size={24} className="text-slate-200 dark:text-slate-600" aria-hidden="true" />
                </button>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate">
                    {item.item_name}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none">
                      {item.profiles?.full_name?.split(' ')[0]}
                    </span>
                    {(item.quantity ?? 1) > 1 && (
                      <span className="text-[9px] font-black text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-lg uppercase">
                        x{item.quantity}
                      </span>
                    )}
                    {item.estimated_price && (
                      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-lg uppercase">
                        {formatCurrency(Number(item.estimated_price) * (item.quantity ?? 1))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setItemToDelete(item)}
                aria-label={`Apagar item: ${item.item_name}`}
                className="text-slate-200 dark:text-slate-600 hover:text-red-400 p-2 active:scale-90 transition-all rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0 ml-2"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {pending.length === 0 && shoppingList.length === 0 && (
          <p className="text-center text-slate-300 py-16 font-black uppercase text-[10px] tracking-[0.2em]">
            Lista vazia — adicione o primeiro item
          </p>
        )}
      </div>

      {/* ── 4. ITENS COMPRADOS ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {done.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3 pb-10"
            role="region"
            aria-label="Itens já comprados"
          >
            {/* Header da seção com botão limpar */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600">
                Comprados ({done.length})
              </span>
              <button
                onClick={handleClearDone}
                aria-label={`Limpar ${done.length} itens comprados`}
                className="text-[9px] font-black uppercase tracking-wider text-red-400 hover:text-red-500 active:scale-95 transition-all"
              >
                Limpar comprados
              </button>
            </div>

            <AnimatePresence>
              {done.map((item) => (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-slate-700 opacity-50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => handleToggle(item.id, item.is_pending)}
                      aria-label={`Desmarcar "${item.item_name}" como comprado`}
                      className="shrink-0 active:scale-90 transition-all"
                    >
                      <CheckCircle2 size={24} className="text-emerald-500" aria-hidden="true" />
                    </button>
                    <span className="font-bold text-sm text-slate-400 line-through truncate">
                      {item.item_name}
                    </span>
                  </div>
                  <button
                    onClick={() => setItemToDelete(item)}
                    aria-label={`Apagar item: ${item.item_name}`}
                    className="text-slate-200 dark:text-slate-600 hover:text-red-400 p-2 active:scale-90 transition-all rounded-xl shrink-0 ml-2"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 5. MODAL CONFIRMAR DELEÇÃO ────────────────────────────────────────── */}
      <ConfirmDeleteModal
        item={itemToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setItemToDelete(null)}
      />

      {/* ── 6. MODO MERCADO ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isMercadoOpen && (
          <ModoMercado
            items={shoppingList}
            onToggle={handleToggle}
            onClose={() => setIsMercadoOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 📌 LEMBRETE: adicionar em Dashboard.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
// const addShoppingItem = useCallback(async ({ name, qty, price }) => {
//   if (!user) throw new Error('Usuário não autenticado');
//   const { error } = await supabase.from('shopping_list').insert({
//     item_name: name,
//     quantity: qty,
//     estimated_price: price,
//     user_id: user.id,
//   });
//   if (error) throw error;
// }, [user]);
//
// const toggleShoppingItem = useCallback(async (id, current) => {
//   const { error } = await supabase
//     .from('shopping_list').update({ is_pending: !current }).eq('id', id);
//   if (error) throw error;
// }, []);
//
// const deleteShoppingItem = useCallback(async (id) => {
//   const { error } = await supabase.from('shopping_list').delete().eq('id', id);
//   if (error) throw error;
// }, []);
//
// const clearDoneItems = useCallback(async () => {
//   const ids = shoppingList.filter(i => !i.is_pending).map(i => i.id);
//   if (ids.length === 0) return;
//   const { error } = await supabase.from('shopping_list').delete().in('id', ids);
//   if (error) throw error;
// }, [shoppingList]);
//
// Passar para TabCompras como:
//   <TabCompras
//     ...
//     onAdd={addShoppingItem}
//     onToggle={toggleShoppingItem}
//     onDelete={deleteShoppingItem}
//     onClearDone={clearDoneItems}
//   />
// ─────────────────────────────────────────────────────────────────────────────