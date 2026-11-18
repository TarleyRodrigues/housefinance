// ─── FORMULÁRIO DE DESAFIO (bottom sheet) ────────────────────────────────────

import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Trash2, Gift } from 'lucide-react';
import { addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { handleCurrencyInput, parseAmount } from '../utils';
import { categoryLabel } from '../utils/categoryEmoji';
import { CHALLENGE_EMOJIS, CHALLENGE_IDEAS } from '../utils/challenges';
import type { Category, Challenge, ChallengePayload } from '../types';

type Period = 'week' | 'month' | 'next' | 'custom';

const d = (x: Date) => format(x, 'yyyy-MM-dd');
const periodRange = (p: Exclude<Period, 'custom'>): [string, string] => {
  const now = new Date();
  if (p === 'week') return [d(startOfWeek(now, { weekStartsOn: 1 })), d(endOfWeek(now, { weekStartsOn: 1 }))];
  if (p === 'month') return [d(startOfMonth(now)), d(endOfMonth(now))];
  const next = addMonths(now, 1);
  return [d(startOfMonth(next)), d(endOfMonth(next))];
};

const INPUT = 'w-full min-h-[44px] p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-100 font-medium text-sm placeholder:text-slate-400 focus:border-amber-400 dark:focus:border-amber-600 transition-colors';

interface Props {
  editing: Challenge | null;
  categories: Category[];
  onSave: (payload: ChallengePayload) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export function ChallengeForm({ editing, categories, onSave, onDelete, onClose }: Props) {
  const [title, setTitle]       = useState(editing?.title ?? '');
  const [emoji, setEmoji]       = useState(editing?.emoji ?? '🏆');
  const [category, setCategory] = useState(editing?.category_name ?? '');
  const [limit, setLimit]       = useState(editing ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(editing.limit_amount) : '');
  const [period, setPeriod]     = useState<Period>(editing ? 'custom' : 'month');
  const [start, setStart]       = useState(editing?.start_date ?? periodRange('month')[0]);
  const [end, setEnd]           = useState(editing?.end_date ?? periodRange('month')[1]);
  const [reward, setReward]     = useState(editing?.reward ?? '');
  const [saving, setSaving]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError]       = useState('');

  const choosePeriod = (p: Period) => {
    setPeriod(p);
    if (p !== 'custom') { const [s, e] = periodRange(p); setStart(s); setEnd(e); }
  };

  const applyIdea = (idea: typeof CHALLENGE_IDEAS[number]) => {
    setTitle(idea.title);
    setEmoji(idea.emoji);
    const cat = idea.categoryHint ? categories.find(c => idea.categoryHint!.test(categoryLabel(c.name))) : null;
    setCategory(cat?.name ?? '');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = parseAmount(limit);
    if (!title.trim())              { setError('Dê um nome ao desafio'); return; }
    if (isNaN(value) || value <= 0) { setError('Informe o limite de gasto'); return; }
    if (!start || !end || end < start) { setError('Confira as datas do período'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({
        title: title.trim(), emoji, category_name: category || null, limit_amount: value,
        start_date: start, end_date: end, reward: reward.trim() || null,
      });
      onClose();
    } catch {
      setError('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    setSaving(true);
    try { await onDelete(editing.id); onClose(); }
    catch { setError('Erro ao apagar. Tente novamente.'); setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
      onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="challenge-title"
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="relative bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 id="challenge-title" className="font-black text-base uppercase tracking-tight text-amber-600 dark:text-amber-400">
            {editing ? 'Editar desafio' : 'Novo desafio'}
          </h3>
          <button onClick={onClose} aria-label="Fechar"
            className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {!editing && (
          <div className="flex flex-wrap gap-1.5">
            {CHALLENGE_IDEAS.map(idea => (
              <button key={idea.title} type="button" onClick={() => applyIdea(idea)}
                className="min-h-[36px] px-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-[11px] font-black text-amber-700 dark:text-amber-300 active:scale-95 transition-all">
                {idea.emoji} {idea.title}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="flex gap-2">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome do desafio" aria-label="Nome do desafio" className={INPUT} />
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" role="radiogroup" aria-label="Emoji do desafio">
            {CHALLENGE_EMOJIS.map(em => (
              <button key={em} type="button" role="radio" aria-checked={emoji === em} onClick={() => setEmoji(em)}
                className={`shrink-0 w-11 h-11 rounded-2xl text-xl flex items-center justify-center transition-all ${
                  emoji === em ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-amber-400' : 'bg-slate-50 dark:bg-slate-900/50'
                }`}>{em}</button>
            ))}
          </div>

          <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Categoria" className={`${INPUT} font-bold`}>
            <option value="">Todos os gastos (total)</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-amber-600 dark:text-amber-400 pointer-events-none">R$</span>
            <input inputMode="numeric" value={limit} onChange={e => setLimit(handleCurrencyInput(e.target.value))}
              placeholder="Limite de gasto" aria-label="Limite de gasto"
              className={`${INPUT} pl-12 text-lg font-black text-amber-700 dark:text-amber-400`} />
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              {([['week', 'Semana'], ['month', 'Este mês'], ['next', 'Próximo'], ['custom', 'Datas']] as const).map(([p, label]) => (
                <button key={p} type="button" onClick={() => choosePeriod(p)}
                  className={`min-h-[40px] rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${
                    period === p ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-300'
                  }`}>{label}</button>
              ))}
            </div>
            <AnimatePresence>
              {period === 'custom' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="grid grid-cols-2 gap-2 overflow-hidden">
                  <input type="date" value={start} onChange={e => setStart(e.target.value)} aria-label="Início" className={`${INPUT} font-bold`} />
                  <input type="date" value={end} onChange={e => setEnd(e.target.value)} aria-label="Fim" className={`${INPUT} font-bold`} />
                </motion.div>
              )}
            </AnimatePresence>
            {period !== 'custom' && (
              <p className="text-[10px] font-bold text-slate-400 px-1">
                {format(new Date(`${start}T12:00:00`), 'dd/MM')} a {format(new Date(`${end}T12:00:00`), 'dd/MM')}
              </p>
            )}
          </div>

          <div className="relative">
            <Gift size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" />
            <input value={reward} onChange={e => setReward(e.target.value)} placeholder="Prêmio (ex: jantar fora 🍷)" aria-label="Prêmio"
              className={`${INPUT} pl-11`} />
          </div>

          {error && <p role="alert" className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-2.5 text-center">{error}</p>}

          <button type="submit" disabled={saving}
            className="w-full min-h-[48px] bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-amber-500/30 active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 size={16} className="animate-spin" />}
            {editing ? 'Salvar' : 'Lançar desafio'}
          </button>

          {editing && (
            confirmDelete ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} disabled={saving}
                  className="flex-1 min-h-[44px] rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-[11px] uppercase tracking-wider">
                  Cancelar
                </button>
                <button type="button" onClick={remove} disabled={saving}
                  className="flex-1 min-h-[44px] rounded-2xl bg-red-500 text-white font-black text-[11px] uppercase tracking-wider shadow-lg shadow-red-500/30">
                  Apagar mesmo
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="w-full min-h-[44px] rounded-2xl text-red-500 font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 border-2 border-red-50 dark:border-red-900/30">
                <Trash2 size={14} /> Apagar desafio
              </button>
            )
          )}
        </form>
      </motion.div>
    </motion.div>
  );
}
