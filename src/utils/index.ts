// ─── UTILITÁRIOS GERAIS ───────────────────────────────────────────────────────

export const formatCurrency = (v: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export const handleCurrencyInput = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  const result = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(
    parseFloat(digits) / 100
  );
  return result === 'NaN' ? '' : result;
};

export const parseAmount = (value: string): number =>
  parseFloat(value.replace(/\./g, '').replace(',', '.'));

export const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
export const USER_COLORS = ['#3b82f6', '#ec4899'];
