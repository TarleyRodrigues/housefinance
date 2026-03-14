// ─── ABA: FILMES & SÉRIES ─────────────────────────────────────────────────────
// ✅ Aba "Todos" como padrão — mostra pendentes (want + watching) de todas as categorias
// ✅ Badge da categoria no card (visível na view Todos)
// ✅ Ordenação por data: mais recentes / mais antigos
// ✅ Toggle Filme / Série para filtrar tipo de mídia
// ✅ Nota de 1–5 estrelas por usuário (tabela watchlist_ratings)
// ✅ Notas exibidas no card com foto + nome de quem avaliou

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Search, X, Bookmark, Play, CheckCircle2,
  Trash2, Film, Tv, AlertTriangle, Loader2,
  ListPlus, Eye, EyeOff, Star, ArrowUpDown,
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

export interface WatchlistRating {
  id: string;
  item_id: string;
  user_id: string;
  rating: number; // 1–5
  profile?: {
    full_name?: string;
    avatar_url?: string;
  };
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
// Constantes
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<WatchStatus, {
  label: string; icon: React.ReactNode; bg: string; text: string; badge: string;
}> = {
  want:     { label: 'Quero assistir', icon: <Bookmark size={12} />,    bg: 'bg-slate-700',    text: 'text-slate-300',  badge: 'bg-slate-600 text-slate-200'  },
  watching: { label: 'Assistindo',     icon: <Play size={12} />,        bg: 'bg-blue-600',     text: 'text-blue-200',   badge: 'bg-blue-500 text-white'       },
  watched:  { label: 'Assistido',      icon: <CheckCircle2 size={12} />, bg: 'bg-emerald-600', text: 'text-emerald-200',badge: 'bg-emerald-500 text-white'    },
};

const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w342';
const ALL_CAT_ID = '__all__'; // ID virtual da aba "Todos"

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
function ConfirmModal({ isOpen, title, description, onConfirm, onCancel }: {
  isOpen: boolean; title: string; description: string;
  onConfirm: () => void; onCancel: () => void;
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
            <button onClick={onCancel} className="flex-1 py-3 rounded-2xl bg-slate-700 text-slate-300 font-black text-xs uppercase tracking-wider active:scale-95 transition-all">
              Cancelar
            </button>
            <button onClick={onConfirm} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-red-500/30">
              Remover
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: StarRating — seletor de estrelas inline
// ─────────────────────────────────────────────────────────────────────────────
function StarRating({ value, onChange, size = 14 }: {
  value: number; onChange: (v: number) => void; size?: number;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
          className="active:scale-90 transition-transform"
        >
          <Star
            size={size}
            className={`transition-colors ${
              n <= (hover || value)
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-600'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: PosterCard
// ─────────────────────────────────────────────────────────────────────────────
function PosterCard({
  item, categoryName, ratings, currentUserId,
  onChangeStatus, onDelete, onRate,
}: {
  item: WatchlistItem;
  categoryName?: string;
  ratings: WatchlistRating[];
  currentUserId: string;
  onChangeStatus: (id: string, status: WatchStatus) => Promise<void>;
  onDelete: (item: WatchlistItem) => void;
  onRate: (itemId: string, rating: number) => Promise<void>;
}) {
  const [showSynopsis, setShowSynopsis] = useState(false);
  const [showRating, setShowRating]     = useState(false);
  const statusCfg = STATUS_CONFIG[item.status];
  const statuses: WatchStatus[] = ['want', 'watching', 'watched'];

  const myRating = ratings.find((r) => r.user_id === currentUserId);
  const otherRatings = ratings.filter((r) => r.user_id !== currentUserId);

  const handleStatusChange = async (s: WatchStatus) => {
    await onChangeStatus(item.id, s);
    // Abre o seletor de nota automaticamente ao marcar como assistido
    if (s === 'watched') setShowRating(true);
  };

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
            {item.media_type === 'movie' ? <Film size={40} className="text-slate-600" /> : <Tv size={40} className="text-slate-600" />}
          </div>
        )}

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

        {/* Badge categoria (visível na view Todos) */}
        {categoryName && (
          <span className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white/70 text-[7px] font-black uppercase px-2 py-0.5 rounded-lg">
            {categoryName}
          </span>
        )}

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

        {/* Sinopse */}
        {item.synopsis && (
          <div>
            <button
              onClick={() => setShowSynopsis((v) => !v)}
              aria-expanded={showSynopsis}
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
                onClick={() => handleStatusChange(s)}
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

        {/* Badge status */}
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wide ${statusCfg.badge}`}>
          {statusCfg.icon}
          {statusCfg.label}
        </div>

        {/* ── NOTAS ──────────────────────────────────────────────────────── */}
        <div className="pt-1 space-y-2 border-t border-slate-700/50">

          {/* Minha nota */}
          <div>
            <button
              onClick={() => setShowRating((v) => !v)}
              className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-amber-500/80 active:scale-95 transition-all"
            >
              <Star size={9} className="fill-amber-500 text-amber-500" />
              {myRating ? `Minha nota: ${myRating.rating}★` : 'Avaliar'}
            </button>

            <AnimatePresence>
              {showRating && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-1.5 overflow-hidden"
                >
                  <StarRating
                    value={myRating?.rating ?? 0}
                    onChange={async (v) => {
                      await onRate(item.id, v);
                      setShowRating(false);
                    }}
                    size={18}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notas dos outros usuários */}
          {otherRatings.length > 0 && (
            <div className="space-y-1">
              {otherRatings.map((r) => (
                <div key={r.user_id} className="flex items-center gap-1.5">
                  <img
                    src={r.profile?.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(r.profile?.full_name ?? 'U')}&size=32`}
                    alt={r.profile?.full_name ?? 'Usuário'}
                    className="w-4 h-4 rounded-full object-cover border border-slate-600"
                  />
                  <span className="text-[8px] text-slate-400 font-bold truncate max-w-[50px]">
                    {r.profile?.full_name?.split(' ')[0] ?? 'Usuário'}
                  </span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map((n) => (
                      <Star
                        key={n}
                        size={8}
                        className={n <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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
  watchlistRatings: WatchlistRating[];
  currentUserId: string;
  tmdbApiKey: string;
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
  onAddCategory: (name: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onAddItem: (payload: {
    category_id: string; tmdb_id: number; title: string;
    poster_url: string | null; synopsis: string | null;
    year: string | null; media_type: 'movie' | 'tv';
  }) => Promise<void>;
  onChangeStatus: (id: string, status: WatchStatus) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onRateItem: (itemId: string, rating: number) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function TabFilmes({
  watchlistCategories, watchlistItems, watchlistRatings,
  currentUserId, tmdbApiKey, fetchData, showToast,
  onAddCategory, onDeleteCategory, onAddItem,
  onChangeStatus, onDeleteItem, onRateItem,
}: Props) {
  // ── Estado ──────────────────────────────────────────────────────────────
  const [activeCatId, setActiveCatId]       = useState<string>(ALL_CAT_ID);
  const [newCatName, setNewCatName]         = useState('');
  const [showNewCat, setShowNewCat]         = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState<TMDBResult[]>([]);
  const [searching, setSearching]           = useState(false);
  const [showSearch, setShowSearch]         = useState(false);
  const [itemToDelete, setItemToDelete]     = useState<WatchlistItem | null>(null);
  const [catToDelete, setCatToDelete]       = useState<WatchlistCategory | null>(null);
  const [filterStatus, setFilterStatus]     = useState<WatchStatus | null>(null);
  const [filterType, setFilterType]         = useState<'all' | 'movie' | 'tv'>('all');
  const [sortOrder, setSortOrder]           = useState<'newest' | 'oldest'>('newest');

  const debouncedQuery = useDebounce(searchQuery, 400);

  // ── Busca TMDB ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2) { setSearchResults([]); return; }
    const controller = new AbortController();
    setSearching(true);
    fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${tmdbApiKey}&query=${encodeURIComponent(debouncedQuery)}&language=pt-BR&include_adult=false`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((data) => {
        setSearchResults(
          (data.results ?? [])
            .filter((r: TMDBResult) => r.media_type === 'movie' || r.media_type === 'tv')
            .slice(0, 8)
        );
      })
      .catch(() => {})
      .finally(() => setSearching(false));
    return () => controller.abort();
  }, [debouncedQuery, tmdbApiKey]);

  // ── Itens filtrados ───────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    let base = activeCatId === ALL_CAT_ID
      ? watchlistItems.filter((i) => i.status === 'want' || i.status === 'watching')
      : watchlistItems.filter((i) => i.category_id === activeCatId);

    if (filterStatus) base = base.filter((i) => i.status === filterStatus);
    if (filterType !== 'all') base = base.filter((i) => i.media_type === filterType);

    return [...base].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? tb - ta : ta - tb;
    });
  }, [watchlistItems, activeCatId, filterStatus, filterType, sortOrder]);

  // ── Contadores ────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const base = activeCatId === ALL_CAT_ID
      ? watchlistItems
      : watchlistItems.filter((i) => i.category_id === activeCatId);
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
      setNewCatName(''); setShowNewCat(false);
      showToast('Categoria criada!'); fetchData();
    } catch { showToast('Erro ao criar categoria', 'error'); }
  }, [newCatName, onAddCategory, showToast, fetchData]);

