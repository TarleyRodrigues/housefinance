// ─── ABA: FILMES & SÉRIES ─────────────────────────────────────────────────────
// ✅ TMDB API — busca com debounce, poster, sinopse, ano, tipo
// ✅ Categorias criadas pelo usuário (Ex: "Namorada", "Com afilhada"...)
// ✅ Status: Quero Assistir / Assistindo / Assistido
// ✅ Salvo no Supabase: watchlist_categories + watchlist_items
// ✅ Arquitetura consistente — supabase removido, tudo via props
// ✅ Visual: cinema/poster dark, galeria estilo streaming

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Search, X, Bookmark, Play, CheckCircle2,
  Trash2, Film, Tv, ChevronDown, AlertTriangle, Loader2,
  ListPlus, Eye, EyeOff,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
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

interface TMDBResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  media_type: 'movie' | 'tv';
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de status
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<WatchStatus, {
  label: string;
  icon: React.ReactNode;
  bg: string;
  text: string;
  badge: string;
}> = {
  want: {
    label: 'Quero assistir',
    icon: <Bookmark size={12} />,
    bg: 'bg-slate-700',
    text: 'text-slate-300',
    badge: 'bg-slate-600 text-slate-200',
  },
  watching: {
    label: 'Assistindo',
    icon: <Play size={12} />,
    bg: 'bg-blue-600',
    text: 'text-blue-200',
    badge: 'bg-blue-500 text-white',
  },
  watched: {
    label: 'Assistido',
    icon: <CheckCircle2 size={12} />,
    bg: 'bg-emerald-600',
    text: 'text-emerald-200',
    badge: 'bg-emerald-500 text-white',
  },
};

const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w342';

