// ─── COMPONENTES DE UI REUTILIZÁVEIS ─────────────────────────────────────────

import { motion } from 'motion/react';
import { CheckCircle, AlertCircle, Info, type LucideIcon } from 'lucide-react';

// ── Toast ─────────────────────────────────────────────────────────────────────
// success = verde ✓ · error = vermelho ! · info (ou qualquer outro) = neutro i
const TOAST_STYLES: Record<string, { cls: string; Icon: LucideIcon }> = {
  success: { cls: 'bg-emerald-600 border-emerald-400', Icon: CheckCircle },
  error:   { cls: 'bg-red-600 border-red-400',         Icon: AlertCircle },
  info:    { cls: 'bg-slate-800 border-slate-700',     Icon: Info },
};

export const Toast = ({ message, type }: { message: string; type: string }) => {
  const { cls, Icon } = TOAST_STYLES[type] ?? TOAST_STYLES.info;
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`fixed bottom-24 left-4 right-4 max-w-md mx-auto p-4 rounded-2xl shadow-2xl z-[300] flex items-center gap-3 border text-white ${cls}`}
    >
      <Icon size={20} className="shrink-0" />
      <span className="font-bold text-sm">{message}</span>
    </motion.div>
  );
};

// ── Skeleton Card ─────────────────────────────────────────────────────────────
export const SkeletonCard = () => (
  <div className="bg-white/90 dark:bg-slate-800/90 p-4 rounded-3xl border border-white/80 dark:border-slate-700/50 animate-pulse flex items-center gap-3">
    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-2xl" />
    <div className="flex-1 space-y-2">
      <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/4" />
      <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-3/4" />
    </div>
  </div>
);
