import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Target, CheckCircle2, Wallet, X, Loader2, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../utils';

interface Props {
  dreams: any[];
  expenses: any[];
  fetchData: () => Promise<void>; // <-- ADICIONE ESTA LINHA
  showToast: (msg: string, type?: string) => void; // <-- ADICIONE ESTA LINHA
  onAddDream: (title: string, target: number, image: string) => Promise<void>;
  onCompleteDream: (dreamId: string, categoryId: string) => Promise<void>;
  onQuickSave: (categoryName: string, amount: number) => Promise<void>;
}

export function TabSonhos({ 
  dreams, expenses, fetchData, showToast, onAddDream, onCompleteDream, onQuickSave 
}: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [img, setImg] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  // Calcula quanto foi economizado para cada sonho olhando o histórico de gastos na categoria
  const dreamsProgress = dreams.map(d => {
    const total = expenses
      .filter(e => e.category_name === d.title && !e.is_deleted)
      .reduce((acc, curr) => acc + Number(curr.amount), 0);
    return { ...d, current: total };
  });

  const handleSave = async (dream: any) => {
    const val = prompt(`Quanto deseja poupar para "${dream.title}"?`);
    if (!val) return;
    setSavingId(dream.id);
    await onQuickSave(dream.title, Number(val.replace(',', '.')));
    setSavingId(null);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xl font-black uppercase tracking-tighter dark:text-white">Nossas Conquistas</h2>
        <button onClick={() => setShowAdd(true)} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-90 transition-all">
          <Plus size={24} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {dreamsProgress.filter(d => !d.is_completed).map((dream) => {
          const percent = Math.min((dream.current / dream.target_value) * 100, 100);
          return (
            <motion.div layout key={dream.id} className="bg-white dark:bg-slate-800 rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-slate-700 shadow-xl relative transition-colors">
              {/* Imagem do Sonho */}
              <div className="h-44 bg-slate-200 dark:bg-slate-900 relative">
                {dream.image_url ? (
                  <img src={dream.image_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-600"><Target size={48} /></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-6 right-6">
                  <h3 className="text-xl font-black text-white uppercase leading-tight">{dream.title}</h3>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Meta: {formatCurrency(dream.target_value)}</p>
                </div>
              </div>

              {/* Barra de Progresso e Ações */}
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase">Acumulado</span>
                    <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">{formatCurrency(dream.current)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-blue-600">{percent.toFixed(0)}%</span>
                  </div>
                </div>

                <div className="h-3 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} className="h-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)]" />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => handleSave(dream)} disabled={savingId === dream.id} className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 active:scale-95 transition-all">
                    {savingId === dream.id ? <Loader2 className="animate-spin" size={16}/> : <TrendingUp size={16}/>} Poupar Agora
                  </button>
                  <button onClick={() => onCompleteDream(dream.id, dream.category_id)} className="p-3.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl active:scale-90 transition-all">
                    <CheckCircle2 size={24} />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Modal Add Sonho */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300] flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] w-full max-w-sm space-y-4 shadow-2xl">
              <div className="flex justify-between items-center"><h3 className="font-black text-blue-600 uppercase">Novo Sonho</h3><button onClick={() => setShowAdd(false)}><X/></button></div>
              <input className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-bold dark:text-white" placeholder="O que vamos conquistar?" value={title} onChange={e => setTitle(e.target.value)} />
              <input className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-bold text-blue-600" placeholder="Valor Total R$" value={target} onChange={e => setTarget(e.target.value)} />
              <input className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none text-xs dark:text-slate-400" placeholder="Link da foto (Opcional)" value={img} onChange={e => setImg(e.target.value)} />
              <button onClick={() => { onAddDream(title, Number(target), img); setShowAdd(false); }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Projetar</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}