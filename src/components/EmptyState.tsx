// ─── TELA VAZIA ──────────────────────────────────────────────────────────────
// Ícone em círculo com halo + título + frase divertida + ação opcional.
// `messages` com várias frases: uma é sorteada a cada vez que a tela monta.

import { useState } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

type Tone = 'blue' | 'cyan' | 'amber' | 'orange' | 'violet' | 'emerald' | 'rose' | 'slate';

const TONES: Record<Tone, { bg: string; icon: string; halo: string; action: string }> = {
  blue:    { bg: 'bg-blue-50 dark:bg-blue-900/20',       icon: 'text-blue-400 dark:text-blue-500',       halo: 'bg-blue-200/40 dark:bg-blue-500/10',       action: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' },
  cyan:    { bg: 'bg-cyan-50 dark:bg-cyan-900/20',       icon: 'text-cyan-500 dark:text-cyan-500',       halo: 'bg-cyan-200/40 dark:bg-cyan-500/10',       action: 'text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-900/20',     icon: 'text-amber-500 dark:text-amber-500',     halo: 'bg-amber-200/40 dark:bg-amber-500/10',     action: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' },
  orange:  { bg: 'bg-orange-50 dark:bg-orange-900/20',   icon: 'text-orange-400 dark:text-orange-500',   halo: 'bg-orange-200/40 dark:bg-orange-500/10',   action: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20' },
  violet:  { bg: 'bg-violet-50 dark:bg-violet-900/20',   icon: 'text-violet-400 dark:text-violet-500',   halo: 'bg-violet-200/40 dark:bg-violet-500/10',   action: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-500 dark:text-emerald-500', halo: 'bg-emerald-200/40 dark:bg-emerald-500/10', action: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' },
  rose:    { bg: 'bg-rose-50 dark:bg-rose-900/20',       icon: 'text-rose-400 dark:text-rose-500',       halo: 'bg-rose-200/40 dark:bg-rose-500/10',       action: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20' },
  slate:   { bg: 'bg-slate-100 dark:bg-slate-800',       icon: 'text-slate-400 dark:text-slate-500',     halo: 'bg-slate-200/50 dark:bg-slate-600/10',     action: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800' },
};

interface Props {
  icon: LucideIcon;
  title: string;
  messages?: string[];
  tone?: Tone;
  action?: { label: string; onClick: () => void };
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, messages = [], tone = 'slate', action, compact = false }: Props) {
  const t = TONES[tone];
  const [message] = useState(() => messages[Math.floor(Math.random() * messages.length)] ?? '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className={`flex flex-col items-center text-center px-6 ${compact ? 'py-8' : 'py-14'}`}
    >
      <div className="relative mb-4">
        <motion.span
          className={`absolute inset-0 rounded-full ${t.halo}`}
          animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        />
        <motion.div
          className={`relative ${compact ? 'w-14 h-14' : 'w-20 h-20'} rounded-full ${t.bg} flex items-center justify-center`}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon size={compact ? 24 : 34} strokeWidth={1.75} className={t.icon} />
        </motion.div>
      </div>
      <p className="font-black text-sm text-slate-700 dark:text-slate-200 tracking-tight">{title}</p>
      {message && (
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5 max-w-[17rem] leading-relaxed">{message}</p>
      )}
      {action && (
        <button onClick={action.onClick}
          className={`mt-4 min-h-[44px] px-5 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all ${t.action}`}>
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
