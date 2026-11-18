// ─── CELEBRAÇÃO ──────────────────────────────────────────────────────────────
// Confete + cartão de conquista. Some sozinho após alguns segundos ou ao tocar.
// Sem dependências: confete feito com Motion. "Reduzir movimento" = só o cartão.

import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import type { CelebrationData } from '../types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#facc15', '#ef4444'];
const PIECES = 46;
const AUTO_CLOSE_MS = 4500;

interface Props {
  data: CelebrationData | null;
  onClose: () => void;
}

function Confetti() {
  // Sorteado uma vez por celebração
  const pieces = useMemo(() => Array.from({ length: PIECES }, (_, i) => ({
    id: i,
    left:   Math.random() * 100,                 // vw
    delay:  Math.random() * 0.35,
    dur:    2.2 + Math.random() * 1.6,
    drift:  (Math.random() - 0.5) * 140,         // px
    spin:   (Math.random() - 0.5) * 900,         // graus
    size:   6 + Math.random() * 7,
    color:  COLORS[i % COLORS.length],
    round:  Math.random() > 0.6,
  })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {pieces.map(p => (
        <motion.span
          key={p.id}
          className="absolute top-0 block"
          style={{
            left: `${p.left}vw`, width: p.size, height: p.round ? p.size : p.size * 0.45,
            backgroundColor: p.color, borderRadius: p.round ? '50%' : 2,
          }}
          initial={{ y: -30, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '105vh', x: p.drift, rotate: p.spin, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: p.dur, delay: p.delay, ease: [0.25, 0.4, 0.55, 1] }}
        />
      ))}
    </div>
  );
}

export function Celebration({ data, onClose }: Props) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [data, onClose]);

  return createPortal(
    <AnimatePresence>
      {data && (
        <motion.div
          key={data.id}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-slate-900/30 backdrop-blur-[2px]"
          onClick={onClose}
          role="status" aria-live="polite"
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 14, stiffness: 220 }}
            className="relative w-full max-w-xs bg-white dark:bg-slate-800 rounded-[2rem] p-7 text-center shadow-2xl border border-slate-100 dark:border-slate-700"
          >
            <motion.div
              initial={{ rotate: -20, scale: 0.5 }} animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', damping: 8, stiffness: 200, delay: 0.1 }}
              className="text-6xl leading-none mb-3 select-none" aria-hidden="true"
            >
              {data.emoji}
            </motion.div>
            <h3 className="font-black text-lg text-slate-800 dark:text-white tracking-tight leading-tight">{data.title}</h3>
            {data.message && (
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{data.message}</p>
            )}
            <button onClick={onClose}
              className="mt-5 w-full min-h-[44px] rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/30 active:scale-95 transition-all">
              Uhuu! 🎉
            </button>
          </motion.div>
          {/* Depois do cartão: o confete cai por cima dele */}
          {!reduce && <Confetti />}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
