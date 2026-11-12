// ─── CARTEIRINHA ESTUDANTIL — helpers ─────────────────────────────────────────
// Padrões, máscaras e formatação da carteirinha (modelo demonstrativo).

import type { EducationLevel, Profile, StudentCard, StudentCardView } from '../types';

export const EDUCATION_LEVELS: EducationLevel[] = [
  'Ensino Superior', 'Pós-graduação', 'Ensino Técnico', 'Ensino Médio',
];

// Hash FNV-1a 32 bits — determinístico, usado para gerar código/QR fictícios
export const hashString = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

// PRNG mulberry32 — sequência pseudoaleatória reproduzível a partir de uma seed
export const seededRandom = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I/L

const toCode = (seed: number, len: number): string => {
  const rnd = seededRandom(seed);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[Math.floor(rnd() * CODE_ALPHABET.length)];
  return out;
};

const formatCode = (raw: string) => `${raw.slice(0, 3)}-${raw.slice(3)}`;

// Código estável por usuário (enquanto não houver um salvo)
export const defaultUsageCode = (userId: string): string =>
  formatCode(toCode(hashString(userId), 7));

// Código novo aleatório (botão "gerar")
export const randomUsageCode = (): string =>
  formatCode(toCode(Math.floor(Math.random() * 2 ** 32), 7));

// Validade padrão: 31/03 do ano seguinte (ciclo usual das carteirinhas)
export const defaultValidUntil = (today = new Date()): string => `${today.getFullYear() + 1}-03-31`;

// Ano de referência impresso na carteirinha: validade até junho → ano anterior
export const cardYear = (validUntil: string): number => {
  const [y, m] = validUntil.split('-').map(Number);
  return m <= 6 ? y - 1 : y;
};

export const maskCpf = (value: string): string => {
  const d = value.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

// 'yyyy-MM-dd' → 'dd/MM/yyyy' (sem passar por Date para não sofrer com fuso)
export const formatDateBR = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

// 'yyyy-MM-dd' → 'Março 2027'
export const formatMonthYear = (iso: string): string => {
  const [y, m] = iso.split('-').map(Number);
  if (!y || !m) return '';
  const month = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${y}`;
};

// Junta carteirinha salva + perfil + padrões em dados prontos para exibir
export const resolveStudentCard = (
  card: StudentCard | null,
  profile: Profile | null,
  userId: string,
): StudentCardView => ({
  fullName:       card?.full_name?.trim() || profile?.full_name || 'Nome do Estudante',
  photoUrl:       card?.photo_url || profile?.avatar_url || null,
  cpf:            card?.cpf ?? '',
  birthDate:      card?.birth_date ?? '',
  institution:    card?.institution ?? '',
  course:         card?.course ?? '',
  educationLevel: card?.education_level ?? 'Ensino Superior',
  usageCode:      card?.usage_code?.trim() || defaultUsageCode(userId),
  validUntil:     card?.valid_until || defaultValidUntil(),
  issuedAt:       card?.updated_at ?? new Date().toISOString(),
  showDemoBadge:  card?.show_demo_badge ?? true,
});
