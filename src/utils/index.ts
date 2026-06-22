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

// Adiciona N meses a uma data 'YYYY-MM-DD', respeitando o último dia do mês
export const addMonths = (dateStr: string, n: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const lastDay = new Date(y, m - 1 + n + 1, 0).getDate();
  const day = Math.min(d, lastDay);
  const result = new Date(y, m - 1 + n, day);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
};

export const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
export const USER_COLORS  = ['#3b82f6', '#ec4899'];

// ── TMDB ──────────────────────────────────────────────────────────────────────
// Chave da API TMDB — use SEMPRE via import.meta.env.VITE_TMDB_KEY no código.
// Este export é apenas uma referência do valor padrão para desenvolvimento.
// Em produção, garanta que .env ou as variáveis de ambiente do deploy estejam configuradas.
export const TMDB_API_KEY = import.meta.env.VITE_TMDB_KEY as string;