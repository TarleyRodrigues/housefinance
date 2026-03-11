// ─── TIPOS GLOBAIS DO APP ────────────────────────────────────────────────────

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
  color: string; // <-- Garanta que esta linha existe
  user_id: string;
  created_at: string;
}

export interface ToastState {
  msg: string;
  type: string;
}

export type TabName = 'list' | 'add' | 'shopping' | 'notes' | 'reminders' | 'stats' | 'config';
