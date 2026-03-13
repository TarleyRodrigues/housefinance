// ─── DASHBOARD.TSX ───────────────────────────────────────────────────────────
// Arquivo orquestrador — gerencia estado global, dados e renderiza as abas.
// Melhorias desta versão:
// ✅ signOut centralizado aqui
// ✅ addCategory, updateCategory, deleteCategory centralizados aqui
// ✅ expenses e currentDate passados para TabAjustes (estatísticas + CSV)
// ✅ Padrão arquitetural 100% consistente — zero supabase nos componentes filhos

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, RefreshCcw, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import BottomNav from '../components/BottomNav';
import { Toast } from '../components/ui';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';

import { TabExtrato }   from '../tabs/TabExtrato';
import { TabNovoGasto } from '../tabs/TabNovoGasto';
import { TabCompras }   from '../tabs/TabCompras';
import { TabNotas }     from '../tabs/TabNotas';
import { TabAvisos }    from '../tabs/TabAvisos';
import { TabGraficos }  from '../tabs/TabGraficos';
import { TabAjustes }   from '../tabs/TabAjustes';
import { TabLogs }      from '../tabs/TabLogs';

import type { Expense } from '../types';

export default function Dashboard() {
  const { user } = useAuth();

  // ── Navegação ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<string>('list');
  const [currentDate, setCurrentDate] = useState(new Date());

  // ── Tema ──────────────────────────────────────────────────────────────────
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = useCallback((msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Edição de despesa ─────────────────────────────────────────────────────
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const handleEditExpense = useCallback((exp: Expense) => {
    setEditingExpense(exp);
    setActiveTab('add');
  }, []);

  useEffect(() => {
    if (activeTab !== 'add') setEditingExpense(null);
  }, [activeTab]);

  // ── Comprovante fullscreen ────────────────────────────────────────────────
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  // ── Dados (Hook Customizado) ──────────────────────────────────────────────
  const {
    expenses,
    prevMonthExpenses,
    prevMonthTotal,
    categories,
    shoppingList,
    reminders,
    notes,
    logs,
    annualChartData,
    userProfile,
    isLoading,
    fetchData,
  } = useDashboardData(currentDate, activeTab);

  // ── Navegação de mês ──────────────────────────────────────────────────────
  const prevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  // ── Autenticação ──────────────────────────────────────────────────────────
  const signOut = useCallback(async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  // ── Despesas ──────────────────────────────────────────────────────────────
  const deleteExpense = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('expenses')
      .update({ is_deleted: true })
      .eq('id', id);
    if (error) throw error;
  }, []);

  // ── Lembretes ─────────────────────────────────────────────────────────────
  const saveReminder = useCallback(async ({
    text, date, time, editId,
  }: {
    text: string;
    date: string;
    time: string;
    editId: string | null;
  }): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    const payload = {
      text,
      reminder_date: date,
      reminder_time: time || null,
      user_id: user.id,
    };
    if (editId) {
      const { error } = await supabase.from('reminders').update(payload).eq('id', editId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('reminders').insert(payload);
      if (error) throw error;
    }
  }, [user]);

  const deleteReminder = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) throw error;
  }, []);

  // ── Lista de compras ──────────────────────────────────────────────────────
  const addShoppingItem = useCallback(async ({
    name, qty, price,
  }: {
    name: string;
    qty: number;
    price: number | null;
  }): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    const { error } = await supabase.from('shopping_list').insert({
      item_name: name,
      quantity: qty,
      estimated_price: price,
      user_id: user.id,
    });
    if (error) throw error;
  }, [user]);

  const toggleShoppingItem = useCallback(async (id: string, current: boolean): Promise<void> => {
    const { error } = await supabase
      .from('shopping_list')
      .update({ is_pending: !current })
      .eq('id', id);
    if (error) throw error;
  }, []);

  const deleteShoppingItem = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('shopping_list').delete().eq('id', id);
    if (error) throw error;
  }, []);

  const clearDoneItems = useCallback(async (): Promise<void> => {
    const ids = shoppingList.filter((i) => !i.is_pending).map((i) => i.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from('shopping_list').delete().in('id', ids);
    if (error) throw error;
  }, [shoppingList]);

  // ── Categorias ────────────────────────────────────────────────────────────

  // Adiciona nova categoria
  const addCategory = useCallback(async (name: string): Promise<void> => {
    const { error } = await supabase.from('categories').insert({ name });
    if (error) throw error;
  }, []);

  // Atualiza nome, meta ou cor de uma categoria
  const updateCategory = useCallback(async ({
    id, name, oldName, monthly_goal, color,
  }: {
    id: string;
    name?: string;
    oldName?: string;
    monthly_goal?: number;
    color?: string;
  }): Promise<void> => {
    const updates: Record<string, unknown> = {};
    if (name !== undefined)         updates.name = name;
    if (monthly_goal !== undefined) updates.monthly_goal = monthly_goal;
    if (color !== undefined)        updates.color = color;

    const { error } = await supabase.from('categories').update(updates).eq('id', id);
    if (error) throw error;

    // Se o nome mudou, atualiza despesas vinculadas para manter consistência
    if (name && oldName && name !== oldName) {
      await supabase
        .from('expenses')
        .update({ category_name: name })
        .eq('category_name', oldName);
    }
  }, []);

  // Remove categoria (despesas ficam sem categoria — não são apagadas)
  const deleteCategory = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
  }, []);

  return (
    <div
      className={`pb-32 pt-4 px-4 max-w-md mx-auto min-h-screen font-sans transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Notificações (Toasts) */}
      <AnimatePresence>
        {toast && <Toast message={toast.msg} type={toast.type} />}
      </AnimatePresence>

      {/* Header com Navegação e Refresh */}
      <div className="flex items-center justify-between mb-4 bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
        <button
          onClick={prevMonth}
          aria-label="Mês anterior"
          className="p-2 active:scale-90 transition-transform"
        >
          <ChevronLeft className="text-slate-400" />
        </button>

        <div className="flex flex-col items-center">
          <h2 className="font-black text-lg capitalize leading-none text-slate-800 dark:text-white">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <button
            onClick={() => window.location.reload()}
            aria-label="Atualizar aplicativo"
            className="flex items-center gap-1 mt-1 text-[9px] font-black text-blue-500 uppercase tracking-widest active:scale-95 transition-transform"
          >
            <RefreshCcw size={10} aria-hidden="true" /> ATUALIZAR APP
          </button>
        </div>

        <button
          onClick={nextMonth}
          aria-label="Próximo mês"
          className="p-2 active:scale-90 transition-transform"
        >
          <ChevronRight className="text-slate-400" />
        </button>
      </div>

      {/* Orquestrador de Abas com Animação */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab + currentDate.toISOString()}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'list' && (
            <TabExtrato
              expenses={expenses}
              categories={categories}
              prevMonthTotal={prevMonthTotal}
              isLoading={isLoading}
              currentDate={currentDate}
              fetchData={fetchData}
              showToast={showToast}
              onEdit={handleEditExpense}
              onViewReceipt={setViewingReceipt}
              onDelete={deleteExpense}
            />
          )}

          {activeTab === 'add' && (
            <TabNovoGasto
              categories={categories}
              editingExpense={editingExpense}
              fetchData={fetchData}
              showToast={showToast}
              onSaved={() => setActiveTab('list')}
            />
          )}

          {activeTab === 'shopping' && (
            <TabCompras
              shoppingList={shoppingList}
              fetchData={fetchData}
              showToast={showToast}
              onAdd={addShoppingItem}
              onToggle={toggleShoppingItem}
              onDelete={deleteShoppingItem}
              onClearDone={clearDoneItems}
            />
          )}

          {activeTab === 'notes' && (
            <TabNotas
              notes={notes}
              fetchData={fetchData}
              showToast={showToast}
            />
          )}

          {activeTab === 'reminders' && (
            <TabAvisos
              reminders={reminders}
              fetchData={fetchData}
              showToast={showToast}
              onSave={saveReminder}
              onDelete={deleteReminder}
            />
          )}

          {activeTab === 'stats' && (
            <TabGraficos
              expenses={expenses}
              prevMonthExpenses={prevMonthExpenses}
              categories={categories}
              annualChartData={annualChartData}
              currentDate={currentDate}
              showToast={showToast}
            />
          )}

          {activeTab === 'config' && (
            <TabAjustes
              userProfile={userProfile}
              categories={categories}
              expenses={expenses}           // ✅ NOVO — para estatísticas e CSV
              currentDate={currentDate}     // ✅ NOVO — para nome do arquivo CSV
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              fetchData={fetchData}
              showToast={showToast}
              onOpenLogs={() => setActiveTab('logs')}
              onSignOut={signOut}           // ✅ NOVO
              onAddCategory={addCategory}   // ✅ NOVO
              onUpdateCategory={updateCategory} // ✅ NOVO
              onDeleteCategory={deleteCategory} // ✅ NOVO
            />
          )}

          {activeTab === 'logs' && (
            <TabLogs
              logs={logs}
              onBack={() => setActiveTab('config')}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Modal Visualizador de Comprovante */}
      <AnimatePresence>
        {viewingReceipt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[200] flex flex-col p-4 backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Visualizar comprovante"
          >
            <button
              onClick={() => setViewingReceipt(null)}
              aria-label="Fechar visualizador de comprovante"
              className="self-end p-4 text-white"
            >
              <X size={32} aria-hidden="true" />
            </button>
            <div className="flex-1 flex items-center justify-center">
              <img
                src={viewingReceipt}
                className="max-w-full max-h-[85vh] rounded-3xl object-contain border border-white/10 shadow-2xl"
                alt="Comprovante da despesa"
              />
            </div>
            <p className="text-center text-white/50 text-[10px] font-black uppercase tracking-[0.4em] mt-6 leading-none">
              DOCUMENTO SALVO NO SUPABASE
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}