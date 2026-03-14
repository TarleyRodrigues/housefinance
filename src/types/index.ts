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
  user_id: string;
  created_at: string;
  is_deleted: boolean;
  profiles?: Profile;     // sempre objeto — normalizado no useDashboardData
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
}

// ─────────────────────────────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────────────────────────────
export interface ToastState {
  msg: string;
  type: string;
}

export type TabName =
  | 'list'
  | 'add'
  | 'shopping'
  | 'notes'
  | 'reminders'
  | 'stats'
  | 'config'
  | 'logs';

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