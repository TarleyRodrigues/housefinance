// ─── TIPOS GLOBAIS DO APP ────────────────────────────────────────────────────
// src/types/index.ts
// ✅ profiles? sempre Profile (objeto único) — normalização feita no useDashboardData
// ✅ description? — opcional para queries parciais
// ✅ Category: color
// ✅ ShoppingItem: quantity e estimated_price

// ─────────────────────────────────────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Expense
// ─────────────────────────────────────────────────────────────────────────────
export interface Expense {
  id: string;
  amount: number;
  category_name: string;
  description?: string;   // opcional — queries parciais podem omitir
  receipt_url?: string;
  merchant?: string;      // estabelecimento onde foi feita a compra
  payment_month?: string; // 'yyyy-MM' — mês da fatura do crédito (null = débito/pix)
  user_id: string;
  created_at: string;
  expense_date?: string;  // yyyy-MM-dd — data do gasto (pode ser retroativa)
  is_deleted: boolean;
  profiles?: Profile;     // sempre objeto — normalizado no useDashboardData
}

// ─────────────────────────────────────────────────────────────────────────────
// ExpenseTemplate (Gastos Padrão)
// ─────────────────────────────────────────────────────────────────────────────
export interface ExpenseTemplate {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  category_name: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Category
// ─────────────────────────────────────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  monthly_goal?: number;
  color?: string;
  is_active: boolean;
  type?: 'couple' | 'individual';       
}

// ─────────────────────────────────────────────────────────────────────────────
// ShoppingItem
// ─────────────────────────────────────────────────────────────────────────────
export interface ShoppingItem {
  id: string;
  item_name: string;
  is_pending: boolean;
  user_id: string;
  created_at: string;
  quantity?: number;        // alter table shopping_list add column if not exists quantity int default 1;
  estimated_price?: number; // alter table shopping_list add column if not exists estimated_price numeric;
  category?: string;        // setor do mercado — herdado do catálogo
  unit?: string;            // alter table shopping_list add column if not exists unit text default 'un';
  volume_ml?: number;       // alter table shopping_list add column if not exists volume_ml integer; (ml por unidade — itens líquidos)
  weight_g?: number;        // alter table shopping_list add column if not exists weight_g integer; (gramas desejadas — itens por peso)
  profiles?: Profile;       // sempre objeto — normalizado no useDashboardData
}

// ─────────────────────────────────────────────────────────────────────────────
// Reminder
// ─────────────────────────────────────────────────────────────────────────────
export interface Reminder {
  id: string;
  text: string;
  reminder_date: string;
  reminder_time?: string;
  user_id: string;
  profiles?: Profile;     // sempre objeto — normalizado no useDashboardData
}

// ─────────────────────────────────────────────────────────────────────────────
// Note
// ─────────────────────────────────────────────────────────────────────────────
export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  user_id: string;
  created_at: string;
  is_private?: boolean;
  profiles?: Profile;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────────────────────────────
export interface ToastState {
  msg: string;
  type: string;
}

export type TabName =
  | 'home'
  | 'list'
  | 'add'
  | 'shopping'
  | 'notes'
  | 'reminders'
  | 'stats'
  | 'config'
  | 'logs'
  | 'recurrent';

// ─────────────────────────────────────────────────────────────────────────────
// RecurringExpense (Gastos Fixos / Assinaturas)
// ─────────────────────────────────────────────────────────────────────────────
export interface RecurringExpense {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  category_name: string;
  day_of_month: number;
  is_active: boolean;
  created_at: string;
  plan_type?: 'subscription' | 'installment';
  total_installments?: number;
  first_payment_date?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Watchlist (Filmes & Séries)
// ─────────────────────────────────────────────────────────────────────────────
export type WatchStatus = 'want' | 'watching' | 'watched';

export interface WatchlistCategory {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export interface WatchlistItem {
  id: string;
  category_id: string;
  user_id: string;
  tmdb_id: number;
  title: string;
  poster_url: string | null;
  synopsis: string | null;
  year: string | null;
  media_type: 'movie' | 'tv';
  status: WatchStatus;
  created_at: string;
}


// ─────────────────────────────────────────────────────────────────────────────
// AIAnalysis (Análises Gemini persistidas)
// ─────────────────────────────────────────────────────────────────────────────
export interface AIAnalysis {
  id: string;
  user_id: string;
  month: string;         // 'yyyy-MM'
  month_display: string; // 'junho 2025'
  content: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ShoppingHistoryItem (Histórico de compras)
// ─────────────────────────────────────────────────────────────────────────────
export interface ShoppingHistoryItem {
  id: string;
  user_id: string;
  item_name: string;
  price?: number;
  category?: string;
  unit?: string;
  volume_ml?: number;
  weight_g?: number;
  quantity?: number;
  purchased_at: string; // ISO timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// NotificationEmail (E-mails para receber lembretes)
// ─────────────────────────────────────────────────────────────────────────────
export interface NotificationEmail {
  id: string;
  email: string;
  label?: string;
  is_active: boolean;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ShoppingCategory (Categorias gerenciadas em Ajustes)
// ─────────────────────────────────────────────────────────────────────────────
export interface ShoppingCategory {
  id: string;
  name: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ShoppingCatalogItem (Catálogo de preços de compras)
// ─────────────────────────────────────────────────────────────────────────────
export interface CatalogPricePoint {
  price: number;
  date: string; // ISO timestamp
}

export interface ShoppingCatalogItem {
  id: string;
  name: string;
  package_qty: number;    // qtd de unidades no pacote (ex: 12 rolos)
  package_unit: string;   // unidade do item (ex: "rolo", "un", "kg")
  last_price: number;     // preço do pacote inteiro (ex: R$16,00)
  category?: string;      // setor do mercado (ex: "Limpeza", "Hortifruti")
  updated_at: string;
  price_history?: CatalogPricePoint[]; // alter table shopping_catalog add column if not exists price_history jsonb default '[]'::jsonb;
}

// ─────────────────────────────────────────────────────────────────────────────
// Merchant (Estabelecimentos cadastrados)
// ─────────────────────────────────────────────────────────────────────────────
export interface Merchant {
  id: string;
  name: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dream (Sonhos & Objetivos)
// ─────────────────────────────────────────────────────────────────────────────
export interface Dream {
  id: string;
  user_id: string;
  title: string;
  target_value: number;
  image_url: string | null;
  category_id: string;    // FK para categories — criada junto com o sonho
  is_completed: boolean;
  created_at: string;
}