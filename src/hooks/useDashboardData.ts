// ─── HOOK PRINCIPAL DE DADOS ─────────────────────────────────────────────────
// Responsável por buscar todos os dados do Supabase

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import type { Expense, Category, ShoppingItem, Reminder, Note, Profile } from '../types';

export function useDashboardData(currentDate: Date, activeTab: string) {
  const { user } = useAuth();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [prevMonthExpenses, setPrevMonthExpenses] = useState<Expense[]>([]); // NOVO: Para comparativo de categorias
  const [prevMonthTotal, setPrevMonthTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [annualChartData, setAnnualChartData] = useState<{ name: string; total: number }[]>([]);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [currentDate, activeTab]);

  async function fetchData() {
    setIsLoading(true);
    try {
      // 1. Buscar Categorias
      const { data: cats } = await supabase.from('categories').select('*').order('name');
      if (cats) setCategories(cats);

      // 2. Buscar Perfil do Usuário
      if (user) {
        const { data: p } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (p) setUserProfile(p);
      }

      // Configuração de Datas (Mês Atual e Anterior)
      const startM = startOfMonth(currentDate).toISOString();
      const endM = endOfMonth(currentDate).toISOString();
      const startPrev = startOfMonth(subMonths(currentDate, 1)).toISOString();
      const endPrev = endOfMonth(subMonths(currentDate, 1)).toISOString();

      // 3. Buscar Dados do Mês ANTERIOR (Completo para o comparativo de categorias)
      const { data: prevExps } = await supabase
        .from('expenses')
        .select('amount, category_name')
        .eq('is_deleted', false)
        .gte('created_at', startPrev)
        .lte('created_at', endPrev);
      
      const pExps = prevExps || [];
      setPrevMonthExpenses(pExps as any);
      setPrevMonthTotal(pExps.reduce((acc, curr) => acc + Number(curr.amount), 0));

      // 4. Buscar Anotações (Se a aba estiver ativa)
      if (activeTab === 'notes') {
        const { data: n } = await supabase.from('notes').select('*').order('created_at', { ascending: false });
        setNotes(n || []);
      }

      // 5. Buscar Lembretes (Se a aba estiver ativa)
      if (activeTab === 'reminders') {
        const { data: r } = await supabase
          .from('reminders')
          .select('*, profiles(full_name, avatar_url)')
          .gte('reminder_date', startM.split('T')[0])
          .lte('reminder_date', endM.split('T')[0])
          .order('reminder_date', { ascending: true });
        setReminders(r || []);
      }

      // 6. Buscar Lista de Compras (Se a aba estiver ativa)
      if (activeTab === 'shopping') {
        const { data: s } = await supabase
          .from('shopping_list')
          .select('*, profiles(full_name, avatar_url)')
          .order('is_pending', { ascending: false })
          .order('created_at', { ascending: false });
        setShoppingList(s || []);
      }

      // 7. Buscar Gastos do Mês Atual
      const { data: exps } = await supabase
        .from('expenses')
        .select('*, profiles(full_name, avatar_url)')
        .eq('is_deleted', false)
        .gte('created_at', startM)
        .lte('created_at', endM)
        .order('created_at', { ascending: false });
      setExpenses(exps || []);

      // 8. Gráfico anual (Busca otimizada do ano inteiro)
      const startY = new Date(currentDate.getFullYear(), 0, 1).toISOString();
      const endY = new Date(currentDate.getFullYear(), 11, 31).toISOString();
      const { data: ann } = await supabase
        .from('expenses')
        .select('amount, created_at')
        .eq('is_deleted', false)
        .gte('created_at', startY)
        .lte('created_at', endY);

      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      setAnnualChartData(
        months.map((m, i) => ({
          name: m,
          total: (ann || [])
            .filter((e) => new Date(e.created_at).getMonth() === i)
            .reduce((acc, curr) => acc + Number(curr.amount), 0),
        }))
      );
    } catch (e) {
      console.error("Erro no hook useDashboardData:", e);
    } finally {
      setIsLoading(false);
    }
  }

  return {
    expenses, 
    prevMonthExpenses, // Agora retornado para uso na TabGraficos
    prevMonthTotal, 
    categories, 
    shoppingList,
    reminders, 
    notes, 
    annualChartData, 
    userProfile, 
    isLoading,
    fetchData,
  };
}