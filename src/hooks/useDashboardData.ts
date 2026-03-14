// ─── HOOK PRINCIPAL DE DADOS ─────────────────────────────────────────────────
// ✅ recipes lazy — busca steps + ingredients + profile
// ✅ CORREÇÃO: recipes só é atualizado quando activeTab === 'recipes'
//    (era o motivo de não aparecer: o estado ficava vazio pois o fetch
//     só rodava na aba certa mas o componente tentava exibir antes)

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import type {
  Expense, Category, ShoppingItem, Reminder, Note, Profile,
  WatchlistCategory, WatchlistItem, Dream,
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
  const [isLoading, setIsLoading]                     = useState(true);
  const [error, setError]                             = useState<string | null>(null);

  const dates = useMemo(() => {
    const startM    = startOfMonth(currentDate).toISOString();
    const endM      = endOfMonth(currentDate).toISOString();
    const startPrev = startOfMonth(subMonths(currentDate, 1)).toISOString();
    const endPrev   = endOfMonth(subMonths(currentDate, 1)).toISOString();
    const startY    = new Date(currentDate.getFullYear(), 0, 1).toISOString();
    const endY      = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59).toISOString();
    return { startM, endM, startPrev, endPrev, startY, endY };
  }, [currentDate]);

  // ✅ fetchRecipes — função independente, pode ser chamada a qualquer momento
  // Separada do fetchData para evitar problema de closure stale com activeTab
  const fetchRecipes = useCallback(async () => {
    const { data: rData, error: rErr } = await supabase
      .from('recipes')
      .select(`
        id,
        user_id,
        title,
        category,
        prep_time,
        image_url,
        instructions,
        steps,
        created_at,
        profiles(full_name, avatar_url),
        recipe_ingredients(id, recipe_id, name, quantity, order_index)
      `)
      .order('created_at', { ascending: false });
    if (rErr) throw rErr;

    const normalized = (rData ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      profile:     Array.isArray(r.profiles) ? (r.profiles[0] ?? undefined) : r.profiles,
      ingredients: (r.recipe_ingredients ?? []) as Recipe['ingredients'],
      steps:       Array.isArray(r.steps) ? r.steps : [],
      profiles:            undefined,
      recipe_ingredients:  undefined,
    }));
    setRecipes(normalized as unknown as Recipe[]);
  }, []); // sem dependências — acessa supabase diretamente

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Categorias
      const { data: cats, error: catsErr } = await supabase
        .from('categories').select('id, name, monthly_goal, color').order('name');
      if (catsErr) throw catsErr;
      if (cats) setCategories(cats as Category[]);

      // 2. Perfil
      if (user) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles').select('id, full_name, avatar_url').eq('id', user.id).single();
        if (profileErr && profileErr.code !== 'PGRST116') throw profileErr;
        if (profile) setUserProfile(profile as Profile);
      }

      // 3. Gastos mês anterior
      const { data: prevExps, error: prevErr } = await supabase
        .from('expenses')
        .select('id, amount, category_name, user_id, created_at, is_deleted, profiles(full_name, avatar_url)')
        .eq('is_deleted', false)
        .gte('created_at', dates.startPrev).lte('created_at', dates.endPrev);
      if (prevErr) throw prevErr;
      const pExps = normalizeProfiles((prevExps ?? []) as unknown as Expense[]);
      setPrevMonthExpenses(pExps);
      setPrevMonthTotal(pExps.reduce((acc, e) => acc + Number(e.amount), 0));

      // 4. Gastos mês atual
      const { data: exps, error: expsErr } = await supabase
        .from('expenses')
        .select('*, profiles(full_name, avatar_url)')
        .eq('is_deleted', false)
        .gte('created_at', dates.startM).lte('created_at', dates.endM)
        .order('created_at', { ascending: false });
      if (expsErr) throw expsErr;
      setExpenses(normalizeProfiles((exps ?? []) as unknown as Expense[]));

      // 5. Gráfico anual
      const { data: ann, error: annErr } = await supabase
        .from('expenses').select('amount, created_at')
        .eq('is_deleted', false)
        .gte('created_at', dates.startY).lte('created_at', dates.endY);
      if (annErr) throw annErr;
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      setAnnualChartData(months.map((m, i) => ({
        name: m,
        total: (ann ?? []).filter((e) => new Date(e.created_at).getMonth() === i).reduce((acc, e) => acc + Number(e.amount), 0),
      })));

      // 6. Sonhos
      const { data: dData, error: dErr } = await supabase
        .from('dreams').select('*').order('created_at', { ascending: false });
      if (dErr) throw dErr;
      setDreams((dData ?? []) as Dream[]);

      // 7. Lazy por aba
      if (activeTab === 'notes') {
        const { data: n, error: notesErr } = await supabase
          .from('notes').select('*').order('created_at', { ascending: false });
        if (notesErr) throw notesErr;
        setNotes((n ?? []) as Note[]);
      }

      if (activeTab === 'reminders') {
        const { data: r, error: remErr } = await supabase
          .from('reminders')
          .select('*, profiles(full_name, avatar_url)')
          .gte('reminder_date', dates.startM.split('T')[0])
          .lte('reminder_date', dates.endM.split('T')[0])
          .order('reminder_date', { ascending: true });
        if (remErr) throw remErr;
        setReminders(normalizeProfiles((r ?? []) as unknown as Reminder[]));
      }

      if (activeTab === 'shopping') {
        const { data: s, error: shopErr } = await supabase
          .from('shopping_list')
          .select('*, profiles(full_name, avatar_url)')
          .order('is_pending', { ascending: false })
          .order('created_at', { ascending: false });
        if (shopErr) throw shopErr;
        setShoppingList(normalizeProfiles((s ?? []) as unknown as ShoppingItem[]));
      }

      if (activeTab === 'logs') {
        const { data: logData, error: logsErr } = await supabase
          .from('logs').select('*, profiles(full_name, avatar_url)')
          .order('created_at', { ascending: false }).limit(100);
        if (logsErr) throw logsErr;
        setLogs(normalizeProfiles((logData ?? []) as unknown as Log[]));
      }

      if (activeTab === 'movies') {
        const { data: wCats, error: wCatsErr } = await supabase
          .from('watchlist_categories').select('*').order('created_at', { ascending: true });
        if (wCatsErr) throw wCatsErr;
        setWatchlistCategories((wCats ?? []) as WatchlistCategory[]);

        const { data: wItems, error: wItemsErr } = await supabase
          .from('watchlist_items').select('*').order('created_at', { ascending: false });
        if (wItemsErr) throw wItemsErr;
        setWatchlistItems((wItems ?? []) as WatchlistItem[]);

        const { data: wRatings, error: wRatingsErr } = await supabase
          .from('watchlist_ratings')
          .select('id, item_id, user_id, rating, profiles(full_name, avatar_url)');
        if (wRatingsErr) throw wRatingsErr;
        const normalized = normalizeProfiles(
          (wRatings ?? []) as unknown as (WatchlistRating & { profiles?: unknown })[]
        ) as unknown as WatchlistRating[];
        setWatchlistRatings(normalized);
      }

      // ✅ Receitas — inclui steps (jsonb), ingredients e profile de quem cadastrou
      if (activeTab === 'recipes') {
        await fetchRecipes();
      }

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar dados';
      console.error('[useDashboardData]', e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [dates, activeTab, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return {
    expenses, prevMonthExpenses, prevMonthTotal,
    categories, shoppingList, reminders, notes, logs,
    annualChartData, userProfile,
    watchlistCategories, watchlistItems, watchlistRatings,
    recipes, dreams, isLoading, error, fetchData, fetchRecipes,
  };
}