import { useState } from 'react';
import { Search, Utensils, ShoppingCart, X, Check, Trash2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  fetchData: () => Promise<void>; // <-- ADICIONE ESTA LINHA
  showToast: (msg: string, type?: string) => void; // <-- ADICIONE ESTA LINHA
  onAddShoppingItems: (items: string[]) => Promise<void>;
}

export function TabReceitas({ fetchData, showToast, onAddShoppingItems }: Props) {
  const [query, setQuery] = useState('');
  const [meals, setMeals] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [editList, setEditList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query) return;
    setLoading(true);
    const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${query}`);
    const data = await res.json();
    setMeals(data.meals || []);
    setLoading(false);
  };

  const handleOpenMeal = (meal: any) => {
    const ingredients: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const ing = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];
      if (ing) ingredients.push(`${measure} ${ing}`.trim());
    }
    setEditList(ingredients);
    setSelected(meal);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
        <h2 className="text-xl font-black uppercase tracking-tighter relative z-10">O que vamos comer hoje?</h2>
        <div className="flex gap-2 mt-4 relative z-10">
          <input className="flex-1 p-4 bg-white/10 rounded-2xl outline-none border border-white/10 text-sm font-bold placeholder:text-white/40" placeholder="Buscar receita..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}/>
          <button onClick={search} className="p-4 bg-blue-600 rounded-2xl active:scale-90 transition-all"><Search size={20}/></button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {meals.map(m => (
          <motion.button whileTap={{ scale: 0.95 }} key={m.idMeal} onClick={() => handleOpenMeal(m)} className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 text-left">
            <img src={m.strMealThumb} className="w-full aspect-square object-cover" alt="" />
            <p className="p-3 font-black text-[10px] uppercase truncate dark:text-white">{m.strMeal}</p>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-0 bg-white dark:bg-slate-900 z-[300] flex flex-col">
            <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center">
              <button onClick={() => setSelected(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full dark:text-white"><X /></button>
              <button onClick={async () => { await onAddShoppingItems(editList); setSelected(null); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-blue-500/30">
                <Check size={14}/> Enviar p/ Compras
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <img src={selected.strMealThumb} className="w-full h-48 object-cover rounded-[2rem] shadow-lg" alt="" />
              
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-black uppercase text-xs text-blue-600">Ingredientes</h4>
                  <button onClick={() => setEditList([...editList, ''])} className="text-blue-500"><Plus size={16}/></button>
                </div>
                <div className="space-y-2">
                  {editList.map((ing, i) => (
                    <div key={i} className="flex gap-2">
                      <input className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold dark:text-white" value={ing} onChange={e => { const n = [...editList]; n[i] = e.target.value; setEditList(n); }} />
                      <button onClick={() => setEditList(editList.filter((_, idx) => idx !== i))} className="p-3 text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h4 className="font-black uppercase text-xs text-slate-400 mb-2">Preparo</h4>
                <p className="text-sm leading-relaxed dark:text-slate-300">{selected.strInstructions}</p>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}