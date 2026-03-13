// ─── DASHBOARD.TSX ───────────────────────────────────────────────────────────
// ✅ Padrão arquitetural consistente — zero supabase nos componentes filhos

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
import { TabFilmes }    from '../tabs/Tabfilmes';
import { TabSonhos }    from '../tabs/TabSonhos';   // Nova Tab
import { TabReceitas }  from '../tabs/TabReceitas'; // Nova Tab

import type { Expense, WatchStatus } from '../types';

export default function Dashboard() {
  const { user } = useAuth();

  // ── Navegação ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<string>('list');
  const [currentDate, setCurrentDate] = useState(new Date());

  // ── Tema ──────────────────────────────────────────────────────────────────
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => {
    const root = window.document.documentElement;
    isDarkMode ? root.classList.add('dark') : root.classList.remove('dark');
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

  // ── Dados ─────────────────────────────────────────────────────────────────
  const {
    expenses, prevMonthExpenses, prevMonthTotal,
    categories, shoppingList, reminders, notes, logs,
    dreams, // Certifique-se que o useDashboardData retorna 'dreams'
    annualChartData, userProfile,
    watchlistCategories, watchlistItems,
    isLoading, fetchData,
  } = useDashboardData(currentDate, activeTab);

  // ── Navegação de mês ──────────────────────────────────────────────────────
  const prevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  // ══════════════════════════════════════════════════════════════════════════
  // CALLBACKS — lógica centralizada
  // ══════════════════════════════════════════════════════════════════════════

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const deleteExpense = useCallback(async (id: string) => {
    const { error } = await supabase.from('expenses').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
    fetchData();
  }, [fetchData]);

  // ── Sonhos ────────────────────────────────────────────────────────────────
  const addDream = useCallback(async (title: string, target: number, image: string) => {
    if (!user) return;
    // 1. Cria Categoria correspondente
    const { data: cat, error: catErr } = await supabase.from('categories').insert({ name: title }).select().single();
    if (catErr) throw catErr;
    // 2. Cria Sonho vinculado
    const { error: dreamErr } = await supabase.from('dreams').insert({
      title, target_value: target, image_url: image, category_id: cat.id, user_id: user.id
    });
    if (dreamErr) throw dreamErr;
    fetchData();
  }, [user, fetchData]);

  const completeDream = useCallback(async (dreamId: string, categoryId: string) => {
    // Marca sonho como feito e inativa a categoria para novos lançamentos
    await supabase.from('dreams').update({ is_completed: true }).eq('id', dreamId);
    await supabase.from('categories').update({ is_active: false }).eq('id', categoryId);
    fetchData();
  }, [fetchData]);

  const quickSaveDream = useCallback(async (categoryName: string, amount: number) => {
    if (!user) return;
    await supabase.from('expenses').insert({
      amount, category_name: categoryName, description: 'Economia para Sonho', user_id: user.id
    });
    fetchData();
  }, [user, fetchData]);

  // ── Receitas -> Compras ──────────────────────────────────────────────────
  const addManyShoppingItems = useCallback(async (items: string[]) => {
    if (!user) return;
    const payload = items.filter(i => i.trim() !== '').map(item => ({
      item_name: item, user_id: user.id
    }));
    const { error } = await supabase.from('shopping_list').insert(payload);
    if (error) throw error;
    showToast(`${items.length} itens na lista!`);
    fetchData();
  }, [user, fetchData, showToast]);

  // ── Lembretes, Compras e Categorias (Mantidos conforme sua versão) ────────
  const saveReminder = useCallback(async ({ text, date, time, editId }: any) => {
    const payload = { text, reminder_date: date, reminder_time: time || null, user_id: user?.id };
    const { error } = editId ? await supabase.from('reminders').update(payload).eq('id', editId) : await supabase.from('reminders').insert(payload);
    if (error) throw error;
    fetchData();
  }, [user, fetchData]);

  const deleteReminder = useCallback(async (id: string) => {
    await supabase.from('reminders').delete().eq('id', id);
    fetchData();
  }, [fetchData]);

  const addShoppingItem = useCallback(async ({ name, qty, price }: any) => {
    await supabase.from('shopping_list').insert({ item_name: name, quantity: qty, estimated_price: price, user_id: user?.id });
    fetchData();
  }, [user, fetchData]);

  const toggleShoppingItem = useCallback(async (id: string, current: boolean) => {
    await supabase.from('shopping_list').update({ is_pending: !current }).eq('id', id);
    fetchData();
  }, [fetchData]);

  const deleteShoppingItem = useCallback(async (id: string) => {
    await supabase.from('shopping_list').delete().eq('id', id);
    fetchData();
  }, [fetchData]);

  const clearDoneItems = useCallback(async () => {
    const ids = shoppingList.filter((i) => !i.is_pending).map((i) => i.id);
    if (ids.length > 0) await supabase.from('shopping_list').delete().in('id', ids);
    fetchData();
  }, [shoppingList, fetchData]);

  const updateCategory = useCallback(async ({ id, name, oldName, monthly_goal, color }: any) => {
    await supabase.from('categories').update({ name, monthly_goal, color }).eq('id', id);
    if (name && oldName && name !== oldName) {
      await supabase.from('expenses').update({ category_name: name }).eq('category_name', oldName);
    }
    fetchData();
  }, [fetchData]);

  // ── Watchlist Handlers ───────────────────────────────────────────────────
  const addWatchlistCategory = useCallback(async (name: string) => {
    await supabase.from('watchlist_categories').insert({ name, user_id: user?.id });
    fetchData();
  }, [user, fetchData]);

  const deleteWatchlistCategory = useCallback(async (id: string) => {
    await supabase.from('watchlist_categories').delete().eq('id', id);
    fetchData();
  }, [fetchData]);

  const addWatchlistItem = useCallback(async (payload: any) => {
    await supabase.from('watchlist_items').insert({ ...payload, user_id: user?.id, status: 'want' });
    fetchData();
  }, [user, fetchData]);

  const changeWatchlistStatus = useCallback(async (id: string, status: WatchStatus) => {
    await supabase.from('watchlist_items').update({ status }).eq('id', id);
    fetchData();
  }, [fetchData]);

  const deleteWatchlistItem = useCallback(async (id: string) => {
    await supabase.from('watchlist_items').delete().eq('id', id);
    fetchData();
  }, [fetchData]);

  return (
    <div className={`pb-32 pt-4 px-4 max-w-md mx-auto min-h-screen font-sans transition-colors duration-300 ${
      isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>

      <AnimatePresence>{toast && <Toast message={toast.msg} type={toast.type} />}</AnimatePresence>

      {activeTab !== 'movies' && activeTab !== 'recipes' && (
        <div className="flex items-center justify-between mb-4 bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
          <button onClick={prevMonth} className="p-2 active:scale-90 transition-transform"><ChevronLeft className="text-slate-400" /></button>
          <div className="flex flex-col items-center">
            <h2 className="font-black text-lg capitalize leading-none text-slate-800 dark:text-white">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <button onClick={() => window.location.reload()} className="flex items-center gap-1 mt-1 text-[9px] font-black text-blue-500 uppercase tracking-widest active:scale-95 transition-transform">
              <RefreshCcw size={10} /> ATUALIZAR APP
            </button>
          </div>
          <button onClick={nextMonth} className="p-2 active:scale-90 transition-transform"><ChevronRight className="text-slate-400" /></button>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={activeTab + currentDate.toISOString()} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
          
          {activeTab === 'list' && (
            <TabExtrato expenses={expenses} categories={categories} prevMonthTotal={prevMonthTotal} isLoading={isLoading} currentDate={currentDate} fetchData={fetchData} showToast={showToast} onEdit={handleEditExpense} onViewReceipt={setViewingReceipt} onDelete={deleteExpense} />
          )}

          {activeTab === 'dreams' && (
            <TabSonhos dreams={dreams} expenses={expenses} fetchData={fetchData} showToast={showToast} onAddDream={addDream} onCompleteDream={completeDream} onQuickSave={quickSaveDream} />
          )}

          {activeTab === 'recipes' && (
            <TabReceitas fetchData={fetchData} showToast={showToast} onAddShoppingItems={addManyShoppingItems} />
          )}

          {activeTab === 'add' && (
            <TabNovoGasto categories={categories.filter(c => c.is_active || c.name === editingExpense?.category_name)} editingExpense={editingExpense} fetchData={fetchData} showToast={showToast} onSaved={() => setActiveTab('list')} />
          )}

          {activeTab === 'shopping' && (
            <TabCompras shoppingList={shoppingList} fetchData={fetchData} showToast={showToast} onAdd={addShoppingItem} onToggle={toggleShoppingItem} onDelete={deleteShoppingItem} onClearDone={clearDoneItems} />
          )}

          {activeTab === 'notes' && <TabNotas notes={notes} fetchData={fetchData} showToast={showToast} />}

          {activeTab === 'reminders' && (
            <TabAvisos reminders={reminders} fetchData={fetchData} showToast={showToast} onSave={saveReminder} onDelete={deleteReminder} />
          )}

          {activeTab === 'stats' && (
            <TabGraficos expenses={expenses} prevMonthExpenses={prevMonthExpenses} categories={categories} annualChartData={annualChartData} currentDate={currentDate} showToast={showToast} />
          )}

          {activeTab === 'config' && (
            <TabAjustes userProfile={userProfile} categories={categories} expenses={expenses} currentDate={currentDate} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} fetchData={fetchData} showToast={showToast} onOpenLogs={() => setActiveTab('logs')} onSignOut={signOut} onAddCategory={async (n) => { 
  await supabase.from('categories').insert({ name: n }); 
  await fetchData(); 
}}  onUpdateCategory={updateCategory} onDeleteCategory={async (id) => { 
  await supabase.from('categories').delete().eq('id', id); 
  await fetchData(); 
}} />
          )}

          {activeTab === 'logs' && <TabLogs logs={logs} onBack={() => setActiveTab('config')} />}

          {activeTab === 'movies' && (
            <TabFilmes watchlistCategories={watchlistCategories} watchlistItems={watchlistItems} tmdbApiKey={import.meta.env.VITE_TMDB_KEY as string} fetchData={fetchData} showToast={showToast} onAddCategory={addWatchlistCategory} onDeleteCategory={deleteWatchlistCategory} onAddItem={addWatchlistItem} onChangeStatus={changeWatchlistStatus} onDeleteItem={deleteWatchlistItem} />
          )}

        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {viewingReceipt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/95 z-[200] flex flex-col p-4 backdrop-blur-xl">
            <button onClick={() => setViewingReceipt(null)} className="self-end p-4 text-white"><X size={32} /></button>
            <div className="flex-1 flex items-center justify-center"><img src={viewingReceipt} className="max-w-full max-h-[85vh] rounded-3xl object-contain border border-white/10 shadow-2xl" alt="Recibo" /></div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}