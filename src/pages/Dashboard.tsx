// ─── DASHBOARD.TSX ───────────────────────────────────────────────────────────
// ✅ saveRecipe salva steps (jsonb) junto com a receita
// ✅ deleteRecipe remove imagem do bucket recipe-images
// ✅ Arquitetura consistente — zero supabase nos componentes filhos
// ✅ Optimistic updates na lista de compras (toggle/delete/clearDone instantâneos)
// ✅ Templates de gastos padrão — add/delete via TabAjustes

import { useState, useEffect, useCallback, useMemo, lazy, Suspense, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, RefreshCcw, X, Moon, Sun, Minimize2 } from 'lucide-react';
import { haptic } from '../utils/haptic';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import BottomNav from '../components/BottomNav';
import { Toast, SkeletonCard } from '../components/ui';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';

import { TabExtrato }   from '../tabs/TabExtrato';
import { TabNovoGasto } from '../tabs/TabNovoGasto';
import { TabCompras }   from '../tabs/TabCompras';
import { TabNotas }     from '../tabs/TabNotas';
import { TabAvisos }    from '../tabs/TabAvisos';
import { TabAjustes }   from '../tabs/TabAjustes';
import { TabHome }      from '../tabs/TabHome';

const TabGraficos    = lazy(() => import('../tabs/TabGraficos').then(m    => ({ default: m.TabGraficos    })));
const TabFilmes      = lazy(() => import('../tabs/Tabfilmes').then(m      => ({ default: m.TabFilmes      })));
const TabReceitas    = lazy(() => import('../tabs/TabReceitas').then(m    => ({ default: m.TabReceitas    })));
const TabSonhos      = lazy(() => import('../tabs/TabSonhos').then(m      => ({ default: m.TabSonhos      })));
const TabLogs        = lazy(() => import('../tabs/TabLogs').then(m        => ({ default: m.TabLogs        })));
const TabRecorrentes = lazy(() => import('../tabs/TabRecorrentes').then(m => ({ default: m.TabRecorrentes })));

import type { Expense, ShoppingItem, WatchStatus, Dream, RecurringExpense, CatalogPricePoint } from '../types';
import type { RecipeStep } from '../tabs/TabReceitas';

const RECIPE_BUCKET = 'recipe-images';

