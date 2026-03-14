// ─── ABA: RECEITAS ────────────────────────────────────────────────────────────
// ✅ CORREÇÃO: recipes agora vem via prop (lazy no hook), não via fetch local
// ✅ Etapas de preparo com título, descrição e tempo opcional
// ✅ Modo Cozinhar: navegação etapa a etapa com progresso visual
// ✅ Cronômetro por etapa com alerta sonoro (Web Audio API) + vibração
// ✅ Upload de imagem via Supabase Storage (bucket recipe-images)
// ✅ Ingredientes editáveis + envio para lista de compras
// ✅ Cards com imagem, categoria, tempo total e quem cadastrou
// ✅ Filtro por categoria

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, X, Check, Trash2, ChefHat, Clock,
  UtensilsCrossed, ArrowLeft, Loader2, Camera,
  Pencil, ShoppingCart, Play, Pause, SkipForward,
  CheckCircle2, Timer, ChevronRight, RotateCcw,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
export interface RecipeStep {
  title: string;
  description: string;
  duration_seconds: number | null; // null = sem cronômetro
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  name: string;
  quantity: string;
  order_index: number;
}

export interface Recipe {
  id: string;
  user_id: string;
  title: string;
  category: string;
  prep_time: number | null;
  image_url: string | null;
  instructions: string | null; // mantido para compatibilidade
  steps: RecipeStep[];         // novo campo jsonb
  created_at: string;
  ingredients?: RecipeIngredient[];
  profile?: { full_name?: string; avatar_url?: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = ['Café da manhã', 'Almoço', 'Jantar', 'Lanche', 'Sobremesa', 'Bebida', 'Outro'];

const CATEGORY_COLORS: Record<string, string> = {
  'Café da manhã': 'bg-amber-500/20 text-amber-400',
  'Almoço':        'bg-orange-500/20 text-orange-400',
  'Jantar':        'bg-blue-500/20 text-blue-400',
  'Lanche':        'bg-green-500/20 text-green-400',
  'Sobremesa':     'bg-pink-500/20 text-pink-400',
  'Bebida':        'bg-cyan-500/20 text-cyan-400',
  'Outro':         'bg-slate-500/20 text-slate-400',
};

const EMPTY_STEP: RecipeStep = { title: '', description: '', duration_seconds: null };

// ─────────────────────────────────────────────────────────────────────────────
// Web Audio API — gera bip de alerta sem dependência externa
// ─────────────────────────────────────────────────────────────────────────────
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const playBeep = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    // 3 bips ascendentes
    playBeep(880, 0,    0.15);
    playBeep(988, 0.2,  0.15);
    playBeep(1174, 0.4, 0.3);
  } catch { /* silencioso se não suportado */ }
}

function vibrateAlert() {
  try {
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 400]);
  } catch { /* silencioso */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Formata segundos como MM:SS
// ─────────────────────────────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: StepTimer — cronômetro individual por etapa
// ─────────────────────────────────────────────────────────────────────────────
function StepTimer({ totalSeconds, onFinish }: { totalSeconds: number; onFinish: () => void }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning]     = useState(false);
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef               = useRef(false);

  // Reset quando totalSeconds muda (nova etapa)
  useEffect(() => {
    setRemaining(totalSeconds);
    setRunning(false);
    finishedRef.current = false;
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [totalSeconds]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            if (!finishedRef.current) {
              finishedRef.current = true;
              playAlertSound();
              vibrateAlert();
              onFinish();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, onFinish]);

  const percent = ((totalSeconds - remaining) / totalSeconds) * 100;
  const isFinished = remaining === 0;

  const reset = () => {
    setRemaining(totalSeconds);
    setRunning(false);
    finishedRef.current = false;
  };

  return (
    <div className={`rounded-[1.5rem] p-4 border transition-all ${
      isFinished
        ? 'bg-emerald-900/30 border-emerald-700/50'
        : running
          ? 'bg-orange-900/30 border-orange-700/50'
          : 'bg-slate-800/60 border-slate-700/50'
    }`}>
      {/* Anel de progresso */}
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 shrink-0">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <circle
              cx="32" cy="32" r="26" fill="none"
              stroke={isFinished ? '#10b981' : running ? '#f97316' : '#64748b'}
              strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 26}`}
              strokeDashoffset={`${2 * Math.PI * 26 * (1 - percent / 100)}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xs font-black tabular-nums ${isFinished ? 'text-emerald-400' : 'text-white'}`}>
              {isFinished ? '✓' : formatTime(remaining)}
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <p className={`text-[10px] font-black uppercase tracking-widest ${
            isFinished ? 'text-emerald-400' : running ? 'text-orange-400' : 'text-slate-400'
          }`}>
            {isFinished ? 'Tempo finalizado!' : running ? 'Cronômetro ativo' : `${formatTime(totalSeconds)} configurado`}
          </p>
          <div className="flex gap-2">
            {!isFinished && (
              <button
                onClick={() => setRunning((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all active:scale-95 ${
                  running
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                }`}
              >
                {running ? <Pause size={11} /> : <Play size={11} />}
                {running ? 'Pausar' : 'Iniciar'}
              </button>
            )}
            <button
              onClick={reset}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase bg-slate-700/50 text-slate-400 border border-slate-600/50 active:scale-95 transition-all"
            >
              <RotateCcw size={10} /> Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: CookingMode — modo de cozinhar (etapa a etapa)
