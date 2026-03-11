// ─── ABA: LISTA DE COMPRAS ───────────────────────────────────────────────────

import { useState } from 'react';
import { Plus, Circle, CheckCircle2, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import type { ShoppingItem } from '../types';

interface Props {
  shoppingList: ShoppingItem[];
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
}

export function TabCompras({ shoppingList, fetchData, showToast }: Props) {
  const { user } = useAuth();
  const [newItem, setNewItem] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem) return;
    await supabase.from('shopping_list').insert({ item_name: newItem, user_id: user.id });
    setNewItem('');
    showToast('Item adicionado!');
    fetchData();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          className="flex-1 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 outline-none text-slate-800 dark:text-white"
          placeholder="O que comprar?"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
        />
        <button className="bg-blue-600 text-white p-4 rounded-2xl active:scale-90 transition-all">
          <Plus size={24} />
        </button>
      </form>

      <div className="space-y-3 pb-10">
        {shoppingList.map((item) => (
          <div
            key={item.id}
            className={`bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border transition-all ${
              !item.is_pending
                ? 'opacity-50 bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700'
                : 'border-slate-100 dark:border-slate-700 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={async () => {
                  await supabase.from('shopping_list').update({ is_pending: !item.is_pending }).eq('id', item.id);
                  fetchData();
                }}
              >
                {item.is_pending
                  ? <Circle size={24} className="text-slate-300 dark:text-slate-600" />
                  : <CheckCircle2 size={24} className="text-emerald-500" />}
              </button>
              <div className="flex flex-col">
                <span className={`font-bold text-sm ${!item.is_pending ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                  {item.item_name}
                </span>
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none">
                  De: {item.profiles?.full_name?.split(' ')[0]}
                </span>
              </div>
            </div>
            <button
              onClick={async () => {
                if (confirm('Apagar?')) {
                  await supabase.from('shopping_list').delete().eq('id', item.id);
                  showToast('Item removido', 'info');
                  fetchData();
                }
              }}
              className="text-slate-300 hover:text-red-500 p-2 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
