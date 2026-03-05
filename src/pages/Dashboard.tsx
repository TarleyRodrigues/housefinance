import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import BottomNav from '../components/BottomNav';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis } from 'recharts';
import { Trash2, Edit2, ChevronLeft, ChevronRight, Plus, X, LogOut, Target, PieChart as PieIcon, BarChart3 } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('list');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [annualChartData, setAnnualChartData] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userProfile, setUserProfile] = useState<any>(null);
  
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterUserId, setFilterUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    const options = { minimumFractionDigits: 2 };
    const result = new Intl.NumberFormat('pt-BR', options).format(
      parseFloat(value) / 100
    );
    setAmount(result === "NaN" ? "" : result);
  };

  async function fetchData() {
    try {
      const { data: cats } = await supabase.from('categories').select('*').order('name');
      if (cats) setCategories(cats);

      if (user) {
        const { data: profiles } = await supabase.from('profiles').select('*').eq('id', user.id);
        if (profiles && profiles.length > 0) setUserProfile(profiles[0]);
      }

      const startM = startOfMonth(currentDate).toISOString();
      const endM = endOfMonth(currentDate).toISOString();

      const { data: exps } = await supabase
        .from('expenses')
        .select(`id, amount, category_name, description, created_at, user_id, profiles (full_name, avatar_url)`)
        .eq('is_deleted', false)
        .gte('created_at', startM)
        .lte('created_at', endM)
        .order('created_at', { ascending: false });

      if (exps) setExpenses(exps);

      const startYear = new Date(currentDate.getFullYear(), 0, 1).toISOString();
      const endYear = new Date(currentDate.getFullYear(), 11, 31).toISOString();
      const { data: annualData } = await supabase.from('expenses').select('amount, created_at').eq('is_deleted', false).gte('created_at', startYear).lte('created_at', endYear);

      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      setAnnualChartData(months.map((m, i) => ({
        name: m,
        total: (annualData || []).filter(e => new Date(e.created_at).getMonth() === i).reduce((acc, curr) => acc + Number(curr.amount), 0)
      })));
    } catch (error) { console.error(error); }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    const payload = { amount: numericAmount, category_name: category, description, user_id: user.id };
    if (editingId) await supabase.from('expenses').update(payload).eq('id', editingId);
    else await supabase.from('expenses').insert(payload);
    setAmount(''); setCategory(''); setDescription(''); setEditingId(null); setActiveTab('list'); fetchData();
  };

  const chartData = categories.map(cat => ({
    name: cat.name,
    value: expenses.filter(e => e.category_name === cat.name).reduce((acc, curr) => acc + Number(curr.amount), 0)
  })).filter(d => d.value > 0);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="pb-28 pt-4 px-4 max-w-md mx-auto min-h-screen bg-slate-50 font-sans">
      {/* Mês Seletor */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}><ChevronLeft className="text-slate-300" /></button>
        <h2 className="font-bold text-lg capitalize">{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</h2>
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}><ChevronRight className="text-slate-300" /></button>
      </div>

      {/* EXTRATO */}
      {activeTab === 'list' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Filtros de Usuário */}
          <div className="flex items-center gap-3 pb-2 overflow-x-auto no-scrollbar">
            <button onClick={() => setFilterUserId(null)} className={`px-4 py-2 rounded-full text-xs font-bold ${!filterUserId ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}>Todos</button>
            {Array.from(new Set(expenses.map(e => e.user_id))).map(uid => {
              const exp = expenses.find(e => e.user_id === uid);
              return (
                <button key={uid} onClick={() => setFilterUserId(filterUserId === uid ? null : uid)} className={`flex items-center gap-2 p-1 pr-4 rounded-full border ${filterUserId === uid ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-100 text-slate-500'}`}>
                  <img src={exp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${exp.profiles?.full_name}`} className="w-7 h-7 rounded-full object-cover" alt="" />
                  <span className="text-xs font-bold">{exp.profiles?.full_name?.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
          <div className="space-y-3">
            {expenses.filter(exp => !filterUserId || exp.user_id === filterUserId).map((exp) => (
              <div key={exp.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-slate-100 group active:bg-slate-50">
                <div className="flex items-center gap-3 flex-1 overflow-hidden">
                  <img src={exp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${exp.profiles?.full_name || 'U'}`} className="w-11 h-11 rounded-full border-2 border-white shadow-sm object-cover" alt="" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold text-blue-500 uppercase">{exp.category_name}</span>
                    <span className="text-slate-800 font-medium truncate text-sm">{exp.description || 'Sem descrição'}</span>
                    <span className="text-[10px] text-slate-400">{exp.profiles?.full_name}</span>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1 ml-2">
                  <span className="font-bold text-slate-900">{Number(exp.amount).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100">
                    <button onClick={() => { setEditingId(exp.id); setAmount(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(exp.amount)); setCategory(exp.category_name); setDescription(exp.description); setActiveTab('add'); }} className="text-blue-500"><Edit2 size={14}/></button>
                    <button onClick={async () => { if(confirm("Remover?")) { await supabase.from('expenses').update({ is_deleted: true }).eq('id', exp.id); fetchData(); } }} className="text-red-400"><Trash2 size={14}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADICIONAR */}
      {activeTab === 'add' && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 animate-in slide-in-from-bottom-4">
          <h3 className="font-bold text-slate-800">{editingId ? 'Editar Gasto' : 'Novo Gasto'}</h3>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-blue-600 text-2xl">R$</span>
            <input type="text" inputMode="numeric" placeholder="0,00" required className="w-full p-4 pl-14 bg-slate-50 rounded-2xl text-3xl font-bold outline-none text-blue-600 border-2 border-transparent focus:border-blue-100" value={amount} onChange={handleCurrencyChange} />
          </div>
          <select required value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-slate-600">
            <option value="">Categoria</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <input type="text" placeholder="Descrição rápida" className="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-slate-100" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all">Confirmar</button>
        </form>
      )}

      {/* GRÁFICOS E METAS */}
      {activeTab === 'stats' && (
        <div className="space-y-6 animate-in fade-in pb-10">
          {/* 1. Evolução Anual (Barras) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2"><BarChart3 size={14}/> Evolução no Ano</h3>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={annualChartData}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none'}} />
                  <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. Divisão do Mês (Pizza) - O QUE TINHA SUMIDO */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2"><PieIcon size={14}/> Gastos por Categoria</h3>
            <div className="h-56 w-full">
              {expenses.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-center text-slate-300 py-10 text-sm">Sem dados</p>}
            </div>
          </div>

          {/* 3. Metas do Mês (Termômetro) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-bold text-slate-400 mb-6 uppercase tracking-widest flex items-center gap-2"><Target size={14}/> Progresso das Metas</h3>
            <div className="space-y-5">
              {categories.map((cat) => {
                const total = expenses.filter(e => e.category_name === cat.name).reduce((acc, curr) => acc + Number(curr.amount), 0);
                const meta = Number(cat.monthly_goal) || 0;
                const percent = meta > 0 ? Math.min((total / meta) * 100, 100) : 0;
                const isOver = meta > 0 && total > meta;
                return (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-700">{cat.name}</span>
                      <span className={isOver ? 'text-red-500' : 'text-slate-400'}>
                        {total.toLocaleString('pt-br', {style:'currency', currency:'BRL'})} {meta > 0 && `/ ${meta}`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-700 ${isOver ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]' : 'bg-blue-500'}`} style={{ width: `${meta > 0 ? percent : 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURAÇÕES */}
      {activeTab === 'config' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <img src={userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email}`} className="w-16 h-16 rounded-full border-2 border-white shadow-sm object-cover" alt="" />
            <div className="flex-1">
              <p className="font-bold text-slate-800">{userProfile?.full_name || 'Meu Perfil'}</p>
              <button onClick={() => window.location.hash = '/profile'} className="text-blue-600 text-sm font-semibold">Editar Perfil →</button>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">Gerenciar Categorias & Metas</h3>
            <CategoryManager categories={categories} refresh={fetchData} />
          </div>
          <button onClick={() => supabase.auth.signOut()} className="w-full p-4 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-2"><LogOut size={20} /> Sair</button>
        </div>
      )}

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

function CategoryManager({ categories, refresh }: { categories: any[], refresh: () => void }) {
  const [newCat, setNewCat] = useState('');
  const addCategory = async () => {
    if (!newCat) return;
    await supabase.from('categories').insert({ name: newCat });
    setNewCat(''); refresh();
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm outline-none" placeholder="Nova categoria..." value={newCat} onChange={e => setNewCat(e.target.value)} />
        <button onClick={addCategory} className="bg-blue-600 text-white p-3 rounded-xl"><Plus size={20}/></button>
      </div>
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1 no-scrollbar">
        {categories.map(c => (
          <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-700 text-sm font-bold uppercase tracking-tighter">{c.name}</span>
              <button onClick={async () => { if(confirm("Remover?")) { await supabase.from('categories').delete().eq('id', c.id); refresh(); } }} className="text-slate-300 hover:text-red-400"><Trash2 size={14}/></button>
            </div>
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Meta Mensal: R$</span>
              <input 
                type="number"
                className="bg-transparent text-xs font-bold text-blue-600 outline-none w-full"
                defaultValue={c.monthly_goal}
                onBlur={async (e) => {
                  await supabase.from('categories').update({ monthly_goal: e.target.value }).eq('id', c.id);
                  refresh();
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}