import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import BottomNav from '../components/BottomNav';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis } from 'recharts';
import { 
  Trash2, Edit2, ChevronLeft, ChevronRight, Plus, X, LogOut, 
  Target, PieChart as PieIcon, BarChart3, RefreshCcw, 
  CheckCircle2, Circle, Bell, Calendar, Clock, ShoppingCart, 
  Filter, Users 
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('list');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [shoppingList, setShoppingList] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [annualChartData, setAnnualChartData] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Estados de formulários
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [newItem, setNewItem] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Filtros
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  // Estados dos Lembretes
  const [remText, setRemText] = useState('');
  const [remDate, setRemDate] = useState('');
  const [remTime, setRemTime] = useState('');
  const [editRemId, setEditRemId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [currentDate, activeTab]);

  const handleHardRefresh = async () => {
    setIsRefreshing(true);
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
    }
    window.location.reload();
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    const options = { minimumFractionDigits: 2 };
    const result = new Intl.NumberFormat('pt-BR', options).format(parseFloat(value) / 100);
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

      if (activeTab === 'reminders') {
        const { data: rems } = await supabase.from('reminders').select('*, profiles(full_name, avatar_url)')
          .gte('reminder_date', startM.split('T')[0]).lte('reminder_date', endM.split('T')[0]).order('reminder_date', { ascending: true });
        if (rems) setReminders(rems);
      }

      if (activeTab === 'shopping') {
        const { data: items } = await supabase.from('shopping_list').select('*, profiles(full_name, avatar_url)')
          .order('is_pending', { ascending: false }).order('created_at', { ascending: false });
        if (items) setShoppingList(items);
      }

      const { data: exps } = await supabase.from('expenses').select(`id, amount, category_name, description, created_at, user_id, profiles (full_name, avatar_url)`)
        .eq('is_deleted', false).gte('created_at', startM).lte('created_at', endM).order('created_at', { ascending: false });
      if (exps) setExpenses(exps);

      const startYear = new Date(currentDate.getFullYear(), 0, 1).toISOString();
      const endYear = new Date(currentDate.getFullYear(), 11, 31).toISOString();
      const { data: annualData } = await supabase.from('expenses').select('amount, created_at').eq('is_deleted', false).gte('created_at', startYear).lte('created_at', endYear);
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      setAnnualChartData(months.map((m, i) => ({ name: m, total: (annualData || []).filter(e => new Date(e.created_at).getMonth() === i).reduce((acc, curr) => acc + Number(curr.amount), 0) })));
    } catch (error) { console.error(error); }
  }

  const handleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { text: remText, reminder_date: remDate, reminder_time: remTime, user_id: user.id };
    if (editRemId) await supabase.from('reminders').update(payload).eq('id', editRemId);
    else await supabase.from('reminders').insert(payload);
    setRemText(''); setRemDate(''); setRemTime(''); setEditRemId(null); fetchData();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    if (editingId) {
      await supabase.from('expenses').update({ amount: numericAmount, category_name: category, description }).eq('id', editingId);
    } else {
      await supabase.from('expenses').insert({ amount: numericAmount, category_name: category, description, user_id: user.id });
    }
    setAmount(''); setCategory(''); setDescription(''); setEditingId(null); setActiveTab('list'); fetchData();
  };

  const chartData = categories.map(cat => ({ name: cat.name, value: expenses.filter(e => e.category_name === cat.name).reduce((acc, curr) => acc + Number(curr.amount), 0) })).filter(d => d.value > 0);
  
  // Agrupamento para o gráfico por pessoa
  const userTotals = Object.values(expenses.reduce((acc: any, curr: any) => {
    const uid = curr.user_id;
    if (!acc[uid]) {
      acc[uid] = { 
        name: curr.profiles?.full_name || 'Usuário', 
        avatar: curr.profiles?.avatar_url,
        value: 0 
      };
    }
    acc[uid].value += Number(curr.amount);
    return acc;
  }, {}));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const USER_COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b'];

  return (
    <div className="pb-28 pt-4 px-4 max-w-md mx-auto min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}><ChevronLeft className="text-slate-300" /></button>
        <div className="flex flex-col items-center">
          <h2 className="font-bold text-lg capitalize leading-none">{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</h2>
          <button onClick={handleHardRefresh} className="flex items-center gap-1 mt-1 text-[10px] font-black text-blue-500 uppercase tracking-tighter">
            <RefreshCcw size={10} className={isRefreshing ? 'animate-spin' : ''} /> ATUALIZAR APP
          </button>
        </div>
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}><ChevronRight className="text-slate-300" /></button>
      </div>

      {/* TELA: EXTRATO */}
      {activeTab === 'list' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center gap-3 pb-1 overflow-x-auto no-scrollbar">
            <button onClick={() => setFilterUserId(null)} className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase transition-all ${!filterUserId ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}>Todos</button>
            {Array.from(new Set(expenses.map(e => e.user_id))).map(uid => {
              const exp = expenses.find(e => e.user_id === uid);
              return (
                <button key={uid} onClick={() => setFilterUserId(filterUserId === uid ? null : uid)} className={`flex items-center gap-2 p-1 pr-4 rounded-full border transition-all ${filterUserId === uid ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-500'}`}>
                  <img src={exp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${exp.profiles?.full_name}`} className="w-7 h-7 rounded-full object-cover bg-slate-100" alt="" />
                  <span className="text-[10px] font-bold uppercase">{exp.profiles?.full_name?.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 pb-2 overflow-x-auto no-scrollbar border-b border-slate-100">
            <button onClick={() => setFilterCategory(null)} className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${!filterCategory ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400'}`}><Filter size={10} /> Categorias</button>
            {categories.filter(cat => expenses.some(e => e.category_name === cat.name)).map(cat => (
              <button key={cat.id} onClick={() => setFilterCategory(filterCategory === cat.name ? null : cat.name)} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase whitespace-nowrap transition-all border ${filterCategory === cat.name ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-white border-slate-100 text-slate-400'}`}>{cat.name}</button>
            ))}
          </div>

          <div className="space-y-3">
            {expenses.filter(exp => !filterUserId || exp.user_id === filterUserId).filter(exp => !filterCategory || exp.category_name === filterCategory).map((exp) => (
                <div key={exp.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-slate-100 group">
                  <div className="flex items-center gap-3 flex-1 overflow-hidden">
                    <img src={exp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${exp.profiles?.full_name || 'U'}`} className="w-11 h-11 rounded-full border-2 border-white shadow-sm flex-shrink-0 object-cover" alt="" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">{exp.category_name}</span>
                      <span className="text-slate-800 font-medium truncate text-sm leading-tight">{exp.description || 'Sem descrição'}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase">{exp.profiles?.full_name}</span>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <span className="font-bold text-slate-900 text-sm">{formatCurrency(exp.amount)}</span>
                    <div className="flex gap-2 justify-end mt-1 opacity-0 group-hover:opacity-100">
                      <button onClick={() => { setEditingId(exp.id); setAmount(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(exp.amount)); setCategory(exp.category_name); setDescription(exp.description); setActiveTab('add'); }} className="text-blue-500"><Edit2 size={14}/></button>
                      <button onClick={async () => { if(confirm("Remover?")) { await supabase.from('expenses').update({ is_deleted: true }).eq('id', exp.id); fetchData(); } }} className="text-red-400"><Trash2 size={14}/></button>
                    </div>
                  </div>
                </div>
            ))}
          </div>
        </div>
      )}

      {/* TELA: COMPRAS */}
      {activeTab === 'shopping' && (
        <div className="space-y-6 animate-in fade-in">
          <form onSubmit={async (e) => { e.preventDefault(); if(!newItem) return; await supabase.from('shopping_list').insert({ item_name: newItem, user_id: user.id }); setNewItem(''); fetchData(); }} className="flex gap-2">
            <input className="flex-1 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-medium" placeholder="O que comprar?" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
            <button className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg active:scale-90"><Plus size={24} /></button>
          </form>
          <div className="space-y-3">
            {shoppingList.map((item) => (
              <div key={item.id} className={`bg-white p-4 rounded-2xl flex items-center justify-between border transition-all ${!item.is_pending ? 'opacity-50 border-transparent bg-slate-50' : 'border-slate-100 shadow-sm'}`}>
                <div className="flex items-center gap-3 flex-1">
                  <button onClick={async () => { await supabase.from('shopping_list').update({ is_pending: !item.is_pending }).eq('id', item.id); fetchData(); }}>
                    {item.is_pending ? <Circle size={24} className="text-slate-300" /> : <CheckCircle2 size={24} className="text-emerald-500" />}
                  </button>
                  <div className="flex flex-col">
                    <span className={`font-bold text-sm ${!item.is_pending ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.item_name}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">De: {item.profiles?.full_name?.split(' ')[0]}</span>
                  </div>
                </div>
                <button onClick={async () => { if(confirm("Apagar?")) { await supabase.from('shopping_list').delete().eq('id', item.id); fetchData(); } }} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TELA: LEMBRETES */}
      {activeTab === 'reminders' && (
        <div className="space-y-6 animate-in fade-in">
          <form onSubmit={handleReminderSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-tighter"><Bell size={16} className="text-blue-500"/> {editRemId ? 'Editar Lembrete' : 'Novo Lembrete'}</h3>
            <input className="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-slate-100" placeholder="Lembrar de quê?" required value={remText} onChange={e => setRemText(e.target.value)} />
            <div className="flex gap-2">
              <div className="flex-1 relative"><Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/><input type="date" required className="w-full p-4 pl-12 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-sm" value={remDate} onChange={e => setRemDate(e.target.value)} /></div>
              <div className="w-32 relative"><Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/><input type="time" className="w-full p-4 pl-12 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-sm" value={remTime} onChange={e => setRemTime(e.target.value)} /></div>
            </div>
            <button className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95">Confirmar</button>
          </form>
          <div className="space-y-3 pb-10">
            {reminders.map((rem) => (
              <div key={rem.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 shrink-0"><Calendar size={20} /></div>
                  <div><p className="font-bold text-slate-800 text-sm">{rem.text}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{format(parseISO(rem.reminder_date), "dd/MM", { locale: ptBR })} {rem.reminder_time && ` às ${rem.reminder_time}`}</p></div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100"><button onClick={() => {setEditRemId(rem.id); setRemText(rem.text); setRemDate(rem.reminder_date); setRemTime(rem.reminder_time || '');}} className="text-blue-500"><Edit2 size={16}/></button><button onClick={async () => { if(confirm("Apagar?")) { await supabase.from('reminders').delete().eq('id', rem.id); fetchData(); } }} className="text-red-400"><Trash2 size={16}/></button></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TELA: ADICIONAR GASTO */}
      {activeTab === 'add' && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 animate-in slide-in-from-bottom-4">
          <h3 className="font-bold text-slate-800">{editingId ? 'Editar Gasto' : 'Novo Gasto'}</h3>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-blue-600 text-2xl">R$</span>
            <input type="text" inputMode="numeric" placeholder="0,00" required className="w-full p-4 pl-14 bg-slate-50 rounded-2xl text-3xl font-bold outline-none text-blue-600 border-2 border-transparent focus:border-blue-100 transition-all" value={amount} onChange={handleCurrencyChange} />
          </div>
          <select required value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-slate-600 font-bold uppercase text-xs">
            <option value="">Categoria</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <input type="text" placeholder="Descrição (opcional)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-slate-100" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95">Confirmar</button>
        </form>
      )}

      {/* TELA: GRÁFICOS */}
      {activeTab === 'stats' && (
        <div className="space-y-6 animate-in fade-in pb-10">
          {/* 1. Evolução Anual */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2"><BarChart3 size={14}/> Evolução Anual</h3>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={annualChartData}><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} /><Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none'}} /><Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. Gastos por Pessoa (Rosca) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2"><Users size={14}/> Gastos por Pessoa</h3>
            <div className="h-56 w-full">
              {expenses.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={userTotals} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value">
                      {userTotals.map((_, i) => <Cell key={i} fill={USER_COLORS[i % USER_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-center text-slate-300 py-10 text-sm">Sem dados</p>}
            </div>
            {/* Legenda com Foto */}
            <div className="mt-4 space-y-3">
              {userTotals.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <img src={item.avatar || `https://ui-avatars.com/api/?name=${item.name}`} className="w-8 h-8 rounded-full object-cover border-2 border-white" />
                    <span className="text-xs font-bold text-slate-700 uppercase">{item.name.split(' ')[0]}</span>
                  </div>
                  <span className="font-black text-slate-900 text-sm">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Distribuição Mensal */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2"><PieIcon size={14}/> Distribuição Mensal</h3>
            <div className="h-56 w-full">
              {expenses.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" isAnimationActive={true}>
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-center text-slate-300 py-10 text-sm">Sem gastos</p>}
            </div>
          </div>

          {/* 4. Metas */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-bold text-slate-400 mb-6 uppercase tracking-widest flex items-center gap-2"><Target size={14}/> Metas do Mês</h3>
            <div className="space-y-6">
              {categories.map((cat) => {
                const total = expenses.filter(e => e.category_name === cat.name).reduce((acc, curr) => acc + Number(curr.amount), 0);
                const meta = Number(cat.monthly_goal) || 0;
                const barMax = Math.max(total, meta);
                const blueWidth = barMax > 0 ? (Math.min(total, meta) / barMax) * 100 : 0;
                const redWidth = (barMax > 0 && total > meta) ? ((total - meta) / barMax) * 100 : 0;
                const isOver = meta > 0 && total > meta;
                return (
                  <div key={cat.id} className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold"><span className="text-slate-700">{cat.name}</span><span className={isOver ? 'text-red-500' : 'text-slate-400'}>{formatCurrency(total)} / <span className="text-slate-500 font-extrabold">{formatCurrency(meta)}</span></span></div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex"><div className={`h-full transition-all duration-700 ${total >= meta && meta > 0 ? 'bg-blue-600' : 'bg-blue-400'}`} style={{ width: `${blueWidth}%` }} /><div className="h-full bg-red-500 transition-all duration-700 shadow-[0_0_8px_rgba(239,68,68,0.4)]" style={{ width: `${redWidth}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TELA: CONFIGURAÇÕES */}
      {activeTab === 'config' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <img src={userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email}`} className="w-16 h-16 rounded-full border-2 border-white shadow-sm object-cover" alt="" />
            <div className="flex-1"><p className="font-bold text-slate-800">{userProfile?.full_name || 'Meu Perfil'}</p><button onClick={() => window.location.hash = '/profile'} className="text-blue-600 text-sm font-semibold">Editar Perfil →</button></div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 tracking-tight">Gerenciar Categorias & Metas</h3>
            <CategoryManager categories={categories} refresh={fetchData} formatCurrency={formatCurrency} />
          </div>
          <button onClick={() => supabase.auth.signOut()} className="w-full p-4 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-widest text-xs"><LogOut size={16} /> Sair do App</button>
        </div>
      )}

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

function CategoryManager({ categories, refresh, formatCurrency }: any) {
  const [newCat, setNewCat] = useState('');
  const addCategory = async () => {
    if (!newCat) return;
    await supabase.from('categories').insert({ name: newCat });
    setNewCat(''); refresh();
  };
  const handleNameChange = async (id: string, oldName: string, newName: string) => {
    if (newName === oldName || !newName) return;
    await supabase.from('categories').update({ name: newName }).eq('id', id);
    await supabase.from('expenses').update({ category_name: newName }).eq('category_name', oldName);
    refresh();
  };
  const handleMetaChange = async (id: string, inputValue: string) => {
    const numericValue = parseFloat(inputValue.replace(/[R$\s.]/g, '').replace(',', '.'));
    if (!isNaN(numericValue)) {
      await supabase.from('categories').update({ monthly_goal: numericValue }).eq('id', id);
      refresh();
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm outline-none" placeholder="Nova categoria..." value={newCat} onChange={e => setNewCat(e.target.value)} />
        <button onClick={addCategory} className="bg-blue-600 text-white p-3 rounded-xl shadow-md active:scale-90 transition-all"><Plus size={20}/></button>
      </div>
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1 no-scrollbar">
        {categories.map((c: any) => (
          <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
            <div className="flex justify-between items-center">
              <input type="text" className="bg-transparent text-sm font-black text-slate-700 outline-none uppercase tracking-tighter w-full border-b border-transparent focus:border-slate-200" defaultValue={c.name} onBlur={(e) => handleNameChange(c.id, c.name, e.target.value)} />
              <button onClick={async () => { if(confirm("Apagar?")) { await supabase.from('categories').delete().eq('id', c.id); refresh(); } }} className="text-slate-300 ml-2 hover:text-red-500"><Trash2 size={14}/></button>
            </div>
            <div className="flex flex-col gap-1 bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
              <label className="text-[9px] font-bold text-slate-400 uppercase">Definir Meta Mensal:</label>
              <input type="text" className="bg-transparent text-sm font-black text-blue-600 outline-none w-full" defaultValue={formatCurrency(c.monthly_goal || 0)} onBlur={(e) => handleMetaChange(c.id, e.target.value)} onFocus={(e) => e.target.value = (c.monthly_goal || 0).toString()} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}