// ─── ABA: SONHOS / CONQUISTAS ─────────────────────────────────────────────────
// ✅ Tipagem completa — alinhada com types/index.ts real (Dream com category_id)
// ✅ onCompleteDream(dreamId, categoryId) — assinatura correta do Dashboard
// ✅ Sem onDeleteDream — não existe no Dashboard atual
// ✅ Modal de "Poupar agora" com input formatado (sem prompt() nativo)
// ✅ Modal de confirmação antes de concluir sonho
// ✅ Seção "Conquistados" colapsável
// ✅ Barra de progresso com cor dinâmica: azul → âmbar → verde
// ✅ fetchData NÃO chamado aqui — Dashboard já chama internamente nos callbacks
// ✅ Estado vazio motivacional
// ✅ Validação de formulário com feedback visual

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Target, CheckCircle2, X, Loader2,
  TrendingUp, Trophy, ChevronDown, ChevronUp,
  AlertTriangle, Sparkles,
} from 'lucide-react';
import { formatCurrency, handleCurrencyInput, parseAmount } from '../utils';
import type { Dream, Expense } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Tipo local — Dream com campos calculados
// ─────────────────────────────────────────────────────────────────────────────
interface DreamWithProgress extends Dream {
  current: number;
  percent: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de progresso — cor dinâmica conforme % atingido
// ─────────────────────────────────────────────────────────────────────────────
function getProgressColor(percent: number): string {
  if (percent >= 100) return 'bg-emerald-500';
  if (percent >= 75)  return 'bg-emerald-400';
  if (percent >= 50)  return 'bg-amber-400';
  if (percent >= 25)  return 'bg-blue-500';
  return 'bg-blue-400';
}

function getProgressGlow(percent: number): string {
  if (percent >= 75) return 'shadow-[0_0_12px_rgba(16,185,129,0.5)]';
  if (percent >= 50) return 'shadow-[0_0_12px_rgba(251,191,36,0.4)]';
  return 'shadow-[0_0_12px_rgba(59,130,246,0.4)]';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub: ConfirmModal genérico
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmModal({
  isOpen, title, description, confirmLabel, confirmClass, onConfirm, onCancel,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[400] flex items-end justify-center p-4"
      onClick={onCancel}
      role="dialog" aria-modal="true"
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle size={24} className="text-amber-500" />
          </div>
          <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase active:scale-95 transition-all">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase text-white active:scale-95 transition-all ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub: SaveModal — "Poupar agora" sem prompt() nativo
// ─────────────────────────────────────────────────────────────────────────────
function SaveModal({
  dream,
  onConfirm,
  onCancel,
}: {
  dream: DreamWithProgress;
  onConfirm: (amount: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleConfirm = async () => {
    const amount = parseAmount(value);
    if (!amount || amount <= 0) { setError('Informe um valor válido'); return; }
    setSaving(true);
    try {
      await onConfirm(amount);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[400] flex items-end justify-center p-4"
      onClick={onCancel}
      role="dialog" aria-modal="true"
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-500">Poupar para</p>
            <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight text-lg">
              {dream.title}
            </h3>
          </div>
          <button onClick={onCancel} aria-label="Fechar" className="p-2 text-slate-400 active:scale-90">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-1">
          <label htmlFor="save-amount" className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
            Valor a poupar
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">R$</span>
            <input
              id="save-amount"
              className={`w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-slate-900 border rounded-2xl font-black text-lg text-slate-800 dark:text-white outline-none transition-colors ${
                error ? 'border-red-400' : 'border-slate-200 dark:border-slate-700 focus:border-blue-400'
              }`}
              placeholder="0,00"
              value={value}
              onChange={(e) => { setValue(handleCurrencyInput(e.target.value)); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              autoFocus
              inputMode="numeric"
            />
          </div>
          {error && <p className="text-[10px] text-red-500 font-bold">{error}</p>}
        </div>

        <button
          onClick={handleConfirm}
          disabled={saving || !value}
          className="w-full py-4 bg-blue-600 text-white font-black text-sm uppercase rounded-2xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving
            ? <><Loader2 size={16} className="animate-spin" /> Salvando...</>
            : <><TrendingUp size={16} /> Poupar {value ? `R$ ${value}` : ''}</>
          }
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS — alinhadas com o Dashboard.tsx real
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  dreams: Dream[];
  expenses: Expense[];
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
  // Cria sonho + categoria vinculada (Dashboard já faz o insert da categoria)
  onAddDream: (title: string, target: number, image: string) => Promise<void>;
  // Marca concluído + inativa categoria — precisa dos dois IDs
  onCompleteDream: (dreamId: string, categoryId: string) => Promise<void>;
  // Registra aporte como expense na categoria do sonho
  onQuickSave: (categoryName: string, amount: number) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function TabSonhos({
  dreams,
  expenses,
  fetchData,
  showToast,
  onAddDream,
  onCompleteDream,
  onQuickSave,
}: Props) {

  // ── Estados de UI ──────────────────────────────────────────────────────────
  const [showAdd, setShowAdd]             = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  // Formulário
  const [title, setTitle]       = useState('');
  const [target, setTarget]     = useState('');
  const [img, setImg]           = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving]     = useState(false);

  // Modais
  const [savingDream, setSavingDream]         = useState<DreamWithProgress | null>(null);
  const [confirmComplete, setConfirmComplete] = useState<DreamWithProgress | null>(null);

  // ── Sonhos com progresso calculado ────────────────────────────────────────
  // Progresso = total de expenses com category_name === dream.title
  const dreamsWithProgress = useMemo((): DreamWithProgress[] => {
    return dreams.map((d) => {
      const current = expenses
        .filter((e) => e.category_name === d.title && !e.is_deleted)
        .reduce((acc, e) => acc + Number(e.amount), 0);
      const percent = d.target_value > 0
        ? Math.min((current / d.target_value) * 100, 100)
        : 0;
      return { ...d, current, percent };
    });
  }, [dreams, expenses]);

  const activeDreams    = dreamsWithProgress.filter((d) => !d.is_completed);
  const completedDreams = dreamsWithProgress.filter((d) => d.is_completed);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddDream = useCallback(async () => {
    if (!title.trim())          { setFormError('Dê um nome ao sonho'); return; }
    const amount = parseAmount(target);
    if (!amount || amount <= 0) { setFormError('Informe um valor válido'); return; }

    setSaving(true);
    setFormError('');
    try {
      await onAddDream(title.trim(), amount, img.trim());
      showToast(`Sonho "${title.trim()}" criado! 🌟`);
      setTitle(''); setTarget(''); setImg('');
      setShowAdd(false);
    } catch {
      showToast('Erro ao criar sonho', 'error');
    } finally {
      setSaving(false);
    }
  }, [title, target, img, onAddDream, showToast]);

  const handleSave = useCallback(async (amount: number) => {
    if (!savingDream) return;
    try {
      await onQuickSave(savingDream.title, amount);
      showToast(`${formatCurrency(amount)} poupado para "${savingDream.title}"! 💰`);
    } catch {
      showToast('Erro ao poupar', 'error');
    } finally {
      setSavingDream(null);
    }
  }, [savingDream, onQuickSave, showToast]);

  const handleComplete = useCallback(async () => {
    if (!confirmComplete) return;
    try {
      // Passa dreamId E categoryId — Dashboard precisa dos dois para inativar categoria
      await onCompleteDream(confirmComplete.id, confirmComplete.category_id);
      showToast(`"${confirmComplete.title}" conquistado! 🏆`);
    } catch {
      showToast('Erro ao concluir', 'error');
    } finally {
      setConfirmComplete(null);
    }
  }, [confirmComplete, onCompleteDream, showToast]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-10">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
            {activeDreams.length} ativo{activeDreams.length !== 1 ? 's' : ''} · {completedDreams.length} conquistado{completedDreams.length !== 1 ? 's' : ''}
          </p>
          <h2 className="text-2xl font-black uppercase tracking-tighter dark:text-white leading-none">
            Nossas Conquistas
          </h2>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          aria-label="Criar novo sonho"
          className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/30 active:scale-90 transition-all"
        >
          <Plus size={22} />
        </button>
      </div>

      {/* ── ESTADO VAZIO ────────────────────────────────────────────────────── */}
      {activeDreams.length === 0 && completedDreams.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 gap-4"
        >
          <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <Sparkles size={36} className="text-blue-400" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-black text-slate-800 dark:text-white uppercase tracking-tight">
              Qual é o próximo sonho?
            </p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Crie o primeiro e comece a poupar
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-black text-xs uppercase rounded-2xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
          >
            <Plus size={14} /> Criar Sonho
          </button>
        </motion.div>
      )}

      {/* ── LISTA DE SONHOS ATIVOS ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <AnimatePresence>
          {activeDreams.map((dream) => {
            const progressColor = getProgressColor(dream.percent);
            const progressGlow  = getProgressGlow(dream.percent);

            return (
              <motion.div
                key={dream.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-800 rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-slate-700 shadow-xl"
              >
                {/* Imagem */}
                <div className="h-44 bg-slate-100 dark:bg-slate-900 relative overflow-hidden">
                  {dream.image_url ? (
                    <img
                      src={dream.image_url}
                      className="w-full h-full object-cover"
                      alt={`Imagem do sonho: ${dream.title}`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Target size={52} className="text-slate-200 dark:text-slate-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/40 to-transparent pointer-events-none" />

                  {/* Badge % */}
                  <div className={`absolute top-3 right-3 px-2.5 py-1.5 rounded-xl text-white text-xs font-black ${
                    dream.percent >= 75 ? 'bg-emerald-500' : dream.percent >= 50 ? 'bg-amber-500' : 'bg-blue-600'
                  }`}>
                    {dream.percent.toFixed(0)}%
                  </div>

                  <div className="absolute bottom-4 left-5 right-5">
                    <h3 className="text-xl font-black text-white uppercase leading-tight tracking-tight">
                      {dream.title}
                    </h3>
                    <p className="text-[9px] font-bold text-blue-300 uppercase tracking-widest mt-0.5">
                      Meta: {formatCurrency(dream.target_value)}
                    </p>
                  </div>
                </div>

                {/* Progresso e ações */}
                <div className="p-5 space-y-4">
                  {/* Valores */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Acumulado</p>
                      <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">
                        {formatCurrency(dream.current)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Faltam</p>
                      <p className="text-sm font-black text-slate-500 dark:text-slate-400">
                        {formatCurrency(Math.max(dream.target_value - dream.current, 0))}
                      </p>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div className="h-3 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${dream.percent}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                      className={`h-full rounded-full ${progressColor} ${progressGlow}`}
                    />
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setSavingDream(dream)}
                      aria-label={`Poupar para ${dream.title}`}
                      className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-blue-500/20"
                    >
                      <TrendingUp size={15} /> Poupar Agora
                    </button>
                    <button
                      onClick={() => setConfirmComplete(dream)}
                      aria-label={`Marcar ${dream.title} como conquistado`}
                      className="p-3.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl active:scale-90 transition-all border border-emerald-100 dark:border-emerald-800"
                    >
                      <CheckCircle2 size={22} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── SONHOS CONQUISTADOS (colapsável) ────────────────────────────────── */}
      {completedDreams.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            aria-expanded={showCompleted}
            className="w-full flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-[1.5rem] active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-emerald-500" />
              <span className="font-black text-xs uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                {completedDreams.length} Conquista{completedDreams.length !== 1 ? 's' : ''}
              </span>
            </div>
            {showCompleted
              ? <ChevronUp size={16} className="text-emerald-500" />
              : <ChevronDown size={16} className="text-emerald-500" />
            }
          </button>

          <AnimatePresence>
            {showCompleted && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-3"
              >
                {completedDreams.map((dream) => (
                  <motion.div
                    key={dream.id}
                    layout
                    className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-800/40 rounded-[1.5rem] shadow-sm"
                  >
                    {dream.image_url ? (
                      <img
                        src={dream.image_url}
                        alt={dream.title}
                        className="w-14 h-14 rounded-2xl object-cover shrink-0 opacity-70"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                        <Trophy size={20} className="text-emerald-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-xs uppercase tracking-tight dark:text-white truncate line-through opacity-60">
                        {dream.title}
                      </p>
                      <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest mt-0.5 flex items-center gap-1">
                        <CheckCircle2 size={9} /> Conquistado · {formatCurrency(dream.target_value)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAIS
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Modal: criar sonho */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[400] flex items-end justify-center p-4"
            onClick={() => setShowAdd(false)}
            role="dialog" aria-modal="true" aria-label="Criar novo sonho"
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-500">Novo</p>
                  <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight text-lg leading-none">
                    Criar Sonho
                  </h3>
                </div>
                <button onClick={() => setShowAdd(false)} aria-label="Fechar" className="p-2 text-slate-400 active:scale-90 transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="dream-title" className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                    Nome do sonho
                  </label>
                  <input
                    id="dream-title"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm dark:text-white outline-none focus:border-blue-400 transition-colors"
                    placeholder="Ex: Viagem para a Europa, TV nova..."
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setFormError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddDream()}
                  />
                </div>

                <div>
                  <label htmlFor="dream-target" className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                    Valor da meta (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">R$</span>
                    <input
                      id="dream-target"
                      className="w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-blue-600 outline-none focus:border-blue-400 transition-colors"
                      placeholder="0,00"
                      value={target}
                      onChange={(e) => { setTarget(handleCurrencyInput(e.target.value)); setFormError(''); }}
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="dream-image" className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                    URL da foto (opcional)
                  </label>
                  <input
                    id="dream-image"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-medium text-xs dark:text-slate-300 outline-none focus:border-blue-400 transition-colors placeholder:text-slate-300"
                    placeholder="https://..."
                    value={img}
                    onChange={(e) => setImg(e.target.value)}
                  />
                </div>

                {formError && (
                  <p className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                    <AlertTriangle size={10} /> {formError}
                  </p>
                )}
              </div>

              <button
                onClick={handleAddDream}
                disabled={saving}
                className="w-full py-4 bg-blue-600 text-white font-black text-sm uppercase rounded-2xl shadow-xl shadow-blue-500/30 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving
                  ? <><Loader2 size={16} className="animate-spin" /> Criando...</>
                  : <><Sparkles size={16} /> Projetar Sonho</>
                }
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: poupar agora */}
      <AnimatePresence>
        {savingDream && (
          <SaveModal
            dream={savingDream}
            onConfirm={handleSave}
            onCancel={() => setSavingDream(null)}
          />
        )}
      </AnimatePresence>

      {/* Modal: confirmar conclusão */}
      <AnimatePresence>
        {confirmComplete && (
          <ConfirmModal
            isOpen
            title="Marcar como conquistado?"
            description={`"${confirmComplete.title}" será movido para conquistas e a categoria de poupança será inativada.`}
            confirmLabel="Conquistei! 🏆"
            confirmClass="bg-emerald-500"
            onConfirm={handleComplete}
            onCancel={() => setConfirmComplete(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}