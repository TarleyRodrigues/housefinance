// ─── GASTOS PADRÃO — gerenciador ─────────────────────────────────────────────
// Atalhos do "Novo Gasto": descrição + valor + categoria + estabelecimento.
// • Criar / editar (bottom sheet) / apagar (com confirmação)
// • Gastos padrão cuja categoria não existe mais aparecem no topo, com
//   "Vincular a…" para corrigir com um toque sem perder o restante dos dados.

import { useMemo, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Pencil, Trash2, X, Loader2, AlertTriangle, Store, Zap, Link2 } from 'lucide-react';
import { formatCurrency, handleCurrencyInput, parseAmount } from '../utils';
import type { Category, ExpenseTemplate, ExpenseTemplatePayload } from '../types';

interface Props {
  templates: ExpenseTemplate[];
  categories: Category[];
  merchantNames: string[];
  onAdd: (payload: ExpenseTemplatePayload) => Promise<void>;
  onUpdate: (id: string, payload: ExpenseTemplatePayload) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showToast: (msg: string, type?: string) => void;
}

const toPayload = (tpl: ExpenseTemplate, patch: Partial<ExpenseTemplatePayload> = {}): ExpenseTemplatePayload => ({
  description:   tpl.description,
  amount:        Number(tpl.amount),
  category_name: tpl.category_name,
  merchant:      tpl.merchant ?? null,
  ...patch,
});

// Mensagem amigável quando a coluna nova ainda não existe no banco
const saveErrorMessage = (err: unknown): string => {
  const { code, message } = (err as { code?: string; message?: string }) ?? {};
  if (code === 'PGRST204' && message?.includes('merchant')) {
    return 'Falta a coluna "merchant" — rode o SQL no Supabase';
  }
  return 'Erro ao salvar. Tente novamente.';
};

const INPUT_CLS =
  'w-full p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200 font-medium placeholder:text-slate-400 focus:border-amber-400 dark:focus:border-amber-600 transition-colors';

