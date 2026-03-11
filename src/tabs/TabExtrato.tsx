// ─── ABA: EXTRATO ────────────────────────────────────────────────────────────
// Exibe lista de despesas com filtros por usuário, categoria e busca

import { useState } from 'react';
import { motion } from 'motion/react';
import { Edit2, Trash2, Search, Filter, ArrowUpRight, ArrowDownRight, Paperclip } from 'lucide-react';
import { supabase } from '../supabase';
import { SkeletonCard } from '../components/ui';
import { formatCurrency } from '../utils';
import type { Expense, Category } from '../types';

interface Props {
  expenses: Expense[];
  categories: Category[];
  prevMonthTotal: number;
  isLoading: boolean;
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
  onEdit: (exp: Expense) => void;
  onViewReceipt: (url: string) => void;
}

export function TabExtrato({
  expenses, categories, prevMonthTotal, isLoading,
  fetchData, showToast, onEdit, onViewReceipt,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const totalMonth = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const diff = prevMonthTotal > 0 ? ((totalMonth - prevMonthTotal) / prevMonthTotal) * 100 : 0;

  const filtered = expenses
    .filter((exp) => !filterUserId || exp.user_id === filterUserId)
    .filter((exp) => !filterCategory || exp.category_name === filterCategory)
    .filter(
      (exp) =>
        !searchTerm ||
        exp.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const totalFiltered = filtered.reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <div className="space-y-4">
      {/* Card total */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-[2.5rem] shadow-xl shadow-blue-500/20 text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Total Filtrado</span>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black ${diff > 0 ? 'bg-red-400/30' : 'bg-emerald-400/30'}`}>
              {diff > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {Math.abs(diff).toFixed(0)}% vs anterior
            </div>
          </div>
          <h1 className="text-4xl font-black tracking-tighter">{formatCurrency(totalFiltered)}</h1>
          <div className="flex items-center gap-2 mt-4 bg-black/10 p-1 rounded-2xl">
            <div className="bg-white/20 p-2 rounded-xl"><Search size={16} /></div>
            <input
              className="bg-transparent border-none outline-none text-xs font-bold w-full placeholder:text-white/40 text-white"
              placeholder="Buscar no extrato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Filtro por usuário */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1 px-1">
        <button
          onClick={() => setFilterUserId(null)}
          className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${
            !filterUserId
              ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-lg'
              : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'
          }`}
        >
          Todos
        </button>
        {Array.from(new Set(expenses.map((e) => e.user_id))).map((uid) => {
          const exp = expenses.find((e) => e.user_id === uid)!;
          return (
            <button
              key={uid}
              onClick={() => setFilterUserId(filterUserId === uid ? null : uid)}
              className={`flex items-center gap-2 p-1 pr-4 rounded-full border transition-all ${
                filterUserId === uid
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'
              }`}
            >
              <img
                src={exp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${exp.profiles?.full_name}`}
                className="w-7 h-7 rounded-full object-cover"
                alt=""
              />
              <span className="text-[10px] font-black uppercase">{exp.profiles?.full_name?.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Filtro por categoria */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-1">
        <button
          onClick={() => setFilterCategory(null)}
          className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase border whitespace-nowrap ${
            !filterCategory
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white border-slate-200 dark:border-slate-600'
              : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
          }`}
        >
          <Filter size={10} /> Categorias
        </button>
        {categories
          .filter((cat) => expenses.some((e) => e.category_name === cat.name))
          .map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(filterCategory === cat.name ? null : cat.name)}
              className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase whitespace-nowrap transition-all border ${
                filterCategory === cat.name
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
              }`}
            >
              {cat.name}
            </button>
          ))}
      </div>

      {/* Lista de despesas */}
      <div className="space-y-3 pb-4">
        {isLoading
          ? [1, 2, 3].map((i) => <SkeletonCard key={i} />)
          : filtered.map((exp) => (
              <motion.div
                layout
                key={exp.id}
                className="bg-white dark:bg-slate-800 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 overflow-hidden">
                  <img
                    src={exp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${exp.profiles?.full_name}`}
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-50 dark:border-slate-700"
                    alt=""
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest leading-none mb-1">{exp.category_name}</span>
                    <span className="font-bold truncate text-sm leading-tight text-slate-800 dark:text-slate-200">{exp.description || 'Sem descrição'}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-slate-400 font-black uppercase">{exp.profiles?.full_name}</span>
                      {exp.receipt_url && (
                        <button
                          onClick={() => onViewReceipt(exp.receipt_url!)}
                          className="flex items-center gap-1 text-blue-500 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-lg border border-blue-100 dark:border-blue-900 shadow-sm transition-all active:scale-90"
                        >
                          <Paperclip size={10} strokeWidth={3} />
                          <span className="text-[8px] font-black">ANEXO</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right ml-2 shrink-0">
                  <span className="font-black text-slate-900 dark:text-white text-base block mb-1">{formatCurrency(exp.amount)}</span>
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => onEdit(exp)} className="text-slate-300 hover:text-blue-500 transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm('Remover este gasto?')) {
                          await supabase.from('expenses').update({ is_deleted: true }).eq('id', exp.id);
                          showToast('Gasto removido', 'info');
                          fetchData();
                        }
                      }}
                      className="text-slate-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
      </div>
    </div>
  );
}