  const handleDeleteCatConfirm = useCallback(async () => {
    if (!catToDelete) return;
    try {
      await onDeleteCategory(catToDelete.id);
      if (activeCatId === catToDelete.id) setActiveCatId(ALL_CAT_ID);
      showToast('Categoria removida', 'info'); fetchData();
    } catch { showToast('Erro ao remover categoria', 'error'); }
    finally { setCatToDelete(null); }
  }, [catToDelete, activeCatId, onDeleteCategory, showToast, fetchData]);

  const handleAddItem = useCallback(async (result: TMDBResult) => {
    const targetCatId = activeCatId === ALL_CAT_ID ? watchlistCategories[0]?.id : activeCatId;
    if (!targetCatId) { showToast('Crie uma categoria primeiro', 'info'); return; }
    const alreadyExists = watchlistItems.some((i) => i.tmdb_id === result.id && i.category_id === targetCatId);
    if (alreadyExists) { showToast('Já está nesta categoria!', 'info'); return; }
    const title = result.title ?? result.name ?? 'Sem título';
    const year = (result.release_date ?? result.first_air_date ?? '').slice(0, 4) || null;
    try {
      await onAddItem({ category_id: targetCatId, tmdb_id: result.id, title, poster_url: result.poster_path, synopsis: result.overview || null, year, media_type: result.media_type });
      showToast(`"${title}" adicionado!`);
      setSearchQuery(''); setSearchResults([]); setShowSearch(false); fetchData();
    } catch { showToast('Erro ao adicionar', 'error'); }
  }, [activeCatId, watchlistCategories, watchlistItems, onAddItem, showToast, fetchData]);

