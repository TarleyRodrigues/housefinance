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
export const USER_COLORS  = ['#3b82f6', '#ec4899'];

// ── TMDB ──────────────────────────────────────────────────────────────────────
// Chave da API TMDB — use SEMPRE via import.meta.env.VITE_TMDB_KEY no código.
// Este export é apenas uma referência do valor padrão para desenvolvimento.
// Em produção, garanta que .env ou as variáveis de ambiente do deploy estejam configuradas.
export const TMDB_API_KEY = import.meta.env.VITE_TMDB_KEY as string;