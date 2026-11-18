// ─── PRATELEIRA DE CONQUISTAS (Home) ─────────────────────────────────────────
// Selos em rolagem horizontal: conquistados coloridos, bloqueados em cinza com
// anel de progresso. Toque abre os detalhes.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock } from 'lucide-react';
import type { Badge } from '../types';

const TONE: Record<Badge['tone'], { ring: string; bg: string; text: string }> = {
  amber:   { ring: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20',     text: 'text-amber-600 dark:text-amber-400' },
  emerald: { ring: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400' },
  blue:    { ring: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20',       text: 'text-blue-600 dark:text-blue-400' },
  violet:  { ring: '#8b5cf6', bg: 'bg-violet-50 dark:bg-violet-900/20',   text: 'text-violet-600 dark:text-violet-400' },
  rose:    { ring: '#f43f5e', bg: 'bg-rose-50 dark:bg-rose-900/20',       text: 'text-rose-600 dark:text-rose-400' },
  orange:  { ring: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20',   text: 'text-orange-600 dark:text-orange-400' },
  cyan:    { ring: '#06b6d4', bg: 'bg-cyan-50 dark:bg-cyan-900/20',       text: 'text-cyan-600 dark:text-cyan-400' },
};

function Medal({ badge, size = 56 }: { badge: Badge; size?: number }) {
  const t = TONE[badge.tone];
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={4} className="stroke-slate-200 dark:stroke-slate-700" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={4} strokeLinecap="round"
          stroke={badge.earned ? t.ring : '#94a3b8'} strokeDasharray={c} strokeDashoffset={c * (1 - badge.progress)} />
      </svg>
      <span className={`rounded-full flex items-center justify-center ${badge.earned ? t.bg : 'bg-slate-100 dark:bg-slate-800'}`}
        style={{ width: size - 12, height: size - 12, fontSize: size * 0.42, filter: badge.earned ? undefined : 'grayscale(1)', opacity: badge.earned ? 1 : 0.55 }}>
        {badge.emoji}
      </span>
      {!badge.earned && (
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-slate-500 dark:bg-slate-600 text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-800">
          <Lock size={10} />
        </span>
      )}
    </span>
  );
}

export function BadgeShelf({ badges }: { badges: Badge[] }) {
  const [open, setOpen] = useState<Badge | null>(null);
  if (badges.length === 0) return null;
  const earned = badges.filter(b => b.earned).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.35 }}
      className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border border-white/80 dark:border-slate-700/50 p-5 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Conquistas</h3>
        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-lg">
          {earned} de {badges.length}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 snap-x">
        {badges.map(b => (
          <button key={b.id} onClick={() => setOpen(b)}
            className="snap-start shrink-0 w-[76px] flex flex-col items-center gap-1.5 text-center active:scale-95 transition-transform min-h-[44px]"
            aria-label={`${b.title}${b.earned ? ' — conquistado' : ` — ${b.progressLabel ?? ''}`}`}>
            <Medal badge={b} />
            <span className={`text-[10px] font-black leading-tight line-clamp-2 ${b.earned ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
              {b.title}
            </span>
          </button>
        ))}
      </div>

      {/* Portal: o card tem backdrop-blur, que prenderia o "fixed" dentro dele */}
      {createPortal(<AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
            onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-labelledby="badge-title"
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="relative bg-white dark:bg-slate-800 rounded-[2rem] p-7 w-full max-w-sm shadow-2xl text-center"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setOpen(null)} aria-label="Fechar"
                className="absolute top-4 right-4 w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center active:scale-90 transition-all">
                <X size={16} />
              </button>
              <div className="flex justify-center mb-4"><Medal badge={open} size={96} /></div>
              <h3 id="badge-title" className="font-black text-lg text-slate-800 dark:text-white tracking-tight">{open.title}</h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{open.description}</p>
              <p className={`inline-block mt-4 px-3 py-1.5 rounded-xl text-xs font-black ${open.earned ? `${TONE[open.tone].bg} ${TONE[open.tone].text}` : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}>
                {open.earned ? '✅ Conquistado' : open.progressLabel}
              </p>
              {open.earned && open.progressLabel && (
                <p className="text-[11px] font-bold text-slate-400 mt-2">{open.progressLabel}</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </motion.div>
  );
}