  const handleChangeStatus = useCallback(async (id: string, status: WatchStatus) => {
    try { await onChangeStatus(id, status); fetchData(); }
    catch { showToast('Erro ao atualizar status', 'error'); }
  }, [onChangeStatus, fetchData, showToast]);

  const handleDeleteItemConfirm = useCallback(async () => {
    if (!itemToDelete) return;
    try { await onDeleteItem(itemToDelete.id); showToast('Removido', 'info'); fetchData(); }
    catch { showToast('Erro ao remover', 'error'); }
    finally { setItemToDelete(null); }
  }, [itemToDelete, onDeleteItem, showToast, fetchData]);

  const handleRateItem = useCallback(async (itemId: string, rating: number) => {
    try { await onRateItem(itemId, rating); showToast('Avaliação salva! ⭐'); fetchData(); }
    catch { showToast('Erro ao salvar avaliação', 'error'); }
  }, [onRateItem, showToast, fetchData]);

  const activeCat = activeCatId === ALL_CAT_ID ? null : watchlistCategories.find((c) => c.id === activeCatId);
  const headerTitle = activeCatId === ALL_CAT_ID ? 'Para assistir' : (activeCat?.name ?? 'Selecione');

  return (
    <div className="space-y-4 pb-10">

      {/* ── 1. HEADER ──────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden border border-slate-700/50">
        <div className="relative z-10">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 block mb-1">
            Minha Watchlist
          </span>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-black tracking-tighter leading-none">{headerTitle}</p>
              <p className="text-[10px] text-white/40 font-bold mt-1 uppercase tracking-widest">
                {counts.total} títulos · {counts.watched} assistidos
              </p>
            </div>
            <button
              onClick={() => setShowSearch((v) => !v)}
              aria-label={showSearch ? 'Fechar busca' : 'Adicionar filme ou série'}
              className="flex flex-col items-center gap-1.5 bg-white/10 border border-white/10 px-4 py-3 rounded-2xl active:scale-95 transition-all"
            >
              {showSearch ? <X size={20} /> : <ListPlus size={20} />}
              <span className="text-[8px] font-black uppercase tracking-wider">{showSearch ? 'Fechar' : 'Adicionar'}</span>
            </button>
          </div>

          {/* Filtros de status */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {(['want', 'watching', 'watched'] as WatchStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(filterStatus === s ? null : s)}
                aria-pressed={filterStatus === s}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all active:scale-95 ${
                  filterStatus === s ? STATUS_CONFIG[s].bg + ' text-white' : 'bg-white/5 text-white/40 border border-white/10'
                }`}
              >
                {STATUS_CONFIG[s].icon} {counts[s]}
              </button>
            ))}

            {/* Toggle Filme/Série */}
            <div className="flex gap-1 ml-auto">
              {(['all', 'movie', 'tv'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  aria-pressed={filterType === t}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all active:scale-95 ${
                    filterType === t ? 'bg-white/20 text-white' : 'bg-white/5 text-white/30 border border-white/10'
                  }`}
                >
                  {t === 'all' ? 'Todos' : t === 'movie' ? <Film size={11} /> : <Tv size={11} />}
                </button>
              ))}
            </div>

            {/* Ordenação */}
            <button
              onClick={() => setSortOrder((v) => v === 'newest' ? 'oldest' : 'newest')}
              aria-label="Alternar ordenação"
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-[9px] font-black uppercase bg-white/5 text-white/30 border border-white/10 active:scale-95 transition-all"
            >
              <ArrowUpDown size={11} />
              {sortOrder === 'newest' ? 'Recentes' : 'Antigos'}
            </button>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-6 -top-6 w-24 h-24 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* ── 2. BUSCA TMDB ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-slate-800 border border-slate-700 rounded-[2rem] p-4 space-y-3 shadow-xl"
          >
            {activeCatId === ALL_CAT_ID && watchlistCategories.length > 0 && (
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest px-1">
                Adicionando em: <span className="text-blue-400">{watchlistCategories[0].name}</span>
              </p>
            )}
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <label htmlFor="tmdb-search" className="sr-only">Buscar filme ou série</label>
              <input
                id="tmdb-search"
                className="w-full pl-10 pr-10 py-3.5 bg-slate-900/70 border border-slate-600 rounded-2xl text-white placeholder:text-slate-500 text-sm font-medium outline-none focus:border-blue-500 transition-colors"
                placeholder="Buscar filme ou série..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searching
                ? <Loader2 size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                : searchQuery && <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"><X size={14} /></button>
              }
            </div>
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
                  {searchResults.map((result) => {
                    const title = result.title ?? result.name ?? 'Sem título';
                    const year = (result.release_date ?? result.first_air_date ?? '').slice(0, 4);
                    const targetCatId = activeCatId === ALL_CAT_ID ? watchlistCategories[0]?.id : activeCatId;
                    const alreadyIn = watchlistItems.some((i) => i.tmdb_id === result.id && i.category_id === targetCatId);
                    return (
                      <motion.button
                        key={result.id} layout
                        onClick={() => !alreadyIn && handleAddItem(result)}
                        disabled={alreadyIn}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                          alreadyIn
                            ? 'border-emerald-800/50 bg-emerald-900/20 opacity-60 cursor-not-allowed'
                            : 'border-slate-700 bg-slate-900/50 hover:border-blue-600 active:scale-[0.98]'
                        }`}
                      >
                        <div className="w-10 h-14 rounded-xl overflow-hidden bg-slate-700 shrink-0">
                          {result.poster_path
                            ? <img src={`https://image.tmdb.org/t/p/w92${result.poster_path}`} alt={title} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center">{result.media_type === 'movie' ? <Film size={16} className="text-slate-500" /> : <Tv size={16} className="text-slate-500" />}</div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-white text-xs truncate uppercase tracking-tight">{title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] text-slate-500 font-bold uppercase">{result.media_type === 'movie' ? 'Filme' : 'Série'}</span>
                            {year && <span className="text-[9px] text-slate-500 font-bold">{year}</span>}
                          </div>
                          {result.overview && <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">{result.overview}</p>}
                        </div>
                        {alreadyIn ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> : <Plus size={16} className="text-blue-400 shrink-0" />}
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
              {debouncedQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <p className="text-center text-slate-500 text-xs font-bold uppercase tracking-widest py-4">Nenhum resultado encontrado</p>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3. CATEGORIAS ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Categorias</span>
          <button onClick={() => setShowNewCat((v) => !v)} className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-blue-500 active:scale-95 transition-all">
            <Plus size={12} /> Nova
          </button>
        </div>

        <AnimatePresence>
          {showNewCat && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
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
                <button onClick={handleAddCategory} disabled={!newCatName.trim()} className="bg-blue-600 text-white px-4 rounded-2xl font-black active:scale-90 transition-all disabled:opacity-40">
                  <Plus size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lista de categorias — inclui "Todos" fixo no início */}
        <div className="flex flex-wrap gap-2">
          {/* Aba virtual "Todos" */}
          <button
            onClick={() => { setActiveCatId(ALL_CAT_ID); setFilterStatus(null); }}
            aria-pressed={activeCatId === ALL_CAT_ID}
            className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
              activeCatId === ALL_CAT_ID
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Todos
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg ${
              activeCatId === ALL_CAT_ID ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
            }`}>
              {watchlistItems.filter((i) => i.status !== 'watched').length}
            </span>
          </button>

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
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg ${active ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                    {catCount}
                  </span>
                </button>
                {active && (
                  <button onClick={() => setCatToDelete(cat)} className="w-7 h-7 flex items-center justify-center rounded-xl text-slate-300 dark:text-slate-600 hover:text-red-400 active:scale-90 transition-all">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}

          {watchlistCategories.length === 0 && (
            <p className="text-[10px] text-slate-300 dark:text-slate-600 font-black uppercase tracking-widest py-2">Crie sua primeira categoria</p>
          )}
        </div>
      </div>

      {/* ── 4. GRID ────────────────────────────────────────────────────────── */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Film size={36} className="text-slate-300 dark:text-slate-600" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 dark:text-slate-600 text-center">
            {activeCatId === ALL_CAT_ID
              ? 'Nenhum título pendente\nAdicione filmes e séries para assistir'
              : filterStatus
                ? `Nenhum título com status "${STATUS_CONFIG[filterStatus].label}"`
                : 'Nenhum título nesta categoria'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence>
            {filteredItems.map((item) => {
              const catName = activeCatId === ALL_CAT_ID
                ? watchlistCategories.find((c) => c.id === item.category_id)?.name
                : undefined;
              const itemRatings = watchlistRatings.filter((r) => r.item_id === item.id);
              return (
                <PosterCard
                  key={item.id}
                  item={item}
                  categoryName={catName}
                  ratings={itemRatings}
                  currentUserId={currentUserId}
                  onChangeStatus={handleChangeStatus}
                  onDelete={setItemToDelete}
                  onRate={handleRateItem}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── 5. MODAIS ──────────────────────────────────────────────────────── */}
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