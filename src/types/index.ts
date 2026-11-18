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

// Linha enxuta de gasto usada no histórico mensal (Gráficos › Histórico)
export interface HistoryExpense {
  id: string;
  amount: number;
  category_name: string;
  description?: string;
  merchant?: string | null;
  expense_date?: string;
  payment_month?: string | null;
  created_at: string;
}

// Payload de criação/edição de gasto (TabNovoGasto → Dashboard)
export interface ExpensePayload {
  amount: number;
  category_name: string;
  description: string;
  receipt_url: string | null;
  expense_date: string;
  merchant: string | null;
  payment_month: string | null;
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
  merchant?: string | null;  // estabelecimento — alter table expense_templates add column if not exists merchant text;
  created_at: string;
}

// Payload de criação/edição de gasto padrão
export interface ExpenseTemplatePayload {
  description: string;
  amount: number;
  category_name: string;
  merchant: string | null;
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
  emoji?: string | null;            // emoji personalizado — null = emoji do início do nome / sugestão
  default_merchant?: string | null; // fornecedor padrão (ex: Energia → Enel) — alter table categories add column if not exists default_merchant text;
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

// Payload de criação/edição de nota (TabNotas → Dashboard)
export type NotePayload = Pick<Note, 'title' | 'content' | 'color'> & { is_private: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// Log (trilha de auditoria)
// ─────────────────────────────────────────────────────────────────────────────
export interface Log {
  id: string;
  created_at: string;
  action: string;           // 'INSERT' | 'UPDATE' | 'DELETE'
  item_description?: string;
  details?: string;
  user_id: string;
  profiles?: { full_name?: string; avatar_url?: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Challenge (Desafios do casal) — tabela challenges
// ─────────────────────────────────────────────────────────────────────────────
export interface Challenge {
  id: string;
  title: string;
  emoji: string | null;
  category_name: string | null;   // null = gasto total do período
  limit_amount: number;
  start_date: string;             // yyyy-MM-dd
  end_date: string;               // yyyy-MM-dd
  reward: string | null;
  created_by: string;
  created_at: string;
}

export type ChallengePayload = Pick<Challenge, 'title' | 'emoji' | 'category_name' | 'limit_amount' | 'start_date' | 'end_date' | 'reward'>;

export type ChallengeStatus = 'upcoming' | 'active' | 'won' | 'lost';

export interface ChallengeProgress extends Challenge {
  spent: number;
  pct: number;                    // spent / limit (pode passar de 1)
  status: ChallengeStatus;
  daysLeft: number;               // dias até o fim (ativo) ou até começar (próximo)
}

// Selos / conquistas (calculados no app) — ver utils/badges
export type BadgeExpense = Pick<Expense,
  'id' | 'amount' | 'category_name' | 'expense_date' | 'payment_month' | 'user_id' | 'merchant' | 'description' | 'receipt_url' | 'created_at'>;

export interface Badge {
  id: string;
  emoji: string;
  title: string;
  description: string;
  earned: boolean;
  progress: number;       // 0–1 (1 quando conquistado)
  progressLabel?: string; // ex: "2 de 3 meses"
  tone: 'amber' | 'emerald' | 'blue' | 'violet' | 'rose' | 'orange' | 'cyan';
}

// Sugestão de gasto extraída pela IA (foto da nota ou voz) — ver hooks/useExpenseAI
export interface ExpenseSuggestion {
  amount: number | null;
  merchant: string | null;
  date: string | null;          // yyyy-MM-dd
  description: string | null;
  category: string | null;      // sempre uma categoria existente (ou null)
}

// Web Speech API (não faz parte do lib.dom do TypeScript)
export interface SpeechRecognitionAlternativeLike { transcript: string }
export interface SpeechRecognitionResultLike { isFinal: boolean; 0: SpeechRecognitionAlternativeLike; length: number }
export interface SpeechRecognitionEventLike { resultIndex: number; results: { length: number; [i: number]: SpeechRecognitionResultLike } }
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

// Retrospectiva do mês (stories estilo Wrapped) — ver utils/monthRecap
export interface RecapCategory {
  name: string;
  total: number;
  pct: number;            // % do total do mês
  color?: string;
}

export interface RecapPerson {
  userId: string;
  name: string;
  avatarUrl?: string;
  count: number;
  total: number;
}

export interface MonthRecap {
  monthLabel: string;     // 'Outubro'
  year: number;
  total: number;
  count: number;
  dailyAvg: number;
  prevTotal: number;
  diffPct: number | null; // vs mês anterior (null se não houver base)
  topCategories: RecapCategory[];
  priciestDay: { date: string; total: number; count: number; topDescription: string } | null;
  topMerchant: { name: string; count: number; total: number } | null;
  people: RecapPerson[];
  biggest: { description: string; amount: number; category: string; date: string } | null;
  goals: { within: number; total: number } | null;
  weekendPct: number;     // % do valor gasto em sábados/domingos
}

// Celebração (confete + cartão) — ver components/Celebration
export interface CelebrationData {
  id: number;
  emoji: string;
  title: string;
  message?: string;
}

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
// StudentCard (Carteirinha Estudantil — modelo demonstrativo)
// Tabela: student_cards (1 linha por usuário, PK = user_id)
// Campos nulos caem no padrão do perfil (nome/foto) ou ficam em branco.
// ─────────────────────────────────────────────────────────────────────────────
export type EducationLevel = 'Ensino Superior' | 'Pós-graduação' | 'Ensino Técnico' | 'Ensino Médio';

export interface StudentCard {
  user_id: string;
  full_name: string | null;       // null = usa profiles.full_name
  photo_url: string | null;       // null = usa profiles.avatar_url
  cpf: string | null;
  birth_date: string | null;      // yyyy-MM-dd
  institution: string | null;
  course: string | null;
  education_level: EducationLevel | null;
  usage_code: string | null;      // null = código gerado a partir do user_id
  valid_until: string | null;     // yyyy-MM-dd — null = 31/03 do ano seguinte
  show_demo_badge: boolean | null; // null = mostra o selo "Modelo demonstrativo"
  updated_at: string;
}

export type StudentCardPayload = Omit<StudentCard, 'user_id' | 'updated_at'>;

// Dados já resolvidos (perfil + carteirinha + padrões) prontos para renderizar
export interface StudentCardView {
  fullName: string;
  photoUrl: string | null;
  cpf: string;
  birthDate: string;              // yyyy-MM-dd ou ''
  institution: string;
  course: string;
  educationLevel: EducationLevel;
  usageCode: string;
  validUntil: string;             // yyyy-MM-dd
  issuedAt: string;               // ISO — última atualização (ou hoje)
  showDemoBadge: boolean;
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