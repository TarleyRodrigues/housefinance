// ─── DESAFIOS DO CASAL — progresso ───────────────────────────────────────────
// Gasto do desafio = soma dos gastos com expense_date dentro do período
// (e da categoria, se houver). Estourar o limite antes do fim já conta como perdido.

import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { Challenge, ChallengeProgress, Expense } from '../types';

export type ChallengeExpense = Pick<Expense, 'amount' | 'category_name' | 'expense_date'>;

export function computeChallengeProgress(
  challenges: Challenge[],
  expenses: ChallengeExpense[],
  now = new Date(),
): ChallengeProgress[] {
  const today = format(now, 'yyyy-MM-dd');
  return challenges.map(c => {
    const spent = expenses
      .filter(e => e.expense_date && e.expense_date >= c.start_date && e.expense_date <= c.end_date
        && (!c.category_name || e.category_name === c.category_name))
      .reduce((a, e) => a + Number(e.amount), 0);
    const limit = Number(c.limit_amount);
    const pct = limit > 0 ? spent / limit : 0;
    const status: ChallengeProgress['status'] =
      spent > limit ? 'lost'
      : today < c.start_date ? 'upcoming'
      : today > c.end_date ? 'won'
      : 'active';
    const daysLeft = status === 'upcoming'
      ? differenceInCalendarDays(parseISO(c.start_date), now)
      : Math.max(0, differenceInCalendarDays(parseISO(c.end_date), now));
    return { ...c, limit_amount: limit, spent, pct, status, daysLeft };
  }).sort((a, b) => {
    const order = { active: 0, upcoming: 1, won: 2, lost: 3 } as const;
    return order[a.status] - order[b.status] || a.end_date.localeCompare(b.end_date);
  });
}

// Sugestões rápidas no formulário
export const CHALLENGE_IDEAS: { emoji: string; title: string; categoryHint: RegExp | null }[] = [
  { emoji: '🍕', title: 'Menos delivery', categoryHint: /delivery|alimenta|comida|lanche/i },
  { emoji: '🛒', title: 'Mercado no limite', categoryHint: /mercado|supermerc/i },
  { emoji: '💸', title: 'Mês econômico', categoryHint: null },
  { emoji: '🎳', title: 'Lazer consciente', categoryHint: /lazer|divers/i },
];

export const CHALLENGE_EMOJIS = ['🏆', '🍕', '🛒', '💸', '🎳', '☕', '🚕', '⚡', '🎯', '🔥', '💪', '🌱'];
