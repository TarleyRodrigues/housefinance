// ─── DESAFIOS DO CASAL (Home) ────────────────────────────────────────────────
// Ativos e próximos com barra de progresso; encerrados num histórico recolhível.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, ChevronDown, Gift, Swords } from 'lucide-react';
import { formatCurrency } from '../utils';
import { categoryLabel } from '../utils/categoryEmoji';
import { ChallengeForm } from './ChallengeForm';
import type { Category, Challenge, ChallengePayload, ChallengeProgress } from '../types';

interface Props {
  challenges: ChallengeProgress[];
  categories: Category[];
  onSave: (payload: ChallengePayload, id: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const statusChip = (c: ChallengeProgress) => {
  switch (c.status) {
    case 'active':   return { text: c.daysLeft === 0 ? 'último dia' : `${c.daysLeft} dia${c.daysLeft !== 1 ? 's' : ''}`, cls: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300' };
    case 'upcoming': return { text: `começa em ${c.daysLeft}d`, cls: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300' };
    case 'won':      return { text: 'vencido 🏆', cls: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300' };
    case 'lost':     return { text: 'estourou', cls: 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-300' };
  }
};

const barColor = (c: ChallengeProgress) =>
  c.status === 'lost' ? 'bg-red-500' : c.status === 'won' ? 'bg-emerald-500'
  : c.pct >= 0.85 ? 'bg-orange-500' : c.pct >= 0.6 ? 'bg-amber-400' : 'bg-emerald-500';

function Row({ c, onOpen }: { c: ChallengeProgress; onOpen: () => void }) {
  const chip = statusChip(c);
  const left = c.limit_amount - c.spent;
  return (
    <button onClick={onOpen} className="w-full text-left p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60 active:scale-[0.98] transition-transform">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xl shrink-0" aria-hidden="true">{c.emoji ?? '🏆'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-black text-sm text-slate-800 dark:text-slate-100 truncate">{c.title}</p>
            <span className={`shrink-0 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-lg ${chip.cls}`}>{chip.text}</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
            {c.category_name ? categoryLabel(c.category_name) : 'Todos os gastos'} · até {formatCurrency(c.limit_amount)}
          </p>
        </div>
      </div>
      <div className="mt-3 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <motion.div className={`h-full rounded-full ${barColor(c)}`}
          initial={{ width: 0 }} animate={{ width: `${Math.min(c.pct, 1) * 100}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[10px] font-bold">
        <span className="text-slate-500 dark:text-slate-400">{formatCurrency(c.spent)} gastos</span>
        <span className={left >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
          {left >= 0 ? `restam ${formatCurrency(left)}` : `${formatCurrency(-left)} acima`}
        </span>
      </div>
      {c.reward && (
        <p className="mt-2 text-[10px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1 truncate">
          <Gift size={11} className="shrink-0" /> Prêmio: {c.reward}
        </p>
      )}
    </button>
  );
}

export function ChallengesCard({ challenges, categories, onSave, onDelete }: Props) {
  const [form, setForm] = useState<{ editing: Challenge | null } | null>(null);
  const [showDone, setShowDone] = useState(false);
  const current = challenges.filter(c => c.status === 'active' || c.status === 'upcoming');
  const done = challenges.filter(c => c.status === 'won' || c.status === 'lost');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.35 }}
      className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border border-white/80 dark:border-slate-700/50 p-5 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Swords size={12} className="text-amber-500" /> Desafios do casal
        </h3>
        <button onClick={() => setForm({ editing: null })}
          className="min-h-[36px] px-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-all">
          <Plus size={12} /> Novo
        </button>
      </div>

      {current.length === 0 ? (
        <button onClick={() => setForm({ editing: null })}
          className="w-full p-4 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-800 text-left active:scale-[0.98] transition-transform">
          <p className="font-black text-sm text-slate-700 dark:text-slate-200">🏁 Que tal um desafio?</p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Ex: menos de R$ 300 em delivery este mês — e quem cumprir ganha um jantar. 🍷
          </p>
        </button>
      ) : (
        <div className="space-y-2.5">
          {current.map(c => <Row key={c.id} c={c} onOpen={() => setForm({ editing: c })} />)}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowDone(v => !v)} aria-expanded={showDone}
            className="min-h-[36px] flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <ChevronDown size={13} className={`transition-transform ${showDone ? 'rotate-180' : ''}`} />
            {done.length} encerrado{done.length !== 1 ? 's' : ''} · {done.filter(c => c.status === 'won').length} vencido{done.filter(c => c.status === 'won').length !== 1 ? 's' : ''}
          </button>
          <AnimatePresence>
            {showDone && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="space-y-2.5 overflow-hidden pt-1">
                {done.map(c => <Row key={c.id} c={c} onOpen={() => setForm({ editing: c })} />)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Portal: o card tem backdrop-blur, que prenderia o "fixed" dentro dele */}
      {createPortal(
        <AnimatePresence>
          {form && (
            <ChallengeForm editing={form.editing} categories={categories}
              onSave={(p) => onSave(p, form.editing?.id ?? null)} onDelete={onDelete} onClose={() => setForm(null)} />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </motion.div>
  );
}
