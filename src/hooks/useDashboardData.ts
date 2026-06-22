// ─── HOOK PRINCIPAL DE DADOS ─────────────────────────────────────────────────
// ✅ categories select inclui 'type' (couple | individual)
// ✅ fetchRecipes independente para evitar stale closure
// ✅ expense_date — filtra por data do gasto (retroativa), não created_at
// ✅ expenseTemplates — templates de gastos padrão
// ✅ setShoppingList exposto para optimistic updates no Dashboard

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { startOfMonth, endOfMonth, subMonths, addMonths, format } from 'date-fns';
import type {
  Expense, Category, ShoppingItem, Reminder, Note, Profile,
  WatchlistCategory, WatchlistItem, Dream, ExpenseTemplate, RecurringExpense, AIAnalysis,
  ShoppingCatalogItem, ShoppingHistoryItem, ShoppingCategory, NotificationEmail, Merchant,
} from '../types';
import type { WatchlistRating } from '../tabs/Tabfilmes';
import type { Recipe } from '../tabs/TabReceitas';

export interface Log {
  id: string;
  created_at: string;
  action: string;
  details?: string;
  user_id: string;
  profiles?: { full_name?: string; avatar_url?: string };
}

function normalizeProfiles<T extends { profiles?: unknown }>(rows: T[]): T[] {
  return rows.map((row) => ({
    ...row,
    profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? undefined : row.profiles,
  }));
}

