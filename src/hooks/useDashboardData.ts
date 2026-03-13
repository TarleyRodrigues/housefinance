// ─── HOOK PRINCIPAL DE DADOS ─────────────────────────────────────────────────
// Melhorias aplicadas:
// ✅ fetchData estabilizado com useCallback (performance — sem re-renders desnecessários)
// ✅ categories busca color — select explícito com todos os campos necessários
// ✅ prevMonthExpenses tipado corretamente — sem `as any`
// ✅ logs tipado com interface Log — zero `any`
// ✅ logs buscados apenas na aba 'logs' (lazy, como shopping/notes/reminders)
// ✅ Tratamento de erro com estado exposto — componentes podem reagir a falhas
// ✅ Datas de mês encapsuladas em useMemo — recalcular só quando currentDate muda

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import type { Expense, Category, ShoppingItem, Reminder, Note, Profile } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos locais
// ─────────────────────────────────────────────────────────────────────────────
export interface Log {
  id: string;
  created_at: string;
  action: string;
  details?: string;
  user_id: string;
  profiles?: {
    full_name?: string;
    avatar_url?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: normaliza o campo `profiles` que o Supabase retorna como array
// quando se usa `.select('*, profiles(...)')` com foreign key
// ─────────────────────────────────────────────────────────────────────────────
function normalizeProfiles<T extends { profiles?: unknown }>(rows: T[]): T[] {
  return rows.map((row) => ({
    ...row,
    profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? undefined : row.profiles,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────
export function useDashboardData(currentDate: Date, activeTab: string) {
  const { user } = useAuth();

  const [expenses, setExpenses]                   = useState<Expense[]>([]);
  const [prevMonthExpenses, setPrevMonthExpenses]  = useState<Expense[]>([]);
  const [prevMonthTotal, setPrevMonthTotal]        = useState(0);
  const [categories, setCategories]               = useState<Category[]>([]);
  const [shoppingList, setShoppingList]           = useState<ShoppingItem[]>([]);
  const [reminders, setReminders]                 = useState<Reminder[]>([]);
  const [notes, setNotes]                         = useState<Note[]>([]);
  const [logs, setLogs]                           = useState<Log[]>([]);
  const [annualChartData, setAnnualChartData]     = useState<{ name: string; total: number }[]>([]);
  const [userProfile, setUserProfile]             = useState<Profile | null>(null);
  const [isLoading, setIsLoading]                 = useState(true);
  const [error, setError]                         = useState<string | null>(null);

  // ── Datas pré-calculadas — recalcula só quando currentDate muda ────────────
  const dates = useMemo(() => {
    const startM    = startOfMonth(currentDate).toISOString();
    const endM      = endOfMonth(currentDate).toISOString();
    const startPrev = startOfMonth(subMonths(currentDate, 1)).toISOString();
    const endPrev   = endOfMonth(subMonths(currentDate, 1)).toISOString();
    const startY    = new Date(currentDate.getFullYear(), 0, 1).toISOString();
    const endY      = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59).toISOString();
    return { startM, endM, startPrev, endPrev, startY, endY };
  }, [currentDate]);

  // ── fetchData estabilizado com useCallback ─────────────────────────────────
  // Dependências explícitas: dates (encapsula currentDate) + activeTab + user
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // ── 1. Categorias — select explícito com color ───────────────────────
      // ⚠️  Requer: alter table categories add column if not exists color text;
      const { data: cats, error: catsErr } = await supabase
        .from('categories')
        .select('id, name, monthly_goal, color')
        .order('name');
      if (catsErr) throw catsErr;
      if (cats) setCategories(cats as Category[]);

      // ── 2. Perfil do usuário ─────────────────────────────────────────────
      if (user) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', user.id)
          .single();
        if (profileErr && profileErr.code !== 'PGRST116') throw profileErr;
        if (profile) setUserProfile(profile as Profile);
      }

      // ── 3. Gastos do mês anterior ────────────────────────────────────────
      const { data: prevExps, error: prevErr } = await supabase
        .from('expenses')
        .select('id, amount, category_name, user_id, created_at, is_deleted, profiles(full_name, avatar_url)')
        .eq('is_deleted', false)
        .gte('created_at', dates.startPrev)
        .lte('created_at', dates.endPrev);
      if (prevErr) throw prevErr;
      const pExps = normalizeProfiles((prevExps ?? []) as unknown as Expense[]);
      setPrevMonthExpenses(pExps);
      setPrevMonthTotal(pExps.reduce((acc, e) => acc + Number(e.amount), 0));

      // ── 4. Gastos do mês atual ───────────────────────────────────────────
      const { data: exps, error: expsErr } = await supabase
        .from('expenses')
        .select('*, profiles(full_name, avatar_url)')
        .eq('is_deleted', false)
        .gte('created_at', dates.startM)
        .lte('created_at', dates.endM)
        .order('created_at', { ascending: false });
      if (expsErr) throw expsErr;
      setExpenses(normalizeProfiles((exps ?? []) as unknown as Expense[]));

      // ── 5. Gráfico anual ─────────────────────────────────────────────────
      const { data: ann, error: annErr } = await supabase
        .from('expenses')
        .select('amount, created_at')
        .eq('is_deleted', false)
        .gte('created_at', dates.startY)
        .lte('created_at', dates.endY);
      if (annErr) throw annErr;

      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      setAnnualChartData(
        months.map((m, i) => ({
          name: m,
          total: (ann ?? [])
            .filter((e) => new Date(e.created_at).getMonth() === i)
            .reduce((acc, e) => acc + Number(e.amount), 0),
        }))
      );

      // ── 6. Queries lazy — só na aba correspondente ───────────────────────

      if (activeTab === 'notes') {
        const { data: n, error: notesErr } = await supabase
          .from('notes')
          .select('*')
          .order('created_at', { ascending: false });
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

      // ✅ Logs lazy — só na aba 'logs' (era sempre, agora economiza 1 query)
      if (activeTab === 'logs') {
        const { data: logData, error: logsErr } = await supabase
          .from('logs')
          .select('*, profiles(full_name, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(100);
        if (logsErr) throw logsErr;
        setLogs(normalizeProfiles((logData ?? []) as unknown as Log[]));
      }

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar dados';
      console.error('[useDashboardData]', e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [dates, activeTab, user]);

  // ── Dispara fetchData quando dependências mudam ────────────────────────────
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
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
    error,      // ✅ NOVO — exposto para componentes exibirem erros se necessário
    fetchData,
  };
}