// ─────────────────────────────────────────────────────────────────────────────
// Botão flutuante de reset de zoom
// Usa `left` (não `right`) calculado a partir da borda direita do visualViewport,
// pois `right` é relativo ao layout viewport e fica escondido quando zooming à esquerda.
// ─────────────────────────────────────────────────────────────────────────────
function ZoomResetButton() {
  const [isZoomed, setIsZoomed] = useState(false);
  const [pos, setPos]           = useState({ top: 16, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const calcPos = useCallback(() => {
    const vp = window.visualViewport;
    if (!vp) return;
    const zoomed = vp.scale > 1.05;
    setIsZoomed(zoomed);
    if (zoomed) {
      // offsetWidth do botão em CSS px; fallback 132px enquanto não montou
      const btnW = btnRef.current?.offsetWidth ?? 132;
      setPos({
        top:  vp.offsetTop  + 16,
        // borda direita do visual viewport, recuando largura do botão + padding
        left: vp.offsetLeft + vp.width - btnW - 16,
      });
    }
  }, []);

  useEffect(() => {
    const vp = window.visualViewport;
    if (!vp) return;
    vp.addEventListener('resize', calcPos);
    vp.addEventListener('scroll', calcPos);
    calcPos();
    return () => {
      vp.removeEventListener('resize', calcPos);
      vp.removeEventListener('scroll', calcPos);
    };
  }, [calcPos]);

  // Refina a posição após o botão montar (obtém largura real)
  useEffect(() => {
    if (isZoomed) calcPos();
  }, [isZoomed, calcPos]);

  const resetZoom = () => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    const orig = meta.content;
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    setTimeout(() => { meta.content = orig; }, 350);
  };

  return (
    <AnimatePresence>
      {isZoomed && (
        <motion.button
          ref={btnRef}
          key="zoom-reset"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          onClick={resetZoom}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-[9999] flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-600/40 text-[10px] font-black uppercase tracking-widest active:scale-90 transition-transform select-none"
          aria-label="Redefinir zoom para 100%"
        >
          <Minimize2 size={14} />
          Zoom 100%
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// Cor RGB de acento por aba — usada no gradiente de fundo
const TAB_GRADIENT_RGB: Record<string, string> = {
  home:       '59,130,246',
  list:       '59,130,246',
  add:        '16,185,129',
  shopping:   '6,182,212',
  notes:      '251,191,36',
  reminders:  '251,146,60',
  stats:      '99,102,241',
  recurrent:  '139,92,246',
  movies:     '100,116,139',
  dreams:     '168,85,247',
  recipes:    '249,115,22',
  config:     '148,163,184',
  logs:       '148,163,184',
};

export default function Dashboard() {
  const { user } = useAuth();

  const [activeTab, setActiveTab]     = useState<string>('home');
  const [currentDate, setCurrentDate] = useState(new Date());

  const [theme, setTheme] = useState<'light' | 'dark' | 'brasil'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'brasil') return saved;
    return 'light';
  });
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark', 'brasil');
    if (theme !== 'light') root.classList.add('dark');
    if (theme === 'brasil') root.classList.add('brasil');
    localStorage.setItem('theme', theme);
  }, [theme]);
  const isDark   = theme !== 'light';
  const isBrasil = theme === 'brasil';

  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const showToast = useCallback((msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const [editingExpense, setEditingExpense]     = useState<Expense | null>(null);
  const [duplicatingExpense, setDuplicatingExpense] = useState<Expense | null>(null);

  const handleEditExpense = useCallback((exp: Expense) => {
    setDuplicatingExpense(null);
    setEditingExpense(exp);
    setActiveTab('add');
  }, []);

  const handleDuplicateExpense = useCallback((exp: Expense) => {
    setEditingExpense(null);
    setDuplicatingExpense(exp);
    setActiveTab('add');
  }, []);

  useEffect(() => {
    if (activeTab !== 'add') {
      setEditingExpense(null);
      setDuplicatingExpense(null);
    }
  }, [activeTab]);

  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  // ── Refresh manual (botão Atualizar) — callback definido após fetchData ──
  const [manualRefreshing, setManualRefreshing] = useState(false);

  // ── Pull-to-refresh — estado e refs (handlers definidos após fetchData) ───
  const PULL_THRESHOLD = 72;
  const pullStartY     = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    expenses, prevMonthExpenses, prevMonthTotal,
    categories, shoppingList, setShoppingList, catalogItems, shoppingHistory, shoppingCategories, notificationEmails, merchants, reminders, notes, logs,
    annualChartData, userProfile,
    watchlistCategories, watchlistItems, watchlistRatings, setWatchlistRatings,
    recipes, dreams, expenseTemplates, recurringExpenses,
    aiAnalyses,
    isLoading, fetchData, fetchRecipes, fetchShoppingList, fetchCatalog, fetchShoppingHistory, fetchShoppingCategories, fetchNotificationEmails, fetchMerchants,
  } = useDashboardData(currentDate, activeTab);

  const handleManualRefresh = useCallback(async () => {
    if (manualRefreshing) return;
    haptic('light');
    setManualRefreshing(true);
    try {
      await fetchData(true);
      showToast('Dados atualizados!');
    } finally {
      setManualRefreshing(false);
    }
  }, [manualRefreshing, fetchData, showToast]);

  const hasTodayReminder = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return reminders.some(r => r.reminder_date === todayStr);
  }, [reminders]);

  const prevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  // ── Pull-to-refresh handlers (após fetchData estar disponível) ────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    pullStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (pullStartY.current === 0) return;
    const dy = e.touches[0].clientY - pullStartY.current;
    if (dy > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(dy, PULL_THRESHOLD * 1.5));
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      haptic('medium');
      await fetchData(true);
      setIsRefreshing(false);
    }
    setPullDistance(0);
    pullStartY.current = 0;
  }, [pullDistance, isRefreshing, fetchData]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  // ── Despesas ──────────────────────────────────────────────────────────────
  const deleteExpense = useCallback(async (id: string) => {
    haptic('medium');
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

  // ── Lista de compras — Optimistic Updates ─────────────────────────────────

  const addShoppingItem = useCallback(async ({ name, qty, price, category, unit, volume_ml, weight_g }: {
    name: string; qty: number; price: number | null; category?: string; unit?: string;
    volume_ml?: number; weight_g?: number;
  }) => {
    if (!user) throw new Error('Não autenticado');
    const tempId = `temp-${Date.now()}`;
    const tempItem: ShoppingItem = {
      id: tempId,
      item_name: name,
      is_pending: true,
      user_id: user.id,
      created_at: new Date().toISOString(),
      quantity: qty,
      estimated_price: price ?? undefined,
      category: category || undefined,
      unit: unit || 'un',
      volume_ml: volume_ml || undefined,
      weight_g: weight_g || undefined,
      profiles: userProfile ?? undefined,
    };
    setShoppingList((prev) => [tempItem, ...prev]);
    try {
      const { error } = await supabase.from('shopping_list').insert({
        item_name: name, quantity: qty, estimated_price: price, user_id: user.id,
        category: category || null, unit: unit || 'un',
        volume_ml: volume_ml || null, weight_g: weight_g || null,
      });
      if (error) throw error;
      await fetchShoppingList();
    } catch (err) {
      setShoppingList((prev) => prev.filter((i) => i.id !== tempId));
      throw err;
    }
  }, [user, userProfile, setShoppingList, fetchShoppingList]);

  const toggleShoppingItem = useCallback(async (
    id: string,
    current: boolean,
    historyPrice?: number,   // preço real pago (sobrescreve estimated_price no histórico)
    historyWeightG?: number, // peso real comprado em gramas
  ) => {
    // Captura o item antes do update de estado para poder gravar no histórico
    let captured: ShoppingItem | undefined;
    setShoppingList((prev) => {
      captured = prev.find(i => i.id === id);
      return prev.map((item) => item.id === id ? { ...item, is_pending: !current } : item);
    });

    // Marcando como comprado — grava no histórico (fire-and-forget, fora do setter)
    if (current && user && captured) {
      const snap = captured;
      void supabase.from('shopping_history').insert({
        user_id: user.id,
        item_name: snap.item_name,
        price: historyPrice ?? snap.estimated_price ?? null,
        category: snap.category ?? null,
        unit: snap.unit ?? null,
        volume_ml: snap.volume_ml ?? null,
        weight_g: historyWeightG ?? snap.weight_g ?? null,
        quantity: snap.quantity ?? 1,
      });
    }

    const { error } = await supabase.from('shopping_list').update({ is_pending: !current }).eq('id', id);
    if (error) {
      fetchData();
      throw error;
    }
  }, [setShoppingList, fetchData, user]);

  const refreshShoppingData = useCallback(async () => {
    await Promise.all([fetchShoppingList(), fetchCatalog(), fetchShoppingHistory(), fetchShoppingCategories()]);
  }, [fetchShoppingList, fetchCatalog, fetchShoppingHistory, fetchShoppingCategories]);

  // ── E-mails de notificação ────────────────────────────────────────────────
  const addNotificationEmail = useCallback(async (email: string, label?: string) => {
    const { error } = await supabase.from('notification_emails').insert({ email, label: label || null });
    if (error) throw error;
    await fetchNotificationEmails();
  }, [fetchNotificationEmails]);

  const toggleNotificationEmail = useCallback(async (id: string, is_active: boolean) => {
    const { error } = await supabase.from('notification_emails').update({ is_active }).eq('id', id);
    if (error) throw error;
    await fetchNotificationEmails();
  }, [fetchNotificationEmails]);

  const deleteNotificationEmail = useCallback(async (id: string) => {
    const { error } = await supabase.from('notification_emails').delete().eq('id', id);
    if (error) throw error;
    await fetchNotificationEmails();
  }, [fetchNotificationEmails]);

  // ── Estabelecimentos ──────────────────────────────────────────────────────
  const addMerchant = useCallback(async (name: string) => {
    const { error } = await supabase.from('merchants').insert({ name: name.trim() });
    if (error) throw error;
    await fetchMerchants();
  }, [fetchMerchants]);

  const updateMerchant = useCallback(async (id: string, name: string) => {
    const { error } = await supabase.from('merchants').update({ name: name.trim() }).eq('id', id);
    if (error) throw error;
    await fetchMerchants();
  }, [fetchMerchants]);

  const deleteMerchant = useCallback(async (id: string) => {
    const { error } = await supabase.from('merchants').delete().eq('id', id);
    if (error) throw error;
    await fetchMerchants();
  }, [fetchMerchants]);

  // ── Categorias de compras ──────────────────────────────────────────────────
  const addShoppingCategory = useCallback(async (name: string) => {
    const { error } = await supabase.from('shopping_categories').insert({ name });
    if (error) throw error;
    await fetchShoppingCategories();
  }, [fetchShoppingCategories]);

  const updateShoppingCategory = useCallback(async (id: string, name: string) => {
    const { error } = await supabase.from('shopping_categories').update({ name }).eq('id', id);
    if (error) throw error;
    await fetchShoppingCategories();
  }, [fetchShoppingCategories]);

  const deleteShoppingCategory = useCallback(async (id: string) => {
    const { error } = await supabase.from('shopping_categories').delete().eq('id', id);
    if (error) throw error;
    await fetchShoppingCategories();
  }, [fetchShoppingCategories]);

  const deleteShoppingItem = useCallback(async (id: string) => {
    // Optimistic: remove visualmente imediatamente
    setShoppingList((prev) => prev.filter((item) => item.id !== id));
    const { error } = await supabase.from('shopping_list').delete().eq('id', id);
    if (error) {
      fetchData(); // Reverte em caso de erro
      throw error;
    }
  }, [setShoppingList, fetchData]);

  const renameShoppingItem = useCallback(async (id: string, name: string) => {
    setShoppingList((prev) => prev.map((item) => item.id === id ? { ...item, item_name: name } : item));
    const { error } = await supabase.from('shopping_list').update({ item_name: name }).eq('id', id);
    if (error) { fetchData(); throw error; }
  }, [setShoppingList, fetchData]);

  const createCatalogItem = useCallback(async (item: {
    name: string; package_qty: number; package_unit: string; last_price: number; category?: string;
  }) => {
    const { error } = await supabase
      .from('shopping_catalog')
      .insert({ ...item, updated_at: new Date().toISOString() });
    if (error) throw error;
    await fetchCatalog();
  }, [fetchCatalog]);

  // Upsert por nome: usado ao confirmar compra (sem unique constraint — faz select primeiro)
  const upsertCatalogItem = useCallback(async (item: {
    name: string; package_qty: number; package_unit: string; last_price: number; category?: string;
  }) => {
    const { data: existing } = await supabase
      .from('shopping_catalog')
      .select('id, last_price, price_history')
      .ilike('name', item.name)
      .maybeSingle();

    if (existing) {
      const prevPrice = existing.last_price as number;
      const prevHistory = ((existing.price_history ?? []) as CatalogPricePoint[]);
      // Só registra no histórico se o preço mudou
      const updatedHistory = (prevPrice !== item.last_price)
        ? [...prevHistory.slice(-11), { price: prevPrice, date: new Date().toISOString() }]
        : prevHistory;

      const { error } = await supabase.from('shopping_catalog').update({
        last_price: item.last_price, package_qty: item.package_qty,
        package_unit: item.package_unit, category: item.category ?? null,
        price_history: updatedHistory,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('shopping_catalog').insert({
        ...item, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    }
    await fetchCatalog();
  }, [fetchCatalog]);

  const updateCatalogItem = useCallback(async (id: string, item: {
    name: string; package_qty: number; package_unit: string; last_price: number; category?: string;
    prevPrice?: number; priceHistory?: CatalogPricePoint[];
  }) => {
    // Registra histórico de preço quando o valor muda
    const updatedHistory = (item.prevPrice !== undefined && item.prevPrice !== item.last_price)
      ? [...(item.priceHistory ?? []).slice(-11), { price: item.prevPrice, date: new Date().toISOString() }]
      : (item.priceHistory ?? []);

    const { error } = await supabase
      .from('shopping_catalog')
      .update({
        name: item.name, last_price: item.last_price,
        package_qty: item.package_qty, package_unit: item.package_unit,
        category: item.category ?? null,
        price_history: updatedHistory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
    await fetchCatalog();
  }, [fetchCatalog]);

  const deleteCatalogItem = useCallback(async (id: string) => {
    const { error } = await supabase.from('shopping_catalog').delete().eq('id', id);
    if (error) throw error;
    await fetchCatalog();
  }, [fetchCatalog]);

  const clearDoneItems = useCallback(async () => {
    const ids = shoppingList.filter((i) => !i.is_pending).map((i) => i.id);
    if (ids.length === 0) return;
    // Optimistic: remove comprados imediatamente
    setShoppingList((prev) => prev.filter((i) => i.is_pending));
    const { error } = await supabase.from('shopping_list').delete().in('id', ids);
    if (error) {
      fetchData(); // Reverte em caso de erro
      throw error;
    }
  }, [shoppingList, setShoppingList, fetchData]);

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

  const updateCategory = useCallback(async ({ id, name, oldName, monthly_goal, color, type }: {
    id: string; name?: string; oldName?: string; monthly_goal?: number; color?: string; type?: string;
  }) => {
    const updates: Record<string, unknown> = {};
    if (name !== undefined)         updates.name         = name;
    if (monthly_goal !== undefined) updates.monthly_goal = monthly_goal;
    if (color !== undefined)        updates.color        = color;
    if (type !== undefined)         updates.type         = type;
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

  // ── Templates de gastos padrão ────────────────────────────────────────────
  const addTemplate = useCallback(async (payload: {
    description: string; amount: number; category_name: string;
  }) => {
    if (!user) throw new Error('Não autenticado');
    const { error } = await supabase.from('expense_templates').insert({ ...payload, user_id: user.id });
    if (error) throw error;
  }, [user]);

  const deleteTemplate = useCallback(async (id: string) => {
    const { error } = await supabase.from('expense_templates').delete().eq('id', id);
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

  // ── Gastos Recorrentes ────────────────────────────────────────────────────
  const addRecurring = useCallback(async (data: {
    description: string; amount: number; category_name: string; day_of_month: number;
  }) => {
    if (!user) throw new Error('Não autenticado');
    const { error } = await supabase.from('recurring_expenses').insert({ ...data, user_id: user.id });
    if (error) throw error;
  }, [user]);

  const updateRecurring = useCallback(async (id: string, data: {
    description?: string; amount?: number; category_name?: string; day_of_month?: number;
  }) => {
    const { error } = await supabase.from('recurring_expenses').update(data).eq('id', id);
    if (error) throw error;
  }, []);

  const toggleRecurring = useCallback(async (id: string, is_active: boolean) => {
    const { error } = await supabase.from('recurring_expenses').update({ is_active }).eq('id', id);
    if (error) throw error;
  }, []);

  const deleteRecurring = useCallback(async (id: string) => {
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
    if (error) throw error;
  }, []);

  const addInstallmentPlan = useCallback(async (data: {
    description: string; amount_per_installment: number; total_installments: number;
    first_payment_date: string; category_name: string; day_of_month: number;
  }) => {
    if (!user) throw new Error('Não autenticado');
    const { error: rError } = await supabase.from('recurring_expenses').insert({
      user_id: user.id,
      description: data.description,
      amount: data.amount_per_installment,
      category_name: data.category_name,
      day_of_month: data.day_of_month,
      is_active: true,
      plan_type: 'installment',
      total_installments: data.total_installments,
      first_payment_date: data.first_payment_date,
    });
    if (rError) throw rError;
    const [baseY, baseM, baseD] = data.first_payment_date.split('-').map(Number);
    const rows = Array.from({ length: data.total_installments }, (_, i) => {
      const lastDay = new Date(baseY, baseM - 1 + i + 1, 0).getDate();
      const day = Math.min(baseD, lastDay);
      const d = new Date(baseY, baseM - 1 + i, day);
      const expenseDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { user_id: user.id, amount: data.amount_per_installment, category_name: data.category_name, description: data.description, expense_date: expenseDate, is_deleted: false };
    });
    const { error: eError } = await supabase.from('expenses').insert(rows);
    if (eError) throw eError;
    await supabase.from('logs').insert({ user_id: user.id, action: 'INSERT', item_description: `${data.description} (${data.total_installments}x)`, details: `Parcelamento criado: ${data.total_installments} parcelas a partir de ${data.first_payment_date}` });
    fetchData();
  }, [user, fetchData]);

  const deleteInstallmentPlan = useCallback(async (id: string, description: string, category_name: string) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const { error: eError } = await supabase.from('expenses').update({ is_deleted: true })
      .eq('description', description).eq('category_name', category_name).eq('is_deleted', false).gt('expense_date', todayStr);
    if (eError) throw eError;
    const { error: rError } = await supabase.from('recurring_expenses').delete().eq('id', id);
    if (rError) throw rError;
    fetchData();
  }, [fetchData]);

  const launchRecurring = useCallback(async (recurring: RecurringExpense) => {
    if (!user) throw new Error('Não autenticado');
    const year  = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day   = String(recurring.day_of_month).padStart(2, '0');
    const expDate = `${year}-${month}-${day}`;
    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      amount: recurring.amount,
      category_name: recurring.category_name,
      description: recurring.description,
      expense_date: expDate,
      is_deleted: false,
    });
    if (error) throw error;
    await supabase.from('logs').insert({
      user_id: user.id, action: 'INSERT',
      item_description: recurring.description,
      details: `Lançado via gasto fixo: ${recurring.description}`,
    });
    fetchData();
  }, [user, currentDate, fetchData]);

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
    // Optimistic update: atualiza estado local imediatamente sem depender do re-fetch
    setWatchlistRatings(prev => {
      const idx = prev.findIndex(r => r.item_id === itemId && r.user_id === user.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], rating };
        return updated;
      }
      return [...prev, { id: `opt-${Date.now()}`, item_id: itemId, user_id: user.id, rating }];
    });
  }, [user, setWatchlistRatings]);

  const moveWatchlistItem = useCallback(async (id: string, categoryId: string) => {
    const { error } = await supabase.from('watchlist_items').update({ category_id: categoryId }).eq('id', id);
    if (error) throw error;
  }, []);

  // ── Análises Gemini ────────────────────────────────────────────────────────
  const saveAIAnalysis = useCallback(async (content: string, month: string, monthDisplay: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('ai_analyses')
      .upsert(
        { user_id: user.id, month, month_display: monthDisplay, content },
        { onConflict: 'user_id,month' }
      );
    if (error) throw error;
    fetchData(true);
  }, [user, fetchData]);

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

    if (isEdit) {
      const { error } = await supabase.from('recipes').update({
        title: data.title, category: data.category,
        prep_time: data.prep_time, instructions: data.instructions, steps: data.steps,
      }).eq('id', recipeId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await supabase.from('recipes').insert({
        title: data.title, category: data.category,
        prep_time: data.prep_time, instructions: data.instructions, steps: data.steps,
        user_id: user.id,
      }).select('id').single();
      if (error) throw error;
      recipeId = inserted.id;
    }

    if (data.imageFile && recipeId) {
      const imageUrl = await uploadRecipeImage(data.imageFile, recipeId);
      const { error } = await supabase.from('recipes').update({ image_url: imageUrl }).eq('id', recipeId);
      if (error) throw error;
    }

    if (recipeId) {
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
      if (data.ingredients.length > 0) {
        const rows = data.ingredients.map((ing) => ({
          recipe_id: recipeId, name: ing.name, quantity: ing.quantity, order_index: ing.order_index,
        }));
        const { error } = await supabase.from('recipe_ingredients').insert(rows);
        if (error) throw error;
      }
    }
  }, [user, uploadRecipeImage]);

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
    <>
      {createPortal(
        <div
          className={`fixed inset-0 pointer-events-none transition-colors duration-500 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}
          style={(() => {
            const rgb = TAB_GRADIENT_RGB[activeTab] ?? '148,163,184';
            return {
              zIndex: 0,
              backgroundImage: isBrasil
                ? [
                    `radial-gradient(circle, rgba(252,202,2,0.08) 1px, transparent 1px)`,
                    `linear-gradient(to bottom, rgba(0,39,118,0.30) 0%, transparent 60%)`,
                  ].join(', ')
                : isDark
                ? [
                    `radial-gradient(circle, rgba(148,163,184,0.05) 1px, transparent 1px)`,
                    `linear-gradient(to bottom, rgba(${rgb},0.18) 0%, transparent 60%)`,
                  ].join(', ')
                : [
                    `radial-gradient(circle, rgba(148,163,184,0.13) 1px, transparent 1px)`,
                  ].join(', '),
              backgroundSize: isDark ? '28px 28px, 100% 100%' : '28px 28px',
            };
          })()}
          aria-hidden="true"
        >
          <div className="absolute inset-0 overflow-hidden">
            <div className="relative max-w-md mx-auto h-full">
              {/* Orb principal — canto superior direito, cor da aba ativa */}
              <div
                className="absolute -top-28 -right-28 w-[22rem] h-[22rem] rounded-full transition-colors duration-500"
                style={{
                  backgroundColor: isBrasil ? 'rgba(252,202,2,0.40)' : `rgba(${TAB_GRADIENT_RGB[activeTab] ?? '59,130,246'}, ${isDark ? 0.28 : 0.42})`,
                  filter: 'blur(72px)',
                }}
              />
              {/* Orb violeta — canto inferior esquerdo */}
              <div
                className="absolute -bottom-28 -left-28 w-80 h-80 rounded-full transition-colors duration-300"
                style={{
                  backgroundColor: isBrasil ? 'rgba(0,39,118,0.45)' : isDark ? 'rgba(139,92,246,0.22)' : 'rgba(139,92,246,0.32)',
                  filter: 'blur(72px)',
                }}
              />
              {/* Orb azul-céu — canto superior esquerdo */}
              <div
                className="absolute -top-16 -left-20 w-64 h-64 rounded-full"
                style={{
                  backgroundColor: isBrasil ? 'rgba(0,156,59,0.25)' : isDark ? 'rgba(56,189,248,0.12)' : 'rgba(56,189,248,0.22)',
                  filter: 'blur(60px)',
                }}
              />
              {/* Orb esmeralda — canto inferior direito */}
              <div
                className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full"
                style={{
                  backgroundColor: isBrasil ? 'rgba(252,202,2,0.18)' : isDark ? 'rgba(52,211,153,0.10)' : 'rgba(52,211,153,0.20)',
                  filter: 'blur(56px)',
                }}
              />
              {/* Ring grande — borda superior direita */}
              <div
                className="absolute -top-16 -right-16 w-80 h-80 rounded-full border-2 transition-colors duration-500"
                style={{ borderColor: isBrasil ? 'rgba(252,202,2,0.15)' : `rgba(${TAB_GRADIENT_RGB[activeTab] ?? '59,130,246'}, ${isDark ? 0.10 : 0.22})` }}
              />
              {/* Ring médio — lateral esquerda */}
              <div className={`absolute top-52 -left-14 w-40 h-40 rounded-full border-2 ${isBrasil ? 'border-yellow-500/15' : isDark ? 'border-violet-400/10' : 'border-violet-400/25'}`} />
              {/* Diamond */}
              <div className={`absolute top-64 right-5 w-16 h-16 rotate-45 border-2 ${isBrasil ? 'border-yellow-400/[0.12]' : isDark ? 'border-white/[0.06]' : 'border-slate-400/[0.14]'}`} />
              {/* Mini ring acento */}
              <div className={`absolute bottom-64 left-16 w-11 h-11 rounded-full border ${isBrasil ? 'border-yellow-400/15' : isDark ? 'border-sky-400/10' : 'border-sky-400/22'}`} />
            </div>
          </div>
        </div>,
        document.body
      )}

    <div
      className={`relative z-10 pb-32 pt-4 px-4 max-w-md mx-auto min-h-screen font-sans transition-colors duration-300 ${
        isDark ? 'text-slate-100' : 'text-slate-900'
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >

      <AnimatePresence>
        {toast && <Toast message={toast.msg} type={toast.type} />}
      </AnimatePresence>

      {/* Pull-to-refresh indicator */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: Math.min(pullDistance / PULL_THRESHOLD, 1), y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.15 }}
            className="flex justify-center mb-2 -mt-2"
          >
            <div className={`w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center shadow-sm ${
              isRefreshing ? 'animate-spin' : ''
            }`}
              style={{ transform: `rotate(${(pullDistance / PULL_THRESHOLD) * 180}deg)` }}
            >
              <RefreshCcw size={15} className="text-blue-500" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab !== 'movies' && (
        <div className="flex items-center justify-between mb-4 bg-white/85 dark:bg-slate-900/80 backdrop-blur-md px-3 py-2.5 rounded-3xl shadow-sm border border-slate-100/70 dark:border-slate-700/60 transition-colors gap-2">
          {/* Avatar do usuário */}
          <img
            src={userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.full_name ?? 'U')}&size=40`}
            className="w-9 h-9 rounded-2xl object-cover border-2 border-slate-100 dark:border-slate-700 shrink-0"
            alt={userProfile?.full_name ?? 'Usuário'}
          />

          {/* Navegação de mês */}
          <div className="flex items-center gap-1 flex-1 justify-center min-w-0">
            <button onClick={prevMonth} aria-label="Mês anterior" className="p-1.5 active:scale-90 transition-transform shrink-0">
              <ChevronLeft size={18} className="text-slate-400" />
            </button>
            <div className="flex flex-col items-center min-w-0">
              <h2 className="font-black text-base capitalize leading-none text-slate-800 dark:text-white truncate">
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <button
                onClick={handleManualRefresh}
                disabled={manualRefreshing}
                aria-label="Atualizar dados"
                className="flex items-center gap-1 mt-1 text-[9px] font-black text-blue-500 uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
              >
                <RefreshCcw size={9} className={manualRefreshing ? 'animate-spin' : ''} />
                {manualRefreshing ? 'atualizando' : 'atualizar'}
              </button>
            </div>
            <button onClick={nextMonth} aria-label="Próximo mês" className="p-1.5 active:scale-90 transition-transform shrink-0">
              <ChevronRight size={18} className="text-slate-400" />
            </button>
          </div>

          {/* Ciclo de temas: Claro → Escuro → Brasil */}
          <button
            onClick={() => setTheme(t => t === 'light' ? 'dark' : t === 'dark' ? 'brasil' : 'light')}
            aria-label={theme === 'light' ? 'Ativar modo escuro' : theme === 'dark' ? 'Ativar tema Brasil' : 'Ativar modo claro'}
            className="w-9 h-9 rounded-2xl bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 flex items-center justify-center text-slate-500 dark:text-yellow-400 active:scale-90 transition-all shrink-0"
          >
            {theme === 'light' ? <Moon size={16} /> : theme === 'dark' ? <span className="text-sm leading-none">🇧🇷</span> : <Sun size={16} />}
          </button>
        </div>
      )}

      <Suspense fallback={
        <div className="space-y-4">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
      }>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + currentDate.toISOString()}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'home' && (
              <TabHome
                expenses={expenses} prevMonthExpenses={prevMonthExpenses}
                categories={categories} reminders={reminders}
                shoppingList={shoppingList} dreams={dreams}
                recurringExpenses={recurringExpenses}
                watchlistItems={watchlistItems} notes={notes}
                currentDate={currentDate} isLoading={isLoading}
                onNavigate={setActiveTab} />
            )}
            {activeTab === 'list' && (
              <TabExtrato expenses={expenses} categories={categories} prevMonthTotal={prevMonthTotal}
                isLoading={isLoading} currentDate={currentDate} fetchData={fetchData}
                showToast={showToast} onEdit={handleEditExpense}
                onDuplicate={handleDuplicateExpense}
                onViewReceipt={setViewingReceipt} onDelete={deleteExpense} />
            )}
            {activeTab === 'add' && (
              <TabNovoGasto categories={categories} expenses={expenses} merchants={merchants} editingExpense={editingExpense}
                duplicateData={duplicatingExpense}
                templates={expenseTemplates}
                fetchData={fetchData} showToast={showToast} onSaved={() => setActiveTab('list')} />
            )}
            {activeTab === 'shopping' && (
              <TabCompras shoppingList={shoppingList} catalogItems={catalogItems}
                shoppingHistory={shoppingHistory} shoppingCategories={shoppingCategories}
                showToast={showToast}
                onAdd={addShoppingItem} onToggle={toggleShoppingItem}
                onDelete={deleteShoppingItem} onClearDone={clearDoneItems}
                onCreateCatalog={createCatalogItem}
                onUpsertCatalog={upsertCatalogItem} onUpdateCatalog={updateCatalogItem}
                onDeleteCatalog={deleteCatalogItem} onRefresh={refreshShoppingData}
                onRenameItem={renameShoppingItem} />
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
                recurringExpenses={recurringExpenses} aiAnalyses={aiAnalyses}
                currentDate={currentDate} showToast={showToast}
                onSaveAnalysis={saveAIAnalysis} />
            )}
            {activeTab === 'config' && (
              <TabAjustes userProfile={userProfile} categories={categories} expenses={expenses}
                expenseTemplates={expenseTemplates} shoppingCategories={shoppingCategories}
                notificationEmails={notificationEmails}
                currentDate={currentDate} theme={theme} setTheme={setTheme}
                fetchData={fetchData} showToast={showToast}
                onOpenLogs={() => setActiveTab('logs')} onSignOut={signOut}
                onAddCategory={addCategory} onUpdateCategory={updateCategory}
                onDeleteCategory={deleteCategory}
                onAddTemplate={addTemplate} onDeleteTemplate={deleteTemplate}
                onAddShoppingCategory={addShoppingCategory}
                onUpdateShoppingCategory={updateShoppingCategory}
                onDeleteShoppingCategory={deleteShoppingCategory}
                onAddNotificationEmail={addNotificationEmail}
                onToggleNotificationEmail={toggleNotificationEmail}
                onDeleteNotificationEmail={deleteNotificationEmail}
                merchants={merchants}
                onAddMerchant={addMerchant}
                onUpdateMerchant={updateMerchant}
                onDeleteMerchant={deleteMerchant} />
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
                onMoveItem={moveWatchlistItem}
              />
            )}
            {activeTab === 'recipes' && (
              <TabReceitas
                recipes={recipes} fetchData={fetchRecipes} showToast={showToast}
                onAddShoppingItems={addShoppingItemsBulk}
                onSaveRecipe={saveRecipe} onDeleteRecipe={deleteRecipe}
              />
            )}
            {activeTab === 'dreams' && (
              <TabSonhos dreams={dreams} expenses={expenses} fetchData={fetchData}
                showToast={showToast} userId={user?.id ?? ''} onAddDream={addDream}
                onUpdateDream={updateDream} onCompleteDream={completeDream}
                onDeleteDream={deleteDream} onQuickSave={quickSaveDream} />
            )}
            {activeTab === 'recurrent' && (
              <TabRecorrentes
                recurringExpenses={recurringExpenses}
                expenses={expenses}
                categories={categories}
                currentDate={currentDate}
                isLoading={isLoading}
                showToast={showToast}
                onAdd={addRecurring}
                onAddInstallment={addInstallmentPlan}
                onUpdate={updateRecurring}
                onToggle={toggleRecurring}
                onDelete={deleteRecurring}
                onDeleteInstallment={deleteInstallmentPlan}
                onLaunch={launchRecurring}
                fetchData={fetchData} />
            )}
          </motion.div>
        </AnimatePresence>
      </Suspense>

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

      {/* Overlay de loading — visível em TODAS as abas durante refresh manual */}
      <AnimatePresence>
        {manualRefreshing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[180] bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="flex flex-col items-center gap-3 bg-white dark:bg-slate-800 px-10 py-7 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700"
            >
              <RefreshCcw size={28} className="animate-spin text-blue-500" />
              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                Atualizando...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ZoomResetButton />

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} hasTodayReminder={hasTodayReminder} />
    </div>
    </>
  );
}
