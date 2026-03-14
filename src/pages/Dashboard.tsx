// ─── DASHBOARD.TSX ───────────────────────────────────────────────────────────
// ✅ saveRecipe salva steps (jsonb) junto com a receita
// ✅ deleteRecipe remove imagem do bucket recipe-images
// ✅ Arquitetura consistente — zero supabase nos componentes filhos

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
import { TabReceitas }  from '../tabs/TabReceitas';
import { TabSonhos }    from '../tabs/TabSonhos';

import type { Expense, WatchStatus, Dream } from '../types';
import type { RecipeStep } from '../tabs/TabReceitas';

const RECIPE_BUCKET = 'recipe-images';

export default function Dashboard() {
  const { user } = useAuth();

  const [activeTab, setActiveTab]     = useState<string>('list');
  const [currentDate, setCurrentDate] = useState(new Date());

  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => {
    const root = window.document.documentElement;
    isDarkMode ? root.classList.add('dark') : root.classList.remove('dark');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const showToast = useCallback((msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const handleEditExpense = useCallback((exp: Expense) => {
    setEditingExpense(exp); setActiveTab('add');
  }, []);
  useEffect(() => { if (activeTab !== 'add') setEditingExpense(null); }, [activeTab]);

  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  const {
    expenses, prevMonthExpenses, prevMonthTotal,
    categories, shoppingList, reminders, notes, logs,
    annualChartData, userProfile,
    watchlistCategories, watchlistItems, watchlistRatings,
    recipes, dreams, isLoading, fetchData, fetchRecipes,
  } = useDashboardData(currentDate, activeTab);

  const prevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  // ── Auth ──────────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  // ── Despesas ──────────────────────────────────────────────────────────────
  const deleteExpense = useCallback(async (id: string) => {
    const { error } = await supabase.from('expenses').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
  }, []);

  // ── Lembretes ─────────────────────────────────────────────────────────────
  const saveReminder = useCallback(async ({ text, date, time, editId }: {
    text: string; date: string; time: string; editId: string | null;
  }) => {
    if (!user) throw new Error('Não autenticado');
    const payload = { text, reminder_date: date, reminder_time: time || null, user_id: user.id };
    if (editId) {
      const { error } = await supabase.from('reminders').update(payload).eq('id', editId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('reminders').insert(payload);
      if (error) throw error;
    }
  }, [user]);

  const deleteReminder = useCallback(async (id: string) => {
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) throw error;
  }, []);

  // ── Lista de compras ──────────────────────────────────────────────────────
  const addShoppingItem = useCallback(async ({ name, qty, price }: {
    name: string; qty: number; price: number | null;
  }) => {
    if (!user) throw new Error('Não autenticado');
    const { error } = await supabase.from('shopping_list').insert({
      item_name: name, quantity: qty, estimated_price: price, user_id: user.id,
    });
    if (error) throw error;
  }, [user]);

  const toggleShoppingItem = useCallback(async (id: string, current: boolean) => {
    const { error } = await supabase.from('shopping_list').update({ is_pending: !current }).eq('id', id);
    if (error) throw error;
  }, []);

  const deleteShoppingItem = useCallback(async (id: string) => {
    const { error } = await supabase.from('shopping_list').delete().eq('id', id);
    if (error) throw error;
  }, []);

  const clearDoneItems = useCallback(async () => {
    const ids = shoppingList.filter((i) => !i.is_pending).map((i) => i.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from('shopping_list').delete().in('id', ids);
    if (error) throw error;
  }, [shoppingList]);

  const addShoppingItemsBulk = useCallback(async (items: string[]) => {
    if (!user) throw new Error('Não autenticado');
    const rows = items.filter((i) => i.trim()).map((item_name) => ({
      item_name, user_id: user.id, is_pending: true,
    }));
    if (rows.length === 0) return;
    const { error } = await supabase.from('shopping_list').insert(rows);
    if (error) throw error;
  }, [user]);

  // ── Categorias de gastos ──────────────────────────────────────────────────
  const addCategory = useCallback(async (name: string) => {
    const { error } = await supabase.from('categories').insert({ name });
    if (error) throw error;
  }, []);

  const updateCategory = useCallback(async ({ id, name, oldName, monthly_goal, color }: {
    id: string; name?: string; oldName?: string; monthly_goal?: number; color?: string;
  }) => {
    const updates: Record<string, unknown> = {};
    if (name !== undefined)         updates.name         = name;
    if (monthly_goal !== undefined) updates.monthly_goal = monthly_goal;
    if (color !== undefined)        updates.color        = color;
    const { error } = await supabase.from('categories').update(updates).eq('id', id);
    if (error) throw error;
    if (name && oldName && name !== oldName) {
      await supabase.from('expenses').update({ category_name: name }).eq('category_name', oldName);
    }
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
  }, []);

  // ── Sonhos ────────────────────────────────────────────────────────────────
  const addDream = useCallback(async (title: string, targetValue: number, imageUrl: string) => {
    if (!user) throw new Error('Não autenticado');
    const { error } = await supabase.from('dreams').insert({
      title, target_value: targetValue, image_url: imageUrl || null,
      is_completed: false, user_id: user.id,
    });
    if (error) throw error;
  }, [user]);

  const deleteDream = useCallback(async (id: string) => {
    const { error } = await supabase.from('dreams').delete().eq('id', id);
    if (error) throw error;
  }, []);

  const completeDream = useCallback(async (dreamId: string, categoryId: string) => {
    await supabase.from('dreams').update({ is_completed: true }).eq('id', dreamId);
    await supabase.from('categories').update({ is_active: false }).eq('id', categoryId);
    fetchData();
  }, [fetchData]);

  const updateDream = useCallback(async (id: string, updates: {
    title?: string; target_value?: number; image_url?: string;
  }) => {
    const { error } = await supabase.from('dreams').update(updates).eq('id', id);
    if (error) throw error;
    fetchData();
  }, [fetchData]);

  const quickSaveDream = useCallback(async (categoryName: string, amount: number) => {
    if (!user) throw new Error('Não autenticado');
    const { data: existingCat } = await supabase
      .from('categories').select('id').eq('name', categoryName).maybeSingle();
    if (!existingCat) await supabase.from('categories').insert({ name: categoryName });
    const { error } = await supabase.from('expenses').insert({
      amount, category_name: categoryName,
      description: `Poupança: ${categoryName}`, user_id: user.id, is_deleted: false,
    });
    if (error) throw error;
  }, [user]);

  // ── Watchlist ─────────────────────────────────────────────────────────────
  const addWatchlistCategory = useCallback(async (name: string) => {
    if (!user) throw new Error('Não autenticado');
    const { error } = await supabase.from('watchlist_categories').insert({ name, user_id: user.id });
    if (error) throw error;
  }, [user]);

  const deleteWatchlistCategory = useCallback(async (id: string) => {
    const { error } = await supabase.from('watchlist_categories').delete().eq('id', id);
    if (error) throw error;
  }, []);

  const addWatchlistItem = useCallback(async (payload: {
    category_id: string; tmdb_id: number; title: string;
    poster_url: string | null; synopsis: string | null;
    year: string | null; media_type: 'movie' | 'tv';
  }) => {
    if (!user) throw new Error('Não autenticado');
    const { error } = await supabase.from('watchlist_items').insert({
      ...payload, user_id: user.id, status: 'want',
    });
    if (error) throw error;
  }, [user]);

  const changeWatchlistStatus = useCallback(async (id: string, status: WatchStatus) => {
    const { error } = await supabase.from('watchlist_items').update({ status }).eq('id', id);
    if (error) throw error;
  }, []);

  const deleteWatchlistItem = useCallback(async (id: string) => {
    const { error } = await supabase.from('watchlist_items').delete().eq('id', id);
    if (error) throw error;
  }, []);

  const rateWatchlistItem = useCallback(async (itemId: string, rating: number) => {
    if (!user) throw new Error('Não autenticado');
    const { error } = await supabase
      .from('watchlist_ratings')
      .upsert({ item_id: itemId, user_id: user.id, rating }, { onConflict: 'item_id,user_id' });
    if (error) throw error;
  }, [user]);

  // ── Receitas ──────────────────────────────────────────────────────────────

  const uploadRecipeImage = useCallback(async (file: File, recipeId: string): Promise<string> => {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user!.id}/${recipeId}.${ext}`;
    await supabase.storage.from(RECIPE_BUCKET).remove([path]);
    const { error } = await supabase.storage.from(RECIPE_BUCKET).upload(path, file, {
      cacheControl: '3600', upsert: true, contentType: file.type,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(RECIPE_BUCKET).getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  }, [user]);

  // ✅ saveRecipe — inclui steps no upsert
  const saveRecipe = useCallback(async (data: {
    id?: string;
    title: string;
    category: string;
    prep_time: number | null;
    instructions: string;
    steps: RecipeStep[];
    ingredients: { name: string; quantity: string; order_index: number }[];
    imageFile?: File | null;
    existingImageUrl?: string | null;
  }) => {
    if (!user) throw new Error('Não autenticado');

    const isEdit = Boolean(data.id);
    let recipeId = data.id;

    // 1. Cria ou atualiza receita (sem image_url ainda)
    if (isEdit) {
      const { error } = await supabase.from('recipes').update({
        title:        data.title,
        category:     data.category,
        prep_time:    data.prep_time,
        instructions: data.instructions,
        steps:        data.steps,           // ✅ salva etapas como jsonb
      }).eq('id', recipeId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await supabase.from('recipes').insert({
        title:        data.title,
        category:     data.category,
        prep_time:    data.prep_time,
        instructions: data.instructions,
        steps:        data.steps,           // ✅ salva etapas como jsonb
        user_id:      user.id,
      }).select('id').single();
      if (error) throw error;
      recipeId = inserted.id;
    }

    // 2. Upload da imagem (se nova foto)
    if (data.imageFile && recipeId) {
      const imageUrl = await uploadRecipeImage(data.imageFile, recipeId);
      const { error } = await supabase.from('recipes').update({ image_url: imageUrl }).eq('id', recipeId);
      if (error) throw error;
    }

    // 3. Atualiza ingredientes — deleta antigos e insere novos
    if (recipeId) {
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
      if (data.ingredients.length > 0) {
        const rows = data.ingredients.map((ing) => ({
          recipe_id:   recipeId,
          name:        ing.name,
          quantity:    ing.quantity,
          order_index: ing.order_index,
        }));
        const { error } = await supabase.from('recipe_ingredients').insert(rows);
        if (error) throw error;
      }
    }
  }, [user, uploadRecipeImage]);

  // ✅ deleteRecipe — remove imagem do bucket também
  const deleteRecipe = useCallback(async (id: string) => {
    const { data: recipe } = await supabase
      .from('recipes').select('image_url').eq('id', id).single();
    if (recipe?.image_url) {
      try {
        const url = new URL(recipe.image_url);
        const pathParts = url.pathname.split(`/${RECIPE_BUCKET}/`);
        if (pathParts[1]) {
          const filePath = pathParts[1].split('?')[0];
          await supabase.storage.from(RECIPE_BUCKET).remove([filePath]);
        }
      } catch { /* ignora erro de storage */ }
    }
    const { error } = await supabase.from('recipes').delete().eq('id', id);
    if (error) throw error;
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`pb-32 pt-4 px-4 max-w-md mx-auto min-h-screen font-sans transition-colors duration-300 ${
      isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>

      <AnimatePresence>
        {toast && <Toast message={toast.msg} type={toast.type} />}
      </AnimatePresence>

      {activeTab !== 'movies' && (
        <div className="flex items-center justify-between mb-4 bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
          <button onClick={prevMonth} aria-label="Mês anterior" className="p-2 active:scale-90 transition-transform">
            <ChevronLeft className="text-slate-400" />
          </button>
          <div className="flex flex-col items-center">
            <h2 className="font-black text-lg capitalize leading-none text-slate-800 dark:text-white">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <button onClick={() => window.location.reload()} aria-label="Atualizar aplicativo" className="flex items-center gap-1 mt-1 text-[9px] font-black text-blue-500 uppercase tracking-widest active:scale-95 transition-transform">
              <RefreshCcw size={10} /> ATUALIZAR APP
            </button>
          </div>
          <button onClick={nextMonth} aria-label="Próximo mês" className="p-2 active:scale-90 transition-transform">
            <ChevronRight className="text-slate-400" />
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab + currentDate.toISOString()}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'list' && (
            <TabExtrato expenses={expenses} categories={categories} prevMonthTotal={prevMonthTotal}
              isLoading={isLoading} currentDate={currentDate} fetchData={fetchData}
              showToast={showToast} onEdit={handleEditExpense}
              onViewReceipt={setViewingReceipt} onDelete={deleteExpense} />
          )}
          {activeTab === 'add' && (
            <TabNovoGasto categories={categories} editingExpense={editingExpense}
              fetchData={fetchData} showToast={showToast} onSaved={() => setActiveTab('list')} />
          )}
          {activeTab === 'shopping' && (
            <TabCompras shoppingList={shoppingList} fetchData={fetchData} showToast={showToast}
              onAdd={addShoppingItem} onToggle={toggleShoppingItem}
              onDelete={deleteShoppingItem} onClearDone={clearDoneItems} />
          )}
          {activeTab === 'notes' && (
            <TabNotas notes={notes} fetchData={fetchData} showToast={showToast} />
          )}
          {activeTab === 'reminders' && (
            <TabAvisos reminders={reminders} fetchData={fetchData} showToast={showToast}
              onSave={saveReminder} onDelete={deleteReminder} />
          )}
          {activeTab === 'stats' && (
            <TabGraficos expenses={expenses} prevMonthExpenses={prevMonthExpenses}
              categories={categories} annualChartData={annualChartData}
              currentDate={currentDate} showToast={showToast} />
          )}
          {activeTab === 'config' && (
            <TabAjustes userProfile={userProfile} categories={categories} expenses={expenses}
              currentDate={currentDate} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}
              fetchData={fetchData} showToast={showToast}
              onOpenLogs={() => setActiveTab('logs')} onSignOut={signOut}
              onAddCategory={addCategory} onUpdateCategory={updateCategory}
              onDeleteCategory={deleteCategory} />
          )}
          {activeTab === 'logs' && (
            <TabLogs logs={logs} onBack={() => setActiveTab('config')} />
          )}
          {activeTab === 'movies' && (
            <TabFilmes
              watchlistCategories={watchlistCategories} watchlistItems={watchlistItems}
              watchlistRatings={watchlistRatings} currentUserId={user?.id ?? ''}
              tmdbApiKey={import.meta.env.VITE_TMDB_KEY as string}
              fetchData={fetchData} showToast={showToast}
              onAddCategory={addWatchlistCategory} onDeleteCategory={deleteWatchlistCategory}
              onAddItem={addWatchlistItem} onChangeStatus={changeWatchlistStatus}
              onDeleteItem={deleteWatchlistItem} onRateItem={rateWatchlistItem}
            />
          )}

          {/* ✅ Receitas com steps + cronômetro */}
          {activeTab === 'recipes' && (
            <TabReceitas
              recipes={recipes}
              fetchData={fetchRecipes}
              showToast={showToast}
              onAddShoppingItems={addShoppingItemsBulk}
              onSaveRecipe={saveRecipe}
              onDeleteRecipe={deleteRecipe}
            />
          )}

          {activeTab === 'dreams' && (
            <TabSonhos dreams={dreams} expenses={expenses} fetchData={fetchData}
              showToast={showToast} userId={user?.id ?? ''} onAddDream={addDream}
              onUpdateDream={updateDream} onCompleteDream={completeDream}
              onQuickSave={quickSaveDream} />
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {viewingReceipt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[200] flex flex-col p-4 backdrop-blur-xl"
            role="dialog" aria-modal="true"
          >
            <button onClick={() => setViewingReceipt(null)} className="self-end p-4 text-white">
              <X size={32} />
            </button>
            <div className="flex-1 flex items-center justify-center">
              <img src={viewingReceipt} className="max-w-full max-h-[85vh] rounded-3xl object-contain border border-white/10 shadow-2xl" alt="Comprovante da despesa" />
            </div>
            <p className="text-center text-white/50 text-[10px] font-black uppercase tracking-[0.4em] mt-6">
              DOCUMENTO SALVO NO SUPABASE
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}