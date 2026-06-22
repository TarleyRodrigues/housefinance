// ─── ABA: CONFIGURAÇÕES ──────────────────────────────────────────────────────
// ✅ Toggle Casal / Individual por categoria (salva coluna 'type' no Supabase)
// ✅ Visual diferenciado: azul = casal, roxo = individual
// ✅ Gerenciador de Templates de Gastos Padrão

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Moon, Sun, LogOut, Plus, Trash2, History,
  Check, AlertTriangle, Download, TrendingUp,
  Calendar, Tag, Users, User, Zap, ChevronDown, ShoppingCart, Bell, Mail, ToggleLeft, ToggleRight,
  Store, Pencil, Search,
} from 'lucide-react';
import { formatCurrency, handleCurrencyInput, parseAmount } from '../utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Category, Profile, Expense, ExpenseTemplate, ShoppingCategory, NotificationEmail, Merchant } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Paleta de cores
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#64748b', '#a855f7',
];

// ─────────────────────────────────────────────────────────────────────────────
// SUB: ConfirmModal
// ─────────────────────────────────────────────────────────────────────────────
interface ConfirmModalProps {
  isOpen: boolean; title: string; description: string;
  confirmLabel?: string; confirmClassName?: string;
  onConfirm: () => void; onCancel: () => void;
}
function ConfirmModal({
  isOpen, title, description, confirmLabel = 'Confirmar',
  confirmClassName = 'bg-red-500 shadow-red-500/30', onConfirm, onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;
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
            <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">{title}</h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: description }} />
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onCancel}
              className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider active:scale-95 transition-all">
              Cancelar
            </button>
            <button onClick={onConfirm}
              className={`flex-1 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg ${confirmClassName}`}>
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: ExpenseTemplateManager — Gerenciar templates de gastos padrão
// ─────────────────────────────────────────────────────────────────────────────
interface TemplateManagerProps {
  templates: ExpenseTemplate[];
  categories: Category[];
  onAdd: (payload: { description: string; amount: number; category_name: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showToast: (msg: string, type?: string) => void;
  fetchData: () => void;
}

function ExpenseTemplateManager({ templates, categories, onAdd, onDelete, showToast, fetchData }: TemplateManagerProps) {
  const [form, setForm]   = useState({ description: '', amount: '', category_name: '' });
  const [loading, setLoading] = useState(false);
  const [toDelete, setToDelete] = useState<ExpenseTemplate | null>(null);

  const patch = (partial: Partial<typeof form>) => setForm((f) => ({ ...f, ...partial }));

  const handleAdd = async () => {
    const amount = parseAmount(form.amount);
    if (!form.description.trim() || isNaN(amount) || amount <= 0 || !form.category_name) {
      showToast('Preencha descrição, valor e categoria', 'error');
      return;
    }
    setLoading(true);
    try {
      await onAdd({ description: form.description.trim(), amount, category_name: form.category_name });
      setForm({ description: '', amount: '', category_name: '' });
      showToast('Template criado!');
      fetchData();
    } catch { showToast('Erro ao criar template', 'error'); }
    finally { setLoading(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!toDelete) return;
    try {
      await onDelete(toDelete.id);
      showToast('Template removido', 'info');
      fetchData();
    } catch { showToast('Erro ao remover template', 'error'); }
    finally { setToDelete(null); }
  };

  return (
    <div className="space-y-4">
      {/* Formulário de novo template */}
      <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-[2rem] border border-amber-100 dark:border-amber-900/30">
        <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
          Novo template
        </p>
        <input
          className="w-full p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-sm outline-none font-bold text-slate-800 dark:text-white placeholder:text-slate-300 focus:border-amber-400 dark:focus:border-amber-600 transition-colors"
          placeholder="Descrição (ex: Conta de luz)"
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-600 dark:text-amber-400 font-black text-base pointer-events-none">R$</span>
          <input
            type="text"
            inputMode="numeric"
            className="w-full p-4 pl-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-xl font-black outline-none text-amber-700 dark:text-amber-400 placeholder:text-slate-300 focus:border-amber-400 dark:focus:border-amber-600 transition-colors"
            placeholder="0,00"
            value={form.amount}
            onChange={(e) => patch({ amount: handleCurrencyInput(e.target.value) })}
          />
        </div>
        <select
          value={form.category_name}
          onChange={(e) => patch({ category_name: e.target.value })}
          className="w-full p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-xs outline-none font-bold text-slate-800 dark:text-slate-200 focus:border-amber-400 dark:focus:border-amber-600 transition-colors"
        >
          <option value="">Categoria...</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          disabled={loading}
          className="w-full py-3 bg-amber-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Plus size={14} />
          Salvar Template
        </button>
      </div>

      {/* Lista de templates existentes */}
      {templates.length === 0 ? (
        <p className="text-center text-slate-300 dark:text-slate-600 py-6 font-black uppercase text-[9px] tracking-[0.2em]">
          Nenhum template criado
        </p>
      ) : (
        <AnimatePresence>
          {templates.map((tpl) => (
            <motion.div
              key={tpl.id} layout
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/50 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-slate-800 dark:text-slate-200 truncate">{tpl.description}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  {formatCurrency(tpl.amount)} · {tpl.category_name}
                </p>
              </div>
              <button
                onClick={() => setToDelete(tpl)}
                aria-label={`Apagar template ${tpl.description}`}
                className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 active:scale-90 transition-all"
              >
                <Trash2 size={15} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      <ConfirmModal
        isOpen={!!toDelete}
        title="Apagar template?"
        description={`<strong>${toDelete?.description}</strong><br/>Não afeta gastos já registrados.`}
        confirmLabel="Apagar"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: CategoryManager com toggle casal/individual
// ─────────────────────────────────────────────────────────────────────────────
interface CategoryManagerProps {
  categories: Category[];
  onAdd: (name: string) => Promise<void>;
  onUpdate: (payload: {
    id: string; name?: string; oldName?: string;
    monthly_goal?: number; color?: string; type?: string;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showToast: (msg: string, type?: string) => void;
  fetchData: () => void;
}

function CategoryManager({ categories, onAdd, onUpdate, onDelete, showToast, fetchData }: CategoryManagerProps) {
  const [newCat, setNewCat]                 = useState('');
  const [savingFields, setSavingFields]     = useState<Record<string, boolean>>({});
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [openColorFor, setOpenColorFor]     = useState<string | null>(null);
  const [names, setNames]                   = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, c.name]))
  );
  const [goals, setGoals]       = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((c) => [
      c.id,
      c.monthly_goal ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(c.monthly_goal) : '',
    ]))
  );
  const [dirtyGoals, setDirtyGoals] = useState<Record<string, boolean>>({});

  useMemo(() => {
    setNames(Object.fromEntries(categories.map((c) => [c.id, c.name])));
    setGoals(Object.fromEntries(categories.map((c) => [
      c.id,
      c.monthly_goal ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(c.monthly_goal) : '',
    ])));
    setDirtyGoals({});
  }, [categories]);

  const showSaved = (key: string) => {
    setSavingFields((s) => ({ ...s, [key]: true }));
    setTimeout(() => setSavingFields((s) => ({ ...s, [key]: false })), 1500);
  };

  const handleAdd = async () => {
    if (!newCat.trim()) return;
    try {
      await onAdd(newCat.trim());
      setNewCat('');
      showToast('Categoria criada!');
      fetchData();
    } catch { showToast('Erro ao criar categoria', 'error'); }
  };

  const handleNameBlur = async (cat: Category) => {
    const newName = names[cat.id] ?? cat.name;
    if (newName === cat.name || !newName.trim()) return;
    try {
      await onUpdate({ id: cat.id, name: newName.trim(), oldName: cat.name });
      showSaved(`name-${cat.id}`);
      fetchData();
    } catch { showToast('Erro ao atualizar nome', 'error'); }
  };

  const handleMetaSave = async (cat: Category) => {
    const numericValue = parseAmount(goals[cat.id] ?? '');
    if (isNaN(numericValue)) return;
    try {
      await onUpdate({ id: cat.id, monthly_goal: numericValue });
      showSaved(`meta-${cat.id}`);
      setDirtyGoals((d) => ({ ...d, [cat.id]: false }));
      fetchData();
    } catch { showToast('Erro ao atualizar meta', 'error'); }
  };

  const handleColorSelect = async (cat: Category, color: string) => {
    try {
      await onUpdate({ id: cat.id, color });
      showSaved(`color-${cat.id}`);
      fetchData();
    } catch { showToast('Erro ao atualizar cor', 'error'); }
  };

  const handleToggleType = async (cat: Category) => {
    const newType = (cat.type ?? 'couple') === 'couple' ? 'individual' : 'couple';
    try {
      await onUpdate({ id: cat.id, type: newType });
      showSaved(`type-${cat.id}`);
      fetchData();
    } catch { showToast('Erro ao atualizar tipo', 'error'); }
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;
    try {
      await onDelete(categoryToDelete.id);
      showToast('Categoria removida', 'info');
      fetchData();
    } catch { showToast('Erro ao remover categoria', 'error'); }
    finally { setCategoryToDelete(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
        <span className="flex items-center gap-1 text-blue-500">
          <Users size={10} /> Casal = compartilhado nos gráficos
        </span>
        <span className="flex items-center gap-1 text-purple-500">
          <User size={10} /> Individual = seção separada
        </span>
      </div>

      <div className="flex gap-2">
        <label htmlFor="new-category" className="sr-only">Nome da nova categoria</label>
        <input
          id="new-category"
          className="flex-1 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-sm outline-none font-bold text-slate-800 dark:text-white placeholder:text-slate-300 focus:border-blue-300 dark:focus:border-blue-700 transition-colors"
          placeholder="Nova categoria..."
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd} disabled={!newCat.trim()} aria-label="Adicionar categoria"
          className="bg-blue-600 text-white p-4 rounded-2xl active:scale-90 transition-all shadow-md disabled:opacity-40"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="space-y-3 max-h-[30rem] overflow-y-auto pr-1 no-scrollbar pb-6">
        <AnimatePresence>
          {categories.map((c) => {
            const isIndividual = (c.type ?? 'couple') === 'individual';
            return (
              <motion.div
                key={c.id} layout
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                className={`p-4 rounded-[2rem] space-y-3 border shadow-sm transition-colors ${
                  isIndividual
                    ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/40'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'
                }`}
              >
                <div className="flex justify-between items-center gap-2">
                  <div className="flex-1 relative">
                    <label htmlFor={`cat-name-${c.id}`} className="sr-only">Nome da categoria {c.name}</label>
                    <input
                      id={`cat-name-${c.id}`}
                      type="text"
                      value={names[c.id] ?? c.name}
                      onChange={(e) => setNames((n) => ({ ...n, [c.id]: e.target.value }))}
                      onBlur={() => handleNameBlur(c)}
                      className="bg-transparent text-sm font-black outline-none uppercase tracking-tighter w-full text-slate-800 dark:text-slate-200 border-b border-transparent focus:border-blue-500 pr-6 transition-colors"
                    />
                    <AnimatePresence>
                      {savingFields[`name-${c.id}`] && (
                        <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                          className="absolute right-0 top-1/2 -translate-y-1/2 text-emerald-500" aria-label="Salvo">
                          <Check size={14} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleType(c)}
                      aria-label={`Tipo atual: ${isIndividual ? 'Individual' : 'Casal'}. Toque para mudar.`}
                      aria-pressed={isIndividual}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                        isIndividual
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      {isIndividual ? <User size={9} /> : <Users size={9} />}
                      {isIndividual ? 'Indiv.' : 'Casal'}
                    </button>

                    <AnimatePresence>
                      {savingFields[`type-${c.id}`] && (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-emerald-500">
                          <Check size={12} />
                        </motion.span>
                      )}
                    </AnimatePresence>

                    <button onClick={() => setCategoryToDelete(c)} aria-label={`Apagar categoria ${c.name}`}
                      className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors p-1 active:scale-90">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setOpenColorFor(openColorFor === c.id ? null : c.id)}
                    className="flex items-center gap-2 active:scale-95 transition-all"
                  >
                    <span
                      className="w-4 h-4 rounded-full border-2 border-white/20 shadow-sm shrink-0"
                      style={{ backgroundColor: c.color ?? '#64748b' }}
                    />
                    <span className={`text-[9px] font-black uppercase tracking-widest ${
                      openColorFor === c.id ? 'text-blue-500' : 'text-slate-400'
                    }`}>
                      Cor
                    </span>
                  </button>
                  <AnimatePresence>
                    {openColorFor === c.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {CATEGORY_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => { handleColorSelect(c, color); setOpenColorFor(null); }}
                              aria-label={`Selecionar cor ${color}`}
                              className="w-6 h-6 rounded-full border-2 transition-all active:scale-90"
                              style={{
                                backgroundColor: color,
                                borderColor: c.color === color ? 'white' : 'transparent',
                                boxShadow: c.color === color ? `0 0 0 2px ${color}` : 'none',
                              }}
                            />
                          ))}
                          <AnimatePresence>
                            {savingFields[`color-${c.id}`] && (
                              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="text-emerald-500 flex items-center">
                                <Check size={14} />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex flex-col gap-1 bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-inner border border-slate-100 dark:border-slate-700 transition-colors">
                  <label htmlFor={`cat-meta-${c.id}`} className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">
                    Meta Mensal
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-blue-400 dark:text-blue-500 shrink-0">R$</span>
                    <input
                      id={`cat-meta-${c.id}`} type="text" inputMode="numeric"
                      className="bg-transparent text-base font-black text-blue-600 dark:text-blue-400 outline-none flex-1 min-w-0"
                      placeholder="0,00"
                      value={goals[c.id] ?? ''}
                      onChange={(e) => {
                        const formatted = handleCurrencyInput(e.target.value);
                        setGoals((g) => ({ ...g, [c.id]: formatted }));
                        const original = c.monthly_goal || 0;
                        setDirtyGoals((d) => ({ ...d, [c.id]: parseAmount(formatted) !== original }));
                      }}
                      aria-label={`Meta mensal de ${c.name}`}
                    />
                    <AnimatePresence>
                      {savingFields[`meta-${c.id}`] && (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="text-emerald-500 shrink-0">
                          <Check size={14} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <AnimatePresence>
                    {dirtyGoals[c.id] && (
                      <motion.button
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        type="button"
                        onClick={() => handleMetaSave(c)}
                        className="mt-2 w-full py-2 bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20"
                      >
                        <Check size={11} />
                        Salvar Meta
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <ConfirmModal
        isOpen={!!categoryToDelete}
        title="Apagar categoria?"
        description={`<strong>${categoryToDelete?.name}</strong><br/>Os gastos desta categoria não serão apagados, mas ficarão sem categoria.`}
        confirmLabel="Apagar"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setCategoryToDelete(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: ShoppingCategoryManager — categorias de compras (mercado)
// ─────────────────────────────────────────────────────────────────────────────
interface ShoppingCategoryManagerProps {
  shoppingCategories: ShoppingCategory[];
  onAdd: (name: string) => Promise<void>;
  onUpdate: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showToast: (msg: string, type?: string) => void;
}

function ShoppingCategoryManager({ shoppingCategories, onAdd, onUpdate, onDelete, showToast }: ShoppingCategoryManagerProps) {
  const [newName, setNewName]           = useState('');
  const [loading, setLoading]           = useState(false);
  const [toDelete, setToDelete]         = useState<ShoppingCategory | null>(null);
  const [names, setNames]               = useState<Record<string, string>>(() =>
    Object.fromEntries(shoppingCategories.map(c => [c.id, c.name]))
  );
  const [saving, setSaving]             = useState<Record<string, boolean>>({});

  useMemo(() => {
    setNames(Object.fromEntries(shoppingCategories.map(c => [c.id, c.name])));
  }, [shoppingCategories]);

  const handleNameBlur = async (cat: ShoppingCategory) => {
    const newVal = (names[cat.id] ?? cat.name).trim();
    if (!newVal || newVal === cat.name) return;
    try {
      await onUpdate(cat.id, newVal);
      setSaving(s => ({ ...s, [cat.id]: true }));
      setTimeout(() => setSaving(s => ({ ...s, [cat.id]: false })), 1500);
    } catch { showToast('Erro ao renomear categoria', 'error'); }
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setLoading(true);
    try {
      await onAdd(name);
      setNewName('');
      showToast('Categoria criada!');
    } catch { showToast('Erro ao criar categoria', 'error'); }
    finally { setLoading(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!toDelete) return;
    try {
      await onDelete(toDelete.id);
      showToast('Categoria removida', 'info');
    } catch { showToast('Erro ao remover categoria', 'error'); }
    finally { setToDelete(null); }
  };

  return (
    <div className="space-y-4">
      <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
        Categorias exibidas nos chips de seleção da tela de compras.
      </p>

      <div className="flex gap-2">
        <input
          className="flex-1 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-sm outline-none font-bold text-slate-800 dark:text-white placeholder:text-slate-300 focus:border-cyan-300 dark:focus:border-cyan-700 transition-colors"
          placeholder="Nova categoria de compra..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd} disabled={!newName.trim() || loading}
          aria-label="Adicionar categoria"
          className="bg-cyan-600 text-white p-4 rounded-2xl active:scale-90 transition-all shadow-md disabled:opacity-40"
        >
          <Plus size={20} />
        </button>
      </div>

      {shoppingCategories.length === 0 ? (
        <p className="text-center text-slate-300 dark:text-slate-600 py-6 font-black uppercase text-[9px] tracking-[0.2em]">
          Nenhuma categoria cadastrada
        </p>
      ) : (
        <AnimatePresence>
          {shoppingCategories.map((cat) => (
            <motion.div
              key={cat.id} layout
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/50 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center shrink-0">
                  {saving[cat.id]
                    ? <Check size={13} className="text-green-500" />
                    : <ShoppingCart size={13} className="text-cyan-600 dark:text-cyan-400" />
                  }
                </div>
                <input
                  className="flex-1 min-w-0 font-black text-sm text-slate-800 dark:text-slate-200 bg-transparent outline-none border-b border-transparent focus:border-cyan-400 dark:focus:border-cyan-600 transition-colors py-0.5"
                  value={names[cat.id] ?? cat.name}
                  onChange={(e) => setNames(n => ({ ...n, [cat.id]: e.target.value }))}
                  onBlur={() => handleNameBlur(cat)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
              </div>
              <button
                onClick={() => setToDelete(cat)}
                aria-label={`Apagar categoria ${cat.name}`}
                className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 active:scale-90 transition-all shrink-0"
              >
                <Trash2 size={15} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      <ConfirmModal
        isOpen={!!toDelete}
        title="Apagar categoria?"
        description={`<strong>${toDelete?.name}</strong><br/>Itens já cadastrados com essa categoria não serão afetados.`}
        confirmLabel="Apagar"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: NotificationEmailManager — e-mails para receber lembretes
// ─────────────────────────────────────────────────────────────────────────────
interface NotificationEmailManagerProps {
  notificationEmails: NotificationEmail[];
  onAdd: (email: string, label?: string) => Promise<void>;
  onToggle: (id: string, is_active: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showToast: (msg: string, type?: string) => void;
}

function NotificationEmailManager({ notificationEmails, onAdd, onToggle, onDelete, showToast }: NotificationEmailManagerProps) {
  const [email, setEmail]   = useState('');
  const [label, setLabel]   = useState('');
  const [loading, setLoading] = useState(false);
  const [toDelete, setToDelete] = useState<NotificationEmail | null>(null);

  const handleAdd = async () => {
    const e = email.trim();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      showToast('E-mail inválido', 'error');
      return;
    }
    setLoading(true);
    try {
      await onAdd(e, label.trim() || undefined);
      setEmail('');
      setLabel('');
      showToast('E-mail adicionado!');
    } catch { showToast('Erro ao adicionar e-mail', 'error'); }
    finally { setLoading(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!toDelete) return;
    try {
      await onDelete(toDelete.id);
      showToast('E-mail removido', 'info');
    } catch { showToast('Erro ao remover e-mail', 'error'); }
    finally { setToDelete(null); }
  };

  return (
    <div className="space-y-4">
      <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
        Todos os e-mails ativos recebem o resumo de lembretes diariamente às 07h.
      </p>

      {/* Formulário */}
      <div className="space-y-2 p-4 bg-violet-50 dark:bg-violet-900/10 rounded-[2rem] border border-violet-100 dark:border-violet-900/30">
        <p className="text-[9px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400">
          Adicionar e-mail
        </p>
        <div className="relative">
          <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="email" inputMode="email" placeholder="exemplo@email.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="w-full p-4 pl-10 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white placeholder:text-slate-300 outline-none focus:border-violet-400 dark:focus:border-violet-600 transition-colors"
          />
        </div>
        <input
          type="text" placeholder="Apelido (ex: Tarley, Parceira...)"
          value={label} onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="w-full p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-300 outline-none focus:border-violet-400 dark:focus:border-violet-600 transition-colors"
        />
        <button
          onClick={handleAdd} disabled={!email.trim() || loading}
          className="w-full py-3 bg-violet-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Plus size={14} />
          Adicionar E-mail
        </button>
      </div>

      {/* Lista */}
      {notificationEmails.length === 0 ? (
        <p className="text-center text-slate-300 dark:text-slate-600 py-6 font-black uppercase text-[9px] tracking-[0.2em]">
          Nenhum e-mail cadastrado
        </p>
      ) : (
        <AnimatePresence>
          {notificationEmails.map((item) => (
            <motion.div
              key={item.id} layout
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              className={`flex items-center gap-3 p-4 rounded-[1.5rem] border shadow-sm transition-colors ${
                item.is_active
                  ? 'bg-white dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'
                  : 'bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800 opacity-60'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                item.is_active
                  ? 'bg-violet-100 dark:bg-violet-900/30'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}>
                <Bell size={14} className={item.is_active ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-slate-800 dark:text-slate-200 truncate">{item.email}</p>
                {item.label && (
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{item.label}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onToggle(item.id, !item.is_active)}
                  aria-label={item.is_active ? 'Desativar' : 'Ativar'}
                  className="p-1.5 active:scale-90 transition-all"
                >
                  {item.is_active
                    ? <ToggleRight size={22} className="text-violet-500" />
                    : <ToggleLeft size={22} className="text-slate-300 dark:text-slate-600" />
                  }
                </button>
                <button
                  onClick={() => setToDelete(item)}
                  aria-label={`Remover ${item.email}`}
                  className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 active:scale-90 transition-all"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      <ConfirmModal
        isOpen={!!toDelete}
        title="Remover e-mail?"
        description={`<strong>${toDelete?.email}</strong>${toDelete?.label ? ` (${toDelete.label})` : ''}<br/>Não receberá mais lembretes diários.`}
        confirmLabel="Remover"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: MerchantManager — cadastro e gestão de estabelecimentos
// ─────────────────────────────────────────────────────────────────────────────
interface MerchantManagerProps {
  merchants: Merchant[];
  onAdd: (name: string) => Promise<void>;
  onUpdate: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showToast: (msg: string, type?: string) => void;
}

function MerchantManager({ merchants, onAdd, onUpdate, onDelete, showToast }: MerchantManagerProps) {
  const [newName, setNewName]     = useState('');
  const [filter, setFilter]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving]       = useState<Record<string, boolean>>({});
  const [toDelete, setToDelete]   = useState<Merchant | null>(null);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return merchants;
    return merchants.filter(m => m.name.toLowerCase().includes(q));
  }, [merchants, filter]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    if (merchants.some(m => m.name.toLowerCase() === name.toLowerCase())) {
      showToast('Estabelecimento já cadastrado', 'error');
      return;
    }
    setLoading(true);
    try {
      await onAdd(name);
      setNewName('');
      showToast('Estabelecimento cadastrado!');
    } catch { showToast('Erro ao cadastrar', 'error'); }
    finally { setLoading(false); }
  };

  const startEdit = (m: Merchant) => {
    setEditingId(m.id);
    setEditingName(m.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const commitEdit = async (m: Merchant) => {
    const name = editingName.trim();
    if (!name || name === m.name) { cancelEdit(); return; }
    try {
      await onUpdate(m.id, name);
      setSaving(s => ({ ...s, [m.id]: true }));
      setTimeout(() => setSaving(s => ({ ...s, [m.id]: false })), 1500);
      cancelEdit();
    } catch { showToast('Erro ao atualizar', 'error'); }
  };

  const handleDeleteConfirm = async () => {
    if (!toDelete) return;
    try {
      await onDelete(toDelete.id);
      showToast('Estabelecimento removido', 'info');
    } catch { showToast('Erro ao remover', 'error'); }
    finally { setToDelete(null); }
  };

  return (
    <div className="space-y-4">
      <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
        Estabelecimentos aparecem como sugestão ao registrar novos gastos.
      </p>

      {/* Adicionar novo */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Store size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="w-full p-4 pl-10 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-sm outline-none font-bold text-slate-800 dark:text-white placeholder:text-slate-300 focus:border-blue-300 dark:focus:border-blue-700 transition-colors"
            placeholder="Nome do estabelecimento..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <button
          onClick={handleAdd} disabled={!newName.trim() || loading}
          aria-label="Adicionar estabelecimento"
          className="bg-blue-600 text-white p-4 rounded-2xl active:scale-90 transition-all shadow-md disabled:opacity-40"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Filtro — só exibe quando há itens */}
      {merchants.length > 4 && (
        <div className="relative">
          <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="w-full p-3 pl-10 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-sm outline-none font-medium text-slate-700 dark:text-slate-300 placeholder:text-slate-300 focus:border-blue-300 dark:focus:border-blue-700 transition-colors"
            placeholder="Filtrar estabelecimentos..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          {filter && (
            <button onClick={() => setFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 p-1">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}

      {/* Lista */}
      {merchants.length === 0 ? (
        <p className="text-center text-slate-300 dark:text-slate-600 py-6 font-black uppercase text-[9px] tracking-[0.2em]">
          Nenhum estabelecimento cadastrado
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-slate-300 dark:text-slate-600 py-4 font-black uppercase text-[9px] tracking-[0.2em]">
          Nenhum resultado para "{filter}"
        </p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 no-scrollbar">
          <AnimatePresence>
            {filtered.map(m => (
              <motion.div
                key={m.id} layout
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm"
              >
                <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                  {saving[m.id]
                    ? <Check size={13} className="text-emerald-500" />
                    : <Store size={13} className="text-blue-500 dark:text-blue-400" />
                  }
                </div>

                {editingId === m.id ? (
                  <input
                    autoFocus
                    className="flex-1 min-w-0 font-bold text-sm text-slate-800 dark:text-slate-200 bg-transparent outline-none border-b border-blue-400 dark:border-blue-600 py-0.5"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onBlur={() => commitEdit(m)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitEdit(m);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                ) : (
                  <span className="flex-1 min-w-0 font-bold text-sm text-slate-800 dark:text-slate-200 truncate">
                    {m.name}
                  </span>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  {editingId === m.id ? (
                    <button onClick={cancelEdit} className="p-1.5 text-slate-400 hover:text-slate-600 active:scale-90 transition-all">
                      <Trash2 size={13} />
                    </button>
                  ) : (
                    <button
                      onClick={() => startEdit(m)}
                      aria-label={`Editar ${m.name}`}
                      className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-blue-500 active:scale-90 transition-all"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => setToDelete(m)}
                    aria-label={`Apagar ${m.name}`}
                    className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 active:scale-90 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <ConfirmModal
        isOpen={!!toDelete}
        title="Apagar estabelecimento?"
        description={`<strong>${toDelete?.name}</strong><br/>Gastos já registrados com esse estabelecimento não serão afetados.`}
        confirmLabel="Apagar"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  userProfile: Profile | null;
  categories: Category[];
  expenses: Expense[];
  expenseTemplates: ExpenseTemplate[];
  shoppingCategories: ShoppingCategory[];
  currentDate: Date;
  theme: 'light' | 'dark' | 'brasil';
  setTheme: (v: 'light' | 'dark' | 'brasil') => void;
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
  onOpenLogs: () => void;
  onSignOut: () => Promise<void>;
  onAddCategory: (name: string) => Promise<void>;
  onUpdateCategory: (payload: {
    id: string; name?: string; oldName?: string;
    monthly_goal?: number; color?: string; type?: string;
  }) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onAddTemplate: (payload: { description: string; amount: number; category_name: string }) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onAddShoppingCategory: (name: string) => Promise<void>;
  onUpdateShoppingCategory: (id: string, name: string) => Promise<void>;
  onDeleteShoppingCategory: (id: string) => Promise<void>;
  notificationEmails: NotificationEmail[];
  onAddNotificationEmail: (email: string, label?: string) => Promise<void>;
  onToggleNotificationEmail: (id: string, is_active: boolean) => Promise<void>;
  onDeleteNotificationEmail: (id: string) => Promise<void>;
  merchants: Merchant[];
  onAddMerchant: (name: string) => Promise<void>;
  onUpdateMerchant: (id: string, name: string) => Promise<void>;
  onDeleteMerchant: (id: string) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function TabAjustes({
  userProfile, categories, expenses, expenseTemplates, shoppingCategories, notificationEmails, merchants, currentDate,
  theme, setTheme, fetchData, showToast,
  onOpenLogs, onSignOut, onAddCategory, onUpdateCategory, onDeleteCategory,
  onAddTemplate, onDeleteTemplate, onAddShoppingCategory, onUpdateShoppingCategory, onDeleteShoppingCategory,
  onAddNotificationEmail, onToggleNotificationEmail, onDeleteNotificationEmail,
  onAddMerchant, onUpdateMerchant, onDeleteMerchant,
}: Props) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [openSections, setOpenSections] = useState<{ templates: boolean; categories: boolean; shoppingCategories: boolean; notifications: boolean; merchants: boolean }>({
    templates: false,
    categories: false,
    shoppingCategories: false,
    notifications: false,
    merchants: false,
  });
  const toggleSection = (key: 'templates' | 'categories' | 'shoppingCategories' | 'notifications' | 'merchants') =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const stats = useMemo(() => {
    const totalMes = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
    const catCounts = expenses.reduce<Record<string, number>>((acc, e) => {
      const cat = e.category_name ?? 'Sem categoria';
      acc[cat] = (acc[cat] ?? 0) + Number(e.amount);
      return acc;
    }, {});
    const favoriteCat = Object.entries(catCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '—';
    return { totalMes, favoriteCat, totalTransacoes: expenses.length };
  }, [expenses]);

  const handleExportCSV = useCallback(() => {
    if (expenses.length === 0) { showToast('Nenhum gasto para exportar', 'info'); return; }
    const header = 'Data,Categoria,Descrição,Valor';
    const rows = expenses.map((e) => [
      e.expense_date || (e.created_at ? format(new Date(e.created_at), 'dd/MM/yyyy') : ''),
      e.category_name ?? '',
      `"${(e.description ?? '').replace(/"/g, '""')}"`,
      Number(e.amount).toFixed(2).replace('.', ','),
    ].join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gastos-${format(currentDate, 'yyyy-MM', { locale: ptBR })}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('CSV exportado com sucesso!');
  }, [expenses, currentDate, showToast]);

  const handleLogoutConfirm = useCallback(async () => {
    try { await onSignOut(); }
    catch { showToast('Erro ao sair', 'error'); }
    finally { setShowLogoutConfirm(false); }
  }, [onSignOut, showToast]);

  return (
    <div className="space-y-6 pb-10">

      {/* ── 1. CARD PERFIL ── */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-800 dark:to-slate-950 p-6 rounded-[2.5rem] shadow-2xl shadow-black/25 text-white relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -left-8 -bottom-12 w-36 h-36 bg-blue-500/10 rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-5">
            <img
              src={userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.full_name ?? 'U')}&background=3b82f6&color=fff`}
              className="w-16 h-16 rounded-2xl border-2 border-white/10 shadow-lg object-cover"
              alt={`Foto de ${userProfile?.full_name ?? 'perfil'}`}
            />
            <div className="flex-1 min-w-0">
              <p className="font-black text-lg leading-tight truncate">{userProfile?.full_name || 'Meu Perfil'}</p>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5 truncate">
                {userProfile?.full_name ? `@${userProfile.full_name.split(' ')[0].toLowerCase()}` : ''}
              </p>
              <button onClick={() => (window.location.hash = '/profile')} aria-label="Editar perfil"
                className="text-blue-400 text-[10px] font-black uppercase tracking-widest mt-1 active:scale-95 transition-all">
                Editar Perfil →
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-2xl p-3 text-center border border-white/5">
              <TrendingUp size={14} className="mx-auto mb-1 opacity-50" />
              <p className="text-sm font-black leading-none">{formatCurrency(stats.totalMes)}</p>
              <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mt-1">{format(currentDate, 'MMM', { locale: ptBR })}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 text-center border border-white/5">
              <Calendar size={14} className="mx-auto mb-1 opacity-50" />
              <p className="text-sm font-black leading-none">{stats.totalTransacoes}</p>
              <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mt-1">Gastos</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 text-center border border-white/5 min-w-0">
              <Tag size={14} className="mx-auto mb-1 opacity-50" />
              <p className="text-[10px] font-black leading-none truncate">{stats.favoriteCat}</p>
              <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mt-1">Top cat.</p>
            </div>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* ── 2. APARÊNCIA ── */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 p-4 shadow-sm space-y-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Aparência</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: 'light'  as const, label: 'Claro',  icon: <Sun size={18} />,                                     color: 'text-amber-400'  },
            { id: 'dark'   as const, label: 'Escuro', icon: <Moon size={18} />,                                    color: 'text-indigo-400' },
            { id: 'brasil' as const, label: 'Brasil', icon: <span className="text-xl leading-none">🇧🇷</span>, color: ''                },
          ]).map(({ id, label, icon, color }) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              aria-pressed={theme === id}
              className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all active:scale-95 border ${
                theme === id
                  ? 'bg-blue-600 border-transparent text-white shadow-lg shadow-blue-500/25'
                  : `bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 ${color}`
              }`}
            >
              {icon}
              <span className="text-[9px] font-black uppercase tracking-widest leading-none">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 3. AÇÕES RÁPIDAS ── */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={handleExportCSV} aria-label="Exportar CSV"
          className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-[2rem] border border-emerald-100 dark:border-emerald-900 flex flex-col items-center gap-2 active:scale-95 transition-all text-emerald-600 dark:text-emerald-400 shadow-sm"
        >
          <Download size={20} />
          <span className="text-[9px] font-black uppercase tracking-widest leading-none text-center">Exportar</span>
        </button>
        <button onClick={() => setShowLogoutConfirm(true)} aria-label="Sair da conta"
          className="p-4 bg-red-50 dark:bg-red-900/20 rounded-[2rem] border border-red-100 dark:border-red-900 flex flex-col items-center gap-2 active:scale-95 transition-all text-red-500 shadow-sm"
        >
          <LogOut size={20} />
          <span className="text-[9px] font-black uppercase tracking-widest leading-none">Sair</span>
        </button>
      </div>

      {/* ── 3. HISTÓRICO ── */}
      <button onClick={onOpenLogs} aria-label="Ver histórico de atividade"
        className="w-full p-5 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 flex items-center gap-4 shadow-sm active:scale-95 transition-all"
      >
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl"><History size={22} /></div>
        <div className="text-left">
          <p className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter text-sm">Histórico de Atividade</p>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mt-1">Ver quem alterou o quê</p>
        </div>
      </button>

      {/* ── 4. GASTOS PADRÃO (accordion) ── */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm transition-colors overflow-hidden">
        <button
          onClick={() => toggleSection('templates')}
          aria-expanded={openSections.templates}
          className="w-full flex items-center justify-between p-5 active:bg-slate-50 dark:active:bg-slate-700/40 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Zap size={14} className="text-amber-500" />
            </div>
            <div className="text-left">
              <p className="font-black text-slate-800 dark:text-slate-200 text-xs uppercase tracking-tight">
                Gastos Padrão
              </p>
              {!openSections.templates && expenseTemplates.length > 0 && (
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                  {expenseTemplates.length} template{expenseTemplates.length !== 1 ? 's' : ''} criado{expenseTemplates.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform duration-200 ${openSections.templates ? 'rotate-180' : ''}`}
          />
        </button>
        <AnimatePresence>
          {openSections.templates && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5">
                <p className="text-[9px] text-slate-400 font-medium mb-4 leading-relaxed">
                  Templates para preencher automaticamente o formulário de novo gasto.
                </p>
                <ExpenseTemplateManager
                  templates={expenseTemplates}
                  categories={categories}
                  onAdd={onAddTemplate}
                  onDelete={onDeleteTemplate}
                  showToast={showToast}
                  fetchData={fetchData}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 5. CATEGORIAS & METAS (accordion) ── */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm transition-colors overflow-hidden">
        <button
          onClick={() => toggleSection('categories')}
          aria-expanded={openSections.categories}
          className="w-full flex items-center justify-between p-5 active:bg-slate-50 dark:active:bg-slate-700/40 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Tag size={14} className="text-blue-500" />
            </div>
            <div className="text-left">
              <p className="font-black text-slate-800 dark:text-slate-200 text-xs uppercase tracking-tight">
                Categorias &amp; Metas
              </p>
              {!openSections.categories && categories.length > 0 && (
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                  {categories.length} categoria{categories.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform duration-200 ${openSections.categories ? 'rotate-180' : ''}`}
          />
        </button>
        <AnimatePresence>
          {openSections.categories && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5">
                <CategoryManager
                  categories={categories}
                  onAdd={onAddCategory}
                  onUpdate={onUpdateCategory}
                  onDelete={onDeleteCategory}
                  showToast={showToast}
                  fetchData={fetchData}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 6. CATEGORIAS DE COMPRAS (accordion) ── */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm transition-colors overflow-hidden">
        <button
          onClick={() => toggleSection('shoppingCategories')}
          aria-expanded={openSections.shoppingCategories}
          className="w-full flex items-center justify-between p-5 active:bg-slate-50 dark:active:bg-slate-700/40 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
              <ShoppingCart size={14} className="text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="text-left">
              <p className="font-black text-slate-800 dark:text-slate-200 text-xs uppercase tracking-tight">
                Categorias de Compras
              </p>
              {!openSections.shoppingCategories && shoppingCategories.length > 0 && (
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                  {shoppingCategories.length} categoria{shoppingCategories.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform duration-200 ${openSections.shoppingCategories ? 'rotate-180' : ''}`}
          />
        </button>
        <AnimatePresence>
          {openSections.shoppingCategories && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5">
                <ShoppingCategoryManager
                  shoppingCategories={shoppingCategories}
                  onAdd={onAddShoppingCategory}
                  onUpdate={onUpdateShoppingCategory}
                  onDelete={onDeleteShoppingCategory}
                  showToast={showToast}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 7. NOTIFICAÇÕES POR E-MAIL (accordion) ── */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm transition-colors overflow-hidden">
        <button
          onClick={() => toggleSection('notifications')}
          aria-expanded={openSections.notifications}
          className="w-full flex items-center justify-between p-5 active:bg-slate-50 dark:active:bg-slate-700/40 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Bell size={14} className="text-violet-500" />
            </div>
            <div className="text-left">
              <p className="font-black text-slate-800 dark:text-slate-200 text-xs uppercase tracking-tight">
                Notificações por E-mail
              </p>
              {!openSections.notifications && (
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                  {notificationEmails.filter(e => e.is_active).length} ativo{notificationEmails.filter(e => e.is_active).length !== 1 ? 's' : ''}
                  {notificationEmails.length > 0 ? ` de ${notificationEmails.length}` : ' — nenhum cadastrado'}
                </p>
              )}
            </div>
          </div>
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform duration-200 ${openSections.notifications ? 'rotate-180' : ''}`}
          />
        </button>
        <AnimatePresence>
          {openSections.notifications && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5">
                <NotificationEmailManager
                  notificationEmails={notificationEmails}
                  onAdd={onAddNotificationEmail}
                  onToggle={onToggleNotificationEmail}
                  onDelete={onDeleteNotificationEmail}
                  showToast={showToast}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 8. ESTABELECIMENTOS (accordion) ── */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm transition-colors overflow-hidden">
        <button
          onClick={() => toggleSection('merchants')}
          aria-expanded={openSections.merchants}
          className="w-full flex items-center justify-between p-5 active:bg-slate-50 dark:active:bg-slate-700/40 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Store size={14} className="text-blue-500" />
            </div>
            <div className="text-left">
              <p className="font-black text-slate-800 dark:text-slate-200 text-xs uppercase tracking-tight">
                Estabelecimentos
              </p>
              {!openSections.merchants && (
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                  {merchants.length > 0
                    ? `${merchants.length} cadastrado${merchants.length !== 1 ? 's' : ''}`
                    : 'Nenhum cadastrado'}
                </p>
              )}
            </div>
          </div>
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform duration-200 ${openSections.merchants ? 'rotate-180' : ''}`}
          />
        </button>
        <AnimatePresence>
          {openSections.merchants && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5">
                <MerchantManager
                  merchants={merchants}
                  onAdd={onAddMerchant}
                  onUpdate={onUpdateMerchant}
                  onDelete={onDeleteMerchant}
                  showToast={showToast}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 9. MODAIS ── */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Sair da conta?"
        description="Você será desconectado e precisará fazer login novamente."
        confirmLabel="Sair"
        confirmClassName="bg-red-500 shadow-red-500/30"
        onConfirm={handleLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