export function useDashboardData(currentDate: Date, activeTab: string) {
  const { user } = useAuth();

  const [expenses, setExpenses]                       = useState<Expense[]>([]);
  const [prevMonthExpenses, setPrevMonthExpenses]     = useState<Expense[]>([]);
  const [prevMonthTotal, setPrevMonthTotal]           = useState(0);
  const [categories, setCategories]                   = useState<Category[]>([]);
  const [shoppingList, setShoppingList]               = useState<ShoppingItem[]>([]);
  const [reminders, setReminders]                     = useState<Reminder[]>([]);
  const [notes, setNotes]                             = useState<Note[]>([]);
  const [logs, setLogs]                               = useState<Log[]>([]);
  const [annualChartData, setAnnualChartData]         = useState<{ name: string; total: number }[]>([]);
  const [userProfile, setUserProfile]                 = useState<Profile | null>(null);
  const [watchlistCategories, setWatchlistCategories] = useState<WatchlistCategory[]>([]);
  const [watchlistItems, setWatchlistItems]           = useState<WatchlistItem[]>([]);
  const [watchlistRatings, setWatchlistRatings]       = useState<WatchlistRating[]>([]);
  const [recipes, setRecipes]                         = useState<Recipe[]>([]);
  const [dreams, setDreams]                           = useState<Dream[]>([]);
  const [expenseTemplates, setExpenseTemplates]       = useState<ExpenseTemplate[]>([]);
  const [recurringExpenses, setRecurringExpenses]     = useState<RecurringExpense[]>([]);
  const [aiAnalyses, setAiAnalyses]                   = useState<AIAnalysis[]>([]);
  const [catalogItems, setCatalogItems]               = useState<ShoppingCatalogItem[]>([]);
  const [shoppingHistory, setShoppingHistory]         = useState<ShoppingHistoryItem[]>([]);
  const [shoppingCategories, setShoppingCategories]   = useState<ShoppingCategory[]>([]);
  const [notificationEmails, setNotificationEmails]   = useState<NotificationEmail[]>([]);
  const [merchants, setMerchants]                     = useState<Merchant[]>([]);
  const [isLoading, setIsLoading]                     = useState(true);
  const [error, setError]                             = useState<string | null>(null);

  // Cache por aba: só re-busca dados pesados (filmes, receitas, notas, logs) após 5 min
  const tabCacheRef = useRef<Record<string, number>>({});
  const TAB_TTL_MS  = 5 * 60 * 1000;
  const isTabStale  = useCallback((tab: string) =>
    Date.now() - (tabCacheRef.current[tab] ?? 0) > TAB_TTL_MS,
  []);

  const dates = useMemo(() => {
    const start    = startOfMonth(currentDate);
    const end      = endOfMonth(currentDate);
    const startPrev = startOfMonth(subMonths(currentDate, 1));
    const endPrev   = endOfMonth(subMonths(currentDate, 1));
    const startYear = new Date(currentDate.getFullYear(), 0, 1);
    const endYear   = new Date(currentDate.getFullYear(), 11, 31);

    return {
      // ISO timestamps (mantidos para compatibilidade)
      startM:    start.toISOString(),
      endM:      end.toISOString(),
      startPrev: startPrev.toISOString(),
      endPrev:   endPrev.toISOString(),
      startY:    startYear.toISOString(),
      endY:      new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59).toISOString(),
      // Strings de data (yyyy-MM-dd) para filtrar por expense_date
      startMDate:    format(start, 'yyyy-MM-dd'),
      endMDate:      format(end, 'yyyy-MM-dd'),
      startPrevDate: format(startPrev, 'yyyy-MM-dd'),
      endPrevDate:   format(endPrev, 'yyyy-MM-dd'),
      startYDate:    format(startYear, 'yyyy-MM-dd'),
      endYDate:      format(endYear, 'yyyy-MM-dd'),
      // Strings yyyy-MM para filtrar por payment_month (crédito)
      monthStr:     format(currentDate, 'yyyy-MM'),
      prevMonthStr: format(subMonths(currentDate, 1), 'yyyy-MM'),
    };
  }, [currentDate]);

  const fetchRecipes = useCallback(async () => {
    const { data: rData, error: rErr } = await supabase
      .from('recipes')
      .select(`
        id, user_id, title, category, prep_time, image_url,
        instructions, steps, created_at,
        profiles(full_name, avatar_url),
        recipe_ingredients(id, recipe_id, name, quantity, order_index)
      `)
      .order('created_at', { ascending: false });
    if (rErr) throw rErr;

    const normalized = (rData ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      profile:            Array.isArray(r.profiles) ? (r.profiles[0] ?? undefined) : r.profiles,
      ingredients:        (r.recipe_ingredients ?? []) as Recipe['ingredients'],
      steps:              Array.isArray(r.steps) ? r.steps : [],
      profiles:           undefined,
      recipe_ingredients: undefined,
    }));
    setRecipes(normalized as unknown as Recipe[]);
  }, []);

  // Busca somente a lista de compras (leve, para optimistic updates)
  const fetchShoppingList = useCallback(async () => {
    const { data: s, error: shopErr } = await supabase
      .from('shopping_list')
      .select('*, profiles(full_name, avatar_url)')
      .order('is_pending', { ascending: false })
      .order('created_at', { ascending: false });
    if (shopErr) throw shopErr;
    setShoppingList(normalizeProfiles((s ?? []) as unknown as ShoppingItem[]));
  }, []);

  const fetchCatalog = useCallback(async () => {
    const { data, error: catErr } = await supabase
      .from('shopping_catalog')
      .select('*')
      .order('name');
    if (!catErr) setCatalogItems((data ?? []) as ShoppingCatalogItem[]);
  }, []);

  const fetchShoppingHistory = useCallback(async () => {
    const { data, error: histErr } = await supabase
      .from('shopping_history')
      .select('*')
      .order('purchased_at', { ascending: false })
      .limit(300);
    if (!histErr) setShoppingHistory((data ?? []) as ShoppingHistoryItem[]);
  }, []);

  const fetchShoppingCategories = useCallback(async () => {
    const { data, error: catErr } = await supabase
      .from('shopping_categories')
      .select('*')
      .order('name');
    if (!catErr) setShoppingCategories((data ?? []) as ShoppingCategory[]);
  }, []);

  const fetchNotificationEmails = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('notification_emails')
      .select('*')
      .order('created_at');
    if (!err) setNotificationEmails((data ?? []) as NotificationEmail[]);
  }, []);

  const fetchMerchants = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('merchants')
      .select('*')
      .order('name');
    if (!err) setMerchants((data ?? []) as Merchant[]);
  }, []);

  const fetchData = useCallback(async (force = false) => {
    if (force) tabCacheRef.current = {};
    setIsLoading(true);
    setError(null);
    try {
      // 1. Categorias
      const { data: cats, error: catsErr } = await supabase
        .from('categories')
        .select('id, name, monthly_goal, color, type')
        .order('name');
      if (catsErr) throw catsErr;
      if (cats) setCategories(cats as Category[]);

      // 2. Perfil
      if (user) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles').select('id, full_name, avatar_url').eq('id', user.id).single();
        if (profileErr && profileErr.code !== 'PGRST116') throw profileErr;
        if (profile) setUserProfile(profile as Profile);
      }

      // 3. Gastos mês anterior — mês efetivo: payment_month OU expense_date
      const prevFilter = `payment_month.eq.${dates.prevMonthStr},and(payment_month.is.null,expense_date.gte.${dates.startPrevDate},expense_date.lte.${dates.endPrevDate})`;
      const { data: prevExps, error: prevErr } = await supabase
        .from('expenses')
        .select('id, amount, category_name, user_id, created_at, expense_date, payment_month, is_deleted, profiles(full_name, avatar_url)')
        .eq('is_deleted', false)
        .or(prevFilter);
      if (prevErr) throw prevErr;
      const pExps = normalizeProfiles((prevExps ?? []) as unknown as Expense[]);
      setPrevMonthExpenses(pExps);
      setPrevMonthTotal(pExps.reduce((acc, e) => acc + Number(e.amount), 0));

      // 4. Gastos mês atual — mês efetivo: payment_month OU expense_date
      const currFilter = `payment_month.eq.${dates.monthStr},and(payment_month.is.null,expense_date.gte.${dates.startMDate},expense_date.lte.${dates.endMDate})`;
      const { data: exps, error: expsErr } = await supabase
        .from('expenses')
        .select('*, profiles(full_name, avatar_url)')
        .eq('is_deleted', false)
        .or(currFilter)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (expsErr) throw expsErr;
      setExpenses(normalizeProfiles((exps ?? []) as unknown as Expense[]));

      // 5. Gráfico anual — mês efetivo considera payment_month quando disponível
      const { data: ann, error: annErr } = await supabase
        .from('expenses').select('amount, expense_date, payment_month')
        .eq('is_deleted', false)
        .gte('expense_date', dates.startYDate)
        .lte('expense_date', dates.endYDate);
      if (annErr) throw annErr;
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      setAnnualChartData(months.map((m, i) => ({
        name: m,
        total: (ann ?? [])
          .filter((e) => {
            // Usa payment_month se definido, senão usa expense_date
            const rec = e as { payment_month?: string; expense_date: string };
            const effectiveDate = rec.payment_month
              ? rec.payment_month + '-01'
              : rec.expense_date;
            const monthIdx = parseInt(effectiveDate.split('-')[1], 10) - 1;
            return monthIdx === i;
          })
          .reduce((acc, e) => acc + Number(e.amount), 0),
      })));

      // 6. Sonhos
      const { data: dData, error: dErr } = await supabase
        .from('dreams').select('*').order('created_at', { ascending: false });
      if (dErr) throw dErr;
      setDreams((dData ?? []) as Dream[]);

      // 7. Templates de gastos padrão — sempre carregado (usado na aba 'add')
      const { data: tpl, error: tplErr } = await supabase
        .from('expense_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (tplErr) throw tplErr;
      setExpenseTemplates((tpl ?? []) as ExpenseTemplate[]);

      // 8. Gastos recorrentes — sempre carregado (badge + home + aba recurrent)
      const { data: recData, error: recErr } = await supabase
        .from('recurring_expenses').select('*').order('created_at', { ascending: false });
      if (recErr) throw recErr;
      setRecurringExpenses((recData ?? []) as RecurringExpense[]);

      // 8b. Análises Gemini salvas — silencia erro se a tabela ainda não existir
      {
        const { data: analyses, error: analysesErr } = await supabase
          .from('ai_analyses')
          .select('*')
          .order('month', { ascending: false });
        if (!analysesErr) setAiAnalyses((analyses ?? []) as AIAnalysis[]);
      }

      // 9. Lembretes — sempre carregados (badge + home tab + aba avisos)
      // range: início do mês real até +2 meses à frente
      {
        const today = new Date();
        const remStart = format(startOfMonth(today), 'yyyy-MM-dd');
        const remEnd   = format(endOfMonth(addMonths(today, 2)), 'yyyy-MM-dd');
        const { data: r, error: remErr } = await supabase
          .from('reminders').select('*, profiles(full_name, avatar_url)')
          .gte('reminder_date', remStart)
          .lte('reminder_date', remEnd)
          .order('reminder_date', { ascending: true });
        if (remErr) throw remErr;
        setReminders(normalizeProfiles((r ?? []) as unknown as Reminder[]));
      }

      // 10. Lazy por aba — com TTL de 5 min (evita re-fetch ao voltar para a mesma aba)
      if (activeTab === 'notes' && isTabStale('notes')) {
        // Busca notas públicas + notas privadas do próprio usuário
        const { data: n, error: notesErr } = await supabase
          .from('notes')
          .select('*, profiles(full_name, avatar_url)')
          .or(`is_private.eq.false,and(is_private.eq.true,user_id.eq.${user?.id})`)
          .order('created_at', { ascending: false });
        if (notesErr) throw notesErr;
        setNotes(normalizeProfiles((n ?? []) as unknown as Note[]));
        tabCacheRef.current['notes'] = Date.now();
      }

      // Categorias de compras, e-mails de notificação e estabelecimentos — carregados sempre
      await Promise.all([fetchShoppingCategories(), fetchNotificationEmails(), fetchMerchants()]);

      if (activeTab === 'shopping') {
        await Promise.all([fetchShoppingList(), fetchCatalog(), fetchShoppingHistory()]);
      }

      if (activeTab === 'logs' && isTabStale('logs')) {
        const { data: logData, error: logsErr } = await supabase
          .from('logs').select('*, profiles(full_name, avatar_url)')
          .order('created_at', { ascending: false }).limit(100);
        if (logsErr) throw logsErr;
        setLogs(normalizeProfiles((logData ?? []) as unknown as Log[]));
        tabCacheRef.current['logs'] = Date.now();
      }

      if (activeTab === 'movies' && isTabStale('movies')) {
        const { data: wCats, error: wCatsErr } = await supabase
          .from('watchlist_categories').select('*').order('created_at', { ascending: true });
        if (wCatsErr) throw wCatsErr;
        setWatchlistCategories((wCats ?? []) as WatchlistCategory[]);

        const { data: wItems, error: wItemsErr } = await supabase
          .from('watchlist_items').select('*').order('created_at', { ascending: false });
        if (wItemsErr) throw wItemsErr;
        setWatchlistItems((wItems ?? []) as WatchlistItem[]);

        const { data: wRatings, error: wRatingsErr } = await supabase
          .from('watchlist_ratings').select('id, item_id, user_id, rating, profiles(full_name, avatar_url)');
        if (wRatingsErr) throw wRatingsErr;
        // Mapeia profiles (array/objeto da resposta) → profile (chave esperada pela interface)
        const normalizedRatings = ((wRatings ?? []) as Record<string, unknown>[]).map(r => ({
          id:      r.id as string,
          item_id: r.item_id as string,
          user_id: r.user_id as string,
          rating:  r.rating as number,
          profile: Array.isArray(r.profiles) ? (r.profiles[0] ?? undefined) : (r.profiles ?? undefined),
        }));
        setWatchlistRatings(normalizedRatings as WatchlistRating[]);
        tabCacheRef.current['movies'] = Date.now();
      }

      if (activeTab === 'recipes' && isTabStale('recipes')) {
        await fetchRecipes();
        tabCacheRef.current['recipes'] = Date.now();
      }

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar dados';
      console.error('[useDashboardData]', e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [dates, activeTab, user, fetchRecipes, fetchShoppingList, fetchCatalog, fetchShoppingHistory, fetchShoppingCategories, fetchNotificationEmails, fetchMerchants]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: re-fetch quando parceiro(a) insere/atualiza/deleta gastos ou lista de compras
  useEffect(() => {
    if (!user) return;

    // Debounce para não disparar fetchData múltiplas vezes em cascata
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => fetchData(), 800);
    };

    const channel = supabase
      .channel('housefinance-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list' }, refresh)
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user, fetchData]);

  return {
    expenses, prevMonthExpenses, prevMonthTotal,
    categories, shoppingList, setShoppingList, catalogItems, shoppingHistory, shoppingCategories, notificationEmails, merchants, reminders, notes, logs,
    annualChartData, userProfile,
    watchlistCategories, watchlistItems, watchlistRatings, setWatchlistRatings,
    recipes, dreams, expenseTemplates, recurringExpenses,
    aiAnalyses,
    isLoading, error,
    fetchData, fetchRecipes, fetchShoppingList, fetchCatalog, fetchShoppingHistory, fetchShoppingCategories, fetchNotificationEmails, fetchMerchants,
  };
}
