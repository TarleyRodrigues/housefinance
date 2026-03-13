// ─── ABA: RECEITAS ────────────────────────────────────────────────────────────
// API: Spoonacular (spoonacular.com) — chave via VITE_SPOONACULAR_KEY
// ✅ Busca por texto em português com tradução automática PT→EN
// ✅ instructionsRequired=true — só retorna receitas com preparo completo
// ✅ Fotos reais de alta qualidade da Spoonacular
// ✅ Filtros rápidos por tipo de prato e culinária
// ✅ Ingredientes editáveis antes de enviar para lista de compras
// ✅ Tempo de preparo e número de porções nos cards

import { useState, useEffect } from 'react';
import {
  Search, Check, Trash2, Plus,
  Loader2, UtensilsCrossed, ArrowLeft, Globe, ChefHat,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const API_KEY = import.meta.env.VITE_SPOONACULAR_KEY as string;
const BASE_URL = 'https://api.spoonacular.com';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
interface Recipe {
  id: number;
  title: string;
  image: string;
  cuisines?: string[];
  dishTypes?: string[];
  readyInMinutes?: number;
  servings?: number;
}

interface RecipeDetail extends Recipe {
  extendedIngredients: { id: number; original: string }[];
  instructions?: string;
  analyzedInstructions?: { steps: { number: number; step: string }[] }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros rápidos — parâmetros precisos para evitar resultados misturados
// Cada filtro pode combinar: query + type + includeIngredients + cuisine
// ─────────────────────────────────────────────────────────────────────────────
interface QuickFilter {
  label: string;
  query?: string;
  cuisine?: string;
  type?: string;               // main course, side dish, dessert, salad, etc.
  includeIngredients?: string; // garante que o ingrediente principal esteja presente
  excludeIngredients?: string;
}

const QUICK_FILTERS: QuickFilter[] = [
  {
    label: '🌎 Latino',
    cuisine: 'latin american',
    type: 'main course',
  },
  {
    label: '🍗 Frango',
    query: 'chicken',
    type: 'main course',
    includeIngredients: 'chicken',
    excludeIngredients: 'beef,pork,fish,shrimp', // evita pratos mistos
  },
  {
    label: '🥩 Carne',
    query: 'beef',
    type: 'main course',
    includeIngredients: 'beef',
    excludeIngredients: 'chicken,fish,shrimp',
  },
  {
    label: '🐟 Peixe',
    query: 'fish',
    type: 'main course',
    includeIngredients: 'fish',
    excludeIngredients: 'chicken,beef,pork',
  },
  {
    label: '🦐 Frutos do Mar',
    query: 'seafood shrimp',
    type: 'main course',
    includeIngredients: 'shrimp',
    excludeIngredients: 'chicken,beef,pork',
  },
  {
    label: '🍝 Massas',
    query: 'pasta',
    type: 'main course',
    includeIngredients: 'pasta',
    cuisine: 'italian',
  },
  {
    label: '🥗 Saladas',
    query: 'salad',
    type: 'salad',
  },
  {
    label: '🍲 Sopas',
    query: 'soup',
    type: 'soup',
  },
  {
    label: '🍰 Sobremesas',
    query: 'dessert',
    type: 'dessert',
  },
];

// Mapa PT→EN para tradução local (sem precisar de API)
const PT_TO_EN: Record<string, string> = {
  frango: 'chicken', galinha: 'chicken',
  carne: 'beef', boi: 'beef',
  porco: 'pork', leitão: 'pork',
  peixe: 'fish', salmão: 'salmon', tilápia: 'tilapia', bacalhau: 'codfish',
  camarão: 'shrimp', lagosta: 'lobster',
  arroz: 'rice', feijão: 'beans', feijoada: 'feijoada',
  macarrão: 'pasta', espaguete: 'spaghetti',
  batata: 'potato', mandioca: 'cassava', aipim: 'cassava',
  ovo: 'egg', ovos: 'eggs',
  queijo: 'cheese',
  bolo: 'cake', torta: 'pie', pudim: 'pudding',
  sopa: 'soup', caldo: 'broth',
  salada: 'salad', legumes: 'vegetables',
  tomate: 'tomato', cebola: 'onion', alho: 'garlic',
  picanha: 'picanha', churrasco: 'barbecue',
  moqueca: 'fish stew', vatapá: 'vatapa',
};

function translateQuery(pt: string): string {
  const lower = pt.toLowerCase().trim();
  for (const [ptTerm, enTerm] of Object.entries(PT_TO_EN)) {
    if (lower.includes(ptTerm)) return enTerm;
  }
  return pt;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
}

async function translate(text: string): Promise<string> {
  if (!text || text.length < 3) return text;
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=en|pt-BR`
    );
    const data = await res.json();
    return data?.responseData?.translatedText ?? text;
  } catch {
    return text;
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
  const [query, setQuery]                 = useState('');
  const [recipes, setRecipes]             = useState<Recipe[]>([]);
  const [selected, setSelected]           = useState<RecipeDetail | null>(null);
  const [editList, setEditList]           = useState<string[]>([]);
  const [loading, setLoading]             = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [instructions, setInstructions]   = useState('');
  const [activeFilter, setActiveFilter]   = useState<string>('🌎 Latino');
  const [sendingToCart, setSendingToCart] = useState(false);

  // Carrega receitas latinas ao abrir a aba
  useEffect(() => { handleFilter(QUICK_FILTERS[0]); }, []);

  // ── Busca por texto ────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setActiveFilter('');
    try {
      const queryEn = translateQuery(query);
      const url = new URL(`${BASE_URL}/recipes/complexSearch`);
      url.searchParams.set('apiKey', API_KEY);
      url.searchParams.set('query', queryEn);
      url.searchParams.set('instructionsRequired', 'true');
      url.searchParams.set('addRecipeInformation', 'true');
      url.searchParams.set('number', '12');
      url.searchParams.set('sort', 'popularity');
      // Inclui o ingrediente principal para evitar resultados irrelevantes
      url.searchParams.set('includeIngredients', queryEn);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Se não achou com includeIngredients, tenta sem (mais abrangente)
      if (!data.results?.length) {
        url.searchParams.delete('includeIngredients');
        const res2 = await fetch(url.toString());
        const data2 = await res2.json();
        setRecipes(data2.results ?? []);
        if (!data2.results?.length) showToast('Nenhuma receita encontrada. Tente outro termo.', 'info');
      } else {
        setRecipes(data.results);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg.includes('402') ? 'Limite da API atingido' : 'Erro ao buscar receitas', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Filtro rápido ──────────────────────────────────────────────────────────
  const handleFilter = async (filter: QuickFilter) => {
    setLoading(true);
    setActiveFilter(filter.label);
    setQuery('');
    try {
      const url = new URL(`${BASE_URL}/recipes/complexSearch`);
      url.searchParams.set('apiKey', API_KEY);
      url.searchParams.set('instructionsRequired', 'true');
      url.searchParams.set('addRecipeInformation', 'true');
      url.searchParams.set('number', '12');
      url.searchParams.set('sort', 'popularity');
      if (filter.query)              url.searchParams.set('query', filter.query);
      if (filter.cuisine)            url.searchParams.set('cuisine', filter.cuisine);
      if (filter.type)               url.searchParams.set('type', filter.type);
      if (filter.includeIngredients) url.searchParams.set('includeIngredients', filter.includeIngredients);
      if (filter.excludeIngredients) url.searchParams.set('excludeIngredients', filter.excludeIngredients);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRecipes(data.results ?? []);
    } catch {
      showToast('Erro ao buscar receitas', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Abre detalhes da receita ───────────────────────────────────────────────
  const handleOpenRecipe = async (recipe: Recipe) => {
    setLoadingDetail(true);
    setSelected({ ...recipe, extendedIngredients: [] });
    setEditList([]);
    setInstructions('Carregando...');

    try {
      const res = await fetch(
        `${BASE_URL}/recipes/${recipe.id}/information?apiKey=${API_KEY}&includeNutrition=false`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const detail: RecipeDetail = await res.json();
      setSelected(detail);

      // Traduz ingredientes
      const ingredients = detail.extendedIngredients.map((i) => i.original);
      const translated = await Promise.all(ingredients.map(translate));
      setEditList(translated);

      // Monta instruções — prefere analyzedInstructions (mais limpo)
      let raw = '';
      if (detail.analyzedInstructions?.[0]?.steps?.length) {
        raw = detail.analyzedInstructions[0].steps
          .map((s) => `${s.number}. ${s.step}`)
          .join('\n');
      } else if (detail.instructions) {
        raw = stripHtml(detail.instructions);
      }

      setInstructions(raw ? await translate(raw) : 'Instruções não disponíveis para esta receita.');
    } catch {
      setInstructions('Não foi possível carregar os detalhes.');
    } finally {
      setLoadingDetail(false);
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

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-10">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-orange-500 via-red-500 to-rose-600 p-5 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <ChefHat size={14} className="opacity-70" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">
              Receitas
            </span>
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tighter leading-none mb-4">
            O que vamos comer?
          </h2>
          <div className="flex gap-2">
            <label htmlFor="recipe-search" className="sr-only">Buscar receita</label>
            <input
              id="recipe-search"
              className="flex-1 p-3.5 bg-white/15 backdrop-blur-sm rounded-2xl outline-none border border-white/20 text-sm font-bold placeholder:text-white/50 focus:border-white/40 transition-colors"
              placeholder="Ex: frango, feijão, bolo..."
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
            <Globe size={9} /> Powered by Spoonacular · tradução automática
          </p>
        </div>
        <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-4 top-0 w-20 h-20 bg-yellow-400/10 rounded-full blur-2xl pointer-events-none" />
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
      {!loading && recipes.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence>
            {recipes.map((r, idx) => (
              <motion.button
                key={r.id}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1, transition: { delay: idx * 0.04 } }}
                exit={{ opacity: 0, scale: 0.88 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleOpenRecipe(r)}
                aria-label={`Ver receita: ${r.title}`}
                className="bg-white dark:bg-slate-800 rounded-[1.5rem] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 text-left group"
              >
                <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-700">
                  {r.image ? (
                    <img
                      src={r.image}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      alt={r.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <UtensilsCrossed size={32} className="text-slate-300" />
                    </div>
                  )}
                  {r.readyInMinutes && (
                    <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[8px] font-black uppercase px-2 py-1 rounded-lg backdrop-blur-sm">
                      ⏱ {r.readyInMinutes} min
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-black text-[10px] uppercase tracking-tight leading-tight dark:text-white line-clamp-2">
                    {r.title}
                  </p>
                  {r.servings && (
                    <p className="text-[8px] text-slate-400 mt-0.5 font-bold">
                      🍽 {r.servings} porções
                    </p>
                  )}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── ESTADO VAZIO ────────────────────────────────────────────────────── */}
      {!loading && recipes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <UtensilsCrossed size={40} className="text-slate-200 dark:text-slate-700" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 dark:text-slate-600 text-center">
            Busque uma receita acima{'\n'}ou escolha um filtro rápido
          </p>
        </div>
      )}

      {/* ── MODAL DETALHES ───────────────────────────────────────────────────── */}
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
            aria-label={`Receita: ${selected.title}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <button
                onClick={() => setSelected(null)}
                aria-label="Voltar"
                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 active:scale-90 transition-all"
              >
                <ArrowLeft size={18} />
              </button>

              <div className="flex-1 mx-3 overflow-hidden">
                <p className="font-black text-xs uppercase tracking-tight truncate dark:text-white">
                  {selected.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {selected.readyInMinutes && (
                    <span className="text-[8px] text-slate-400 font-bold">⏱ {selected.readyInMinutes} min</span>
                  )}
                  {selected.servings && (
                    <span className="text-[8px] text-slate-400 font-bold">🍽 {selected.servings} porções</span>
                  )}
                </div>
              </div>

              <button
                onClick={handleSendToCart}
                disabled={sendingToCart || loadingDetail || editList.length === 0}
                aria-label="Enviar ingredientes para lista de compras"
                className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-2xl text-[9px] font-black uppercase shadow-lg shadow-orange-500/30 active:scale-90 transition-all disabled:opacity-50"
              >
                {sendingToCart ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Compras
              </button>
            </div>

            {/* Conteúdo scrollável */}
            <div className="flex-1 overflow-y-auto">
              <div className="relative">
                {selected.image ? (
                  <img src={selected.image} className="w-full h-56 object-cover" alt={selected.title} />
                ) : (
                  <div className="w-full h-56 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <UtensilsCrossed size={48} className="text-slate-300" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-900 via-transparent to-transparent pointer-events-none" />
              </div>

              <div className="p-5 space-y-6">

                {/* Ingredientes */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black text-xs uppercase tracking-widest text-orange-500 flex items-center gap-2">
                      Ingredientes
                      {loadingDetail && <Loader2 size={10} className="animate-spin text-slate-400" />}
                    </h3>
                    <button
                      onClick={() => setEditList([...editList, ''])}
                      aria-label="Adicionar ingrediente"
                      className="flex items-center gap-1 text-[9px] font-black text-blue-500 uppercase active:scale-90 transition-all"
                    >
                      <Plus size={12} /> Adicionar
                    </button>
                  </div>

                  {loadingDetail && editList.length === 0 ? (
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
                    {loadingDetail && <Loader2 size={10} className="animate-spin" />}
                  </h3>
                  {loadingDetail ? (
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

                {/* Botão inferior */}
                <button
                  onClick={handleSendToCart}
                  disabled={sendingToCart || loadingDetail || editList.length === 0}
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