// ─────────────────────────────────────────────────────────────────────────────
// Formulário (bottom sheet)
// ─────────────────────────────────────────────────────────────────────────────
function TemplateForm({ editing, categories, merchantNames, onSave, onClose }: {
  editing: ExpenseTemplate | null;
  categories: Category[];
  merchantNames: string[];
  onSave: (payload: ExpenseTemplatePayload) => Promise<void>;
  onClose: () => void;
}) {
  const categoryExists = (name: string) => categories.some(c => c.name === name);
  const [description, setDescription] = useState(editing?.description ?? '');
  const [amount, setAmount] = useState(
    editing ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(editing.amount) : '',
  );
  // Categoria apagada: força escolher de novo
  const [category, setCategory] = useState(editing && categoryExists(editing.category_name) ? editing.category_name : '');
  const [merchant, setMerchant] = useState(editing?.merchant ?? '');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  // Ao escolher a categoria, sugere o fornecedor padrão dela (se o campo estiver vazio)
  const handleCategory = (name: string) => {
    setCategory(name);
    const def = categories.find(c => c.name === name)?.default_merchant;
    if (def && !merchant.trim()) setMerchant(def);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = parseAmount(amount);
    if (!description.trim())       { setError('Informe a descrição'); return; }
    if (isNaN(value) || value <= 0) { setError('Informe um valor maior que zero'); return; }
    if (!category)                 { setError('Escolha a categoria'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({
        description: description.trim(), amount: value, category_name: category,
        merchant: merchant.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(saveErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
      onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="tpl-form-title"
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 id="tpl-form-title" className="font-black text-base uppercase tracking-tight text-amber-600 dark:text-amber-400">
            {editing ? 'Editar Gasto Padrão' : 'Novo Gasto Padrão'}
          </h3>
          <button onClick={onClose} aria-label="Fechar"
            className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {editing && !categoryExists(editing.category_name) && (
          <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 leading-relaxed">
            A categoria <strong>"{editing.category_name}"</strong> não existe mais. Escolha a nova categoria abaixo.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-amber-600 dark:text-amber-400 text-lg pointer-events-none">R$</span>
            <input type="text" inputMode="numeric" placeholder="0,00" value={amount} aria-label="Valor"
              onChange={e => setAmount(handleCurrencyInput(e.target.value))}
              className="w-full p-4 pl-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl text-2xl font-black outline-none text-amber-700 dark:text-amber-400 border-2 border-transparent focus:border-amber-500 transition-all" />
          </div>

          <input type="text" placeholder="Descrição (ex: Conta de luz)" value={description} aria-label="Descrição"
            onChange={e => setDescription(e.target.value)} className={INPUT_CLS} />

          <select value={category} onChange={e => handleCategory(e.target.value)} aria-label="Categoria"
            className={`${INPUT_CLS} font-bold uppercase text-xs`}>
            <option value="">Categoria...</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>

          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 focus-within:border-amber-400 dark:focus-within:border-amber-600 transition-colors">
            <label htmlFor="tpl-merchant" className="flex items-center gap-1.5 px-4 pt-3 pb-1">
              <Store size={11} className="text-slate-400" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Estabelecimento (opcional)</span>
            </label>
            <input id="tpl-merchant" type="text" list="tpl-merchant-list" placeholder="Ex: Enel, Sabesp..."
              value={merchant} onChange={e => setMerchant(e.target.value)}
              className="w-full px-4 pb-3 bg-transparent outline-none text-slate-800 dark:text-slate-200 font-medium text-sm placeholder:text-slate-400" />
            <datalist id="tpl-merchant-list">
              {merchantNames.map(m => <option key={m} value={m} />)}
            </datalist>
          </div>

          {error && (
            <p role="alert" className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-2.5 text-center">{error}</p>
          )}

          <button type="submit" disabled={saving}
            className="w-full min-h-[44px] bg-amber-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-amber-500/30 active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 size={18} className="animate-spin" />}
            Salvar
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirmação de exclusão
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmDelete({ tpl, deleting, onConfirm, onCancel }: {
  tpl: ExpenseTemplate; deleting: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
      onClick={onCancel} role="alertdialog" aria-modal="true" aria-labelledby="tpl-del-title"
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle size={24} className="text-red-500" />
          </div>
          <h3 id="tpl-del-title" className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">
            Apagar gasto padrão?
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            <span className="font-bold text-slate-700 dark:text-slate-200">{tpl.description}</span> · {formatCurrency(tpl.amount)}<br />
            Não afeta gastos já registrados.
          </p>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} disabled={deleting}
            className="flex-1 min-h-[44px] py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider active:scale-95 transition-all">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 min-h-[44px] py-3 rounded-2xl bg-red-500 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 disabled:opacity-60">
            {deleting && <Loader2 size={14} className="animate-spin" />}
            Apagar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card de um gasto padrão
// ─────────────────────────────────────────────────────────────────────────────
function TemplateCard({ tpl, categories, categoryColor, orphan, linking, onLink, onEdit, onDelete }: {
  tpl: ExpenseTemplate;
  categories: Category[];
  categoryColor?: string;
  orphan: boolean;
  linking: boolean;
  onLink: (categoryName: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
      className={`p-4 rounded-[1.75rem] border shadow-sm bg-white/90 dark:bg-slate-800/90 ${
        orphan ? 'border-amber-300 dark:border-amber-700' : 'border-slate-100 dark:border-slate-700'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-10 rounded-full shrink-0"
          style={{ backgroundColor: orphan ? '#f59e0b' : (categoryColor ?? '#94a3b8') }} />
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-slate-800 dark:text-slate-100 truncate">{tpl.description}</p>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {formatCurrency(tpl.amount)} ·{' '}
            <span className={orphan ? 'line-through text-amber-600 dark:text-amber-400' : ''}>{tpl.category_name}</span>
          </p>
          {tpl.merchant && (
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 truncate flex items-center gap-1">
              <Store size={10} className="shrink-0" /> {tpl.merchant}
            </p>
          )}
        </div>
        <button onClick={onEdit} aria-label={`Editar ${tpl.description}`}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 dark:text-slate-500 hover:text-amber-500 active:scale-90 transition-all">
          <Pencil size={15} />
        </button>
        <button onClick={onDelete} aria-label={`Apagar ${tpl.description}`}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 dark:text-slate-500 hover:text-red-500 active:scale-90 transition-all">
          <Trash2 size={15} />
        </button>
      </div>

      {/* Categoria removida: vincular a uma existente sem perder descrição/valor/estabelecimento */}
      {orphan && (
        <div className="mt-3 flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-2 pl-3">
          {linking
            ? <Loader2 size={14} className="text-amber-600 animate-spin shrink-0" />
            : <Link2 size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />}
          <label htmlFor={`link-${tpl.id}`} className="sr-only">Vincular {tpl.description} a uma categoria</label>
          <select id={`link-${tpl.id}`} value="" disabled={linking}
            onChange={e => e.target.value && onLink(e.target.value)}
            className="flex-1 min-h-[40px] bg-transparent outline-none text-xs font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">
            <option value="">Vincular à categoria…</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function ExpenseTemplateManager({
  templates, categories, merchantNames, onAdd, onUpdate, onDelete, showToast,
}: Props) {
  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState<ExpenseTemplate | null>(null);
  const [toDelete, setToDelete]   = useState<ExpenseTemplate | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const categoryByName = useMemo(() => new Map(categories.map(c => [c.name, c])), [categories]);

  // Órfãos primeiro; depois em ordem alfabética
  const { orphans, valid } = useMemo(() => {
    const sorted = [...templates].sort((a, b) => a.description.localeCompare(b.description, 'pt-BR'));
    return {
      orphans: sorted.filter(t => !categoryByName.has(t.category_name)),
      valid:   sorted.filter(t =>  categoryByName.has(t.category_name)),
    };
  }, [templates, categoryByName]);

  const openNew  = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (tpl: ExpenseTemplate) => { setEditing(tpl); setFormOpen(true); };

  const handleSave = async (payload: ExpenseTemplatePayload) => {
    if (editing) await onUpdate(editing.id, payload);
    else await onAdd(payload);
    showToast(editing ? 'Gasto padrão atualizado!' : 'Gasto padrão criado!');
  };

  const handleLink = async (tpl: ExpenseTemplate, categoryName: string) => {
    setLinkingId(tpl.id);
    try {
      // Aproveita o fornecedor padrão da categoria se o gasto padrão não tiver estabelecimento
      const def = categoryByName.get(categoryName)?.default_merchant ?? null;
      await onUpdate(tpl.id, toPayload(tpl, { category_name: categoryName, merchant: tpl.merchant ?? def }));
      showToast(`"${tpl.description}" vinculado a ${categoryName}`);
    } catch (err) {
      showToast(saveErrorMessage(err), 'error');
    } finally {
      setLinkingId(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await onDelete(toDelete.id);
      showToast('Gasto padrão removido', 'info');
      setToDelete(null);
    } catch {
      showToast('Erro ao remover. Tente novamente.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const renderCard = (tpl: ExpenseTemplate, orphan: boolean) => (
    <TemplateCard key={tpl.id} tpl={tpl} categories={categories}
      categoryColor={categoryByName.get(tpl.category_name)?.color}
      orphan={orphan} linking={linkingId === tpl.id}
      onLink={name => handleLink(tpl, name)}
      onEdit={() => openEdit(tpl)}
      onDelete={() => setToDelete(tpl)} />
  );

  return (
    <div className="space-y-4">
      <button onClick={openNew}
        className="w-full min-h-[44px] flex items-center justify-center gap-2 py-4 rounded-[2rem] border-2 border-dashed border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 font-black text-xs uppercase tracking-widest active:scale-95 transition-all bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
        <Plus size={16} /> Novo Gasto Padrão
      </button>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-slate-300 dark:text-slate-600 text-center">
          <Zap size={40} strokeWidth={1.5} />
          <p className="font-black uppercase text-[10px] tracking-widest">Nenhum gasto padrão</p>
          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 max-w-[16rem] leading-relaxed">
            Crie atalhos para os gastos que se repetem — no Novo Gasto basta um toque para preencher tudo.
          </p>
        </div>
      ) : (
        <>
          {orphans.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 px-1">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 leading-snug">
                  {orphans.length === 1 ? '1 gasto padrão está' : `${orphans.length} gastos padrão estão`} com
                  uma categoria que não existe mais. Vincule à categoria correta:
                </p>
              </div>
              <AnimatePresence>{orphans.map(t => renderCard(t, true))}</AnimatePresence>
            </div>
          )}

          {valid.length > 0 && (
            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">
                {valid.length} gasto{valid.length !== 1 ? 's' : ''} padrão
              </p>
              <AnimatePresence>{valid.map(t => renderCard(t, false))}</AnimatePresence>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {formOpen && (
          <TemplateForm key={editing?.id ?? 'new'} editing={editing} categories={categories}
            merchantNames={merchantNames} onSave={handleSave}
            onClose={() => { setFormOpen(false); setEditing(null); }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toDelete && (
          <ConfirmDelete tpl={toDelete} deleting={deleting} onConfirm={handleDelete}
            onCancel={() => !deleting && setToDelete(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
