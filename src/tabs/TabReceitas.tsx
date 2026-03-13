// ─── ABA: RECEITAS ────────────────────────────────────────────────────────────
// API: TheMealDB (gratuita, sem limite, sem chave)
// Busca funciona em inglês/espanhol mas os resultados são traduzidos automaticamente
// via MyMemory API (gratuita, sem chave, 5000 chars/dia por IP)
// Culinária brasileira: filtro por área "Brazilian" retorna pratos nacionais
// ✅ Busca por nome em PT → traduz para EN → busca na MealDB → traduz resultado de volta
// ✅ Busca rápida por categorias brasileiras sem tradução
// ✅ Ingredientes editáveis antes de enviar para a lista de compras

import { useState, useEffect } from 'react';
import {
  Search, X, Check, Trash2, Plus, ChevronDown,
  Loader2, UtensilsCrossed, ArrowLeft, Globe,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
interface Meal {
  idMeal: string;
  strMeal: string;
  strMealThumb: string;
  strInstructions?: string;
  strArea?: string;
  strCategory?: string;
  [key: string]: string | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Culinária brasileira e latina — retorna direto da MealDB por área
// ─────────────────────────────────────────────────────────────────────────────
const QUICK_FILTERS = [
  { label: '🇧🇷 Brasileira', area: 'Brazilian'  },
  { label: '🌮 Mexicana',    area: 'Mexican'    },
  { label: '🥩 Carnes',      area: 'American'   },
  { label: '🍝 Massas',      area: 'Italian'    },
  { label: '🍗 Frango',      query: 'chicken'   },
  { label: '🥗 Saladas',     query: 'salad'     },
];

// Traduções de nomes de pratos conhecidos para exibição
const MEAL_TRANSLATIONS: Record<string, string> = {
  'Chicken': 'Frango', 'Beef': 'Carne', 'Pork': 'Porco', 'Lamb': 'Cordeiro',
  'Fish': 'Peixe', 'Pasta': 'Macarrão', 'Soup': 'Sopa', 'Salad': 'Salada',
  'Rice': 'Arroz', 'Bread': 'Pão', 'Cake': 'Bolo', 'Pie': 'Torta',
  'Stew': 'Ensopado', 'Fried': 'Frito', 'Grilled': 'Grelhado',
  'Roasted': 'Assado', 'Baked': 'Assado no forno', 'Stuffed': 'Recheado',
  'Creamy': 'Cremoso', 'Spicy': 'Apimentado',
};

// Traduz palavras conhecidas no nome do prato (simples, sem API)
function translateMealName(name: string): string {
  let result = name;
  for (const [en, pt] of Object.entries(MEAL_TRANSLATIONS)) {
    result = result.replace(new RegExp(en, 'gi'), pt);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// MyMemory API — tradução gratuita sem chave
// Usado para: traduzir busca PT→EN e instruções EN→PT
// Limite: 5000 chars/dia por IP (mais do que suficiente para uso pessoal)
// ─────────────────────────────────────────────────────────────────────────────
async function translate(text: string, from: string, to: string): Promise<string> {
  if (!text || text.length < 3) return text;
  // Limita para não estourar o limite diário
  const truncated = text.slice(0, 800);
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(truncated)}&langpair=${from}|${to}`
    );
    const data = await res.json();
    return data?.responseData?.translatedText ?? text;
  } catch {
    return text; // fallback: retorna original se falhar
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
  onAddShoppingItems: (items: string[]) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────────────────────
export function TabReceitas({ fetchData, showToast, onAddShoppingItems }: Props) {
  const [query, setQuery]           = useState('');
  const [meals, setMeals]           = useState<Meal[]>([]);
  const [selected, setSelected]     = useState<Meal | null>(null);
  const [editList, setEditList]     = useState<string[]>([]);
  const [loading, setLoading]       = useState(false);
  const [translating, setTranslating] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [sendingToCart, setSendingToCart] = useState(false);

  // ── Busca com tradução PT→EN ───────────────────────────────────────────────
  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setActiveFilter(null);
    try {
      // 1. Tenta buscar diretamente (funciona para nomes em inglês)
      let url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`;
      let res = await fetch(url);
      let data = await res.json();

      // 2. Se não encontrou, traduz o termo para inglês e tenta de novo
      if (!data.meals || data.meals.length === 0) {
        const translated = await translate(query, 'pt-BR', 'en');
        if (translated && translated.toLowerCase() !== query.toLowerCase()) {
          url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(translated)}`;
          res = await fetch(url);
          data = await res.json();
        }
      }
      setMeals(data.meals ?? []);
      if (!data.meals || data.meals.length === 0) {
        showToast('Nenhuma receita encontrada. Tente outro termo.', 'info');
      }
    } catch {
      showToast('Erro ao buscar receitas', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Busca por filtro rápido (área ou termo em inglês) ──────────────────────
  const handleFilter = async (filter: typeof QUICK_FILTERS[0]) => {
    setLoading(true);
    setActiveFilter(filter.label);
    setQuery('');
    try {
      let url: string;
      if ('area' in filter) {
        url = `https://www.themealdb.com/api/json/v1/1/filter.php?a=${filter.area}`;
      } else {
        url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${filter.query}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setMeals(data.meals ?? []);
    } catch {
      showToast('Erro ao buscar receitas', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Abre receita e carrega detalhes + tradução ─────────────────────────────
  const handleOpenMeal = async (meal: Meal) => {
    setTranslating(true);
    setSelected(meal);
    setInstructions('Carregando...');
    setEditList([]);

    try {
      // Se veio do filtro por área, só tem thumbnail — busca detalhes completos
      let fullMeal = meal;
      if (!meal.strInstructions) {
        const res = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`);
        const data = await res.json();
        fullMeal = data.meals?.[0] ?? meal;
        setSelected(fullMeal);
      }

      // Extrai ingredientes
      const ingredients: string[] = [];
      for (let i = 1; i <= 20; i++) {
        const ing = fullMeal[`strIngredient${i}`];
        const measure = fullMeal[`strMeasure${i}`];
        if (ing && ing.trim()) {
          ingredients.push(`${measure ?? ''} ${ing}`.trim());
        }
      }

      // Traduz ingredientes PT (lista já vem em inglês — traduzimos)
      const translatedIngredients = await Promise.all(
        ingredients.map((ing) => translate(ing, 'en', 'pt-BR'))
      );
      setEditList(translatedIngredients);

      // Traduz instruções
      if (fullMeal.strInstructions) {
        const translatedInstructions = await translate(fullMeal.strInstructions, 'en', 'pt-BR');
        setInstructions(translatedInstructions);
      } else {
        setInstructions('Instruções não disponíveis.');
      }
    } catch {
      setInstructions('Não foi possível carregar as instruções.');
      setEditList([]);
    } finally {
      setTranslating(false);
    }
  };

  // ── Envia para lista de compras ────────────────────────────────────────────
  const handleSendToCart = async () => {
    const items = editList.filter((i) => i.trim());
    if (items.length === 0) return;
    setSendingToCart(true);
    try {
      await onAddShoppingItems(items);
      showToast(`${items.length} ingredientes adicionados às compras! 🛒`);
      fetchData();
      setSelected(null);
    } catch {
      showToast('Erro ao adicionar à lista', 'error');
    } finally {
      setSendingToCart(false);
    }
  };

  return (
    <div className="space-y-4 pb-10">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-orange-500 to-red-500 p-5 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 block mb-1">
            Buscar Receitas
          </span>
          <h2 className="text-2xl font-black uppercase tracking-tighter leading-none mb-4">
            O que vamos comer?
          </h2>
          <div className="flex gap-2">
            <label htmlFor="recipe-search" className="sr-only">Buscar receita em português</label>
            <input
              id="recipe-search"
              className="flex-1 p-3.5 bg-white/15 backdrop-blur-sm rounded-2xl outline-none border border-white/20 text-sm font-bold placeholder:text-white/50 focus:border-white/40 transition-colors"
              placeholder="Ex: frango, arroz, bolo..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              aria-label="Buscar receita"
              className="p-3.5 bg-white/20 border border-white/20 rounded-2xl active:scale-90 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            </button>
          </div>
          <p className="text-[9px] text-white/50 font-bold mt-2 flex items-center gap-1">
            <Globe size={9} /> Busca em português com tradução automática
          </p>
        </div>
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* ── FILTROS RÁPIDOS ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {QUICK_FILTERS.map((filter) => (
          <button
            key={filter.label}
            onClick={() => handleFilter(filter)}
            disabled={loading}
            aria-pressed={activeFilter === filter.label}
            className={`flex-shrink-0 px-3.5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 disabled:opacity-50 ${
              activeFilter === filter.label
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* ── LOADING ─────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 size={32} className="text-orange-400 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Buscando receitas...
          </p>
        </div>
      )}

      {/* ── RESULTADOS ──────────────────────────────────────────────────────── */}
      {!loading && meals.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence>
            {meals.map((m) => (
              <motion.button
                key={m.idMeal}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleOpenMeal(m)}
                aria-label={`Ver receita de ${translateMealName(m.strMeal)}`}
                className="bg-white dark:bg-slate-800 rounded-[1.5rem] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 text-left group"
              >
                <div className="relative aspect-square overflow-hidden">
                  <img
                    src={m.strMealThumb}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    alt={m.strMeal}
                    loading="lazy"
                  />
                  {m.strArea && (
                    <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[8px] font-black uppercase px-2 py-1 rounded-lg backdrop-blur-sm">
                      {m.strArea}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-black text-[10px] uppercase tracking-tight leading-tight dark:text-white line-clamp-2">
                    {translateMealName(m.strMeal)}
                  </p>
                  <p className="text-[8px] text-slate-400 mt-0.5 font-bold uppercase">
                    {m.strMeal !== translateMealName(m.strMeal) ? m.strMeal : ''}
                  </p>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── ESTADO VAZIO ────────────────────────────────────────────────────── */}
      {!loading && meals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <UtensilsCrossed size={40} className="text-slate-200 dark:text-slate-700" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 dark:text-slate-600 text-center">
            Busque uma receita acima{'\n'}ou escolha um filtro rápido
          </p>
        </div>
      )}

      {/* ── MODAL DETALHES DA RECEITA ────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 bg-white dark:bg-slate-900 z-[300] flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={`Receita: ${translateMealName(selected.strMeal)}`}
          >
            {/* Header do modal */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <button
                onClick={() => setSelected(null)}
                aria-label="Voltar para a lista"
                className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 active:scale-90 transition-all"
              >
                <ArrowLeft size={18} />
              </button>

              <div className="flex-1 mx-3 overflow-hidden">
                <p className="font-black text-xs uppercase tracking-tight truncate dark:text-white">
                  {translateMealName(selected.strMeal)}
                </p>
                {selected.strArea && (
                  <p className="text-[8px] text-slate-400 font-bold uppercase">{selected.strArea}</p>
                )}
              </div>

              <button
                onClick={handleSendToCart}
                disabled={sendingToCart || translating || editList.length === 0}
                aria-label="Enviar ingredientes para lista de compras"
                className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-2xl text-[9px] font-black uppercase shadow-lg shadow-orange-500/30 active:scale-90 transition-all disabled:opacity-50"
              >
                {sendingToCart
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Check size={13} />
                }
                Compras
              </button>
            </div>

            {/* Conteúdo com scroll */}
            <div className="flex-1 overflow-y-auto">
              {/* Imagem */}
              <div className="relative">
                <img
                  src={selected.strMealThumb}
                  className="w-full h-52 object-cover"
                  alt={selected.strMeal}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-900 via-transparent to-transparent pointer-events-none" />
              </div>

              <div className="p-5 space-y-6">
                {/* Ingredientes */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black text-xs uppercase tracking-widest text-orange-500">
                      Ingredientes
                      {translating && <Loader2 size={10} className="inline ml-2 animate-spin text-slate-400" />}
                    </h3>
                    <button
                      onClick={() => setEditList([...editList, ''])}
                      aria-label="Adicionar ingrediente"
                      className="flex items-center gap-1 text-[9px] font-black text-blue-500 uppercase active:scale-90 transition-all"
                    >
                      <Plus size={12} /> Adicionar
                    </button>
                  </div>

                  {translating && editList.length === 0 ? (
                    <div className="space-y-2">
                      {[1,2,3,4,5].map((i) => (
                        <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {editList.map((ing, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input
                            className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-xs font-bold dark:text-white outline-none focus:border-orange-400 transition-colors"
                            value={ing}
                            onChange={(e) => {
                              const n = [...editList];
                              n[i] = e.target.value;
                              setEditList(n);
                            }}
                            aria-label={`Ingrediente ${i + 1}`}
                          />
                          <button
                            onClick={() => setEditList(editList.filter((_, idx) => idx !== i))}
                            aria-label={`Remover ingrediente ${i + 1}`}
                            className="p-2.5 text-red-400 bg-red-50 dark:bg-red-900/20 rounded-2xl active:scale-90 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Modo de preparo */}
                <section>
                  <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                    Modo de Preparo
                    {translating && <Loader2 size={10} className="animate-spin" />}
                  </h3>
                  {translating ? (
                    <div className="space-y-2">
                      {[1,2,3,4].map((i) => (
                        <div key={i} className="h-4 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" style={{ width: `${70 + i * 7}%` }} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed dark:text-slate-300 text-slate-600 whitespace-pre-line">
                      {instructions}
                    </p>
                  )}
                </section>

                {/* Botão inferior (redundante para facilidade) */}
                <button
                  onClick={handleSendToCart}
                  disabled={sendingToCart || translating || editList.length === 0}
                  className="w-full py-4 bg-orange-500 text-white font-black text-sm uppercase tracking-wider rounded-[2rem] shadow-xl shadow-orange-500/30 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sendingToCart
                    ? <><Loader2 size={16} className="animate-spin" /> Adicionando...</>
                    : <><Check size={16} /> Enviar {editList.length} ingredientes para Compras</>
                  }
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}