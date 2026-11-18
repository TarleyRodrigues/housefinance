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
  ShoppingCatalogItem, ShoppingHistoryItem, ShoppingCategory, NotificationEmail, Merchant, HistoryExpense,
  StudentCard, Log,
} from '../types';
import { HISTORY_MONTHS } from '../utils';
import type { WatchlistRating } from '../tabs/Tabfilmes';
import type { Recipe } from '../tabs/TabReceitas';

export type { Log } from '../types';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Abas que têm dados próprios (carregados ao abrir a aba)
const TABS_WITH_DATA = new Set(['notes', 'logs', 'movies', 'recipes', 'stats', 'shopping', 'config']);

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
  const [historyExpenses, setHistoryExpenses]         = useState<HistoryExpense[]>([]);
  const [studentCard, setStudentCard]                 = useState<StudentCard | null>(null);
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

  // Carteirinha estudantil do usuário logado (0 ou 1 linha).
  // Não bloqueia o app se a tabela ainda não existir.
  const fetchStudentCard = useCallback(async () => {
    if (!user) return;
    const { data, error: cardErr } = await supabase
      .from('student_cards')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (cardErr) { console.error('[useDashboardData] student_cards', cardErr); return; }
    setStudentCard((data ?? null) as StudentCard | null);
  }, [user]);

  // ── Notas (públicas + privadas do próprio usuário) ──────────────────────────
  const fetchNotes = useCallback(async () => {
    if (!user) return;
    const { data: n, error: notesErr } = await supabase
      .from('notes')
      .select('*, profiles(full_name, avatar_url)')
      .or(`is_private.eq.false,and(is_private.eq.true,user_id.eq.${user.id})`)
      .order('created_at', { ascending: false });
    if (notesErr) throw notesErr;
    setNotes(normalizeProfiles((n ?? []) as unknown as Note[]));
    tabCacheRef.current['notes'] = Date.now();
  }, [user]);

  const fetchLogs = useCallback(async () => {
    const { data: logData, error: logsErr } = await supabase
      .from('logs').select('*, profiles(full_name, avatar_url)')
      .order('created_at', { ascending: false }).limit(100);
    if (logsErr) throw logsErr;
    setLogs(normalizeProfiles((logData ?? []) as unknown as Log[]));
    tabCacheRef.current['logs'] = Date.now();
  }, []);

  const fetchWatchlist = useCallback(async () => {
    const [cRes, iRes, rRes] = await Promise.all([
      supabase.from('watchlist_categories').select('*').order('created_at', { ascending: true }),
      supabase.from('watchlist_items').select('*').order('created_at', { ascending: false }),
      supabase.from('watchlist_ratings').select('id, item_id, user_id, rating, profiles(full_name, avatar_url)'),
    ]);
    if (cRes.error) throw cRes.error;
    if (iRes.error) throw iRes.error;
    if (rRes.error) throw rRes.error;
    setWatchlistCategories((cRes.data ?? []) as WatchlistCategory[]);
    setWatchlistItems((iRes.data ?? []) as WatchlistItem[]);
    // Mapeia profiles (array/objeto da resposta) → profile (chave esperada pela interface)
    setWatchlistRatings(((rRes.data ?? []) as Record<string, unknown>[]).map(r => ({
      id:      r.id as string,
      item_id: r.item_id as string,
      user_id: r.user_id as string,
      rating:  r.rating as number,
      profile: Array.isArray(r.profiles) ? (r.profiles[0] ?? undefined) : (r.profiles ?? undefined),
    })) as WatchlistRating[]);
    tabCacheRef.current['movies'] = Date.now();
  }, []);

  // Histórico de 12 meses (até o mês selecionado) — usado em Gráficos › Histórico
  const fetchHistory = useCallback(async () => {
    const histStart = startOfMonth(subMonths(currentDate, HISTORY_MONTHS - 1));
    const histStartStr = format(histStart, 'yyyy-MM');
    const histFilter = `payment_month.gte.${histStartStr},and(payment_month.is.null,expense_date.gte.${format(histStart, 'yyyy-MM-dd')})`;
    const { data: hist, error: histErr } = await supabase
      .from('expenses')
      .select('id, amount, category_name, description, merchant, expense_date, payment_month, created_at')
      .eq('is_deleted', false)
      .or(histFilter)
      .order('expense_date', { ascending: false })
      .limit(5000);
    if (histErr) throw histErr;
    // Corta no mês selecionado (mês efetivo = payment_month ou mês de expense_date)
    setHistoryExpenses(((hist ?? []) as HistoryExpense[]).filter((e) => {
      const m = e.payment_month ?? e.expense_date?.slice(0, 7) ?? '';
      return m >= histStartStr && m <= dates.monthStr;
    }));
    tabCacheRef.current[`history-${dates.monthStr}`] = Date.now();
  }, [currentDate, dates.monthStr]);

  // ── Núcleo: dados usados em várias abas — todas as consultas em paralelo ────
  // Recarrega ao trocar de mês, após mutações e em eventos realtime;
  // NÃO roda ao trocar de aba.
  const fetchCore = useCallback(async () => {
    const prevFilter = `payment_month.eq.${dates.prevMonthStr},and(payment_month.is.null,expense_date.gte.${dates.startPrevDate},expense_date.lte.${dates.endPrevDate})`;
    const currFilter = `payment_month.eq.${dates.monthStr},and(payment_month.is.null,expense_date.gte.${dates.startMDate},expense_date.lte.${dates.endMDate})`;
    // Lembretes: início do mês real até +2 meses à frente
    const today    = new Date();
    const remStart = format(startOfMonth(today), 'yyyy-MM-dd');
    const remEnd   = format(endOfMonth(addMonths(today, 2)), 'yyyy-MM-dd');

    const [
      catsRes, profileRes, prevRes, currRes, annRes, dreamsRes,
      tplRes, recRes, analysesRes, remRes,
    ] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      user
        ? supabase.from('profiles').select('id, full_name, avatar_url').eq('id', user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      // Mês anterior — mês efetivo: payment_month OU expense_date
      supabase.from('expenses')
        .select('id, amount, category_name, user_id, created_at, expense_date, payment_month, is_deleted, profiles(full_name, avatar_url)')
        .eq('is_deleted', false).or(prevFilter),
      // Mês atual
      supabase.from('expenses')
        .select('*, profiles(full_name, avatar_url)')
        .eq('is_deleted', false).or(currFilter)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false }),
      // Gráfico anual
      supabase.from('expenses').select('amount, expense_date, payment_month')
        .eq('is_deleted', false)
        .gte('expense_date', dates.startYDate)
        .lte('expense_date', dates.endYDate),
      supabase.from('dreams').select('*').order('created_at', { ascending: false }),
      supabase.from('expense_templates').select('*').order('description'),
      supabase.from('recurring_expenses').select('*').order('created_at', { ascending: false }),
      supabase.from('ai_analyses').select('*').order('month', { ascending: false }),
      supabase.from('reminders').select('*, profiles(full_name, avatar_url)')
        .gte('reminder_date', remStart).lte('reminder_date', remEnd)
        .order('reminder_date', { ascending: true }),
      // Leves e usados em várias abas — erros tratados dentro de cada função
      fetchShoppingCategories(), fetchNotificationEmails(), fetchMerchants(),
    ]);

    // Essenciais: erro interrompe e aparece para o usuário
    for (const r of [catsRes, profileRes, prevRes, currRes, annRes, dreamsRes, recRes, remRes]) {
      if (r.error) throw r.error;
    }

    setCategories((catsRes.data ?? []) as Category[]);
    if (profileRes.data) setUserProfile(profileRes.data as Profile);

    const pExps = normalizeProfiles((prevRes.data ?? []) as unknown as Expense[]);
    setPrevMonthExpenses(pExps);
    setPrevMonthTotal(pExps.reduce((acc, e) => acc + Number(e.amount), 0));
    setExpenses(normalizeProfiles((currRes.data ?? []) as unknown as Expense[]));

    // Mês efetivo considera payment_month quando disponível — soma em uma passada
    const totals = new Array<number>(12).fill(0);
    for (const e of (annRes.data ?? []) as { amount: number; expense_date: string; payment_month?: string | null }[]) {
      const effective = e.payment_month ? `${e.payment_month}-01` : e.expense_date;
      const idx = parseInt(effective?.split('-')[1] ?? '', 10) - 1;
      if (idx >= 0 && idx < 12) totals[idx] += Number(e.amount);
    }
    setAnnualChartData(MONTH_LABELS.map((name, i) => ({ name, total: totals[i] })));

    setDreams((dreamsRes.data ?? []) as Dream[]);
    setRecurringExpenses((recRes.data ?? []) as RecurringExpense[]);
    setReminders(normalizeProfiles((remRes.data ?? []) as unknown as Reminder[]));

    // Opcionais: não bloqueiam o app se a tabela não existir / RLS
    if (tplRes.error) console.error('[useDashboardData] expense_templates', tplRes.error);
    else setExpenseTemplates((tplRes.data ?? []) as ExpenseTemplate[]);
    if (!analysesRes.error) setAiAnalyses((analysesRes.data ?? []) as AIAnalysis[]);
  }, [dates, user, fetchShoppingCategories, fetchNotificationEmails, fetchMerchants]);

  // ── Dados específicos de cada aba (TTL de 5 min nos mais pesados) ──────────
  const fetchTab = useCallback(async (tab: string): Promise<void> => {
    switch (tab) {
      case 'notes':    if (isTabStale('notes'))  await fetchNotes(); break;
      case 'logs':     if (isTabStale('logs'))   await fetchLogs(); break;
      case 'movies':   if (isTabStale('movies')) await fetchWatchlist(); break;
      case 'recipes':
        if (isTabStale('recipes')) { await fetchRecipes(); tabCacheRef.current['recipes'] = Date.now(); }
        break;
      case 'stats':    if (isTabStale(`history-${dates.monthStr}`)) await fetchHistory(); break;
      case 'shopping': await Promise.all([fetchShoppingList(), fetchCatalog(), fetchShoppingHistory()]); break;
      case 'config':   await fetchStudentCard(); break;
    }
  }, [isTabStale, dates.monthStr, fetchNotes, fetchLogs, fetchWatchlist, fetchRecipes, fetchHistory,
      fetchShoppingList, fetchCatalog, fetchShoppingHistory, fetchStudentCard]);

  // Contador de cargas em andamento → isLoading (cargas sobrepostas não "piscam")
  const pendingRef = useRef(0);
  const track = useCallback(async (job: () => Promise<unknown>) => {
    pendingRef.current += 1;
    setIsLoading(true);
    try {
      await job();
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar dados';
      console.error('[useDashboardData]', e);
      setError(msg);
    } finally {
      pendingRef.current -= 1;
      if (pendingRef.current === 0) setIsLoading(false);
    }
  }, []);

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // Recarga completa (núcleo + aba atual). force = ignora o cache das abas.
  const fetchData = useCallback(async (force = false) => {
    if (force) tabCacheRef.current = {};
    await track(() => Promise.all([fetchCore(), fetchTab(activeTabRef.current)]));
  }, [track, fetchCore, fetchTab]);

  // Núcleo: na montagem e quando muda o mês/usuário
  useEffect(() => { track(fetchCore); }, [track, fetchCore]);

  // Aba: ao trocar de aba (e de mês, por causa do histórico em Gráficos)
  useEffect(() => {
    if (TABS_WITH_DATA.has(activeTab)) track(() => fetchTab(activeTab));
  }, [activeTab, fetchTab, track]);

  // Realtime: parceiro(a) inseriu/atualizou/deletou gastos ou itens da lista de compras.
  // Ref evita recriar o canal a cada troca de mês.
  const realtimeRef = useRef({ fetchCore, fetchShoppingList, fetchHistory, track });
  realtimeRef.current = { fetchCore, fetchShoppingList, fetchHistory, track };

  useEffect(() => {
    if (!user) return;

    // Debounce para não disparar várias recargas em cascata
    let expTimer: ReturnType<typeof setTimeout>;
    let shopTimer: ReturnType<typeof setTimeout>;

    const onExpenses = () => {
      // Gastos mudaram: invalida o cache do histórico
      for (const key of Object.keys(tabCacheRef.current)) {
        if (key.startsWith('history-')) delete tabCacheRef.current[key];
      }
      clearTimeout(expTimer);
      expTimer = setTimeout(() => {
        const { fetchCore: core, fetchHistory: hist, track: run } = realtimeRef.current;
        run(() => Promise.all([core(), activeTabRef.current === 'stats' ? hist() : null]));
      }, 800);
    };

    const onShopping = () => {
      clearTimeout(shopTimer);
      shopTimer = setTimeout(() => {
        const { fetchShoppingList: shop, track: run } = realtimeRef.current;
        run(shop);
      }, 800);
    };

    const channel = supabase
      .channel('housefinance-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, onExpenses)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list' }, onShopping)
      .subscribe();

    return () => {
      clearTimeout(expTimer);
      clearTimeout(shopTimer);
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    expenses, prevMonthExpenses, prevMonthTotal,
    categories, shoppingList, setShoppingList, catalogItems, shoppingHistory, shoppingCategories, notificationEmails, merchants, reminders, notes, logs,
    annualChartData, userProfile,
    watchlistCategories, watchlistItems, watchlistRatings, setWatchlistRatings,
    recipes, dreams, expenseTemplates, recurringExpenses,
    aiAnalyses, historyExpenses, studentCard,
    isLoading, error,
    fetchData, fetchRecipes, fetchShoppingList, fetchCatalog, fetchShoppingHistory, fetchShoppingCategories, fetchNotificationEmails, fetchMerchants,
    fetchStudentCard, fetchNotes,
  };
}
