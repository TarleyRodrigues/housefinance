import { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Circle, CheckCircle2, Trash2, ShoppingCart,
  X, AlertTriangle, Minus, ChevronDown, RotateCcw, Check,
  Tag, BookOpen, ChevronRight, History, RefreshCw, Pencil, Clock,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import { formatCurrency } from '../utils';
import type { ShoppingItem, ShoppingCatalogItem, CatalogPricePoint, ShoppingHistoryItem, ShoppingCategory } from '../types';

// Aplica máscara R$ em tempo real: "1690" → "16,90"
function applyMoneyMask(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  if (num === 0) return '';
  return (num / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Converte número para máscara: 16.9 → "16,90"
function numberToMask(n: number): string {
  return applyMoneyMask(String(Math.round(n * 100)));
}

// Parseia máscara para número: "1.234,56" → 1234.56
function parseMasked(masked: string): number {
  if (!masked) return 0;
  return parseFloat(masked.replace(/\./g, '').replace(',', '.')) || 0;
}

// Retorna preço por 100ml para itens com unidade L ou ml
function getPricePer100ml(item: ShoppingCatalogItem): number | null {
  const qty = item.package_qty;
  if (item.package_unit === 'ml') return (item.last_price / qty) * 100;
  if (item.package_unit === 'L')  return (item.last_price / (qty * 1000)) * 100;
  return null;
}

// Retorna tendência de preço comparando com o último registro histórico
function getPriceTrend(item: ShoppingCatalogItem): { direction: 'up' | 'down'; oldPrice: number } | null {
  const hist = item.price_history;
  if (!hist?.length) return null;
  const last = hist[hist.length - 1];
  if (last.price === item.last_price) return null;
  return { direction: last.price < item.last_price ? 'up' : 'down', oldPrice: last.price };
}

// Formata inteiro com separador de milhar: "2000" → "2.000"
function fmtInt(input: string): string {
  const d = input.replace(/\D/g, '');
  if (!d) return '';
  return parseInt(d, 10).toLocaleString('pt-BR');
}
function parseIntStr(s: string): number {
  return parseInt(s.replace(/\./g, ''), 10) || 0;
}
function gramsDisplay(g: number): string {
  return g >= 1000
    ? `${(g / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg`
    : `${g.toLocaleString('pt-BR')} g`;
}

type ItemMode = 'un' | 'liquid' | 'kg';

function ModeSelector({ value, onChange }: { value: ItemMode; onChange: (m: ItemMode) => void }) {
  const opts: { mode: ItemMode; label: string }[] = [
    { mode: 'un',     label: 'Unidade' },
    { mode: 'liquid', label: 'Líquido' },
    { mode: 'kg',     label: 'Peso/kg' },
  ];
  return (
    <div className="flex gap-1.5">
      {opts.map(({ mode, label }) => (
        <button key={mode} type="button" onClick={() => onChange(mode)}
          className={`flex-1 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all active:scale-95 ${
            value === mode
              ? mode === 'liquid'
                ? 'bg-sky-600 border-sky-600 text-white shadow-sm shadow-sky-500/30'
                : mode === 'kg'
                ? 'bg-amber-600 border-amber-600 text-white shadow-sm shadow-amber-500/30'
                : 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/30'
              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400'
          }`}>
          {label}
        </button>
      ))}
    </div>
  );
}

// Detecta o modo de um item do catálogo pelo package_unit
function getCatalogMode(unit: string): ItemMode {
  if (unit === 'ml' || unit === 'L') return 'liquid';
  if (unit === 'g' || unit === 'kg') return 'kg';
  return 'un';
}

interface FormState {
  name: string;
  qty: number;
  price: string;
  mode: ItemMode;
  unit: string;      // sub-tipo para modo UN (un/cx/pct/fd)
  volume_ml: string; // ml por unidade (modo Líquido)
  weight_g: string;  // gramas desejadas (modo Peso)
  category: string;
}
const EMPTY_FORM: FormState = { name: '', qty: 1, price: '', mode: 'un', unit: 'un', volume_ml: '', weight_g: '', category: '' };

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmDeleteModal
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmDeleteModal({ item, onConfirm, onCancel }: {
  item: ShoppingItem | null; onConfirm: () => void; onCancel: () => void;
}) {
  if (!item) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
        role="dialog" aria-modal="true" onClick={onCancel}>
        <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">Apagar item?</h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              <span className="font-bold text-slate-600 dark:text-slate-300">{item.item_name}</span>
              <br />Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onCancel} className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider active:scale-95 transition-all">Cancelar</button>
            <button onClick={onConfirm} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-red-500/30">Apagar</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmClearModal
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmClearModal({ count, onConfirm, onCancel }: {
  count: number; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
        role="dialog" aria-modal="true" onClick={onCancel}>
        <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">Limpar comprados?</h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              <span className="font-bold text-slate-600 dark:text-slate-300">{count} {count === 1 ? 'item' : 'itens'}</span>{' '}
              serão removidos permanentemente da lista.
            </p>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onCancel} className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider active:scale-95 transition-all">Cancelar</button>
            <button onClick={onConfirm} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-red-500/30">Limpar</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmBuyModal — registra preço real pago ao marcar como comprado
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmBuyModal({ item, catalogItems, isSaving, onJustMark, onSaveAndMark, onCancel }: {
  item: ShoppingItem;
  catalogItems: ShoppingCatalogItem[];
  isSaving: boolean;
  onJustMark: () => void;
  onSaveAndMark: (price: number, packageQty: number, unit: string) => void;
  onCancel: () => void;
}) {
  const match  = catalogItems.find(c => c.name.toLowerCase() === item.item_name.toLowerCase());
  const isKg   = !!item.weight_g;
  const isLiquid = !!item.volume_ml;

  // Kg: campos = gramas reais compradas + valor total pago
  const [actualGrams, setActualGrams] = useState(
    item.weight_g ? fmtInt(String(item.weight_g)) : ''
  );
  const [kgTotal, setKgTotal] = useState(
    match && item.weight_g ? numberToMask((match.last_price / match.package_qty) * item.weight_g) : ''
  );

  // Líquido / UN: campos = preço da unidade + qtd de referência do pacote
  const [price, setPrice]   = useState(match ? numberToMask(match.last_price) : '');
  const [pkgQty, setPkgQty] = useState(match ? String(match.package_qty) : item.volume_ml ? String(item.volume_ml) : '');
  const [pkgUnit, setPkgUnit] = useState(match?.package_unit ?? (isLiquid ? 'ml' : 'un'));

  const priceNum    = parseMasked(price);
  const pkgQtyNum   = parseFloat(pkgQty.replace(',', '.'));
  const kgTotalNum  = parseMasked(kgTotal);
  const actualGramsNum = parseIntStr(actualGrams);

  const canSaveKg = kgTotalNum > 0 && actualGramsNum > 0;
  const canSaveUn = priceNum > 0 && pkgQtyNum > 0;
  const canSave   = isKg ? canSaveKg : canSaveUn;

  const inputCls = 'w-full p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-white text-sm font-medium placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-300 dark:focus:border-emerald-700 transition-colors';

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
        role="dialog" aria-modal="true" onClick={onCancel}>
        <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}>

          <div className="flex items-start justify-between mb-5">
            <div className="flex-1 min-w-0 pr-3">
              <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">Confirmar compra</h3>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-0.5 truncate">{item.item_name}</p>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {isKg && item.weight_g && (
                  <span className="text-[10px] font-black text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-lg inline-block">
                    {gramsDisplay(item.weight_g)} solicitado
                  </span>
                )}
                {isLiquid && item.volume_ml && (item.quantity ?? 1) > 1 && (
                  <span className="text-[10px] font-black text-sky-500 bg-sky-50 dark:bg-sky-900/30 px-2 py-0.5 rounded-lg inline-block">
                    {item.quantity}× {item.volume_ml.toLocaleString('pt-BR')}ml
                  </span>
                )}
                {!isKg && !isLiquid && (item.quantity ?? 1) > 1 && (
                  <span className="text-[10px] font-black text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-lg inline-block">
                    ×{item.quantity}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onCancel} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-400 active:scale-90 transition-all shrink-0"><X size={16} /></button>
          </div>

          <div className="space-y-3 mb-5">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest">
              {isKg ? 'Quanto você comprou exatamente?' : 'Salvar no catálogo'}
              {!isKg && <span className="normal-case font-medium text-slate-300 dark:text-slate-600"> (opcional)</span>}
            </p>

            {isKg ? (
              /* Campos para itens de peso */
              <>
                <div className="relative">
                  <input type="text" inputMode="numeric" placeholder="0 g"
                    value={actualGrams}
                    onChange={(e) => setActualGrams(fmtInt(e.target.value))}
                    className={inputCls} />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">g</span>
                </div>
                {actualGramsNum > 0 && (
                  <p className="text-[10px] font-black text-amber-500 dark:text-amber-400">
                    = {gramsDisplay(actualGramsNum)}
                  </p>
                )}
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-black">R$</span>
                  <input type="text" inputMode="numeric" placeholder="Valor total pago"
                    value={kgTotal} onChange={(e) => setKgTotal(applyMoneyMask(e.target.value))}
                    className={`${inputCls} pl-10`} />
                </div>
                {canSaveKg && actualGramsNum >= 100 && (
                  <p className="text-[11px] font-black text-emerald-500 dark:text-emerald-400">
                    ≈ {formatCurrency((kgTotalNum / actualGramsNum) * 100)}/100g
                    · {formatCurrency((kgTotalNum / actualGramsNum) * 1000)}/kg
                  </p>
                )}
              </>
            ) : (
              /* Campos para itens líquidos e unidade */
              <>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-black">R$</span>
                  <input type="text" inputMode="numeric" placeholder="0,00"
                    value={price} onChange={(e) => setPrice(applyMoneyMask(e.target.value))}
                    className={`${inputCls} pl-10`} />
                </div>
                <input type="number" inputMode="decimal" min="1"
                  placeholder={isLiquid ? 'Volume (ml)' : 'Qtd por pacote'}
                  value={pkgQty} onChange={(e) => setPkgQty(e.target.value)}
                  className={inputCls} />
                {canSaveUn && (
                  <p className="text-[11px] font-black text-emerald-500 dark:text-emerald-400">
                    {isLiquid
                      ? `≈ ${formatCurrency((priceNum / pkgQtyNum) * 100)}/100ml`
                      : `≈ ${formatCurrency(priceNum / pkgQtyNum)} por un`
                    }
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={onJustMark} disabled={isSaving}
              className="flex-1 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider active:scale-95 transition-all disabled:opacity-50">
              Só marcar ✓
            </button>
            <button
              onClick={() => {
                if (!canSave) { onJustMark(); return; }
                if (isKg) { onSaveAndMark(kgTotalNum, actualGramsNum, 'g'); }
                else      { onSaveAndMark(priceNum, pkgQtyNum, pkgUnit || 'un'); }
              }}
              disabled={isSaving}
              className={`flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider active:scale-95 transition-all disabled:opacity-50 text-white ${
                canSave
                  ? isKg ? 'bg-amber-500 shadow-lg shadow-amber-500/30'
                    : 'bg-emerald-500 shadow-lg shadow-emerald-500/30'
                  : 'bg-blue-500 shadow-lg shadow-blue-500/20'
              }`}>
              {isSaving ? '...' : canSave ? 'Salvar e marcar' : 'Confirmar ✓'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CatalogSheet — catálogo com busca, filtro por categoria, edição, criação e exclusão
// ─────────────────────────────────────────────────────────────────────────────
type CatalogMode = ItemMode;
const EMPTY_CATALOG = { name: '', price: '', pkgQty: '', unit: 'un', category: '', mode: 'un' as CatalogMode, mlQty: '', gQty: '' };

function CatalogSheet({ catalogItems, allCategoriesExternal, onAdd, onCreate, onUpdate, onDelete, onClose, showToast }: {
  catalogItems: ShoppingCatalogItem[];
  allCategoriesExternal: string[];
  onAdd: (payload: { name: string; qty: number; price: number | null; category?: string; unit?: string; volume_ml?: number; weight_g?: number }) => Promise<void>;
  onCreate: (item: { name: string; package_qty: number; package_unit: string; last_price: number; category?: string }) => Promise<void>;
  onUpdate: (id: string, item: { name: string; package_qty: number; package_unit: string; last_price: number; category?: string; prevPrice?: number; priceHistory?: CatalogPricePoint[] }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
  showToast: (msg: string, type?: string) => void;
}) {
  const [search, setSearch]         = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState<ShoppingCatalogItem | null>(null);
  const [addQty, setAddQty]         = useState(1);
  const [addWeightG, setAddWeightG] = useState('');  // para itens kg
  const [isLoading, setIsLoading]   = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newForm, setNewForm]       = useState(EMPTY_CATALOG);
  const patchNew = (p: Partial<typeof EMPTY_CATALOG>) => setNewForm(f => ({ ...f, ...p }));

  const [editName, setEditName]                 = useState('');
  const [editPrice, setEditPrice]               = useState('');
  const [editPkgQty, setEditPkgQty]             = useState('');
  const [editUnit, setEditUnit]                 = useState('');
  const [editMode, setEditMode]                 = useState<CatalogMode>('un');
  const [editCategory, setEditCategory]         = useState('');
  const [editOriginalPrice, setEditOriginalPrice]   = useState(0);
  const [editPriceHistory, setEditPriceHistory]     = useState<CatalogPricePoint[]>([]);
  const [historyItem, setHistoryItem]               = useState<ShoppingCatalogItem | null>(null);

  const allCategories = allCategoriesExternal;

  const filtered = useMemo(() => {
    let list = catalogItems;
    if (activeCategory) list = list.filter(c => c.category === activeCategory);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(c => c.name.toLowerCase().includes(q));
    return list;
  }, [catalogItems, search, activeCategory]);

  const openEdit = (cat: ShoppingCatalogItem) => {
    const mode = getCatalogMode(cat.package_unit);
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditMode(mode);
    setEditPrice(numberToMask(cat.last_price));
    setEditPkgQty(String(cat.package_qty));
    setEditUnit(cat.package_unit);
    setEditCategory(cat.category ?? '');
    setEditOriginalPrice(cat.last_price);
    setEditPriceHistory(cat.price_history ?? []);
  };

  const editPriceNum  = parseMasked(editPrice);
  const editPkgQtyNum = (editMode === 'liquid' || editMode === 'kg')
    ? parseIntStr(editPkgQty)
    : parseFloat(editPkgQty.replace(',', '.'));
  const editCanSave   = editName.trim() !== '' && editPriceNum > 0 && editPkgQtyNum > 0;

  // Muda o modo no formulário de edição e ajusta o unit automaticamente
  const switchEditMode = (m: CatalogMode) => {
    setEditMode(m);
    if (m === 'liquid') { setEditUnit('ml'); setEditPkgQty(''); }
    else if (m === 'kg') { setEditUnit('g'); setEditPkgQty(''); }
    else { setEditUnit('un'); setEditPkgQty(''); }
  };

  const handleUpdate = async () => {
    if (!editingId || !editCanSave) return;
    setIsLoading(true);
    try {
      const unit = editMode === 'liquid' ? 'ml' : editMode === 'kg' ? 'g' : 'un';
      await onUpdate(editingId, {
        name: editName.trim(), last_price: editPriceNum,
        package_qty: editPkgQtyNum, package_unit: unit,
        category: editCategory.trim() || undefined,
        prevPrice: editOriginalPrice,
        priceHistory: editPriceHistory,
      });
      setEditingId(null);
      showToast('Catálogo atualizado!', 'success');
    } catch {
      showToast('Erro ao atualizar item', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToList = async () => {
    if (!addingItem) return;
    setIsLoading(true);
    const mode = getCatalogMode(addingItem.package_unit);
    try {
      if (mode === 'kg') {
        const grams = parseIntStr(addWeightG);
        if (!grams) { showToast('Informe quantas gramas deseja', 'error'); setIsLoading(false); return; }
        const pricePerG = addingItem.last_price / addingItem.package_qty;
        const estimatedTotal = pricePerG * grams;
        await onAdd({
          name: addingItem.name, qty: 1,
          price: estimatedTotal > 0 ? estimatedTotal : null,
          category: addingItem.category, unit: 'kg',
          weight_g: grams,
        });
      } else if (mode === 'liquid') {
        const unitPrice = addingItem.last_price; // last_price já é por unidade (mlQty ml)
        await onAdd({
          name: addingItem.name, qty: addQty, price: unitPrice,
          category: addingItem.category, unit: 'un',
          volume_ml: addingItem.package_qty,
        });
      } else {
        const unitPrice = addingItem.last_price / addingItem.package_qty;
        await onAdd({
          name: addingItem.name, qty: addQty, price: unitPrice,
          category: addingItem.category, unit: addingItem.package_unit,
        });
      }
      showToast(`${addingItem.name} adicionado à lista!`);
      setAddingItem(null);
      setAddQty(1);
      setAddWeightG('');
    } catch {
      showToast('Erro ao adicionar à lista', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const newPriceNum  = parseMasked(newForm.price);
  const newMlQtyNum  = parseIntStr(newForm.mlQty);
  const newGQtyNum   = parseIntStr(newForm.gQty);
  const newPkgQtyNum = parseFloat(newForm.pkgQty.replace(',', '.'));

  // Validação por modo
  const newCanSave = newForm.name.trim() !== '' && newPriceNum > 0 && (
    newForm.mode === 'liquid' ? newMlQtyNum > 0 :
    newForm.mode === 'kg'     ? newGQtyNum > 0 :
    newPkgQtyNum > 0
  );

  const handleCreate = async () => {
    if (!newCanSave) return;
    setIsLoading(true);
    try {
      const pkg_unit = newForm.mode === 'liquid' ? 'ml' : newForm.mode === 'kg' ? 'g' : 'un';
      const pkg_qty  = newForm.mode === 'liquid' ? newMlQtyNum : newForm.mode === 'kg' ? newGQtyNum : newPkgQtyNum;
      await onCreate({
        name: newForm.name.trim(), last_price: newPriceNum,
        package_qty: pkg_qty, package_unit: pkg_unit,
        category: newForm.category.trim() || undefined,
      });
      setNewForm(EMPTY_CATALOG);
      setIsCreating(false);
      showToast('Item adicionado ao catálogo!', 'success');
    } catch {
      showToast('Erro ao criar item', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsLoading(true);
    try {
      await onDelete(id);
      setDeletingId(null);
      showToast('Item removido do catálogo', 'info');
    } catch {
      showToast('Erro ao remover item', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
      className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-[250] flex flex-col"
      role="dialog" aria-modal="true" aria-label="Catálogo de preços">

      {/* Header */}
      <div className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 shrink-0">
        <div>
          <h2 className="font-black text-base uppercase tracking-tighter text-slate-800 dark:text-white flex items-center gap-2">
            <BookOpen size={18} className="text-blue-500" />
            Catálogo de Preços
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
            {catalogItems.length} {catalogItems.length === 1 ? 'item' : 'itens'} cadastrados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setIsCreating(v => !v); setEditingId(null); setDeletingId(null); }}
            aria-label="Novo item no catálogo"
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-wider active:scale-90 transition-all ${
              isCreating
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
            }`}>
            <Plus size={14} />
            Novo
          </button>
          <button onClick={onClose} aria-label="Fechar"
            className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 active:scale-90 transition-all">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="px-4 pt-3 pb-2 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 shrink-0 space-y-2">
        <input placeholder="Buscar no catálogo..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none focus:border-blue-300 dark:focus:border-blue-700 transition-colors" />

        {/* Filtro por categoria */}
        {allCategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setActiveCategory(null)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                !activeCategory
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}>
              Todos
            </button>
            {allCategories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  activeCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}>
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {/* Form de criação */}
        <AnimatePresence>
          {isCreating && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-2">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-blue-200 dark:border-blue-800 shadow-sm space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Novo item</p>
                <input value={newForm.name} onChange={(e) => patchNew({ name: e.target.value })} placeholder="Nome do item"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-blue-300 dark:focus:border-blue-700 transition-colors" />
                <ModeSelector value={newForm.mode} onChange={(m) => patchNew({ mode: m, pkgQty: '', mlQty: '', gQty: '' })} />
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">R$</span>
                  <input type="text" inputMode="numeric"
                    value={newForm.price} onChange={(e) => patchNew({ price: applyMoneyMask(e.target.value) })} placeholder="0,00"
                    className="w-full p-3 pl-8 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-blue-300 dark:focus:border-blue-700 transition-colors" />
                </div>
                {newForm.mode === 'liquid' && (
                  <div className="relative">
                    <input type="text" inputMode="numeric"
                      value={newForm.mlQty} onChange={(e) => patchNew({ mlQty: fmtInt(e.target.value) })}
                      placeholder="Volume por unidade (ml)"
                      className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-sky-300 dark:focus:border-sky-700 transition-colors" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">ml</span>
                  </div>
                )}
                {newForm.mode === 'kg' && (
                  <div className="relative">
                    <input type="text" inputMode="numeric"
                      value={newForm.gQty} onChange={(e) => patchNew({ gQty: fmtInt(e.target.value) })}
                      placeholder="Peso de referência (g)"
                      className="w-full p-3 pr-8 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-amber-300 dark:focus:border-amber-700 transition-colors" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">g</span>
                  </div>
                )}
                {newForm.mode === 'un' && (
                  <input type="number" inputMode="decimal" min="1"
                    value={newForm.pkgQty} onChange={(e) => patchNew({ pkgQty: e.target.value })} placeholder="Qtd no pacote"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-blue-300 dark:focus:border-blue-700 transition-colors" />
                )}
                {newCanSave && (
                  <p className="text-[10px] font-black text-emerald-500 dark:text-emerald-400">
                    {newForm.mode === 'liquid'
                      ? `≈ ${formatCurrency((newPriceNum / newMlQtyNum) * 100)}/100ml`
                      : newForm.mode === 'kg'
                      ? `≈ ${formatCurrency((newPriceNum / newGQtyNum) * 100)}/100g`
                      : `≈ ${formatCurrency(newPriceNum / newPkgQtyNum)} por un`
                    }
                  </p>
                )}
                <div className="relative">
                  <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={newForm.category} onChange={(e) => patchNew({ category: e.target.value })} placeholder="Categoria (ex: Limpeza)"
                    className="w-full p-3 pl-8 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-blue-300 dark:focus:border-blue-700 transition-colors" />
                </div>
                {allCategories.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {allCategories.map(c => (
                      <button key={c} type="button" onClick={() => patchNew({ category: newForm.category === c ? '' : c })}
                        className={`text-[9px] font-black px-2 py-1 rounded-lg border transition-all ${
                          newForm.category === c
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400'
                        }`}>
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setIsCreating(false); setNewForm(EMPTY_CATALOG); }}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-black text-xs uppercase active:scale-95 transition-all">
                    Cancelar
                  </button>
                  <button onClick={handleCreate} disabled={isLoading || !newCanSave}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-black text-xs uppercase active:scale-95 transition-all shadow-sm disabled:opacity-40">
                    {isLoading ? '...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filtered.length === 0 && !isCreating && (
          <p className="text-center text-slate-300 dark:text-slate-600 py-16 font-black uppercase text-[10px] tracking-[0.2em]">
            {search || activeCategory ? 'Nenhum item encontrado' : 'Catálogo vazio — clique em Novo para começar'}
          </p>
        )}

        <AnimatePresence initial={false}>
          {filtered.map((cat) => (
            <motion.div key={cat.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {editingId === cat.id ? (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-blue-200 dark:border-blue-800 shadow-sm space-y-3">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome do item"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-blue-300 dark:focus:border-blue-700 transition-colors" />
                  <ModeSelector value={editMode} onChange={switchEditMode} />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">R$</span>
                    <input type="text" inputMode="numeric"
                      value={editPrice} onChange={(e) => setEditPrice(applyMoneyMask(e.target.value))} placeholder="0,00"
                      className="w-full p-3 pl-8 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-blue-300 dark:focus:border-blue-700 transition-colors" />
                  </div>
                  {editMode === 'liquid' && (
                    <div className="relative">
                      <input type="text" inputMode="numeric"
                        value={editPkgQty} onChange={(e) => setEditPkgQty(fmtInt(e.target.value))}
                        placeholder="Volume por unidade (ml)"
                        className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-sky-300 dark:focus:border-sky-700 transition-colors" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">ml</span>
                    </div>
                  )}
                  {editMode === 'kg' && (
                    <div className="relative">
                      <input type="text" inputMode="numeric"
                        value={editPkgQty} onChange={(e) => setEditPkgQty(fmtInt(e.target.value))}
                        placeholder="Peso de referência (g)"
                        className="w-full p-3 pr-8 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-amber-300 dark:focus:border-amber-700 transition-colors" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">g</span>
                    </div>
                  )}
                  {editMode === 'un' && (
                    <input type="number" inputMode="decimal" min="1"
                      value={editPkgQty} onChange={(e) => setEditPkgQty(e.target.value)} placeholder="Qtd no pacote"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-blue-300 dark:focus:border-blue-700 transition-colors" />
                  )}
                  {editCanSave && (
                    <p className="text-[10px] font-black text-emerald-500 dark:text-emerald-400">
                      {editMode === 'liquid'
                        ? `≈ ${formatCurrency((editPriceNum / editPkgQtyNum) * 100)}/100ml`
                        : editMode === 'kg'
                        ? `≈ ${formatCurrency((editPriceNum / editPkgQtyNum) * 100)}/100g`
                        : `≈ ${formatCurrency(editPriceNum / editPkgQtyNum)} por un`
                      }
                    </p>
                  )}
                  <div className="relative">
                    <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="Categoria (ex: Limpeza)"
                      className="w-full p-3 pl-8 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-blue-300 dark:focus:border-blue-700 transition-colors" />
                  </div>
                  {allCategories.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {allCategories.map(c => (
                        <button key={c} type="button" onClick={() => setEditCategory(c)}
                          className={`text-[9px] font-black px-2 py-1 rounded-lg border transition-all ${
                            editCategory === c
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400'
                          }`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(null)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-black text-xs uppercase active:scale-95 transition-all">
                      Cancelar
                    </button>
                    <button onClick={handleUpdate} disabled={isLoading || !editCanSave}
                      className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-black text-xs uppercase active:scale-95 transition-all shadow-sm disabled:opacity-40">
                      {isLoading ? '...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              ) : deletingId === cat.id ? (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border-2 border-red-200 dark:border-red-800 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-red-700 dark:text-red-300 truncate">{cat.name}</p>
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-wider mt-0.5">Confirmar exclusão?</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => setDeletingId(null)}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] font-black uppercase active:scale-95 transition-all min-h-[36px]">
                      Não
                    </button>
                    <button onClick={() => handleDelete(cat.id)} disabled={isLoading}
                      className="px-3 py-2 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase active:scale-95 transition-all shadow-sm min-h-[36px] disabled:opacity-50">
                      {isLoading ? '...' : 'Excluir'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate">{cat.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] font-black text-emerald-500 dark:text-emerald-400">
                        {formatCurrency(cat.last_price / cat.package_qty)}/{cat.package_unit}
                      </span>
                      {(() => {
                        const mlPrice = getPricePer100ml(cat);
                        return mlPrice ? (
                          <span className="text-[9px] font-black text-sky-500 dark:text-sky-400">
                            ≈ {formatCurrency(mlPrice)}/100ml
                          </span>
                        ) : null;
                      })()}
                      <span className="text-[9px] text-slate-300 dark:text-slate-600 font-medium">
                        pacote {formatCurrency(cat.last_price)}/{cat.package_qty}{cat.package_unit}
                      </span>
                      {(() => {
                        const trend = getPriceTrend(cat);
                        return trend ? (
                          <span className={`text-[9px] font-black ${trend.direction === 'up' ? 'text-red-400' : 'text-emerald-500'}`}>
                            {trend.direction === 'up' ? '↑' : '↓'} era {formatCurrency(trend.oldPrice)}
                          </span>
                        ) : null;
                      })()}
                      {cat.category && (
                        <span className="text-[9px] font-black text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-lg">
                          {cat.category}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {(cat.price_history?.length ?? 0) > 0 && (
                      <button onClick={() => setHistoryItem(cat)}
                        aria-label={`Histórico de preços de ${cat.name}`}
                        className="p-2 rounded-xl text-slate-300 dark:text-slate-600 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 active:scale-90 transition-all min-h-[36px]">
                        <Clock size={15} />
                      </button>
                    )}
                    <button onClick={() => { setDeletingId(cat.id); setEditingId(null); }}
                      aria-label={`Excluir ${cat.name}`}
                      className="p-2 rounded-xl text-slate-300 dark:text-slate-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-90 transition-all min-h-[36px]">
                      <Trash2 size={15} />
                    </button>
                    <button onClick={() => { openEdit(cat); setDeletingId(null); }}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] font-black uppercase active:scale-95 transition-all min-h-[36px]">
                      Editar
                    </button>
                    <button onClick={() => { setAddingItem(cat); setAddQty(1); }}
                      className="px-3 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase active:scale-95 transition-all shadow-sm min-h-[36px]">
                      + Lista
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modal: histórico de preços do item */}
      <AnimatePresence>
        {historyItem && (() => {
          // Monta timeline completa: mais recente primeiro
          const timeline: { price: number; date: string }[] = [
            { price: historyItem.last_price, date: historyItem.updated_at },
            ...[...(historyItem.price_history ?? [])].reverse(),
          ];
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm z-10 flex items-end justify-center p-4"
              onClick={() => setHistoryItem(null)}>
              <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl max-h-[70vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Clock size={14} className="text-violet-500 shrink-0" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-violet-500">Histórico de Preços</p>
                    </div>
                    <h3 className="font-black text-slate-800 dark:text-white text-base leading-tight truncate">{historyItem.name}</h3>
                    {historyItem.category && (
                      <span className="text-[9px] font-black text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-lg inline-block mt-1">
                        {historyItem.category}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setHistoryItem(null)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-400 active:scale-90 transition-all shrink-0">
                    <X size={16} />
                  </button>
                </div>

                {/* Timeline */}
                <div className="overflow-y-auto flex-1 space-y-0 pr-1">
                  {timeline.map((entry, idx) => {
                    const next = timeline[idx + 1]; // próximo = mais antigo
                    const isFirst = idx === 0;
                    const diff = next ? entry.price - next.price : 0;
                    const pct  = next && next.price > 0 ? (diff / next.price) * 100 : 0;
                    const wentUp   = diff > 0;
                    const wentDown = diff < 0;
                    const dateObj  = new Date(entry.date);
                    const dateStr  = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
                    return (
                      <div key={idx} className="flex gap-3 items-start">
                        {/* Linha do tempo */}
                        <div className="flex flex-col items-center shrink-0 pt-1">
                          <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${isFirst ? 'border-violet-500 bg-violet-500' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`} />
                          {idx < timeline.length - 1 && (
                            <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 min-h-[32px]" />
                          )}
                        </div>

                        {/* Conteúdo */}
                        <div className="pb-5 flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className={`font-black text-base ${isFirst ? 'text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                {formatCurrency(entry.price)}
                                {isFirst && <span className="text-[10px] font-black text-violet-400 ml-1.5 uppercase tracking-wider">atual</span>}
                              </p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{dateStr}</p>
                            </div>
                            {/* Indicador de variação vs preço anterior (mais antigo) */}
                            {next && (
                              <div className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-black shrink-0 ${
                                wentUp
                                  ? 'bg-red-50 dark:bg-red-900/20 text-red-500'
                                  : wentDown
                                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                              }`}>
                                {wentUp
                                  ? <TrendingUp size={12} />
                                  : wentDown
                                  ? <TrendingDown size={12} />
                                  : null
                                }
                                {diff !== 0
                                  ? `${wentUp ? '+' : ''}${pct.toFixed(1)}%`
                                  : '='
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[9px] text-slate-300 dark:text-slate-600 font-medium text-center mt-2">
                  {timeline.length} registro{timeline.length !== 1 ? 's' : ''} · variação comparada ao preço anterior
                </p>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Mini-modal: quantidade ao adicionar à lista */}
      <AnimatePresence>
        {addingItem && (() => {
          const addMode = getCatalogMode(addingItem.package_unit);
          const weightG = parseIntStr(addWeightG);
          const estimateKg = addMode === 'kg' && weightG > 0
            ? (addingItem.last_price / addingItem.package_qty) * weightG
            : null;
          const estimateOther = addMode === 'liquid'
            ? addingItem.last_price * addQty
            : (addingItem.last_price / addingItem.package_qty) * addQty;
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm z-10 flex items-end justify-center p-4"
              onClick={() => { setAddingItem(null); setAddWeightG(''); }}>
              <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
                onClick={(e) => e.stopPropagation()}>
                <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight mb-0.5">Adicionar à lista</h3>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-0.5 truncate">{addingItem.name}</p>
                {addingItem.category && (
                  <span className="text-[9px] font-black text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-lg inline-block mb-4">
                    {addingItem.category}
                  </span>
                )}
                {!addingItem.category && <div className="mb-4" />}

                {addMode === 'kg' ? (
                  <>
                    <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Quantas gramas?
                    </p>
                    <div className="relative mb-3">
                      <input type="text" inputMode="numeric"
                        value={addWeightG} onChange={(e) => setAddWeightG(fmtInt(e.target.value))}
                        placeholder="Ex: 500, 1.500..."
                        className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-base font-black text-slate-800 dark:text-white outline-none focus:border-amber-300 dark:focus:border-amber-700 transition-colors" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">g</span>
                    </div>
                    {weightG > 0 && (
                      <p className="text-xs text-amber-500 dark:text-amber-400 font-black mb-5">
                        ≈ {gramsDisplay(weightG)} — estimativa: {formatCurrency(estimateKg!)}
                      </p>
                    )}
                    {!weightG && <div className="mb-5" />}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {addMode === 'liquid' ? `Unidades (${addingItem.package_qty}${addingItem.package_unit} cada)` : `Quantidade (${addingItem.package_unit})`}
                      </span>
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-2xl p-1">
                        <button type="button" onClick={() => setAddQty(q => Math.max(1, q - 1))}
                          className="w-9 h-9 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm active:scale-90 transition-all text-slate-600 dark:text-slate-300">
                          <Minus size={14} />
                        </button>
                        <span className="text-base font-black text-slate-700 dark:text-slate-200 w-8 text-center">{addQty}</span>
                        <button type="button" onClick={() => setAddQty(q => q + 1)}
                          className="w-9 h-9 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm active:scale-90 transition-all text-slate-600 dark:text-slate-300">
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-emerald-500 dark:text-emerald-400 font-black mb-5">
                      Estimativa: {formatCurrency(estimateOther)}
                      {addMode === 'liquid' && (
                        <span className="text-slate-400 font-medium ml-1">
                          ({addQty} × {addingItem.package_qty}{addingItem.package_unit})
                        </span>
                      )}
                    </p>
                  </>
                )}

                <div className="flex gap-3">
                  <button onClick={() => { setAddingItem(null); setAddWeightG(''); }}
                    className="flex-1 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase active:scale-95 transition-all">
                    Cancelar
                  </button>
                  <button onClick={handleAddToList} disabled={isLoading || (addMode === 'kg' && !weightG)}
                    className={`flex-1 py-3.5 rounded-2xl font-black text-xs uppercase active:scale-95 transition-all shadow-lg disabled:opacity-50 text-white ${
                      addMode === 'kg'
                        ? 'bg-amber-500 shadow-amber-500/20'
                        : addMode === 'liquid'
                        ? 'bg-sky-600 shadow-sky-500/20'
                        : 'bg-blue-600 shadow-blue-500/20'
                    }`}>
                    {isLoading ? '...' : 'Adicionar'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ModoMercado — agrupado por categoria quando disponível
// ─────────────────────────────────────────────────────────────────────────────
function ModoMercado({ items, onToggle, onClose }: {
  items: ShoppingItem[];
  onToggle: (id: string, current: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const pending = items.filter(i => i.is_pending);
  const done    = items.filter(i => !i.is_pending);
  const allDone = pending.length === 0;

  // Agrupa pendentes por categoria
  const grouped = useMemo<[string, ShoppingItem[]][]>(() => {
    const groups = new Map<string, ShoppingItem[]>();
    const noCat: ShoppingItem[] = [];
    pending.forEach(item => {
      if (item.category) {
        if (!groups.has(item.category)) groups.set(item.category, []);
        groups.get(item.category)!.push(item);
      } else {
        noCat.push(item);
      }
    });
    const sorted: [string, ShoppingItem[]][] = Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
    if (noCat.length > 0) sorted.push(['Outros', noCat]);
    return sorted;
  }, [pending]);

  const hasCategories = grouped.some(([cat]) => cat !== 'Outros') && grouped.length > 1;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (cat: string) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
      className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-[250] flex flex-col"
      role="dialog" aria-modal="true" aria-label="Modo mercado">

      <div className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
        <div>
          <h2 className="font-black text-lg uppercase tracking-tighter text-slate-800 dark:text-white flex items-center gap-2">
            <ShoppingCart size={20} className="text-blue-500" />
            Modo Mercado
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
            {done.length} de {items.length} itens marcados
          </p>
        </div>
        <button onClick={onClose} aria-label="Fechar" className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 active:scale-90 transition-all">
          <X size={20} />
        </button>
      </div>

      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 w-full">
        <motion.div className="h-full bg-emerald-500 rounded-full"
          animate={{ width: items.length > 0 ? `${(done.length / items.length) * 100}%` : '0%' }}
          transition={{ duration: 0.4 }} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {allDone ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
            <p className="font-black text-xl text-slate-800 dark:text-white uppercase tracking-tight">Tudo comprado!</p>
            <p className="text-sm text-slate-400 font-medium">Todos os {items.length} itens foram marcados.</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {hasCategories ? (
              /* Vista agrupada por categoria */
              grouped.map(([cat, catItems]) => {
                const allCatDone = catItems.every(i => !i.is_pending);
                const isCollapsed = collapsed.has(cat);
                return (
                  <div key={cat}>
                    {/* Header do grupo */}
                    <button
                      onClick={() => toggleCollapse(cat)}
                      className="w-full flex items-center justify-between px-2 py-2 mb-2"
                      aria-expanded={!isCollapsed}>
                      <div className="flex items-center gap-2">
                        {allCatDone
                          ? <CheckCircle2 size={14} className="text-emerald-500" />
                          : <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-400" />
                        }
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                          allCatDone ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          {cat}
                        </span>
                        <span className="text-[9px] font-medium text-slate-300 dark:text-slate-600">
                          ({catItems.length})
                        </span>
                      </div>
                      <ChevronRight size={14} className={`text-slate-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                    </button>

                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                          {catItems.map(item => (
                            <motion.button key={item.id} layout
                              onClick={() => onToggle(item.id, item.is_pending)}
                              aria-label={`Marcar ${item.item_name} como comprado`}
                              className={`w-full p-4 rounded-2xl border flex items-center gap-3 active:scale-[0.98] transition-all text-left ${
                                item.is_pending
                                  ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm'
                                  : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 opacity-50'
                              }`}>
                              {item.is_pending
                                ? <Circle size={22} className="text-slate-200 dark:text-slate-600 shrink-0" />
                                : <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
                              }
                              <div className="flex-1 min-w-0">
                                <span className={`font-bold text-base block truncate ${
                                  item.is_pending ? 'text-slate-800 dark:text-white' : 'text-slate-400 line-through'
                                }`}>
                                  {item.item_name}
                                </span>
                                <div className="flex gap-2 mt-0.5">
                                  {((item.quantity ?? 1) > 1 || (item.unit && item.unit !== 'un')) && (
                                    <span className="text-[10px] font-black text-blue-500">
                                      {item.unit && item.unit !== 'un'
                                        ? `${item.quantity ?? 1}×${item.unit}`
                                        : `×${item.quantity}`}
                                    </span>
                                  )}
                                  {item.estimated_price && (
                                    <span className="text-[10px] font-black text-slate-400">
                                      {formatCurrency(Number(item.estimated_price) * (item.quantity ?? 1))}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            ) : (
              /* Vista plana (sem categorias ou só uma) */
              <div className="space-y-3">
                <AnimatePresence>
                  {pending.map(item => (
                    <motion.button layout key={item.id}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10, height: 0 }}
                      onClick={() => onToggle(item.id, item.is_pending)}
                      className="w-full bg-white dark:bg-slate-800 p-5 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-all text-left">
                      <Circle size={28} className="text-slate-200 dark:text-slate-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-black text-lg text-slate-800 dark:text-white block truncate">{item.item_name}</span>
                        <div className="flex items-center gap-3 mt-0.5">
                          {((item.quantity ?? 1) > 1 || (item.unit && item.unit !== 'un')) && (
                            <span className="text-[10px] font-black text-blue-500">
                              {item.unit && item.unit !== 'un'
                                ? `${item.quantity ?? 1}×${item.unit}`
                                : `×${item.quantity}`}
                            </span>
                          )}
                          {item.estimated_price && (
                            <span className="text-[10px] font-black text-slate-400">
                              {formatCurrency(Number(item.estimated_price) * (item.quantity ?? 1))}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Itens comprados (seção menor no fim) */}
            {done.length > 0 && !hasCategories && (
              <div className="pt-2 space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600 px-1">
                  Já no carrinho ({done.length})
                </p>
                {done.map(item => (
                  <button key={item.id} onClick={() => onToggle(item.id, item.is_pending)}
                    className="w-full bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3 opacity-50 active:scale-[0.98] transition-all">
                    <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
                    <span className="font-bold text-sm text-slate-400 line-through truncate">{item.item_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {items.some(i => i.estimated_price) && (
        <div className="p-5 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estimativa total</span>
            <span className="font-black text-lg text-slate-800 dark:text-white">
              {formatCurrency(items.filter(i => i.estimated_price).reduce((acc, i) => acc + Number(i.estimated_price) * (i.quantity ?? 1), 0))}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HistorySheet — timeline de compras agrupada por dia
// ─────────────────────────────────────────────────────────────────────────────
function HistorySheet({ history, onClose, onRefresh }: {
  history: ShoppingHistoryItem[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, ShoppingHistoryItem[]>();
    history.forEach(item => {
      const key = new Date(item.purchased_at).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    const today     = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    return Array.from(map.entries()).map(([key, items]) => {
      const d = new Date(key);
      const label = d.toDateString() === today.toDateString()
        ? 'Hoje'
        : d.toDateString() === yesterday.toDateString()
        ? 'Ontem'
        : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
      const total = items.reduce((acc, i) => acc + (i.price ? Number(i.price) * (i.quantity ?? 1) : 0), 0);
      return { label, items, total };
    });
  }, [history]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await onRefresh(); } finally { setIsRefreshing(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
      className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-[250] flex flex-col"
      role="dialog" aria-modal="true" aria-label="Histórico de compras">

      <div className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 shrink-0">
        <div>
          <h2 className="font-black text-base uppercase tracking-tighter text-slate-800 dark:text-white flex items-center gap-2">
            <History size={18} className="text-violet-500" />
            Histórico
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
            {history.length} {history.length === 1 ? 'item comprado' : 'itens comprados'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} disabled={isRefreshing} aria-label="Atualizar histórico"
            className="p-2.5 bg-slate-100 dark:bg-slate-700 rounded-2xl text-slate-500 active:scale-90 transition-all disabled:opacity-50">
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={onClose} aria-label="Fechar"
            className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 active:scale-90 transition-all">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-10">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-24">
            <History size={36} className="text-slate-200 dark:text-slate-700" />
            <p className="text-center text-slate-300 dark:text-slate-600 font-black uppercase text-[10px] tracking-[0.2em]">
              Nenhum item no histórico
            </p>
          </div>
        ) : grouped.map(({ label, items, total }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</span>
              {total > 0 && (
                <span className="text-[10px] font-black text-emerald-500 dark:text-emerald-400">{formatCurrency(total)}</span>
              )}
            </div>
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id}
                  className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate">{item.item_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {item.weight_g ? (
                        <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-lg">
                          {gramsDisplay(item.weight_g)}
                        </span>
                      ) : item.volume_ml ? (
                        <span className="text-[9px] font-black text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 px-1.5 py-0.5 rounded-lg">
                          {(item.quantity ?? 1) > 1 ? `${item.quantity}×` : ''}
                          {item.volume_ml >= 1000
                            ? `${(item.volume_ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L`
                            : `${item.volume_ml}ml`}
                        </span>
                      ) : (item.quantity ?? 1) > 1 ? (
                        <span className="text-[9px] font-black text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-lg">
                          ×{item.quantity}
                        </span>
                      ) : null}
                      {item.category && (
                        <span className="text-[9px] font-black text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-1.5 py-0.5 rounded-lg">
                          {item.category}
                        </span>
                      )}
                      <span className="text-[9px] text-slate-300 dark:text-slate-600 font-medium">
                        {new Date(item.purchased_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  {item.price && (
                    <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 shrink-0">
                      {formatCurrency(Number(item.price) * (item.quantity ?? 1))}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  shoppingList: ShoppingItem[];
  catalogItems: ShoppingCatalogItem[];
  shoppingHistory: ShoppingHistoryItem[];
  shoppingCategories: ShoppingCategory[];
  showToast: (msg: string, type?: string) => void;
  onAdd: (payload: { name: string; qty: number; price: number | null; category?: string; unit?: string; volume_ml?: number; weight_g?: number }) => Promise<void>;
  onToggle: (id: string, current: boolean, historyPrice?: number, historyWeightG?: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClearDone: () => Promise<void>;
  onCreateCatalog: (item: { name: string; package_qty: number; package_unit: string; last_price: number; category?: string }) => Promise<void>;
  onUpsertCatalog: (item: { name: string; package_qty: number; package_unit: string; last_price: number; category?: string }) => Promise<void>;
  onUpdateCatalog: (id: string, item: { name: string; package_qty: number; package_unit: string; last_price: number; category?: string; prevPrice?: number; priceHistory?: CatalogPricePoint[] }) => Promise<void>;
  onDeleteCatalog: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onRenameItem: (id: string, name: string) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// TabCompras
// ─────────────────────────────────────────────────────────────────────────────
export function TabCompras({
  shoppingList, catalogItems, shoppingHistory, shoppingCategories, showToast,
  onAdd, onToggle, onDelete, onClearDone, onCreateCatalog, onUpsertCatalog, onUpdateCatalog, onDeleteCatalog, onRefresh, onRenameItem,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const patch = (partial: Partial<FormState>) => setForm(f => ({ ...f, ...partial }));

  const [itemToDelete, setItemToDelete]         = useState<ShoppingItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isMercadoOpen, setIsMercadoOpen]       = useState(false);
  const [isCatalogOpen, setIsCatalogOpen]       = useState(false);
  const [isHistoryOpen, setIsHistoryOpen]       = useState(false);
  const [isRefreshing, setIsRefreshing]         = useState(false);
  const [showCategoryField, setShowCategoryField] = useState(false);
  const [showNewCatInput, setShowNewCatInput]     = useState(false);
  const [newCatValue, setNewCatValue]             = useState('');

  // Autocomplete
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Item do catálogo atualmente selecionado — usado para auto-calcular preço
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<ShoppingCatalogItem | null>(null);

  // Filtro de categoria na lista principal
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Modal de compra (só para itens sem preço)
  const [confirmBuyItem, setConfirmBuyItem] = useState<ShoppingItem | null>(null);
  const [isSavingBuy, setIsSavingBuy]       = useState(false);

  // Edição inline de nome
  const [editingItemId, setEditingItemId]   = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState('');

  const { pending, done } = useMemo(
    () => ({ pending: shoppingList.filter(i => i.is_pending), done: shoppingList.filter(i => !i.is_pending) }),
    [shoppingList]
  );

  const estimativaTotal = useMemo(
    () => pending.filter(i => i.estimated_price).reduce((acc, i) => acc + Number(i.estimated_price) * (i.quantity ?? 1), 0),
    [pending]
  );

  // Categorias únicas dos itens pendentes (para chips de filtro)
  const pendingCategories = useMemo(() => {
    const cats = new Set(pending.map(i => i.category).filter(Boolean) as string[]);
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [pending]);

  // Categorias: gerenciadas em Ajustes + retrocompat com itens/catálogo existentes
  const allCategories = useMemo(() => {
    const cats = new Set([
      ...shoppingCategories.map(c => c.name),
      ...catalogItems.map(c => c.category).filter(Boolean),
      ...shoppingList.map(i => i.category).filter(Boolean),
    ] as string[]);
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [shoppingCategories, catalogItems, shoppingList]);

  // Lista filtrada por categoria ativa
  const filteredPending = useMemo(() => {
    if (!activeCategory) return pending;
    const f = pending.filter(i => i.category === activeCategory);
    return f.length > 0 ? f : pending;
  }, [pending, activeCategory]);

  // Autocomplete suggestions
  const suggestions = useMemo(() => {
    const q = form.name.trim().toLowerCase();
    if (q.length < 2) return [];
    return catalogItems.filter(c => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [form.name, catalogItems]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const selectSuggestion = useCallback((cat: ShoppingCatalogItem) => {
    setSelectedCatalogItem(cat);
    const mode = getCatalogMode(cat.package_unit);
    if (mode === 'liquid') {
      patch({ name: cat.name, mode: 'liquid', price: numberToMask(cat.last_price), volume_ml: String(cat.package_qty), category: cat.category ?? '' });
    } else if (mode === 'kg') {
      patch({ name: cat.name, mode: 'kg', price: '', weight_g: '', category: cat.category ?? '' });
    } else {
      patch({ name: cat.name, mode: 'un', price: numberToMask(cat.last_price / cat.package_qty), unit: cat.package_unit, category: cat.category ?? '' });
    }
    setShowSuggestions(false);
    nameInputRef.current?.blur();
  }, []);

  const handleAdd = useCallback(async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await onAdd({
        name: form.name.trim(),
        qty: form.mode === 'kg' ? 1 : form.qty,
        price: form.price ? parseMasked(form.price) : null,
        category: form.category.trim() || undefined,
        unit: form.mode === 'liquid' ? 'un' : form.mode === 'kg' ? 'kg' : 'un',
        ...(form.mode === 'liquid' && form.volume_ml ? { volume_ml: parseIntStr(form.volume_ml) } : {}),
        ...(form.mode === 'kg' && form.weight_g ? { weight_g: parseIntStr(form.weight_g) } : {}),
      });
      setForm(EMPTY_FORM);
      setSelectedCatalogItem(null);
      setShowCategoryField(false);
      setShowSuggestions(false);
      showToast('Item adicionado!');
    } catch {
      showToast('Erro ao adicionar item', 'error');
    }
  }, [form, onAdd, showToast]);

  const handleToggle = useCallback(async (id: string, current: boolean, historyPrice?: number, historyWeightG?: number) => {
    try { await onToggle(id, current, historyPrice, historyWeightG); }
    catch { showToast('Erro ao atualizar item', 'error'); }
  }, [onToggle, showToast]);

  const handleConfirmBuyJust = useCallback(async () => {
    if (!confirmBuyItem) return;
    setIsSavingBuy(true);
    try {
      await handleToggle(confirmBuyItem.id, confirmBuyItem.is_pending);
      showToast('Item marcado como comprado!', 'success');
    } catch {
      showToast('Erro ao marcar item', 'error');
    } finally { setIsSavingBuy(false); setConfirmBuyItem(null); }
  }, [confirmBuyItem, handleToggle, showToast]);

  const handleConfirmBuySave = useCallback(async (price: number, packageQty: number, unit: string) => {
    if (!confirmBuyItem) return;
    setIsSavingBuy(true);
    const isKg = !!confirmBuyItem.weight_g;
    try {
      await onUpsertCatalog({
        name: confirmBuyItem.item_name, last_price: price,
        package_qty: packageQty, package_unit: unit,
        category: confirmBuyItem.category,
      });
      // Passa preço real e peso real para o histórico
      await handleToggle(
        confirmBuyItem.id,
        confirmBuyItem.is_pending,
        price,
        isKg ? packageQty : undefined,
      );
      showToast('Preço salvo no catálogo!', 'success');
    } catch {
      showToast('Erro ao confirmar compra', 'error');
    } finally { setIsSavingBuy(false); setConfirmBuyItem(null); }
  }, [confirmBuyItem, onUpsertCatalog, handleToggle, showToast]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!itemToDelete) return;
    try {
      await onDelete(itemToDelete.id);
      showToast('Item removido', 'info');
    } catch {
      showToast('Erro ao remover item', 'error');
    } finally { setItemToDelete(null); }
  }, [itemToDelete, onDelete, showToast]);

  const handleClearDone = useCallback(async () => {
    try {
      await onClearDone();
      showToast(`${done.length} itens removidos`, 'info');
    } catch {
      showToast('Erro ao limpar itens', 'error');
    }
  }, [onClearDone, done.length, showToast]);

  const startEditItem = useCallback((item: ShoppingItem) => {
    setEditingItemId(item.id);
    setEditingItemName(item.item_name);
  }, []);

  const handleRenameBlur = useCallback(async (item: ShoppingItem) => {
    const trimmed = editingItemName.trim();
    if (!trimmed || trimmed === item.item_name) { setEditingItemId(null); return; }
    try {
      await onRenameItem(item.id, trimmed);
    } catch {
      showToast('Erro ao renomear item', 'error');
    } finally {
      setEditingItemId(null);
    }
  }, [editingItemName, onRenameItem, showToast]);

  return (
    <div className="space-y-4">

      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-[2.5rem] shadow-2xl shadow-blue-500/30 text-white relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-44 h-44 bg-white/8 rounded-full pointer-events-none" />
        <div className="absolute -left-6 -bottom-8 w-32 h-32 bg-indigo-400/20 rounded-full pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 block mb-1">Lista de Compras</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tighter">{pending.length}</span>
              <span className="text-sm font-black opacity-50">/ {shoppingList.length} itens</span>
            </div>
            {estimativaTotal > 0 && (
              <span className="text-[10px] font-bold opacity-70 mt-1 block">
                Estimativa: {formatCurrency(estimativaTotal)}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-1.5">
              {shoppingList.length > 0 && (
                <button onClick={() => setIsMercadoOpen(true)} aria-label="Modo mercado"
                  className="flex items-center gap-1 bg-white/15 border border-white/20 px-2.5 py-2 rounded-2xl active:scale-95 transition-all">
                  <ShoppingCart size={14} />
                  <span className="text-[9px] font-black uppercase tracking-wider">Mercado</span>
                </button>
              )}
              <button
                onClick={async () => { setIsRefreshing(true); try { await onRefresh(); } finally { setIsRefreshing(false); } }}
                disabled={isRefreshing} aria-label="Atualizar lista"
                className="p-2 bg-white/10 border border-white/15 rounded-2xl active:scale-95 transition-all disabled:opacity-50">
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setIsCatalogOpen(true)} aria-label="Catálogo de preços"
                className="flex items-center gap-1 bg-white/10 border border-white/15 px-2.5 py-2 rounded-2xl active:scale-95 transition-all flex-1">
                <BookOpen size={14} />
                <span className="text-[9px] font-black uppercase tracking-wider">
                  Catálogo {catalogItems.length > 0 ? `(${catalogItems.length})` : ''}
                </span>
              </button>
              <button onClick={() => setIsHistoryOpen(true)} aria-label="Histórico de compras"
                className="flex items-center gap-1 bg-white/10 border border-white/15 px-2.5 py-2 rounded-2xl active:scale-95 transition-all flex-1">
                <History size={14} />
                <span className="text-[9px] font-black uppercase tracking-wider">Histórico</span>
              </button>
            </div>
          </div>
        </div>

        {shoppingList.length > 0 && done.length > 0 && (
          <div className="relative z-10 mt-4 space-y-1">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div className="h-full bg-emerald-400 rounded-full"
                animate={{ width: `${(done.length / shoppingList.length) * 100}%` }}
                transition={{ duration: 0.5 }} />
            </div>
            <p className="text-[9px] font-black opacity-40 uppercase tracking-widest">
              {done.length} comprado{done.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* ── FORMULÁRIO ───────────────────────────────────────────────────────── */}
      <form onSubmit={handleAdd}
        className="bg-white dark:bg-slate-800 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-3"
        aria-label="Adicionar item à lista de compras">

        {/* Nome + autocomplete */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <label htmlFor="item-name" className="sr-only">Nome do item</label>
            <input id="item-name" ref={nameInputRef}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 font-medium focus:border-blue-300 dark:focus:border-blue-700 transition-colors"
              placeholder="O que comprar?"
              value={form.name} autoComplete="off"
              onChange={(e) => { patch({ name: e.target.value }); setShowSuggestions(true); setSelectedCatalogItem(null); }}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} />

            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full left-0 right-0 z-20 mt-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-xl overflow-hidden"
                  role="listbox">
                  {suggestions.map(cat => (
                    <button key={cat.id} type="button" role="option" aria-selected={form.name === cat.name}
                      onMouseDown={() => selectSuggestion(cat)}
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Tag size={13} className="text-blue-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 block truncate">{cat.name}</span>
                          {cat.category && (
                            <span className="text-[9px] font-black text-blue-400 uppercase">{cat.category}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-black text-emerald-500 dark:text-emerald-400 block">
                          {formatCurrency(cat.last_price / cat.package_qty)}/{cat.package_unit}
                        </span>
                        {(() => {
                          const mlPrice = getPricePer100ml(cat);
                          return mlPrice ? (
                            <span className="text-[9px] font-black text-sky-400 block">
                              {formatCurrency(mlPrice)}/100ml
                            </span>
                          ) : null;
                        })()}
                        <span className="text-[9px] text-slate-300 dark:text-slate-600 font-medium">
                          pacote {formatCurrency(cat.last_price)}
                        </span>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button type="submit" aria-label="Adicionar item"
            className="bg-blue-600 text-white p-4 rounded-2xl active:scale-90 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-40 shrink-0"
            disabled={!form.name.trim()}>
            <Plus size={22} />
          </button>
        </div>

        {/* Modo */}
        <ModeSelector value={form.mode}
          onChange={(m) => { patch({ mode: m, price: '', volume_ml: '', weight_g: '', qty: 1, unit: 'un' }); setSelectedCatalogItem(null); }} />

        {/* Qtd (UN e Líquido) */}
        {form.mode !== 'kg' && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-2xl p-1 shrink-0">
              <button type="button" onClick={() => patch({ qty: Math.max(1, form.qty - 1) })} aria-label="Diminuir quantidade"
                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm active:scale-90 transition-all text-slate-600 dark:text-slate-300">
                <Minus size={14} />
              </button>
              <span className="text-sm font-black text-slate-700 dark:text-slate-200 w-6 text-center">{form.qty}</span>
              <button type="button" onClick={() => patch({ qty: form.qty + 1 })} aria-label="Aumentar quantidade"
                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm active:scale-90 transition-all text-slate-600 dark:text-slate-300">
                <Plus size={14} />
              </button>
            </div>
            {form.mode === 'liquid' && (
              <div className="relative flex-1">
                <input type="text" inputMode="numeric"
                  value={form.volume_ml} onChange={(e) => patch({ volume_ml: fmtInt(e.target.value) })}
                  placeholder="Volume por unidade (ml)"
                  className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-sky-300 dark:focus:border-sky-700 transition-colors" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">ml</span>
              </div>
            )}
          </div>
        )}

        {/* Gramas desejadas (modo Kg) */}
        {form.mode === 'kg' && (
          <div className="space-y-1.5">
            <div className="relative">
              <input type="text" inputMode="numeric"
                value={form.weight_g}
                onChange={(e) => {
                  const newWeight = fmtInt(e.target.value);
                  if (selectedCatalogItem && getCatalogMode(selectedCatalogItem.package_unit) === 'kg') {
                    const grams = parseIntStr(newWeight);
                    const estimated = grams > 0
                      ? numberToMask((selectedCatalogItem.last_price / selectedCatalogItem.package_qty) * grams)
                      : '';
                    patch({ weight_g: newWeight, price: estimated });
                  } else {
                    patch({ weight_g: newWeight });
                  }
                }}
                placeholder="Quantas gramas? (ex: 500, 1.500...)"
                className="w-full p-4 pr-10 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-white text-sm font-medium placeholder:text-slate-300 focus:border-amber-300 dark:focus:border-amber-700 transition-colors" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-black">g</span>
            </div>
            {selectedCatalogItem && getCatalogMode(selectedCatalogItem.package_unit) === 'kg' && (
              <p className="text-[10px] font-black text-amber-500 dark:text-amber-400 px-1">
                Catálogo: {formatCurrency((selectedCatalogItem.last_price / selectedCatalogItem.package_qty) * 100)}/100g
                · pacote {formatCurrency(selectedCatalogItem.last_price)}/{selectedCatalogItem.package_qty}g
              </p>
            )}
          </div>
        )}

        {/* Preço */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-black">R$</span>
          <label htmlFor="item-price" className="sr-only">Preço</label>
          <input id="item-price" type="text" inputMode="numeric"
            className="w-full p-4 pl-10 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-white text-sm font-medium placeholder:text-slate-300 focus:border-emerald-300 dark:focus:border-emerald-700 transition-colors"
            placeholder={
              form.mode === 'liquid' ? '0,00 por unidade' :
              form.mode === 'kg' ? '0,00 (opcional)' :
              `0,00 por ${form.unit || 'un'}`
            }
            value={form.price} onChange={(e) => patch({ price: applyMoneyMask(e.target.value) })} />
        </div>

        {/* Estimativa */}
        <AnimatePresence>
          {form.price && parseMasked(form.price) > 0 && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-[11px] font-black text-emerald-500 dark:text-emerald-400 px-1 overflow-hidden">
              {form.mode === 'liquid' && form.volume_ml
                ? `${form.qty} × ${formatCurrency(parseMasked(form.price))} (${form.volume_ml}ml) = ${formatCurrency(parseMasked(form.price) * form.qty)}`
                : form.mode === 'kg' && form.weight_g
                ? `${form.weight_g}g — estimativa: ${formatCurrency(parseMasked(form.price))}`
                : form.qty > 1
                ? `${form.qty} × ${formatCurrency(parseMasked(form.price))} = ${formatCurrency(parseMasked(form.price) * form.qty)}`
                : formatCurrency(parseMasked(form.price))
              }
            </motion.p>
          )}
        </AnimatePresence>

        {/* Categoria — toggle */}
        <button type="button"
          onClick={() => { setShowCategoryField(v => !v); setShowNewCatInput(false); setNewCatValue(''); }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-wider transition-all w-full justify-center ${
            showCategoryField || form.category
              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
              : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 text-slate-400'
          }`}>
          <Tag size={12} />
          {form.category ? form.category : 'Categoria (opcional)'}
          <ChevronDown size={10} className={`transition-transform ${showCategoryField ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showCategoryField && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-2">

              {/* Chips das categorias existentes */}
              <div className="flex gap-2 flex-wrap">
                {allCategories.map(cat => (
                  <button key={cat} type="button"
                    onClick={() => { patch({ category: form.category === cat ? '' : cat }); setShowNewCatInput(false); setNewCatValue(''); }}
                    className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl border transition-all active:scale-95 ${
                      form.category === cat
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400'
                    }`}>
                    {cat}
                  </button>
                ))}
                {/* Botão nova categoria */}
                <button type="button"
                  onClick={() => { setShowNewCatInput(v => !v); setNewCatValue(''); }}
                  className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl border transition-all active:scale-95 ${
                    showNewCatInput
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'bg-slate-50 dark:bg-slate-800 border-dashed border-slate-300 dark:border-slate-600 text-slate-400'
                  }`}>
                  + Nova
                </button>
              </div>

              {/* Input nova categoria */}
              <AnimatePresence>
                {showNewCatInput && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="flex gap-2">
                      <input autoFocus
                        className="flex-1 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-violet-400 dark:focus:border-violet-600 transition-colors placeholder:text-slate-300"
                        placeholder="Nome da categoria..."
                        value={newCatValue}
                        onChange={(e) => setNewCatValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const v = newCatValue.trim();
                            if (v) { patch({ category: v }); setShowNewCatInput(false); setNewCatValue(''); }
                          }
                          if (e.key === 'Escape') { setShowNewCatInput(false); setNewCatValue(''); }
                        }}
                      />
                      <button type="button" aria-label="Confirmar categoria"
                        disabled={!newCatValue.trim()}
                        onClick={() => {
                          const v = newCatValue.trim();
                          if (v) { patch({ category: v }); setShowNewCatInput(false); setNewCatValue(''); }
                        }}
                        className="w-11 h-11 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-sm active:scale-90 transition-all disabled:opacity-40 shrink-0">
                        <Check size={18} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* ── FILTROS POR CATEGORIA ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {pendingCategories.length >= 2 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button onClick={() => setActiveCategory(null)}
                className={`shrink-0 px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  !activeCategory
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}>
                Todos ({pending.length})
              </button>
              {pendingCategories.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  className={`shrink-0 px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    activeCategory === cat
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                      : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                  }`}>
                  {cat} ({pending.filter(i => i.category === cat).length})
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ITENS PENDENTES ───────────────────────────────────────────────────── */}
      <div className="space-y-3" role="region" aria-label="Itens para comprar">
        <AnimatePresence>
          {filteredPending.map(item => {
            const isEditing = editingItemId === item.id;
            return (
              <motion.div layout key={item.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20, height: 0 }}
                className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center gap-3 border border-slate-100 dark:border-slate-700 shadow-sm">

                {/* Botão marcar como comprado */}
                <button
                  onClick={() => !isEditing && setConfirmBuyItem(item)}
                  aria-label={`Marcar "${item.item_name}" como comprado`}
                  disabled={isEditing}
                  className="shrink-0 active:scale-90 transition-all disabled:opacity-30">
                  <Circle size={24} className="text-slate-200 dark:text-slate-600" />
                </button>

                {/* Nome + meta OU input de edição */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editingItemName}
                      onChange={(e) => setEditingItemName(e.target.value)}
                      onBlur={() => handleRenameBlur(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') { setEditingItemId(null); }
                      }}
                      className="w-full font-bold text-sm text-slate-700 dark:text-slate-200 bg-transparent outline-none border-b-2 border-blue-400 dark:border-blue-500 py-0.5"
                    />
                  ) : (
                    <>
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate block">{item.item_name}</span>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none">
                          {item.profiles?.full_name?.split(' ')[0]}
                        </span>
                        {item.weight_g ? (
                          <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-lg uppercase">
                            {gramsDisplay(item.weight_g)}
                          </span>
                        ) : item.volume_ml ? (
                          <span className="text-[9px] font-black text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 px-1.5 py-0.5 rounded-lg uppercase">
                            {(item.quantity ?? 1) > 1 ? `${item.quantity}×` : ''}{item.volume_ml >= 1000
                              ? `${(item.volume_ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L`
                              : `${item.volume_ml}ml`}
                          </span>
                        ) : ((item.quantity ?? 1) > 1 || (item.unit && item.unit !== 'un')) ? (
                          <span className="text-[9px] font-black text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-lg uppercase">
                            {item.unit && item.unit !== 'un'
                              ? `${item.quantity ?? 1}×${item.unit}`
                              : `×${item.quantity}`}
                          </span>
                        ) : null}
                        {item.estimated_price && (
                          <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-lg uppercase">
                            {formatCurrency(Number(item.estimated_price) * (item.quantity ?? 1))}
                          </span>
                        )}
                        {item.category && !activeCategory && (
                          <span className="text-[9px] font-black text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-1.5 py-0.5 rounded-lg uppercase">
                            {item.category}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Ações: lápis + lixeira */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {!isEditing && (
                    <button onClick={() => startEditItem(item)} aria-label={`Editar nome de ${item.item_name}`}
                      className="text-slate-200 dark:text-slate-600 hover:text-blue-400 p-2 active:scale-90 transition-all rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20">
                      <Pencil size={14} />
                    </button>
                  )}
                  <button onClick={() => setItemToDelete(item)} aria-label={`Apagar ${item.item_name}`}
                    className="text-slate-200 dark:text-slate-600 hover:text-red-400 p-2 active:scale-90 transition-all rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {pending.length === 0 && shoppingList.length === 0 && (
          <p className="text-center text-slate-300 py-16 font-black uppercase text-[10px] tracking-[0.2em]">
            Lista vazia — adicione o primeiro item
          </p>
        )}
      </div>

      {/* ── ITENS COMPRADOS ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {done.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-3 pb-10" role="region" aria-label="Itens já comprados">
            <div className="flex items-center justify-between px-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600">
                Comprados ({done.length})
              </span>
              <button onClick={() => setShowClearConfirm(true)}
                className="text-[9px] font-black uppercase tracking-wider text-red-400 hover:text-red-500 active:scale-95 transition-all">
                Limpar comprados
              </button>
            </div>
            <AnimatePresence>
              {done.map(item => (
                <motion.div layout key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                  className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                    <span className="font-bold text-sm text-slate-400 dark:text-slate-500 line-through truncate">{item.item_name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button onClick={() => handleToggle(item.id, item.is_pending)}
                      aria-label={`Reativar "${item.item_name}"`}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all">
                      <RotateCcw size={10} />
                      Reativar
                    </button>
                    <button onClick={() => setItemToDelete(item)}
                      className="text-slate-300 dark:text-slate-600 hover:text-red-400 p-2 active:scale-90 transition-all rounded-xl">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAIS ───────────────────────────────────────────────────────────── */}
      <ConfirmDeleteModal item={itemToDelete} onConfirm={handleDeleteConfirm} onCancel={() => setItemToDelete(null)} />

      {showClearConfirm && (
        <ConfirmClearModal count={done.length}
          onConfirm={() => { setShowClearConfirm(false); handleClearDone(); }}
          onCancel={() => setShowClearConfirm(false)} />
      )}

      {confirmBuyItem && (
        <ConfirmBuyModal item={confirmBuyItem} catalogItems={catalogItems} isSaving={isSavingBuy}
          onJustMark={handleConfirmBuyJust} onSaveAndMark={handleConfirmBuySave}
          onCancel={() => setConfirmBuyItem(null)} />
      )}

      {/* ── MODO MERCADO ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isMercadoOpen && (
          <ModoMercado items={shoppingList} onToggle={handleToggle} onClose={() => setIsMercadoOpen(false)} />
        )}
      </AnimatePresence>

      {/* ── CATÁLOGO ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isCatalogOpen && (
          <CatalogSheet catalogItems={catalogItems} allCategoriesExternal={allCategories}
            onAdd={onAdd} onCreate={onCreateCatalog} onUpdate={onUpdateCatalog} onDelete={onDeleteCatalog}
            onClose={() => setIsCatalogOpen(false)} showToast={showToast} />
        )}
      </AnimatePresence>

      {/* ── HISTÓRICO ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isHistoryOpen && (
          <HistorySheet history={shoppingHistory} onRefresh={onRefresh}
            onClose={() => setIsHistoryOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
