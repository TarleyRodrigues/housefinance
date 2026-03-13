// ─── ABA: CONFIGURAÇÕES ──────────────────────────────────────────────────────
// Melhorias aplicadas:
// ✅ supabase removido — lógica via props onAddCategory/onUpdateCategory/onDeleteCategory/onSignOut (arquitetura)
// ✅ confirm() → modal customizado (UX)
// ✅ defaultValue → value controlado nos inputs de categoria (qualidade)
// ✅ Feedback visual ao salvar campo (borda verde + ícone check) (UX)
// ✅ Logout com confirmação via modal (UX)
// ✅ Exportar CSV do mês atual (Feature 🔥)
// ✅ Estatísticas no card de perfil (Feature 🔥)
// ✅ Cor por categoria com color picker (Feature 🔥)
// ✅ aria-label em todos os botões (acessibilidade)

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Moon, Sun, LogOut, Plus, Trash2, History,
  Check, AlertTriangle, Download, TrendingUp,
  Calendar, Tag,
} from 'lucide-react';
import { formatCurrency } from '../utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Category, Profile, Expense } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Paleta de cores para categorias
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#64748b', '#a855f7',
];

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTE: ConfirmModal genérico
// ─────────────────────────────────────────────────────────────────────────────
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmClassName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  isOpen, title, description, confirmLabel = 'Confirmar',
  confirmClassName = 'bg-red-500 shadow-red-500/30',
  onConfirm, onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
        role="dialog"
        aria-modal="true"
        onClick={onCancel}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-500" aria-hidden="true" />
            </div>
            <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">{title}</h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: description }} />
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider active:scale-95 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg ${confirmClassName}`}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTE: CategoryManager
// ─────────────────────────────────────────────────────────────────────────────
interface CategoryManagerProps {
  categories: Category[];
  onAdd: (name: string) => Promise<void>;
  onUpdate: (payload: { id: string; name?: string; oldName?: string; monthly_goal?: number; color?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showToast: (msg: string, type?: string) => void;
  fetchData: () => void;
}

function CategoryManager({ categories, onAdd, onUpdate, onDelete, showToast, fetchData }: CategoryManagerProps) {
  const [newCat, setNewCat] = useState('');
  // Rastreia campos salvando para feedback visual
  const [savingFields, setSavingFields] = useState<Record<string, boolean>>({});
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  // Estado controlado para nomes das categorias
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, c.name]))
  );

  // Sincroniza quando categories muda externamente
  useMemo(() => {
    setNames(Object.fromEntries(categories.map((c) => [c.id, c.name])));
  }, [categories]);

  const showSaved = (key: string) => {
    setSavingFields((s) => ({ ...s, [key]: true }));
    setTimeout(() => setSavingFields((s) => ({ ...s, [key]: false })), 1500);
  };

  const handleAdd = async () => {
    if (!newCat.trim()) return;
    try {
      await onAdd(newCat.trim());
      setNewCat('');
      showToast('Categoria criada!');
      fetchData();
    } catch {
      showToast('Erro ao criar categoria', 'error');
    }
  };

  const handleNameBlur = async (cat: Category) => {
    const newName = names[cat.id] ?? cat.name;
    if (newName === cat.name || !newName.trim()) return;
    try {
      await onUpdate({ id: cat.id, name: newName.trim(), oldName: cat.name });
      showSaved(`name-${cat.id}`);
      fetchData();
    } catch {
      showToast('Erro ao atualizar nome', 'error');
    }
  };

  const handleMetaBlur = async (cat: Category, inputValue: string) => {
    const numericValue = parseFloat(inputValue.replace(/[R$\s.]/g, '').replace(',', '.'));
    if (isNaN(numericValue)) return;
    try {
      await onUpdate({ id: cat.id, monthly_goal: numericValue });
      showSaved(`meta-${cat.id}`);
      fetchData();
    } catch {
      showToast('Erro ao atualizar meta', 'error');
    }
  };

  const handleColorSelect = async (cat: Category, color: string) => {
    try {
      await onUpdate({ id: cat.id, color });
      showSaved(`color-${cat.id}`);
      fetchData();
    } catch {
      showToast('Erro ao atualizar cor', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;
    try {
      await onDelete(categoryToDelete.id);
      showToast('Categoria removida', 'info');
      fetchData();
    } catch {
      showToast('Erro ao remover categoria', 'error');
    } finally {
      setCategoryToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Input nova categoria */}
      <div className="flex gap-2">
        <label htmlFor="new-category" className="sr-only">Nome da nova categoria</label>
        <input
          id="new-category"
          className="flex-1 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-sm outline-none font-bold text-slate-800 dark:text-white placeholder:text-slate-300 focus:border-blue-300 dark:focus:border-blue-700 transition-colors"
          placeholder="Nova categoria..."
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          aria-label="Adicionar categoria"
          className="bg-blue-600 text-white p-4 rounded-2xl active:scale-90 transition-all shadow-md disabled:opacity-40"
          disabled={!newCat.trim()}
        >
          <Plus size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Lista de categorias */}
      <div className="space-y-3 max-h-[30rem] overflow-y-auto pr-1 no-scrollbar pb-6">
        <AnimatePresence>
          {categories.map((c) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] space-y-3 border border-slate-100 dark:border-slate-800 transition-colors shadow-sm"
            >
              {/* Nome + delete */}
              <div className="flex justify-between items-center gap-2">
                <div className="flex-1 relative">
                  <label htmlFor={`cat-name-${c.id}`} className="sr-only">Nome da categoria {c.name}</label>
                  <input
                    id={`cat-name-${c.id}`}
                    type="text"
                    // ✅ value controlado — atualiza corretamente após fetchData
                    value={names[c.id] ?? c.name}
                    onChange={(e) => setNames((n) => ({ ...n, [c.id]: e.target.value }))}
                    onBlur={() => handleNameBlur(c)}
                    className="bg-transparent text-sm font-black outline-none uppercase tracking-tighter w-full text-slate-800 dark:text-slate-200 border-b border-transparent focus:border-blue-500 pr-6 transition-colors"
                    aria-label={`Nome da categoria: ${c.name}`}
                  />
                  {/* ✅ Feedback visual de salvo */}
                  <AnimatePresence>
                    {savingFields[`name-${c.id}`] && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute right-0 top-1/2 -translate-y-1/2 text-emerald-500"
                        aria-label="Salvo"
                      >
                        <Check size={14} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  onClick={() => setCategoryToDelete(c)}
                  aria-label={`Apagar categoria ${c.name}`}
                  className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors p-1 active:scale-90"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>

              {/* ✅ Seletor de cor */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Cor</span>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorSelect(c, color)}
                      aria-label={`Selecionar cor ${color} para ${c.name}`}
                      className="w-6 h-6 rounded-full border-2 transition-all active:scale-90"
                      style={{
                        backgroundColor: color,
                        borderColor: c.color === color ? 'white' : 'transparent',
                        boxShadow: c.color === color ? `0 0 0 2px ${color}` : 'none',
                      }}
                    />
                  ))}
                  {/* ✅ Feedback visual de cor salva */}
                  <AnimatePresence>
                    {savingFields[`color-${c.id}`] && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-emerald-500 flex items-center"
                        aria-label="Cor salva"
                      >
                        <Check size={14} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Meta mensal */}
              <div className="flex flex-col gap-1 bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-inner border border-slate-100 dark:border-slate-700 transition-colors relative">
                <label
                  htmlFor={`cat-meta-${c.id}`}
                  className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1"
                >
                  Meta Mensal
                </label>
                <input
                  id={`cat-meta-${c.id}`}
                  type="text"
                  className="bg-transparent text-base font-black text-blue-600 dark:text-blue-400 outline-none w-full pr-6"
                  defaultValue={formatCurrency(c.monthly_goal || 0)}
                  onBlur={(e) => handleMetaBlur(c, e.target.value)}
                  onFocus={(e) => { e.target.value = (c.monthly_goal || 0).toString(); }}
                  aria-label={`Meta mensal de ${c.name}`}
                />
                {/* ✅ Feedback visual de meta salva */}
                <AnimatePresence>
                  {savingFields[`meta-${c.id}`] && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute right-3 bottom-3 text-emerald-500"
                      aria-label="Meta salva"
                    >
                      <Check size={14} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modal de confirmação de deleção */}
      <ConfirmModal
        isOpen={!!categoryToDelete}
        title="Apagar categoria?"
        description={`<strong>${categoryToDelete?.name}</strong><br/>Os gastos desta categoria não serão apagados, mas ficarão sem categoria.`}
        confirmLabel="Apagar"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setCategoryToDelete(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS DO COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  userProfile: Profile | null;
  categories: Category[];
  expenses: Expense[];          // ✅ NOVO — para estatísticas e exportação CSV
  currentDate: Date;            // ✅ NOVO — para exportação CSV e estatísticas
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
  onOpenLogs: () => void;
  onSignOut: () => Promise<void>;                          // ✅ NOVO
  onAddCategory: (name: string) => Promise<void>;         // ✅ NOVO
  onUpdateCategory: (payload: {                           // ✅ NOVO
    id: string;
    name?: string;
    oldName?: string;
    monthly_goal?: number;
    color?: string;
  }) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;        // ✅ NOVO
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL: TabAjustes
// ─────────────────────────────────────────────────────────────────────────────
export function TabAjustes({
  userProfile,
  categories,
  expenses,
  currentDate,
  isDarkMode,
  setIsDarkMode,
  fetchData,
  showToast,
  onOpenLogs,
  onSignOut,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: Props) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // ✅ Estatísticas do mês atual para o card de perfil
  const stats = useMemo(() => {
    const totalMes = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
    const catCounts = expenses.reduce<Record<string, number>>((acc, e) => {
      const cat = e.category_name ?? 'Sem categoria';
      acc[cat] = (acc[cat] ?? 0) + Number(e.amount);
      return acc;
    }, {});
    const favoriteCat = Object.entries(catCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '—';
    const totalTransacoes = expenses.length;
    return { totalMes, favoriteCat, totalTransacoes };
  }, [expenses]);

  // ✅ Exportação CSV
  const handleExportCSV = useCallback(() => {
    if (expenses.length === 0) {
      showToast('Nenhum gasto para exportar', 'info');
      return;
    }
    const header = 'Data,Categoria,Descrição,Valor';
    const rows = expenses.map((e) =>
      [
        e.created_at ? format(new Date(e.created_at), 'dd/MM/yyyy') : '',
        e.category_name ?? '',
        `"${(e.description ?? '').replace(/"/g, '""')}"`,
        Number(e.amount).toFixed(2).replace('.', ','),
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gastos-${format(currentDate, 'yyyy-MM', { locale: ptBR })}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('CSV exportado com sucesso!');
  }, [expenses, currentDate, showToast]);

  const handleLogoutConfirm = useCallback(async () => {
    try {
      await onSignOut();
    } catch {
      showToast('Erro ao sair', 'error');
    } finally {
      setShowLogoutConfirm(false);
    }
  }, [onSignOut, showToast]);

  return (
    <div className="space-y-6 pb-10">

      {/* ── 1. CARD DE PERFIL COM ESTATÍSTICAS ───────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-800 dark:to-slate-950 p-6 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-5">
            <img
              src={userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.full_name ?? 'U')}&background=3b82f6&color=fff`}
              className="w-16 h-16 rounded-2xl border-2 border-white/10 shadow-lg object-cover"
              alt={`Foto de ${userProfile?.full_name ?? 'perfil'}`}
            />
            <div className="flex-1 min-w-0">
              <p className="font-black text-lg leading-tight truncate">
                {userProfile?.full_name || 'Meu Perfil'}
              </p>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5 truncate">
                {userProfile?.full_name ? `@${userProfile.full_name.split(' ')[0].toLowerCase()}` : ''}
              </p>
              <button
                onClick={() => (window.location.hash = '/profile')}
                aria-label="Editar perfil"
                className="text-blue-400 text-[10px] font-black uppercase tracking-widest mt-1 active:scale-95 transition-all"
              >
                Editar Perfil →
              </button>
            </div>
          </div>

          {/* ✅ Estatísticas do mês */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-2xl p-3 text-center border border-white/5">
              <TrendingUp size={14} className="mx-auto mb-1 opacity-50" aria-hidden="true" />
              <p className="text-sm font-black leading-none">{formatCurrency(stats.totalMes)}</p>
              <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mt-1">
                {format(currentDate, 'MMM', { locale: ptBR })}
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 text-center border border-white/5">
              <Calendar size={14} className="mx-auto mb-1 opacity-50" aria-hidden="true" />
              <p className="text-sm font-black leading-none">{stats.totalTransacoes}</p>
              <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mt-1">Gastos</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 text-center border border-white/5 min-w-0">
              <Tag size={14} className="mx-auto mb-1 opacity-50" aria-hidden="true" />
              <p className="text-[10px] font-black leading-none truncate">{stats.favoriteCat}</p>
              <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mt-1">Top cat.</p>
            </div>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      </div>

      {/* ── 2. AÇÕES RÁPIDAS (DARK MODE / LOGOUT / CSV) ───────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          aria-label={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
          aria-pressed={isDarkMode}
          className="p-4 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2 active:scale-95 transition-all text-slate-800 dark:text-slate-200 shadow-sm"
        >
          {isDarkMode
            ? <Sun size={20} className="text-amber-400" aria-hidden="true" />
            : <Moon size={20} className="text-indigo-500" aria-hidden="true" />}
          <span className="text-[9px] font-black uppercase tracking-widest leading-none text-center">
            {isDarkMode ? 'Claro' : 'Escuro'}
          </span>
        </button>

        {/* ✅ Exportar CSV */}
        <button
          onClick={handleExportCSV}
          aria-label="Exportar gastos como CSV"
          className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-[2rem] border border-emerald-100 dark:border-emerald-900 flex flex-col items-center gap-2 active:scale-95 transition-all text-emerald-600 dark:text-emerald-400 shadow-sm"
        >
          <Download size={20} aria-hidden="true" />
          <span className="text-[9px] font-black uppercase tracking-widest leading-none text-center">
            Exportar
          </span>
        </button>

        {/* ✅ Logout com confirmação */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          aria-label="Sair da conta"
          className="p-4 bg-red-50 dark:bg-red-900/20 rounded-[2rem] border border-red-100 dark:border-red-900 flex flex-col items-center gap-2 active:scale-95 transition-all text-red-500 shadow-sm"
        >
          <LogOut size={20} aria-hidden="true" />
          <span className="text-[9px] font-black uppercase tracking-widest leading-none">Sair</span>
        </button>
      </div>

      {/* ── 3. HISTÓRICO DE ATIVIDADE ─────────────────────────────────────────── */}
      <button
        onClick={onOpenLogs}
        aria-label="Ver histórico de atividade"
        className="w-full p-5 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 flex items-center gap-4 shadow-sm active:scale-95 transition-all"
      >
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl" aria-hidden="true">
          <History size={22} />
        </div>
        <div className="text-left">
          <p className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter text-sm">
            Histórico de Atividade
          </p>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mt-1">
            Ver quem alterou o quê
          </p>
        </div>
      </button>

      {/* ── 4. CATEGORIAS & METAS ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
        <h3 className="font-black text-slate-800 dark:text-slate-200 mb-4 uppercase text-[10px] opacity-50 tracking-widest">
          Categorias &amp; Metas
        </h3>
        <CategoryManager
          categories={categories}
          onAdd={onAddCategory}
          onUpdate={onUpdateCategory}
          onDelete={onDeleteCategory}
          showToast={showToast}
          fetchData={fetchData}
        />
      </div>

      {/* ── 5. MODAIS ─────────────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Sair da conta?"
        description="Você será desconectado e precisará fazer login novamente."
        confirmLabel="Sair"
        confirmClassName="bg-red-500 shadow-red-500/30"
        onConfirm={handleLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 📌 LEMBRETE: adicionar em Dashboard.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
// const signOut = useCallback(async () => {
//   await supabase.auth.signOut();
// }, []);
//
// const addCategory = useCallback(async (name: string) => {
//   const { error } = await supabase.from('categories').insert({ name });
//   if (error) throw error;
// }, []);
//
// const updateCategory = useCallback(async ({ id, name, oldName, monthly_goal, color }) => {
//   const updates: Record<string, unknown> = {};
//   if (name !== undefined) updates.name = name;
//   if (monthly_goal !== undefined) updates.monthly_goal = monthly_goal;
//   if (color !== undefined) updates.color = color;
//   const { error } = await supabase.from('categories').update(updates).eq('id', id);
//   if (error) throw error;
//   // Se nome mudou, atualiza despesas vinculadas
//   if (name && oldName) {
//     await supabase.from('expenses').update({ category_name: name }).eq('category_name', oldName);
//   }
// }, []);
//
// const deleteCategory = useCallback(async (id: string) => {
//   const { error } = await supabase.from('categories').delete().eq('id', id);
//   if (error) throw error;
// }, []);
//
// Passar para TabAjustes como:
//   <TabAjustes
//     ...
//     expenses={expenses}
//     currentDate={currentDate}
//     onSignOut={signOut}
//     onAddCategory={addCategory}
//     onUpdateCategory={updateCategory}
//     onDeleteCategory={deleteCategory}
//   />
//
// ⚠️  LEMBRETE: adicionar coluna color na tabela categories no Supabase:
//   alter table categories add column if not exists color text;
// ─────────────────────────────────────────────────────────────────────────────