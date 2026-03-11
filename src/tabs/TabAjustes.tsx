// ─── ABA: CONFIGURAÇÕES ──────────────────────────────────────────────────────

import { useState } from 'react';
import { Moon, Sun, LogOut, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { formatCurrency } from '../utils';
import type { Category, Profile } from '../types';

interface Props {
  userProfile: Profile | null;
  categories: Category[];
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
}

export function TabAjustes({ userProfile, categories, isDarkMode, setIsDarkMode, fetchData, showToast }: Props) {
  const { user } = useAuth();

  return (
    <div className="space-y-6 pb-10">
      {/* Perfil */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4 transition-colors">
        <img
          src={userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email}`}
          className="w-16 h-16 rounded-full border-2 border-white dark:border-slate-700 shadow-sm object-cover"
          alt=""
        />
        <div className="flex-1">
          <p className="font-bold text-slate-800 dark:text-slate-200 leading-tight">{userProfile?.full_name || 'Meu Perfil'}</p>
          <button onClick={() => (window.location.hash = '/profile')} className="text-blue-600 text-xs font-black uppercase tracking-widest mt-1">
            Editar Perfil →
          </button>
        </div>
      </div>

      {/* Dark mode / Sair */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-6 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2 active:scale-95 transition-all text-slate-800 dark:text-slate-200 shadow-sm"
        >
          {isDarkMode ? <Sun className="text-amber-400" /> : <Moon className="text-indigo-500" />}
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">
            {isDarkMode ? 'MODO CLARO' : 'MODO ESCURO'}
          </span>
        </button>
        <button
          onClick={() => supabase.auth.signOut()}
          className="p-6 bg-red-50 dark:bg-red-900/20 rounded-[2rem] border border-transparent flex flex-col items-center gap-2 active:scale-95 transition-all text-red-500 shadow-sm"
        >
          <LogOut size={20} />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">SAIR</span>
        </button>
      </div>

      {/* Categorias */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
        <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 uppercase text-[10px] opacity-50 tracking-widest">
          Categorias &amp; Metas
        </h3>
        <CategoryManager categories={categories} fetchData={fetchData} showToast={showToast} />
      </div>
    </div>
  );
}

// ─── CATEGORY MANAGER ────────────────────────────────────────────────────────
function CategoryManager({
  categories, fetchData, showToast,
}: {
  categories: Category[];
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
}) {
  const [newCat, setNewCat] = useState('');

  const addCategory = async () => {
    if (!newCat) return;
    await supabase.from('categories').insert({ name: newCat });
    setNewCat('');
    showToast('Categoria criada!');
    fetchData();
  };

  const handleNameChange = async (id: string, oldName: string, newName: string) => {
    if (newName === oldName || !newName) return;
    await supabase.from('categories').update({ name: newName }).eq('id', id);
    await supabase.from('expenses').update({ category_name: newName }).eq('category_name', oldName);
    showToast('Nome atualizado!');
    fetchData();
  };

  const handleMetaChange = async (id: string, inputValue: string) => {
    const numericValue = parseFloat(inputValue.replace(/[R$\s.]/g, '').replace(',', '.'));
    if (!isNaN(numericValue)) {
      await supabase.from('categories').update({ monthly_goal: numericValue }).eq('id', id);
      showToast('Meta atualizada!');
      fetchData();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className="flex-1 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-sm outline-none font-bold text-slate-800 dark:text-white"
          placeholder="Nova categoria..."
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
        />
        <button onClick={addCategory} className="bg-blue-600 text-white p-4 rounded-2xl active:scale-90 transition-all">
          <Plus size={20} />
        </button>
      </div>
      <div className="space-y-3 max-h-[25rem] overflow-y-auto pr-1 no-scrollbar pb-6">
        {categories.map((c) => (
          <div key={c.id} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-[2rem] space-y-3 border border-slate-100 dark:border-slate-700 transition-colors">
            <div className="flex justify-between items-center">
              <input
                type="text"
                className="bg-transparent text-sm font-black outline-none uppercase tracking-tighter w-full text-slate-800 dark:text-slate-200 border-b border-transparent focus:border-blue-500"
                defaultValue={c.name}
                onBlur={(e) => handleNameChange(c.id, c.name, e.target.value)}
              />
              <button
                onClick={async () => {
                  if (confirm('Apagar esta categoria?')) {
                    await supabase.from('categories').delete().eq('id', c.id);
                    showToast('Categoria removida', 'info');
                    fetchData();
                  }
                }}
                className="text-slate-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-1 bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-inner border border-slate-100 dark:border-slate-700 transition-colors">
              <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Meta Mensal</label>
              <input
                type="text"
                className="bg-transparent text-base font-black text-blue-600 dark:text-blue-400 outline-none w-full"
                defaultValue={formatCurrency(c.monthly_goal || 0)}
                onBlur={(e) => handleMetaChange(c.id, e.target.value)}
                onFocus={(e) => (e.target.value = (c.monthly_goal || 0).toString())}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
