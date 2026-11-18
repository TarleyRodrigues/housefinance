// ─── SELOS / CONQUISTAS ──────────────────────────────────────────────────────
// Calculados a partir dos gastos dos últimos 12 meses (mês efetivo =
// payment_month ou mês de expense_date). As metas usadas são as atuais.

import { format, subDays, subMonths } from 'date-fns';
import type { Badge, BadgeExpense, Category } from '../types';

const monthOf = (e: BadgeExpense) => e.payment_month ?? (e.expense_date ?? e.created_at).slice(0, 7);
const dayOf = (e: BadgeExpense) => (e.expense_date ?? e.created_at).slice(0, 10);
// Dia em que o gasto foi LANÇADO no app (hábito), em horário local
const launchDay = (e: BadgeExpense) => format(new Date(e.created_at), 'yyyy-MM-dd');

const DELIVERY = /ifood|i-food|rappi|delivery|uber ?eats|z[eé] delivery|aiqfome|99 ?food|james/i;
const isDelivery = (e: BadgeExpense) =>
  DELIVERY.test(e.merchant ?? '') || DELIVERY.test(e.description ?? '') || /delivery/i.test(e.category_name);

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function computeBadges(rows: BadgeExpense[], categories: Category[], now = new Date()): Badge[] {
  const thisMonth = format(now, 'yyyy-MM');
  const lastMonth = format(subMonths(now, 1), 'yyyy-MM');
  const prevMonth = format(subMonths(now, 2), 'yyyy-MM');

  // Totais por mês e por mês+categoria
  const monthTotal = new Map<string, number>();
  const monthCat = new Map<string, Map<string, number>>();
  for (const e of rows) {
    const m = monthOf(e);
    const v = Number(e.amount);
    monthTotal.set(m, (monthTotal.get(m) ?? 0) + v);
    const cats = monthCat.get(m) ?? new Map<string, number>();
    cats.set(e.category_name, (cats.get(e.category_name) ?? 0) + v);
    monthCat.set(m, cats);
  }

  const goals = categories.filter(c => (c.monthly_goal ?? 0) > 0 && c.is_active !== false);
  const goalSum = goals.reduce((a, c) => a + (c.monthly_goal ?? 0), 0);
  const withinGoals = (m: string) => {
    const cats = monthCat.get(m);
    if (!cats || goals.length === 0) return false;
    return goals.every(c => (cats.get(c.name) ?? 0) <= (c.monthly_goal ?? 0));
  };

  // Sequência de meses fechados (a partir do mês passado) dentro das metas
  let streak = 0;
  for (let i = 1; i <= 12; i++) {
    const m = format(subMonths(now, i), 'yyyy-MM');
    if (!monthTotal.has(m) || !withinGoals(m)) break;
    streak++;
  }

  // Delivery: dias desde o último
  const deliveryDays = rows.filter(isDelivery).map(dayOf).sort();
  const lastDelivery = deliveryDays[deliveryDays.length - 1];
  const daysSinceDelivery = lastDelivery
    ? Math.floor((now.getTime() - new Date(`${lastDelivery}T12:00:00`).getTime()) / 86_400_000)
    : null;
  const hasDeliveryHistory = deliveryDays.length > 0;

  // Mês atual (mês efetivo): comprovantes e lugar favorito
  const current = rows.filter(e => monthOf(e) === thisMonth);
  const withReceipt = current.filter(e => !!e.receipt_url).length;
  // Hábito (pelo dia do lançamento): dias distintos lançando e quem lançou
  const launchedThisMonth = rows.filter(e => launchDay(e).startsWith(thisMonth));
  const daysWithEntry = new Set(launchedThisMonth.map(launchDay)).size;
  const perUser = new Map<string, number>();
  for (const e of launchedThisMonth) perUser.set(e.user_id, (perUser.get(e.user_id) ?? 0) + 1);
  const users = [...perUser.values()].sort((a, b) => b - a);
  const merchantCount = new Map<string, number>();
  for (const e of current) {
    const k = e.merchant?.trim().toLowerCase();
    if (k) merchantCount.set(k, (merchantCount.get(k) ?? 0) + 1);
  }
  const topMerchantVisits = Math.max(0, ...merchantCount.values());

  // Últimos 7 dias: algum gasto lançado?
  const weekStart = format(subDays(now, 6), 'yyyy-MM-dd');
  const lastTotal = monthTotal.get(lastMonth) ?? 0;
  const prevTotal = monthTotal.get(prevMonth) ?? 0;

  const badges: Badge[] = [];

  badges.push({
    id: `goals-${lastMonth}`, emoji: '🎯', tone: 'emerald',
    title: 'Mês na meta',
    description: 'Fechar o mês sem estourar nenhuma meta de categoria.',
    earned: withinGoals(lastMonth),
    progress: withinGoals(lastMonth) ? 1 : 0,
    progressLabel: goals.length === 0 ? 'Defina metas em Ajustes' : withinGoals(lastMonth) ? 'Mês passado gabaritado!' : 'Mês passado escapou',
  });

  for (const n of [2, 3, 6]) {
    badges.push({
      id: `streak-${n}`, emoji: n >= 6 ? '👑' : '🔥', tone: n >= 6 ? 'amber' : 'orange',
      title: `${n} meses na meta`,
      description: `${n} meses seguidos sem estourar nenhuma meta.`,
      earned: streak >= n,
      progress: clamp01(streak / n),
      progressLabel: `${Math.min(streak, n)} de ${n} meses`,
    });
  }

  if (hasDeliveryHistory) {
    const d = daysSinceDelivery ?? 0;
    badges.push({
      id: 'no-delivery-7', emoji: '🥗', tone: 'emerald',
      title: 'Semana sem delivery',
      description: '7 dias seguidos sem pedir comida por app.',
      earned: d >= 7,
      progress: clamp01(d / 7),
      progressLabel: d >= 7 ? `${d} dias sem delivery` : `${d} de 7 dias`,
    });
  }

  if (lastTotal > 0 && prevTotal > 0) {
    const saved = lastTotal < prevTotal;
    badges.push({
      id: `saver-${lastMonth}`, emoji: '📉', tone: 'cyan',
      title: 'Economizou',
      description: 'Gastar menos no mês passado do que no anterior.',
      earned: saved,
      progress: saved ? 1 : clamp01(prevTotal / lastTotal),
      progressLabel: saved ? `${(((prevTotal - lastTotal) / prevTotal) * 100).toFixed(0)}% a menos` : 'Mês passado foi maior',
    });
  }

  if (goalSum > 0 && lastTotal > 0) {
    const ok = lastTotal <= goalSum * 0.9;
    badges.push({
      id: `calm-${lastMonth}`, emoji: '🌱', tone: 'emerald',
      title: 'Mês tranquilo',
      description: 'Gastar até 90% da soma das metas no mês.',
      earned: ok,
      progress: ok ? 1 : clamp01((goalSum * 0.9) / lastTotal),
      progressLabel: `${((lastTotal / goalSum) * 100).toFixed(0)}% das metas`,
    });
  }

  badges.push({
    id: 'duo', emoji: '🤝', tone: 'violet',
    title: 'Dupla dinâmica',
    description: 'Os dois lançam pelo menos 10 gastos no mês.',
    earned: users.length >= 2 && users[1] >= 10,
    progress: users.length >= 2 ? clamp01(users[1] / 10) : 0,
    progressLabel: users.length >= 2 ? `${Math.min(users[1], 10)} de 10 (quem lançou menos)` : 'Falta o(a) parceiro(a) lançar',
  });

  badges.push({
    id: 'diligent', emoji: '✍️', tone: 'blue',
    title: 'Sempre em dia',
    description: 'Lançar gastos em 15 dias diferentes no mês.',
    earned: daysWithEntry >= 15,
    progress: clamp01(daysWithEntry / 15),
    progressLabel: `${Math.min(daysWithEntry, 15)} de 15 dias`,
  });

  if (current.length >= 5) {
    const pct = withReceipt / current.length;
    badges.push({
      id: 'receipts', emoji: '🧾', tone: 'blue',
      title: 'Comprovante em dia',
      description: '80% dos gastos do mês com comprovante anexado.',
      earned: pct >= 0.8,
      progress: clamp01(pct / 0.8),
      progressLabel: `${(pct * 100).toFixed(0)}% com comprovante`,
    });
  }

  badges.push({
    id: 'regular', emoji: '🏪', tone: 'rose',
    title: 'Cliente VIP',
    description: 'Ir 10 vezes ao mesmo estabelecimento no mês.',
    earned: topMerchantVisits >= 10,
    progress: clamp01(topMerchantVisits / 10),
    progressLabel: `${Math.min(topMerchantVisits, 10)} de 10 visitas`,
  });

  for (const n of [100, 500]) {
    badges.push({
      id: `count-${n}`, emoji: n === 100 ? '💯' : '🏆', tone: n === 100 ? 'violet' : 'amber',
      title: `${n} lançamentos`,
      description: `${n} gastos lançados nos últimos 12 meses.`,
      earned: rows.length >= n,
      progress: clamp01(rows.length / n),
      progressLabel: `${Math.min(rows.length, n)} de ${n}`,
    });
  }

  // Ativo na semana (ajuda a puxar o hábito)
  const weekEntries = rows.filter(e => launchDay(e) >= weekStart).length;
  badges.push({
    id: 'week-active', emoji: '⚡', tone: 'amber',
    title: 'Semana ativa',
    description: 'Lançar 7 gastos ou mais nos últimos 7 dias.',
    earned: weekEntries >= 7,
    progress: clamp01(weekEntries / 7),
    progressLabel: `${Math.min(weekEntries, 7)} de 7 nesta semana`,
  });

  // Conquistados primeiro; depois os mais próximos de conquistar
  return badges.sort((a, b) => Number(b.earned) - Number(a.earned) || b.progress - a.progress);
}
