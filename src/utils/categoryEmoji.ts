// ─── EMOJI DE CATEGORIA ──────────────────────────────────────────────────────
// Prioridade: emoji personalizado (coluna categories.emoji) → emoji no início do
// nome (ex: "🛒Mercado") → sugestão por palavra-chave → null.
// O nome nunca é alterado: ele liga os gastos à categoria.

import type { Category } from '../types';

// Emoji no começo do texto (inclui variações ️, tons de pele e sequências com ZWJ)
const LEADING_EMOJI =
  /^\s*((?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic}️?)*‍?)\s*/u;

export function splitCategoryName(name: string): { emoji: string | null; label: string } {
  const m = name.match(LEADING_EMOJI);
  if (!m) return { emoji: null, label: name.trim() };
  const emoji = m[1].replace(/‍$/, '');
  return { emoji, label: name.slice(m[0].length).trim() || name.trim() };
}

// Nome sem o emoji do início
export const categoryLabel = (name: string) => splitCategoryName(name).label;

const KEYWORDS: [RegExp, string][] = [
  [/mercad|supermerc|feira|hortifrut|atacad/i, '🛒'],
  [/aliment|comida|refei|restaur|lanche|almo[cç]o|jantar/i, '🍽️'],
  [/delivery|ifood|pizza|hamb[uú]rg/i, '🍕'],
  [/caf[eé]|padaria/i, '☕'],
  [/energia|luz|el[eé]tric/i, '⚡'],
  [/[aá]gua|saneam|esgoto/i, '🚿'],
  [/g[aá]s\b|botij/i, '🔥'],
  [/internet|wi-?fi|fibra/i, '📶'],
  [/celular|telefon|plano m[oó]vel/i, '📱'],
  [/aluguel|moradia|casa|condom[ií]n|iptu/i, '🏠'],
  [/transport|uber|t[aá]xi|[oô]nibus|metr[oô]/i, '🚕'],
  [/combust|gasolina|posto|etanol/i, '⛽'],
  [/carro|ve[ií]culo|ipva|mec[aâ]nic|estacion/i, '🚗'],
  [/sa[uú]de|m[eé]dic|consulta|plano de sa/i, '💊'],
  [/farm[aá]c|rem[eé]dio|drogaria/i, '💊'],
  [/academia|esporte|treino|gym/i, '🏋️'],
  [/pet|gato|cachorro|ra[cç][aã]o|veterin/i, '🐾'],
  [/lazer|divers|passeio|cinema|show|bar\b/i, '🎉'],
  [/viagem|hotel|passage|turism/i, '✈️'],
  [/educa|escola|curso|faculd|livro/i, '📚'],
  [/roupa|vestu|cal[cç]ado|moda/i, '👕'],
  [/beleza|sal[aã]o|cabel|est[eé]tica|barbe/i, '💇'],
  [/presente|anivers/i, '🎁'],
  [/assinatura|streaming|netflix|spotify/i, '📺'],
  [/investim|poupan|reserva|sonho/i, '💰'],
  [/cart[aã]o|fatura|banco|tarifa/i, '💳'],
  [/imposto|taxa/i, '🧾'],
  [/beb[eê]|filho|crian[cç]a/i, '🍼'],
  [/limpeza|faxina|diarista/i, '🧹'],
  [/manuten|reforma|conserto/i, '🛠️'],
  [/doa[cç]|igreja|d[ií]zimo/i, '🙏'],
  [/outro|divers/i, '🔀'],
];

export function suggestEmoji(name: string): string | null {
  const label = categoryLabel(name);
  return KEYWORDS.find(([re]) => re.test(label))?.[1] ?? null;
}

export function categoryEmoji(name: string, custom?: string | null): string | null {
  return custom?.trim() || splitCategoryName(name).emoji || suggestEmoji(name);
}

// Mapa nome → emoji (para listas)
export function buildCategoryEmojiMap(categories: Category[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const c of categories) map[c.name] = categoryEmoji(c.name, c.emoji);
  return map;
}

// Grade do seletor em Ajustes
export const EMOJI_CHOICES = [
  '🛒', '🍽️', '🍕', '☕', '🍺', '🍖', '⚡', '🚿', '🔥', '📶', '📱', '🏠',
  '🚕', '⛽', '🚗', '🚌', '💊', '🏥', '🏋️', '🐾', '🐈', '🐶', '🎉', '🎬',
  '🎳', '✈️', '🏖️', '📚', '👕', '💇', '🎁', '📺', '🎮', '💰', '💳', '🧾',
  '🍼', '🧹', '🛠️', '🙏', '💼', '🔀',
];
