// ─── TIPOS GLOBAIS DO APP ────────────────────────────────────────────────────
// src/types/index.ts
// ✅ ShoppingItem: adicionados quantity e estimated_price
// ✅ Todos os outros tipos preservados intactos

export interface Expense {
  id: string;
  amount: number;
  category_name: string;
  description: string;
  receipt_url?: string;
  user_id: string;
  created_at: string;
  is_deleted: boolean;
  profiles?: Profile;
}

export interface Category {
  id: string;
  name: string;
  monthly_goal?: number;
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  email?: string;
}

export interface ShoppingItem {
  id: string;
  item_name: string;
  is_pending: boolean;
  user_id: string;
  created_at: string;
  quantity?: number;        // ✅ NOVO — coluna adicionada via SQL no Supabase
  estimated_price?: number; // ✅ NOVO — coluna adicionada via SQL no Supabase
  profiles?: Profile;
}

export interface Reminder {
  id: string;
  text: string;
  reminder_date: string;
  reminder_time?: string;
  user_id: string;
  profiles?: Profile;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  user_id: string;
  created_at: string;
}

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
// ⚠️  LEMBRETE: rodar no SQL Editor do Supabase se ainda não fez:
//
//   alter table shopping_list
//     add column if not exists quantity int default 1;
//
//   alter table shopping_list
//     add column if not exists estimated_price numeric;
//
// ─────────────────────────────────────────────────────────────────────────────