// ─── SELETOR DE EMOJI DA CATEGORIA ───────────────────────────────────────────
// Grade de sugestões + campo livre. "Usar o do nome" limpa o personalizado.

import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Loader2, RotateCcw } from 'lucide-react';
import { EMOJI_CHOICES, categoryLabel, splitCategoryName, suggestEmoji } from '../utils/categoryEmoji';

interface Props {
  categoryName: string;
  current: string | null;          // emoji personalizado salvo (coluna)
  color?: string | null;
  onSelect: (emoji: string | null) => Promise<void>;
  onClose: () => void;
}

// Primeiro "caractere visível" (cluster de grafemas) do texto digitado
const firstGrapheme = (text: string): string => {
  const t = text.trim();
  if (!t) return '';
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: 'grapheme' }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) for (const { segment } of new Seg('pt-BR', { granularity: 'grapheme' }).segment(t)) return segment;
  return Array.from(t)[0] ?? '';
};

export function EmojiPickerSheet({ categoryName, current, color, onSelect, onClose }: Props) {
  const fromName = splitCategoryName(categoryName).emoji;
  const suggestion = suggestEmoji(categoryName);
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const pick = async (emoji: string | null) => {
    if (saving) return;
    setSaving(emoji ?? 'reset');
    try { await onSelect(emoji); onClose(); } finally { setSaving(null); }
  };

  const shown = current || fromName || suggestion;
  const c = color || '#64748b';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
      onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="emoji-title"
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: `${c}26`, boxShadow: `inset 0 0 0 1px ${c}40` }} aria-hidden="true">
            {shown ?? '·'}
          </span>
          <div className="flex-1 min-w-0">
            <h3 id="emoji-title" className="font-black text-base text-slate-800 dark:text-white tracking-tight truncate">{categoryLabel(categoryName)}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Escolha o emoji</p>
          </div>
          <button onClick={onClose} aria-label="Fechar"
            className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {EMOJI_CHOICES.map(e => (
            <button key={e} onClick={() => pick(e)} disabled={!!saving} aria-label={`Usar ${e}`}
              className={`aspect-square min-h-[44px] rounded-2xl text-2xl flex items-center justify-center active:scale-90 transition-all ${
                shown === e ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400' : 'bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}>
              {saving === e ? <Loader2 size={18} className="animate-spin text-slate-400" /> : e}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <label htmlFor="emoji-custom" className="sr-only">Outro emoji</label>
          <input id="emoji-custom" value={custom} onChange={e => setCustom(firstGrapheme(e.target.value))}
            placeholder="Outro? Cole ou digite um emoji"
            className="flex-1 min-h-[44px] px-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-100 text-sm placeholder:text-slate-400 focus:border-blue-400" />
          <button onClick={() => custom && pick(custom)} disabled={!custom || !!saving}
            className="min-h-[44px] px-4 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all disabled:opacity-40">
            Usar {custom}
          </button>
        </div>

        {current && (
          <button onClick={() => pick(null)} disabled={!!saving}
            className="w-full min-h-[44px] rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
            {saving === 'reset' ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            {fromName ? `Voltar ao do nome (${fromName})` : 'Remover emoji personalizado'}
          </button>
        )}

        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 leading-relaxed">
          O nome da categoria não muda — o emoji aparece no extrato, no Novo Gasto, na Home e em Gastos Fixos.
        </p>
      </motion.div>
    </motion.div>
  );
}