// ─────────────────────────────────────────────────────────────────────────────
// Hook: debounce
// ─────────────────────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: ConfirmModal
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmModal({
  isOpen, title, description, onConfirm, onCancel,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
        role="dialog" aria-modal="true" onClick={onCancel}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-slate-800 border border-slate-700 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-red-900/40 flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-400" />
            </div>
            <h3 className="font-black text-white text-base uppercase tracking-tight">{title}</h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed"
              dangerouslySetInnerHTML={{ __html: description }} />
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onCancel}
              className="flex-1 py-3 rounded-2xl bg-slate-700 text-slate-300 font-black text-xs uppercase tracking-wider active:scale-95 transition-all">
              Cancelar
            </button>
            <button onClick={onConfirm}
              className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-red-500/30">
              Remover
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: PosterCard — card de filme/série na lista
// ─────────────────────────────────────────────────────────────────────────────
function PosterCard({
  item,
  onChangeStatus,
  onDelete,
}: {
  item: WatchlistItem;
  onChangeStatus: (id: string, status: WatchStatus) => Promise<void>;
  onDelete: (item: WatchlistItem) => void;
}) {
  const [showSynopsis, setShowSynopsis] = useState(false);
  const statusCfg = STATUS_CONFIG[item.status];
  const statuses: WatchStatus[] = ['want', 'watching', 'watched'];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88 }}
      className="relative bg-slate-800 rounded-[1.5rem] overflow-hidden border border-slate-700/50 shadow-xl"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] overflow-hidden bg-slate-900">
        {item.poster_url ? (
          <img
            src={`${TMDB_IMAGE}${item.poster_url}`}
            alt={`Poster de ${item.title}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {item.media_type === 'movie'
              ? <Film size={40} className="text-slate-600" />
              : <Tv size={40} className="text-slate-600" />}
          </div>
        )}

        {/* Overlay escuro no topo */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

        {/* Badge tipo */}
        <div className="absolute top-2 left-2">
          <span className="flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-white">
            {item.media_type === 'movie' ? <Film size={9} /> : <Tv size={9} />}
            {item.media_type === 'movie' ? 'Filme' : 'Série'}
          </span>
        </div>

        {/* Botão delete */}
        <button
          onClick={() => onDelete(item)}
          aria-label={`Remover ${item.title}`}
          className="absolute top-2 right-2 w-7 h-7 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-300 hover:text-red-400 active:scale-90 transition-all"
        >
          <Trash2 size={12} />
        </button>

        {/* Ano no bottom */}
        {item.year && (
          <span className="absolute bottom-2 right-2 text-[9px] font-black text-white/50 uppercase">
            {item.year}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <p className="font-black text-white text-xs leading-tight line-clamp-2 uppercase tracking-tight">
          {item.title}
        </p>

        {/* Sinopse toggle */}
        {item.synopsis && (
          <div>
            <button
              onClick={() => setShowSynopsis((v) => !v)}
              aria-expanded={showSynopsis}
              aria-label={showSynopsis ? 'Ocultar sinopse' : 'Ver sinopse'}
              className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-slate-500 active:scale-95 transition-all"
            >
              {showSynopsis ? <EyeOff size={9} /> : <Eye size={9} />}
              {showSynopsis ? 'Ocultar' : 'Sinopse'}
            </button>
            <AnimatePresence>
              {showSynopsis && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-[9px] text-slate-400 leading-relaxed mt-1 overflow-hidden line-clamp-4"
                >
                  {item.synopsis}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Status selector */}
        <div className="flex gap-1 pt-1">
          {statuses.map((s) => {
            const cfg = STATUS_CONFIG[s];
            const active = item.status === s;
            return (
              <button
                key={s}
                onClick={() => onChangeStatus(item.id, s)}
                aria-label={cfg.label}
                aria-pressed={active}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[8px] font-black uppercase transition-all active:scale-95 ${
                  active ? cfg.bg + ' text-white' : 'bg-slate-700/50 text-slate-500 hover:bg-slate-700'
                }`}
              >
                {cfg.icon}
              </button>
            );
          })}
        </div>

        {/* Badge status atual */}
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wide ${statusCfg.badge}`}>
          {statusCfg.icon}
          {statusCfg.label}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  watchlistCategories: WatchlistCategory[];
  watchlistItems: WatchlistItem[];
  tmdbApiKey: string;                 // VITE_TMDB_KEY no .env
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
  onAddCategory: (name: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onAddItem: (payload: {
    category_id: string;
    tmdb_id: number;
    title: string;
    poster_url: string | null;
    synopsis: string | null;
    year: string | null;
    media_type: 'movie' | 'tv';
  }) => Promise<void>;
  onChangeStatus: (id: string, status: WatchStatus) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function TabFilmes({
  watchlistCategories,
  watchlistItems,
  tmdbApiKey,
  fetchData,
  showToast,
  onAddCategory,
  onDeleteCategory,
  onAddItem,
  onChangeStatus,
  onDeleteItem,
}: Props) {
  const [activeCatId, setActiveCatId]   = useState<string | null>(null);
  const [newCatName, setNewCatName]     = useState('');
  const [showNewCat, setShowNewCat]     = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([]);
  const [searching, setSearching]       = useState(false);
  const [showSearch, setShowSearch]     = useState(false);
  const [itemToDelete, setItemToDelete] = useState<WatchlistItem | null>(null);
  const [catToDelete, setCatToDelete]   = useState<WatchlistCategory | null>(null);
  const [filterStatus, setFilterStatus] = useState<WatchStatus | null>(null);

  const debouncedQuery = useDebounce(searchQuery, 400);

  // ── Seleciona primeira categoria automaticamente ───────────────────────────
  useEffect(() => {
    if (watchlistCategories.length > 0 && !activeCatId) {
      setActiveCatId(watchlistCategories[0].id);
    }
  }, [watchlistCategories, activeCatId]);

  // ── Busca TMDB com debounce ────────────────────────────────────────────────
  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${tmdbApiKey}&query=${encodeURIComponent(debouncedQuery)}&language=pt-BR&include_adult=false`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((data) => {
        const results = (data.results ?? []).filter(
          (r: TMDBResult) => r.media_type === 'movie' || r.media_type === 'tv'
        ).slice(0, 8);
        setSearchResults(results);
      })
      .catch(() => {})
      .finally(() => setSearching(false));
    return () => controller.abort();
  }, [debouncedQuery, tmdbApiKey]);

  // ── Itens da categoria ativa com filtro de status ──────────────────────────
  const filteredItems = useMemo(() => {
    const base = watchlistItems.filter((i) => i.category_id === activeCatId);
    return filterStatus ? base.filter((i) => i.status === filterStatus) : base;
  }, [watchlistItems, activeCatId, filterStatus]);

  // ── Contadores por status ──────────────────────────────────────────────────
  const counts = useMemo(() => {
    const base = watchlistItems.filter((i) => i.category_id === activeCatId);
    return {
      want:     base.filter((i) => i.status === 'want').length,
      watching: base.filter((i) => i.status === 'watching').length,
      watched:  base.filter((i) => i.status === 'watched').length,
      total:    base.length,
    };
  }, [watchlistItems, activeCatId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddCategory = useCallback(async () => {
    if (!newCatName.trim()) return;
    try {
      await onAddCategory(newCatName.trim());
      setNewCatName('');
      setShowNewCat(false);
      showToast('Categoria criada!');
      fetchData();
    } catch {
      showToast('Erro ao criar categoria', 'error');
    }
  }, [newCatName, onAddCategory, showToast, fetchData]);

  const handleDeleteCatConfirm = useCallback(async () => {
    if (!catToDelete) return;
    try {
      await onDeleteCategory(catToDelete.id);
      if (activeCatId === catToDelete.id) setActiveCatId(null);
      showToast('Categoria removida', 'info');
      fetchData();
    } catch {
      showToast('Erro ao remover categoria', 'error');
    } finally {
      setCatToDelete(null);
    }
  }, [catToDelete, activeCatId, onDeleteCategory, showToast, fetchData]);

  const handleAddItem = useCallback(async (result: TMDBResult) => {
    if (!activeCatId) {
      showToast('Selecione uma categoria primeiro', 'info');
      return;
    }
    // Verifica duplicata
    const alreadyExists = watchlistItems.some(
      (i) => i.tmdb_id === result.id && i.category_id === activeCatId
    );
    if (alreadyExists) {
      showToast('Já está nesta categoria!', 'info');
      return;
    }
    const title = result.title ?? result.name ?? 'Sem título';
    const year = (result.release_date ?? result.first_air_date ?? '').slice(0, 4) || null;
    try {
      await onAddItem({
        category_id: activeCatId,
        tmdb_id: result.id,
        title,
        poster_url: result.poster_path,
        synopsis: result.overview || null,
        year,
        media_type: result.media_type,
      });
      showToast(`"${title}" adicionado!`);
      setSearchQuery('');
      setSearchResults([]);
      setShowSearch(false);
      fetchData();
    } catch {
      showToast('Erro ao adicionar', 'error');
    }
  }, [activeCatId, watchlistItems, onAddItem, showToast, fetchData]);

  const handleChangeStatus = useCallback(async (id: string, status: WatchStatus) => {
    try {
      await onChangeStatus(id, status);
      fetchData();
    } catch {
      showToast('Erro ao atualizar status', 'error');
    }
  }, [onChangeStatus, fetchData, showToast]);

  const handleDeleteItemConfirm = useCallback(async () => {
    if (!itemToDelete) return;
    try {
      await onDeleteItem(itemToDelete.id);
      showToast('Removido', 'info');
      fetchData();
    } catch {
      showToast('Erro ao remover', 'error');
    } finally {
      setItemToDelete(null);
    }
  }, [itemToDelete, onDeleteItem, showToast, fetchData]);

  const activeCat = watchlistCategories.find((c) => c.id === activeCatId);

  return (
    <div className="space-y-4 pb-10">

      {/* ── 1. HEADER ────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden border border-slate-700/50">
        <div className="relative z-10">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 block mb-1">
            Minha Watchlist
          </span>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-black tracking-tighter leading-none">
                {activeCat?.name ?? 'Selecione'}
              </p>
              {activeCat && (
                <p className="text-[10px] text-white/40 font-bold mt-1 uppercase tracking-widest">
                  {counts.total} títulos · {counts.watched} assistidos
                </p>
              )}
            </div>
            <button
              onClick={() => setShowSearch((v) => !v)}
              aria-label={showSearch ? 'Fechar busca' : 'Adicionar filme ou série'}
              className="flex flex-col items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-3 rounded-2xl active:scale-95 transition-all"
            >
              {showSearch ? <X size={20} /> : <ListPlus size={20} />}
              <span className="text-[8px] font-black uppercase tracking-wider">
                {showSearch ? 'Fechar' : 'Adicionar'}
              </span>
            </button>
          </div>

          {/* Contadores de status */}
          {activeCat && counts.total > 0 && (
            <div className="flex gap-2 mt-4">
              {(['want', 'watching', 'watched'] as WatchStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(filterStatus === s ? null : s)}
                  aria-pressed={filterStatus === s}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all active:scale-95 ${
                    filterStatus === s
                      ? STATUS_CONFIG[s].bg + ' text-white'
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}
                >
                  {STATUS_CONFIG[s].icon}
                  {counts[s]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-6 -top-6 w-24 h-24 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* ── 2. BUSCA TMDB ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-slate-800 border border-slate-700 rounded-[2rem] p-4 space-y-3 shadow-xl"
          >
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <label htmlFor="tmdb-search" className="sr-only">Buscar filme ou série</label>
              <input
                id="tmdb-search"
                className="w-full pl-10 pr-10 py-3.5 bg-slate-900/70 border border-slate-600 rounded-2xl text-white placeholder:text-slate-500 text-sm font-medium outline-none focus:border-blue-500 transition-colors"
                placeholder="Buscar filme ou série..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searching && (
                <Loader2 size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
              )}
              {searchQuery && !searching && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                  aria-label="Limpar busca"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 active:scale-90"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Resultados */}
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-2 max-h-80 overflow-y-auto no-scrollbar"
                >
                  {searchResults.map((result) => {
                    const title = result.title ?? result.name ?? 'Sem título';
                    const year = (result.release_date ?? result.first_air_date ?? '').slice(0, 4);
                    const alreadyIn = watchlistItems.some(
                      (i) => i.tmdb_id === result.id && i.category_id === activeCatId
                    );
                    return (
                      <motion.button
                        key={result.id}
                        layout
                        onClick={() => !alreadyIn && handleAddItem(result)}
                        disabled={alreadyIn}
                        aria-label={`Adicionar ${title} ${alreadyIn ? '(já adicionado)' : ''}`}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                          alreadyIn
                            ? 'border-emerald-800/50 bg-emerald-900/20 opacity-60 cursor-not-allowed'
                            : 'border-slate-700 bg-slate-900/50 hover:border-blue-600 hover:bg-slate-900 active:scale-[0.98]'
                        }`}
                      >
                        {/* Mini poster */}
                        <div className="w-10 h-14 rounded-xl overflow-hidden bg-slate-700 shrink-0">
                          {result.poster_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                              alt={title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {result.media_type === 'movie'
                                ? <Film size={16} className="text-slate-500" />
                                : <Tv size={16} className="text-slate-500" />}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-white text-xs truncate uppercase tracking-tight">
                            {title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] text-slate-500 font-bold uppercase">
                              {result.media_type === 'movie' ? 'Filme' : 'Série'}
                            </span>
                            {year && (
                              <span className="text-[9px] text-slate-500 font-bold">{year}</span>
                            )}
                          </div>
                          {result.overview && (
                            <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">
                              {result.overview}
                            </p>
                          )}
                        </div>
                        {alreadyIn ? (
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        ) : (
                          <Plus size={16} className="text-blue-400 shrink-0" />
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
              {debouncedQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <p className="text-center text-slate-500 text-xs font-bold uppercase tracking-widest py-4">
                  Nenhum resultado encontrado
                </p>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3. CATEGORIAS ────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Categorias
          </span>
          <button
            onClick={() => setShowNewCat((v) => !v)}
            aria-label="Criar nova categoria"
            aria-expanded={showNewCat}
            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-blue-500 active:scale-95 transition-all"
          >
            <Plus size={12} /> Nova
          </button>
        </div>

        {/* Input nova categoria */}
        <AnimatePresence>
          {showNewCat && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 pb-1">
                <label htmlFor="new-cat-name" className="sr-only">Nome da nova categoria</label>
                <input
                  id="new-cat-name"
                  className="flex-1 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white placeholder:text-slate-300 outline-none focus:border-blue-400 transition-colors"
                  placeholder="Ex: Com minha namorada..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  autoFocus
                />
                <button
                  onClick={handleAddCategory}
                  disabled={!newCatName.trim()}
                  aria-label="Confirmar nova categoria"
                  className="bg-blue-600 text-white px-4 rounded-2xl font-black active:scale-90 transition-all disabled:opacity-40"
                >
                  <Plus size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lista de categorias */}
        <div className="flex flex-wrap gap-2">
          {watchlistCategories.map((cat) => {
            const catCount = watchlistItems.filter((i) => i.category_id === cat.id).length;
            const active = activeCatId === cat.id;
            return (
              <div key={cat.id} className="flex items-center gap-1">
                <button
                  onClick={() => { setActiveCatId(cat.id); setFilterStatus(null); }}
                  aria-pressed={active}
                  className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                    active
                      ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-lg'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {cat.name}
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg ${
                    active ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                  }`}>
                    {catCount}
                  </span>
                </button>
                {active && (
                  <button
                    onClick={() => setCatToDelete(cat)}
                    aria-label={`Apagar categoria ${cat.name}`}
                    className="w-7 h-7 flex items-center justify-center rounded-xl text-slate-300 dark:text-slate-600 hover:text-red-400 active:scale-90 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
          {watchlistCategories.length === 0 && (
            <p className="text-[10px] text-slate-300 dark:text-slate-600 font-black uppercase tracking-widest py-2">
              Crie sua primeira categoria
            </p>
          )}
        </div>
      </div>

      {/* ── 4. GRID DE FILMES ────────────────────────────────────────────────── */}
      {activeCatId && (
        <div>
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Film size={36} className="text-slate-300 dark:text-slate-600" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 dark:text-slate-600 text-center">
                {filterStatus
                  ? `Nenhum título com status "${STATUS_CONFIG[filterStatus].label}"`
                  : 'Nenhum título nesta categoria\nToque em Adicionar para buscar'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <AnimatePresence>
                {filteredItems.map((item) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    onChangeStatus={handleChangeStatus}
                    onDelete={setItemToDelete}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* ── 5. MODAIS ─────────────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={!!itemToDelete}
        title="Remover título?"
        description={`<strong>${itemToDelete?.title}</strong> será removido desta categoria.`}
        onConfirm={handleDeleteItemConfirm}
        onCancel={() => setItemToDelete(null)}
      />
      <ConfirmModal
        isOpen={!!catToDelete}
        title="Apagar categoria?"
        description={`<strong>${catToDelete?.name}</strong> e todos os seus títulos serão removidos.`}
        onConfirm={handleDeleteCatConfirm}
        onCancel={() => setCatToDelete(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 📌 SUPABASE — SQL para criar as tabelas
// ─────────────────────────────────────────────────────────────────────────────
//
// create table if not exists watchlist_categories (
//   id uuid primary key default gen_random_uuid(),
//   name text not null,
//   user_id uuid references auth.users(id) on delete cascade not null,
//   created_at timestamptz default now()
// );
//
// create table if not exists watchlist_items (
//   id uuid primary key default gen_random_uuid(),
//   category_id uuid references watchlist_categories(id) on delete cascade not null,
//   user_id uuid references auth.users(id) on delete cascade not null,
//   tmdb_id integer not null,
//   title text not null,
//   poster_url text,
//   synopsis text,
//   year text,
//   media_type text check (media_type in ('movie', 'tv')) not null,
//   status text check (status in ('want', 'watching', 'watched')) default 'want' not null,
//   created_at timestamptz default now(),
//   unique(category_id, tmdb_id)
// );
//
// ─────────────────────────────────────────────────────────────────────────────
// 📌 CALLBACKS para Dashboard.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
// const addWatchlistCategory = useCallback(async (name: string) => {
//   if (!user) throw new Error('Não autenticado');
//   const { error } = await supabase.from('watchlist_categories').insert({ name, user_id: user.id });
//   if (error) throw error;
// }, [user]);
//
// const deleteWatchlistCategory = useCallback(async (id: string) => {
//   const { error } = await supabase.from('watchlist_categories').delete().eq('id', id);
//   if (error) throw error;
// }, []);
//
// const addWatchlistItem = useCallback(async (payload) => {
//   if (!user) throw new Error('Não autenticado');
//   const { error } = await supabase.from('watchlist_items').insert({ ...payload, user_id: user.id });
//   if (error) throw error;
// }, [user]);
//
// const changeWatchlistStatus = useCallback(async (id: string, status: WatchStatus) => {
//   const { error } = await supabase.from('watchlist_items').update({ status }).eq('id', id);
//   if (error) throw error;
// }, []);
//
// const deleteWatchlistItem = useCallback(async (id: string) => {
//   const { error } = await supabase.from('watchlist_items').delete().eq('id', id);
//   if (error) throw error;
// }, []);
//
// ─────────────────────────────────────────────────────────────────────────────
// 📌 .env — adicionar:
//   VITE_TMDB_KEY=sua_chave_aqui
//
// Obter chave gratuita em: https://www.themoviedb.org/settings/api
// ─────────────────────────────────────────────────────────────────────────────