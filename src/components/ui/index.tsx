// ─── COMPONENTES DE UI REUTILIZÁVEIS ─────────────────────────────────────────

import { motion } from 'motion/react';
import { CheckCircle } from 'lucide-react';

// ── Toast ─────────────────────────────────────────────────────────────────────
export const Toast = ({ message, type }: { message: string; type: string }) => (
  <motion.div
    initial={{ y: 100, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: 100, opacity: 0 }}
    className={`fixed bottom-24 left-4 right-4 p-4 rounded-2xl shadow-2xl z-[300] flex items-center gap-3 border ${
      type === 'success'
        ? 'bg-emerald-600 border-emerald-400 text-white'
        : 'bg-slate-800 border-slate-700 text-white'
    }`}
  >
    <CheckCircle size={20} />
    <span className="font-bold text-sm">{message}</span>
  </motion.div>
);

// ── Skeleton Card ─────────────────────────────────────────────────────────────
export const SkeletonCard = () => (
  <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 animate-pulse flex items-center gap-3">
    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-2xl" />
    <div className="flex-1 space-y-2">
      <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/4" />
      <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-3/4" />
    </div>
  </div>
);
