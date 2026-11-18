// ─── RETROSPECTIVA DO MÊS — cálculo dos destaques ────────────────────────────
// Função pura: recebe os gastos do mês (já filtrados pelo mês efetivo) e os do
// mês anterior, e devolve os números exibidos nos stories.

import { endOfMonth, format, getDay, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Category, Expense, MonthRecap, RecapPerson } from '../types';

const dayOf = (e: Pick<Expense, 'expense_date' | 'created_at'>) =>
  e.expense_date ?? e.created_at.slice(0, 10);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function computeMonthRecap(
  expenses: Expense[],
  prevExpenses: Pick<Expense, 'amount'>[],
  categories: Category[],
  month: Date,
): MonthRecap {
  const total = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const prevTotal = prevExpenses.reduce((a, e) => a + Number(e.amount), 0);

  // Média diária: mês inteiro se já acabou; senão, dias decorridos
  const today = new Date();
  const days = isSameMonth(month, today) ? today.getDate() : endOfMonth(month).getDate();

  // Categorias
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category_name, (byCat.get(e.category_name) ?? 0) + Number(e.amount));
  const colorOf = new Map(categories.map(c => [c.name, c.color]));
  const topCategories = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, t]) => ({ name, total: t, pct: total > 0 ? (t / total) * 100 : 0, color: colorOf.get(name) }));

  // Dia mais caro
  const byDay = new Map<string, Expense[]>();
  for (const e of expenses) {
    const d = dayOf(e);
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  let priciestDay: MonthRecap['priciestDay'] = null;
  for (const [date, list] of byDay) {
    const t = list.reduce((a, e) => a + Number(e.amount), 0);
    if (!priciestDay || t > priciestDay.total) {
      const top = [...list].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
      priciestDay = { date, total: t, count: list.length, topDescription: top.description || top.category_name };
    }
  }

  // Estabelecimento favorito (mais vezes; desempate pelo valor)
  const byMerchant = new Map<string, { name: string; count: number; total: number }>();
  for (const e of expenses) {
    const name = e.merchant?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const cur = byMerchant.get(key) ?? { name, count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(e.amount);
    byMerchant.set(key, cur);
  }
  const topMerchant = [...byMerchant.values()].sort((a, b) => b.count - a.count || b.total - a.total)[0] ?? null;

  // Quem lançou mais
  const byUser = new Map<string, RecapPerson>();
  for (const e of expenses) {
    const cur = byUser.get(e.user_id) ?? {
      userId: e.user_id,
      name: e.profiles?.full_name?.split(' ')[0] || 'Alguém',
      avatarUrl: e.profiles?.avatar_url,
      count: 0, total: 0,
    };
    cur.count += 1;
    cur.total += Number(e.amount);
    byUser.set(e.user_id, cur);
  }
  const people = [...byUser.values()].sort((a, b) => b.count - a.count);

  // Maior gasto único
  const big = [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  const biggest = big
    ? { description: big.description || 'Sem descrição', amount: Number(big.amount), category: big.category_name, date: dayOf(big) }
    : null;

  // Metas: quantas categorias com meta ficaram dentro
  const withGoal = categories.filter(c => (c.monthly_goal ?? 0) > 0 && c.is_active !== false);
  const goals = withGoal.length
    ? { within: withGoal.filter(c => (byCat.get(c.name) ?? 0) <= (c.monthly_goal ?? 0)).length, total: withGoal.length }
    : null;

  // Fim de semana
  const weekend = expenses
    .filter(e => { const d = getDay(parseISO(dayOf(e))); return d === 0 || d === 6; })
    .reduce((a, e) => a + Number(e.amount), 0);

  return {
    monthLabel: capitalize(format(month, 'MMMM', { locale: ptBR })),
    year: month.getFullYear(),
    total,
    count: expenses.length,
    dailyAvg: days > 0 ? total / days : 0,
    prevTotal,
    diffPct: prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null,
    topCategories,
    priciestDay,
    topMerchant,
    people,
    biggest,
    goals,
    weekendPct: total > 0 ? (weekend / total) * 100 : 0,
  };
}

// 'yyyy-MM-dd' → 'sábado, 12 de outubro'
export const formatRecapDay = (iso: string) =>
  format(parseISO(iso), "EEEE, d 'de' MMMM", { locale: ptBR });