// ─────────────────────────────────────────────────────────────────────────────
function CookingMode({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const steps = recipe.steps ?? [];
  const [currentIdx, setCurrentIdx] = useState(0);
  const [completed, setCompleted]   = useState<Set<number>>(new Set());
  const [timerAlert, setTimerAlert] = useState(false);

  const step = steps[currentIdx];
  const isLast = currentIdx === steps.length - 1;
  const allDone = completed.size === steps.length;

  const goNext = () => {
    setCompleted((prev) => new Set([...prev, currentIdx]));
    setTimerAlert(false);
    if (!isLast) setCurrentIdx((i) => i + 1);
  };

  const goPrev = () => {
    setTimerAlert(false);
    setCurrentIdx((i) => Math.max(0, i - 1));
  };

  if (steps.length === 0) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-[500] flex flex-col items-center justify-center gap-4 p-8">
        <ChefHat size={48} className="text-slate-600" />
        <p className="text-slate-400 font-black uppercase text-xs tracking-widest text-center">
          Esta receita não tem etapas cadastradas
        </p>
        <button onClick={onClose} className="px-6 py-3 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900 z-[500] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
        <button onClick={onClose} className="p-2 bg-slate-800 rounded-2xl text-slate-400 active:scale-90 transition-all">
          <X size={18} />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Modo Cozinhar</p>
          <p className="text-xs font-black text-white uppercase tracking-tight truncate max-w-[180px]">{recipe.title}</p>
        </div>
        {/* Progresso */}
        <div className="flex items-center gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                completed.has(i) ? 'bg-emerald-500 w-4' :
                i === currentIdx ? 'bg-orange-500 w-4' :
                'bg-slate-700 w-1.5'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Conteúdo da etapa */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {allDone ? (
          /* Tela de conclusão */
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-5 text-center"
          >
            <div className="w-24 h-24 rounded-full bg-emerald-900/40 flex items-center justify-center">
              <CheckCircle2 size={48} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-white uppercase tracking-tight">Prontinho! 🍽️</p>
              <p className="text-sm text-slate-400 mt-1">Todas as {steps.length} etapas concluídas</p>
            </div>
            <button
              onClick={onClose}
              className="mt-4 px-8 py-4 bg-emerald-500 text-white font-black text-sm uppercase tracking-wider rounded-[2rem] shadow-xl shadow-emerald-500/30 active:scale-95 transition-all"
            >
              Bom apetite!
            </button>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* Número e título da etapa */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/30">
                  <span className="text-white font-black text-lg">{currentIdx + 1}</span>
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    Etapa {currentIdx + 1} de {steps.length}
                  </p>
                  <p className="text-xl font-black text-white uppercase tracking-tight leading-tight mt-0.5">
                    {step.title || `Etapa ${currentIdx + 1}`}
                  </p>
                </div>
              </div>

              {/* Descrição */}
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-[1.5rem] p-5">
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                  {step.description}
                </p>
              </div>

              {/* Cronômetro (se tiver tempo definido) */}
              {step.duration_seconds && step.duration_seconds > 0 && (
                <div>
                  {timerAlert && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-3 flex items-center gap-2 bg-emerald-900/40 border border-emerald-700/50 px-4 py-2.5 rounded-2xl"
                    >
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      <p className="text-[10px] font-black uppercase tracking-wide text-emerald-400">
                        Tempo da etapa finalizado!
                      </p>
                    </motion.div>
                  )}
                  <StepTimer
                    key={currentIdx}
                    totalSeconds={step.duration_seconds}
                    onFinish={() => setTimerAlert(true)}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Navegação inferior */}
      {!allDone && (
        <div className="p-4 border-t border-slate-800 shrink-0 flex gap-3">
          <button
            onClick={goPrev}
            disabled={currentIdx === 0}
            className="px-4 py-3.5 bg-slate-800 border border-slate-700 rounded-2xl text-slate-400 font-black text-xs uppercase active:scale-95 transition-all disabled:opacity-30"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            onClick={goNext}
            className={`flex-1 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg ${
              isLast
                ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                : 'bg-orange-500 text-white shadow-orange-500/30'
            }`}
          >
            {isLast ? (
              <><CheckCircle2 size={18} /> Concluir Receita</>
            ) : (
              <>Próxima Etapa <SkipForward size={16} /></>
            )}
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: StepFormRow — linha de etapa no formulário
// ─────────────────────────────────────────────────────────────────────────────
function StepFormRow({
  step, index, total, onChange, onRemove, onMoveUp, onMoveDown,
}: {
  step: RecipeStep; index: number; total: number;
  onChange: (s: RecipeStep) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] overflow-hidden">
      {/* Cabeçalho da etapa */}
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
          <span className="text-white font-black text-xs">{index + 1}</span>
        </div>
        <input
          className="flex-1 bg-transparent text-sm font-black dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
          placeholder={`Título da etapa ${index + 1}`}
          value={step.title}
          onChange={(e) => onChange({ ...step, title: e.target.value })}
        />
        <div className="flex items-center gap-1">
          <button onClick={onMoveUp} disabled={index === 0} className="p-1.5 text-slate-400 active:scale-90 disabled:opacity-20 transition-all">
            <ChevronRight size={12} className="-rotate-90" />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="p-1.5 text-slate-400 active:scale-90 disabled:opacity-20 transition-all">
            <ChevronRight size={12} className="rotate-90" />
          </button>
          <button onClick={() => setExpanded((v) => !v)} className="p-1.5 text-slate-400 active:scale-90 transition-all">
            <ChevronRight size={12} className={expanded ? '-rotate-90' : 'rotate-90'} />
          </button>
          <button onClick={onRemove} className="p-1.5 text-red-400 active:scale-90 transition-all">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Corpo expansível */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-slate-200 dark:border-slate-700 pt-3">
              {/* Descrição */}
              <textarea
                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium dark:text-white outline-none focus:border-orange-400 transition-colors resize-none leading-relaxed"
                placeholder="Descreva o que fazer nesta etapa..."
                rows={3}
                value={step.description}
                onChange={(e) => onChange({ ...step, description: e.target.value })}
              />
              {/* Tempo */}
              <div className="flex items-center gap-2">
                <Timer size={14} className="text-orange-400 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cronômetro</span>
                <div className="flex items-center gap-1 ml-auto">
                  <input
                    type="number"
                    min="0"
                    className="w-16 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black dark:text-white outline-none focus:border-orange-400 transition-colors text-center"
                    placeholder="0"
                    value={step.duration_seconds ? Math.floor(step.duration_seconds / 60) : ''}
                    onChange={(e) => {
                      const mins = Number(e.target.value) || 0;
                      const secs = step.duration_seconds ? step.duration_seconds % 60 : 0;
                      onChange({ ...step, duration_seconds: mins * 60 + secs || null });
                    }}
                  />
                  <span className="text-[9px] text-slate-400 font-bold">min</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    className="w-16 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black dark:text-white outline-none focus:border-orange-400 transition-colors text-center"
                    placeholder="0"
                    value={step.duration_seconds ? step.duration_seconds % 60 : ''}
                    onChange={(e) => {
                      const secs = Number(e.target.value) || 0;
                      const mins = step.duration_seconds ? Math.floor(step.duration_seconds / 60) : 0;
                      onChange({ ...step, duration_seconds: mins * 60 + secs || null });
                    }}
                  />
                  <span className="text-[9px] text-slate-400 font-bold">seg</span>
                </div>
              </div>
              {step.duration_seconds && step.duration_seconds > 0 && (
                <p className="text-[9px] text-orange-400 font-bold flex items-center gap-1">
                  <Timer size={9} /> {formatTime(step.duration_seconds)} de cronômetro configurado
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  recipes: Recipe[];
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
  onAddShoppingItems: (items: string[]) => Promise<void>;
  onSaveRecipe: (data: {
    id?: string;
    title: string;
    category: string;
    prep_time: number | null;
    instructions: string;
    steps: RecipeStep[];
    ingredients: { name: string; quantity: string; order_index: number }[];
    imageFile?: File | null;
    existingImageUrl?: string | null;
  }) => Promise<void>;
  onDeleteRecipe: (id: string) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function TabReceitas({
  recipes, fetchData, showToast, onAddShoppingItems, onSaveRecipe, onDeleteRecipe,
}: Props) {
  const [filterCat, setFilterCat]         = useState<string | null>(null);
  const [selected, setSelected]           = useState<Recipe | null>(null);
  const [cookingRecipe, setCookingRecipe] = useState<Recipe | null>(null);
  const [showForm, setShowForm]           = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Recipe | null>(null);
  const [sendingToCart, setSendingToCart] = useState(false);

  // Formulário
  const [formTitle, setFormTitle]               = useState('');
  const [formCategory, setFormCategory]         = useState(CATEGORIES[1]);
  const [formPrepTime, setFormPrepTime]         = useState('');
  const [formSteps, setFormSteps]               = useState<RecipeStep[]>([{ ...EMPTY_STEP }]);
  const [formIngredients, setFormIngredients]   = useState<{ name: string; quantity: string }[]>([{ name: '', quantity: '' }]);
  const [formImage, setFormImage]               = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);
  const [saving, setSaving]                     = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredRecipes = useMemo(() => {
    if (!filterCat) return recipes;
    return recipes.filter((r) => r.category === filterCat);
  }, [recipes, filterCat]);

  // ── Abre formulário ────────────────────────────────────────────────────────
  const openNewForm = useCallback(() => {
    setEditingRecipe(null);
    setFormTitle(''); setFormCategory(CATEGORIES[1]); setFormPrepTime('');
    setFormSteps([{ ...EMPTY_STEP }]);
    setFormIngredients([{ name: '', quantity: '' }]);
    setFormImage(null); setFormImagePreview(null);
    setShowForm(true);
  }, []);

  const openEditForm = useCallback((recipe: Recipe) => {
    setEditingRecipe(recipe);
    setFormTitle(recipe.title);
    setFormCategory(recipe.category);
    setFormPrepTime(recipe.prep_time ? String(recipe.prep_time) : '');
    setFormSteps(recipe.steps?.length ? recipe.steps.map((s) => ({ ...s })) : [{ ...EMPTY_STEP }]);
    setFormIngredients(
      recipe.ingredients?.length
        ? recipe.ingredients.map((i) => ({ name: i.name, quantity: i.quantity }))
        : [{ name: '', quantity: '' }]
    );
    setFormImage(null);
    setFormImagePreview(recipe.image_url ?? null);
    setSelected(null);
    setShowForm(true);
  }, []);

  // ── Imagem ────────────────────────────────────────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Imagem muito grande. Máximo 5MB.', 'error'); return; }
    setFormImage(file);
    const reader = new FileReader();
    reader.onload = () => setFormImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── Etapas ────────────────────────────────────────────────────────────────
  const addStep = () => setFormSteps((prev) => [...prev, { ...EMPTY_STEP }]);
  const removeStep = (i: number) => setFormSteps((prev) => prev.filter((_, idx) => idx !== i));
  const updateStep = (i: number, s: RecipeStep) => setFormSteps((prev) => prev.map((st, idx) => idx === i ? s : st));
  const moveStepUp = (i: number) => {
    if (i === 0) return;
    setFormSteps((prev) => { const n = [...prev]; [n[i-1], n[i]] = [n[i], n[i-1]]; return n; });
  };
  const moveStepDown = (i: number) => {
    setFormSteps((prev) => {
      if (i >= prev.length - 1) return prev;
      const n = [...prev]; [n[i], n[i+1]] = [n[i+1], n[i]]; return n;
    });
  };

  // ── Ingredientes ──────────────────────────────────────────────────────────
  const addIngredient = () => setFormIngredients((prev) => [...prev, { name: '', quantity: '' }]);
  const removeIngredient = (i: number) => setFormIngredients((prev) => prev.filter((_, idx) => idx !== i));
  const updateIngredient = (i: number, field: 'name' | 'quantity', value: string) =>
    setFormIngredients((prev) => prev.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing));

  // ── Salvar ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formTitle.trim()) { showToast('Dê um nome à receita!', 'info'); return; }
    const validIngredients = formIngredients.filter((i) => i.name.trim());
    if (validIngredients.length === 0) { showToast('Adicione pelo menos um ingrediente!', 'info'); return; }
    const validSteps = formSteps.filter((s) => s.title.trim() || s.description.trim());
    if (validSteps.length === 0) { showToast('Adicione pelo menos uma etapa de preparo!', 'info'); return; }

    setSaving(true);
    try {
      await onSaveRecipe({
        id: editingRecipe?.id,
        title: formTitle.trim(),
        category: formCategory,
        prep_time: formPrepTime ? Number(formPrepTime) : null,
        instructions: '', // mantido para compatibilidade
        steps: validSteps,
        ingredients: validIngredients.map((ing, idx) => ({
          name: ing.name.trim(), quantity: ing.quantity.trim(), order_index: idx,
        })),
        imageFile: formImage,
        existingImageUrl: editingRecipe?.image_url ?? null,
      });
      showToast(editingRecipe ? 'Receita atualizada! 🍳' : 'Receita cadastrada! 🍳');
      setShowForm(false);
      fetchData();
    } catch {
      showToast('Erro ao salvar receita', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Deletar ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await onDeleteRecipe(confirmDelete.id);
      showToast('Receita removida', 'info');
      setSelected(null); setConfirmDelete(null); fetchData();
    } catch { showToast('Erro ao remover receita', 'error'); }
  };

  // ── Enviar para compras ───────────────────────────────────────────────────
  const handleSendToCart = async (recipe: Recipe) => {
    if (!recipe.ingredients?.length) { showToast('Esta receita não tem ingredientes', 'info'); return; }
    setSendingToCart(true);
    try {
      const items = recipe.ingredients.map((i) => i.quantity ? `${i.quantity} ${i.name}` : i.name);
      await onAddShoppingItems(items);
      showToast(`${items.length} ingredientes adicionados às compras! 🛒`);
      fetchData();
    } catch { showToast('Erro ao adicionar à lista', 'error'); }
    finally { setSendingToCart(false); }
  };

  // ── Tempo total calculado das etapas ──────────────────────────────────────
  const totalStepTime = (recipe: Recipe) => {
    if (!recipe.steps?.length) return null;
    const total = recipe.steps.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);
    return total > 0 ? total : null;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-10">

      {/* ── MODO COZINHAR ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {cookingRecipe && (
          <CookingMode recipe={cookingRecipe} onClose={() => setCookingRecipe(null)} />
        )}
      </AnimatePresence>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-orange-600 via-orange-500 to-amber-400 p-5 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <ChefHat size={14} className="opacity-70" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">Livro de Receitas</span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">Nossas Receitas</h2>
              <p className="text-[10px] text-white/60 font-bold mt-1 uppercase tracking-widest">
                {recipes.length} receita{recipes.length !== 1 ? 's' : ''} cadastrada{recipes.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={openNewForm} className="flex flex-col items-center gap-1.5 bg-white/20 border border-white/20 px-4 py-3 rounded-2xl active:scale-95 transition-all">
              <Plus size={20} />
              <span className="text-[8px] font-black uppercase tracking-wider">Nova</span>
            </button>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* ── FILTROS ────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setFilterCat(null)}
          aria-pressed={!filterCat}
          className={`flex-shrink-0 px-3.5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 ${
            !filterCat ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
          }`}
        >
          Todas
        </button>
        {CATEGORIES.map((cat) => {
          const count = recipes.filter((r) => r.category === cat).length;
          if (count === 0) return null;
          return (
            <button key={cat} onClick={() => setFilterCat(cat)} aria-pressed={filterCat === cat}
              className={`flex-shrink-0 px-3.5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 ${
                filterCat === cat ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {cat} <span className="opacity-50">({count})</span>
            </button>
          );
        })}
      </div>

      {/* ── GRID ───────────────────────────────────────────────────────────── */}
      {filteredRecipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-20 h-20 rounded-[2rem] bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
            <UtensilsCrossed size={36} className="text-orange-300 dark:text-orange-700" />
          </div>
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-300 dark:text-slate-600">
              {filterCat ? `Nenhuma receita em "${filterCat}"` : 'Nenhuma receita cadastrada'}
            </p>
            <button onClick={openNewForm} className="mt-3 text-[10px] font-black uppercase tracking-widest text-orange-500 active:scale-95 transition-all">
              + Cadastrar primeira receita
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence>
            {filteredRecipes.map((recipe, idx) => {
              const stepTime = totalStepTime(recipe);
              return (
                <motion.button
                  key={recipe.id} layout
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1, transition: { delay: idx * 0.04 } }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelected(recipe)}
                  className="bg-white dark:bg-slate-800 rounded-[1.5rem] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 text-left group"
                >
                  <div className="relative aspect-square overflow-hidden bg-orange-50 dark:bg-slate-700">
                    {recipe.image_url ? (
                      <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ChefHat size={36} className="text-orange-200 dark:text-slate-600" />
                      </div>
                    )}
                    <span className={`absolute top-2 left-2 text-[8px] font-black uppercase px-2 py-1 rounded-lg backdrop-blur-sm ${CATEGORY_COLORS[recipe.category] ?? 'bg-black/50 text-white'}`}>
                      {recipe.category}
                    </span>
                    {recipe.steps?.length > 0 && (
                      <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-lg backdrop-blur-sm">
                        {recipe.steps.length} etapas
                      </span>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="font-black text-[11px] uppercase tracking-tight leading-tight dark:text-white line-clamp-2">{recipe.title}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {(recipe.prep_time || stepTime) && (
                          <span className="flex items-center gap-1 text-[8px] text-slate-400 font-bold">
                            <Clock size={9} /> {recipe.prep_time ?? Math.ceil((stepTime ?? 0) / 60)} min
                          </span>
                        )}
                      </div>
                      {recipe.profile?.avatar_url && (
                        <img src={recipe.profile.avatar_url} alt={recipe.profile.full_name ?? ''} className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-600" />
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── MODAL: DETALHE ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 bg-white dark:bg-slate-900 z-[300] flex flex-col"
            role="dialog" aria-modal="true"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <button onClick={() => setSelected(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 active:scale-90 transition-all">
                <ArrowLeft size={18} />
              </button>
              <div className="flex-1 mx-3 overflow-hidden">
                <p className="font-black text-xs uppercase tracking-tight truncate dark:text-white">{selected.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg ${CATEGORY_COLORS[selected.category]}`}>{selected.category}</span>
                  {selected.prep_time && <span className="text-[8px] text-slate-400 font-bold flex items-center gap-1"><Clock size={8} /> {selected.prep_time} min</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEditForm(selected)} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500 active:scale-90 transition-all">
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleSendToCart(selected)}
                  disabled={sendingToCart}
                  className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-2.5 rounded-2xl text-[9px] font-black uppercase shadow-lg shadow-orange-500/30 active:scale-90 transition-all disabled:opacity-50"
                >
                  {sendingToCart ? <Loader2 size={13} className="animate-spin" /> : <ShoppingCart size={13} />}
                  Compras
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="relative">
                {selected.image_url ? (
                  <img src={selected.image_url} className="w-full h-56 object-cover" alt={selected.title} />
                ) : (
                  <div className="w-full h-40 bg-orange-50 dark:bg-slate-800 flex items-center justify-center">
                    <ChefHat size={48} className="text-orange-200 dark:text-slate-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-900 via-transparent to-transparent pointer-events-none" />
              </div>

              <div className="p-5 space-y-6">

                {/* Quem cadastrou */}
                {selected.profile?.full_name && (
                  <div className="flex items-center gap-2">
                    <img
                      src={selected.profile.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(selected.profile.full_name)}`}
                      alt={selected.profile.full_name}
                      className="w-7 h-7 rounded-full object-cover border-2 border-orange-200"
                    />
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      Receita de <strong className="text-slate-600 dark:text-slate-300">{selected.profile.full_name.split(' ')[0]}</strong>
                    </span>
                  </div>
                )}

                {/* Botão Modo Cozinhar */}
                {selected.steps?.length > 0 && (
                  <button
                    onClick={() => { setSelected(null); setCookingRecipe(selected); }}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-sm uppercase tracking-wider rounded-[2rem] shadow-xl shadow-orange-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Play size={18} className="fill-white" />
                    Iniciar Modo Cozinhar ({selected.steps.length} etapas)
                  </button>
                )}

                {/* Ingredientes */}
                <section>
                  <h3 className="font-black text-xs uppercase tracking-widest text-orange-500 mb-3 flex items-center gap-2">
                    <UtensilsCrossed size={13} /> Ingredientes
                    {selected.ingredients && <span className="text-slate-300 font-bold normal-case tracking-normal text-[9px]">({selected.ingredients.length} itens)</span>}
                  </h3>
                  {selected.ingredients?.length ? (
                    <div className="space-y-2">
                      {selected.ingredients.sort((a, b) => a.order_index - b.order_index).map((ing) => (
                        <div key={ing.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                          {ing.quantity && <span className="text-[10px] font-black text-orange-500 uppercase tracking-wide shrink-0">{ing.quantity}</span>}
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{ing.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300 italic">Nenhum ingrediente cadastrado</p>
                  )}
                </section>

                {/* Etapas — resumo no detalhe */}
                {selected.steps?.length > 0 && (
                  <section>
                    <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                      <Timer size={13} /> Etapas de Preparo
                    </h3>
                    <div className="space-y-2">
                      {selected.steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                          <div className="w-6 h-6 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-orange-500 font-black text-[9px]">{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black dark:text-white uppercase tracking-tight">{step.title || `Etapa ${i + 1}`}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{step.description}</p>
                            {step.duration_seconds && step.duration_seconds > 0 && (
                              <span className="inline-flex items-center gap-1 mt-1 text-[8px] font-black text-orange-400 uppercase">
                                <Timer size={8} /> {formatTime(step.duration_seconds)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Enviar para compras */}
                <button
                  onClick={() => handleSendToCart(selected)}
                  disabled={sendingToCart || !selected.ingredients?.length}
                  className="w-full py-4 bg-orange-500 text-white font-black text-sm uppercase tracking-wider rounded-[2rem] shadow-xl shadow-orange-500/30 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sendingToCart
                    ? <><Loader2 size={16} className="animate-spin" /> Adicionando...</>
                    : <><ShoppingCart size={16} /> Enviar {selected.ingredients?.length ?? 0} ingredientes para Compras</>
                  }
                </button>

                <button
                  onClick={() => setConfirmDelete(selected)}
                  className="w-full py-3 border border-red-200 dark:border-red-900/50 text-red-400 font-black text-xs uppercase tracking-wider rounded-[2rem] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} /> Excluir Receita
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL: FORMULÁRIO ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 bg-white dark:bg-slate-900 z-[400] flex flex-col"
            role="dialog" aria-modal="true"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <button onClick={() => setShowForm(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 active:scale-90 transition-all">
                <X size={18} />
              </button>
              <p className="font-black text-xs uppercase tracking-widest dark:text-white">
                {editingRecipe ? 'Editar Receita' : 'Nova Receita'}
              </p>
              <button
                onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 bg-orange-500 text-white px-4 py-2.5 rounded-2xl text-[9px] font-black uppercase shadow-lg shadow-orange-500/30 active:scale-90 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Salvar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Imagem */}
              <div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-video rounded-[1.5rem] overflow-hidden border-2 border-dashed border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10 flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  {formImagePreview ? (
                    <img src={formImagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Camera size={28} className="text-orange-300 dark:text-orange-700" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">Adicionar Foto</span>
                      <span className="text-[8px] text-orange-300 font-bold">JPG, PNG ou WEBP · max 5MB</span>
                    </>
                  )}
                </button>
                {formImagePreview && (
                  <button onClick={() => { setFormImage(null); setFormImagePreview(null); }} className="mt-2 text-[9px] font-black uppercase text-red-400 tracking-widest">
                    Remover foto
                  </button>
                )}
              </div>

              {/* Nome */}
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Nome da Receita *</label>
                <input
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold dark:text-white outline-none focus:border-orange-400 transition-colors"
                  placeholder="Ex: Feijoada da vovó"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              {/* Categoria + Tempo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Categoria</label>
                  <select
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold dark:text-white outline-none focus:border-orange-400 transition-colors"
                    value={formCategory} onChange={(e) => setFormCategory(e.target.value)}
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Tempo total (min)</label>
                  <input
                    type="number" min="1"
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold dark:text-white outline-none focus:border-orange-400 transition-colors"
                    placeholder="Ex: 45"
                    value={formPrepTime} onChange={(e) => setFormPrepTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Ingredientes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ingredientes *</label>
                  <button onClick={addIngredient} className="flex items-center gap-1 text-[9px] font-black uppercase text-orange-500 active:scale-95 transition-all">
                    <Plus size={11} /> Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {formIngredients.map((ing, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        className="w-24 shrink-0 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none focus:border-orange-400 transition-colors placeholder:text-slate-300"
                        placeholder="Qtd."
                        value={ing.quantity}
                        onChange={(e) => updateIngredient(i, 'quantity', e.target.value)}
                      />
                      <input
                        className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none focus:border-orange-400 transition-colors placeholder:text-slate-300"
                        placeholder="Ingrediente"
                        value={ing.name}
                        onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                      />
                      <button onClick={() => removeIngredient(i)} className="p-2 text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl active:scale-90 transition-all shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Etapas de preparo */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Timer size={11} className="text-orange-400" /> Etapas de Preparo *
                  </label>
                  <button onClick={addStep} className="flex items-center gap-1 text-[9px] font-black uppercase text-orange-500 active:scale-95 transition-all">
                    <Plus size={11} /> Adicionar Etapa
                  </button>
                </div>
                <div className="space-y-3">
                  {formSteps.map((step, i) => (
                    <StepFormRow
                      key={i}
                      step={step}
                      index={i}
                      total={formSteps.length}
                      onChange={(s) => updateStep(i, s)}
                      onRemove={() => removeStep(i)}
                      onMoveUp={() => moveStepUp(i)}
                      onMoveDown={() => moveStepDown(i)}
                    />
                  ))}
                </div>
              </div>

              {/* Botão salvar inferior */}
              <button
                onClick={handleSave} disabled={saving}
                className="w-full py-4 bg-orange-500 text-white font-black text-sm uppercase tracking-wider rounded-[2rem] shadow-xl shadow-orange-500/30 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving
                  ? <><Loader2 size={16} className="animate-spin" /> Salvando...</>
                  : <><Check size={16} /> {editingRecipe ? 'Salvar Alterações' : 'Cadastrar Receita'}</>
                }
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL: CONFIRMAR DELEÇÃO ─────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[500] flex items-end justify-center p-4"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 size={24} className="text-red-400" />
                </div>
                <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">Excluir receita?</h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  <strong className="text-slate-600 dark:text-slate-300">{confirmDelete.title}</strong> será removida permanentemente.
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider active:scale-95 transition-all">
                  Cancelar
                </button>
                <button onClick={handleDelete} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-red-500/30">
                  Excluir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}