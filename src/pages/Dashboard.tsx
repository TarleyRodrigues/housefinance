import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import BottomNav from '../components/BottomNav';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis } from 'recharts';
import { 
  Trash2, Edit2, ChevronLeft, ChevronRight, Plus, X, LogOut, 
  Target, PieChart as PieIcon, BarChart3, RefreshCcw, 
  CheckCircle2, Circle, Bell, Calendar, Clock, ShoppingCart, 
  Filter, Users, StickyNote, ChevronRight as ChevronNext, Save, Wallet
} from 'lucide-react';

// COMPONENTE DE CARREGAMENTO (SKELETON)
const SkeletonCard = () => (
  <div className="bg-white p-4 rounded-3xl border border-slate-100 animate-pulse flex items-center gap-3">
    <div className="w-12 h-12 bg-slate-100 rounded-2xl" />
    <div className="flex-1 space-y-2">
      <div className="h-3 bg-slate-100 rounded w-1/4" />
      <div className="h-4 bg-slate-100 rounded w-3/4" />
    </div>
    <div className="w-16 h-6 bg-slate-100 rounded" />
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('list');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [shoppingList, setShoppingList] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [annualChartData, setAnnualChartData] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados Gerais
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [newItem, setNewItem] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  // Estados dos Lembretes e Notas
  const [remText, setRemText] = useState('');
  const [remDate, setRemDate] = useState('');
  const [remTime, setRemTime] = useState('');
  const [editRemId, setEditRemId] = useState<string | null>(null);
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [currentDate, activeTab]);

  const stats = useMemo(() => {
    const totalMonth = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const filtered = expenses
      .filter(exp => !filterUserId || exp.user_id === filterUserId)
      .filter(exp => !filterCategory || exp.category_name === filterCategory);
    const totalFiltered = filtered.reduce((acc, curr) => acc + Number(curr.amount), 0);
    return { totalMonth, totalFiltered };
  }, [expenses, filterUserId, filterCategory]);

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
    setIsLoading(true);
    try {
      const { data: cats } = await supabase.from('categories').select('*').order('name');
      if (cats) setCategories(cats);

      if (user) {
        const { data: profiles } = await supabase.from('profiles').select('*').eq('id', user.id);
        if (profiles && profiles.length > 0) setUserProfile(profiles[0]);
      }

      const startM = startOfMonth(currentDate).toISOString();
      const endM = endOfMonth(currentDate).toISOString();

      if (activeTab === 'notes') {
        const { data: nts } = await supabase.from('notes').select('*').order('created_at', { ascending: false });
        if (nts) setNotes(nts);
      }

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
    finally { setIsLoading(false); }
  }

  // --- HANDLERS DAS NOTAS ---
  const saveNote = async () => {
    if (!noteTitle) return;
    const payload = { title: noteTitle, content: noteContent, user_id: user.id };
    if (editingNoteId) await supabase.from('notes').update(payload).eq('id', editingNoteId);
    else await supabase.from('notes').insert(payload);
    setNoteTitle(''); setNoteContent(''); setEditingNoteId(null); setIsNoteEditorOpen(false); fetchData();
  };

  // ESTA FUNÇÃO ESTAVA FALTANDO NO SEU ARQUIVO:
  const deleteNote = async (id: string) => {
    if (confirm("Apagar esta anotação permanentemente?")) {
      await supabase.from('notes').delete().eq('id', id);
      setIsNoteEditorOpen(false);
      fetchData();
    }
  };

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
    if (editingId) await supabase.from('expenses').update({ amount: numericAmount, category_name: category, description }).eq('id', editingId);
    else await supabase.from('expenses').insert({ amount: numericAmount, category_name: category, description, user_id: user.id });
    setAmount(''); setCategory(''); setDescription(''); setEditingId(null); setActiveTab('list'); fetchData();
  };

  const chartData = categories.map(cat => ({ name: cat.name, value: expenses.filter(e => e.category_name === cat.name).reduce((acc, curr) => acc + Number(curr.amount), 0) })).filter(d => d.value > 0);
  const userTotals = Object.values(expenses.reduce((acc: any, curr: any) => {
    const uid = curr.user_id;
    if (!acc[uid]) acc[uid] = { name: curr.profiles?.full_name || 'Usuário', avatar: curr.profiles?.avatar_url, value: 0 };
    acc[uid].value += Number(curr.amount);
    return acc;
  }, {}));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const USER_COLORS = ['#3b82f6', '#ec4899'];

  return (
    <div className="pb-28 pt-4 px-4 max-w-md mx-auto min-h-screen bg-slate-50 font-sans selection:bg-blue-100 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}><ChevronLeft className="text-slate-300" /></button>
        <div className="flex flex-col items-center">
          <h2 className="font-black text-lg capitalize leading-none text-slate-800">{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</h2>
          <button onClick={handleHardRefresh} className="flex items-center gap-1 mt-1 text-[9px] font-black text-blue-500 uppercase tracking-widest">
            <RefreshCcw size={10} className={isRefreshing ? 'animate-spin' : ''} /> ATUALIZAR APP
          </button>
        </div>
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}><ChevronRight className="text-slate-300" /></button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab + currentDate.toISOString()}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >

          {activeTab === 'list' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-[2rem] shadow-xl shadow-blue-100 text-white relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Total Filtrado</span>
                    <Wallet size={20} className="opacity-50" />
                  </div>
                  <h1 className="text-4xl font-black tracking-tighter">{formatCurrency(stats.totalFiltered)}</h1>
                  {(filterUserId || filterCategory) && (
                    <p className="text-[9px] mt-2 font-black uppercase tracking-widest opacity-80 bg-white/10 inline-block px-2 py-1 rounded-lg border border-white/10">
                      Mês todo: {formatCurrency(stats.totalMonth)}
                    </p>
                  )}
                </div>
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
                  <button onClick={() => setFilterUserId(null)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${!filterUserId ? 'bg-slate-800 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>Todos</button>
                  {Array.from(new Set(expenses.map(e => e.user_id))).map(uid => {
                    const exp = expenses.find(e => e.user_id === uid);
                    return (
                      <button key={uid} onClick={() => setFilterUserId(filterUserId === uid ? null : uid)} className={`flex items-center gap-2 p-1 pr-4 rounded-full border transition-all ${filterUserId === uid ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500'}`}>
                        <img src={exp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${exp.profiles?.full_name}`} className="w-7 h-7 rounded-full object-cover" alt="" />
                        <span className="text-[10px] font-black uppercase">{exp.profiles?.full_name?.split(' ')[0]}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  <button onClick={() => setFilterCategory(null)} className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase border ${!filterCategory ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-white border-slate-100 text-slate-400'}`}><Filter size={10} /> Categorias</button>
                  {categories.filter(cat => expenses.some(e => e.category_name === cat.name)).map(cat => (
                    <button key={cat.id} onClick={() => setFilterCategory(filterCategory === cat.name ? null : cat.name)} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase whitespace-nowrap transition-all border ${filterCategory === cat.name ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-100 text-slate-400'}`}>{cat.name}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pb-4">
                {isLoading ? [1,2,3,4].map(i => <SkeletonCard key={i} />) : 
                  expenses.filter(exp => !filterUserId || exp.user_id === filterUserId).filter(exp => !filterCategory || exp.category_name === filterCategory).map((exp) => (
                      <motion.div layout key={exp.id} className="bg-white p-4 rounded-3xl border border-slate-50 shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform">
                        <div className="flex items-center gap-3 flex-1 overflow-hidden">
                          <img src={exp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${exp.profiles?.full_name}`} className="w-12 h-12 rounded-2xl border-2 border-slate-50 shadow-sm object-cover" alt="" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{exp.category_name}</span>
                            <span className="text-slate-800 font-bold truncate text-sm leading-tight">{exp.description || 'Sem descrição'}</span>
                            <span className="text-[9px] text-slate-300 font-black uppercase tracking-tighter">{exp.profiles?.full_name}</span>
                          </div>
                        </div>
                        <div className="text-right ml-2 shrink-0">
                          <span className="font-black text-slate-900 text-sm block mb-1">{formatCurrency(exp.amount)}</span>
                          <div className="flex gap-3 justify-end">
                            <button onClick={() => { 
                              const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(exp.amount);
                              setEditingId(exp.id); setAmount(formatted); setCategory(exp.category_name); setDescription(exp.description); setActiveTab('add'); 
                            }} className="text-blue-500 active:scale-90 transition-transform"><Edit2 size={16}/></button>
                            <button onClick={async () => { if(confirm("Remover?")) { await supabase.from('expenses').update({ is_deleted: true }).eq('id', exp.id); fetchData(); } }} className="text-red-400 active:scale-90 transition-transform"><Trash2 size={16}/></button>
                          </div>
                        </div>
                      </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'shopping' && (
            <div className="space-y-6">
              <form onSubmit={async (e) => { e.preventDefault(); if(!newItem) return; await supabase.from('shopping_list').insert({ item_name: newItem, user_id: user.id }); setNewItem(''); fetchData(); }} className="flex gap-2">
                <input className="flex-1 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-medium" placeholder="O que comprar?" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
                <button className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg active:scale-90"><Plus size={24} /></button>
              </form>
              <div className="space-y-3">
                {shoppingList.map((item) => (
                  <div key={item.id} className={`bg-white p-4 rounded-2xl flex items-center justify-between border transition-all ${!item.is_pending ? 'opacity-50 bg-slate-50' : 'border-slate-100 shadow-sm'}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <button onClick={async () => { await supabase.from('shopping_list').update({ is_pending: !item.is_pending }).eq('id', item.id); fetchData(); }}>
                        {item.is_pending ? <Circle size={24} className="text-slate-300" /> : <CheckCircle2 size={24} className="text-emerald-500" />}
                      </button>
                      <div className="flex flex-col"><span className={`font-bold text-sm ${!item.is_pending ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.item_name}</span><span className="text-[10px] text-slate-400 font-bold uppercase">De: {item.profiles?.full_name?.split(' ')[0]}</span></div>
                    </div>
                    <button onClick={async () => { if(confirm("Apagar?")) { await supabase.from('shopping_list').delete().eq('id', item.id); fetchData(); } }} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <button onClick={() => { setEditingNoteId(null); setNoteTitle(''); setNoteContent(''); setIsNoteEditorOpen(true); }} className="w-full p-5 bg-amber-400 text-slate-900 rounded-[2rem] font-black shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all uppercase text-xs tracking-widest"><Plus size={20} strokeWidth={3} /> Criar Anotação</button>
              <div className="grid grid-cols-1 gap-3 pb-10">
                {notes.map((note) => (
                  <motion.button layout key={note.id} onClick={() => { setEditingNoteId(note.id); setNoteTitle(note.title); setNoteContent(note.content); setIsNoteEditorOpen(true); }} className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm text-left flex items-center justify-between active:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 shrink-0"><StickyNote size={24} /></div>
                      <div className="overflow-hidden">
                        <p className="font-black text-slate-800 truncate uppercase tracking-tighter text-sm">{note.title}</p>
                        <p className="text-[9px] text-slate-300 uppercase font-black tracking-widest">{format(parseISO(note.created_at), "dd MMM yyyy", { locale: ptBR })}</p>
                      </div>
                    </div>
                    <ChevronNext size={16} className="text-slate-200" />
                  </motion.button>
                ))}
              </div>
            </div>
          )}

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
                    <div className="flex gap-2"><button onClick={() => {setEditRemId(rem.id); setRemText(rem.text); setRemDate(rem.reminder_date); setRemTime(rem.reminder_time || '');}} className="text-blue-500"><Edit2 size={16}/></button><button onClick={async () => { if(confirm("Apagar?")) { await supabase.from('reminders').delete().eq('id', rem.id); fetchData(); } }} className="text-red-400"><Trash2 size={16}/></button></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'add' && (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-6">
              <div className="flex items-center gap-3 text-blue-600 mb-2"><Plus size={24} strokeWidth={3} /><h3 className="font-black text-xl uppercase tracking-tighter">{editingId ? 'Editar Registro' : 'Novo Registro'}</h3></div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="relative"><span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-blue-600 text-2xl">R$</span><input type="text" inputMode="numeric" placeholder="0,00" required className="w-full p-6 pl-16 bg-slate-50 rounded-3xl text-4xl font-black outline-none text-blue-600 border-2 border-transparent focus:border-blue-100 transition-all shadow-inner" value={amount} onChange={handleCurrencyChange} /></div>
                <select required value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-5 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-slate-800 font-bold uppercase text-xs tracking-widest">{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                <input type="text" placeholder="No que você gastou?" className="w-full p-5 bg-slate-50 rounded-2xl outline-none border border-slate-100 font-medium" value={description} onChange={(e) => setDescription(e.target.value)} />
                <button className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl shadow-xl shadow-blue-100 active:scale-95 transition-all uppercase tracking-widest">Salvar no Extrato</button>
              </form>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-6 pb-10">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"><h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2"><BarChart3 size={14}/> Evolução Anual</h3><div className="h-40 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={annualChartData}><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} /><Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none'}} /><Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"><h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2"><Users size={14}/> Gastos por Pessoa</h3><div className="h-56 w-full">{expenses.length > 0 ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={userTotals} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value">{userTotals.map((_, i) => <Cell key={i} fill={USER_COLORS[i % USER_COLORS.length]} />)}</Pie><Tooltip formatter={(v: any) => formatCurrency(v)} /></PieChart></ResponsiveContainer> : <p className="text-center text-slate-300 py-10 text-sm italic">Sem dados</p>}</div><div className="mt-4 space-y-3">{userTotals.map((item: any, i: number) => (<div key={i} className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100"><div className="flex items-center gap-3"><img src={item.avatar || `https://ui-avatars.com/api/?name=${item.name}`} className="w-8 h-8 rounded-full object-cover border-2 border-white" /><span className="text-xs font-bold text-slate-700 uppercase">{item.name.split(' ')[0]}</span></div><span className="font-black text-slate-900 text-sm">{formatCurrency(item.value)}</span></div>))}</div></div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"><h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2"><PieIcon size={14}/> Distribuição Mensal</h3><div className="h-56 w-full">{expenses.length > 0 ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" isAnimationActive={true}>{chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: any) => formatCurrency(v)} /></PieChart></ResponsiveContainer> : <p className="text-center text-slate-300 py-10 text-sm italic">Sem gastos</p>}</div></div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"><h3 className="text-[10px] font-bold text-slate-400 mb-6 uppercase tracking-widest flex items-center gap-2"><Target size={14}/> Progresso das Metas</h3><div className="space-y-6">{categories.map((cat) => { const total = expenses.filter(e => e.category_name === cat.name).reduce((acc, curr) => acc + Number(curr.amount), 0); const meta = Number(cat.monthly_goal) || 0; const barMax = Math.max(total, meta); const blueWidth = barMax > 0 ? (Math.min(total, meta) / barMax) * 100 : 0; const redWidth = (barMax > 0 && total > meta) ? ((total - meta) / barMax) * 100 : 0; const isOver = meta > 0 && total > meta; return (<div key={cat.id} className="space-y-1.5"><div className="flex justify-between text-[11px] font-bold"><span className="text-slate-700">{cat.name}</span><span className={isOver ? 'text-red-500' : 'text-slate-400'}>{formatCurrency(total)} / <span className="text-slate-500 font-extrabold">{formatCurrency(meta)}</span></span></div><div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex"><div className={`h-full transition-all duration-700 ${total >= meta && meta > 0 ? 'bg-blue-600' : 'bg-blue-400'}`} style={{ width: `${blueWidth}%` }} /><div className="h-full bg-red-500 transition-all duration-700 shadow-[0_0_8px_rgba(239,68,68,0.4)]" style={{ width: `${redWidth}%` }} /></div></div>);})}</div></div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4"><img src={userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email}`} className="w-16 h-16 rounded-full border-2 border-white shadow-sm object-cover" alt="" /><div className="flex-1"><p className="font-bold text-slate-800">{userProfile?.full_name || 'Meu Perfil'}</p><button onClick={() => window.location.hash = '/profile'} className="text-blue-600 text-sm font-semibold">Editar Perfil →</button></div></div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"><h3 className="font-bold text-slate-800 mb-4 tracking-tight">Gerenciar Categorias & Metas</h3><CategoryManager categories={categories} refresh={fetchData} formatCurrency={formatCurrency} /></div>
              <button onClick={() => supabase.auth.signOut()} className="w-full p-4 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-widest text-xs"><LogOut size={16} /> Sair do App</button>
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {isNoteEditorOpen && (
          <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="fixed inset-0 bg-white z-[100] flex flex-col p-6">
            <div className="flex items-center justify-between mb-8"><button onClick={() => setIsNoteEditorOpen(false)} className="p-3 bg-slate-100 rounded-full text-slate-500 active:scale-90 transition-all"><X size={24}/></button><h3 className="font-black text-slate-800 uppercase tracking-tighter text-sm">{editingNoteId ? 'Editando Nota' : 'Nova Nota'}</h3><button onClick={saveNote} className="p-3 bg-blue-600 rounded-full text-white shadow-lg shadow-blue-100 active:scale-90 transition-all"><Save size={24}/></button></div>
            <input className="text-3xl font-black text-slate-800 outline-none placeholder:text-slate-100 mb-6 bg-transparent" placeholder="Dê um título..." value={noteTitle} onChange={e => setNoteTitle(e.target.value)} />
            <textarea className="flex-1 w-full outline-none text-slate-600 text-lg leading-relaxed resize-none bg-transparent" placeholder="Comece a escrever..." value={noteContent} onChange={e => setNoteContent(e.target.value)} />
            {editingNoteId && <button onClick={() => deleteNote(editingNoteId)} className="mt-4 p-4 text-red-400 font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 border-2 border-red-50 rounded-2xl active:bg-red-50"><Trash2 size={14}/> Apagar esta nota</button>}
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

function CategoryManager({ categories, refresh, formatCurrency }: any) {
  const [newCat, setNewCat] = useState('');
  const addCategory = async () => { if (!newCat) return; await supabase.from('categories').insert({ name: newCat }); setNewCat(''); refresh(); };
  const handleNameChange = async (id: string, oldName: string, newName: string) => { if (newName === oldName || !newName) return; await supabase.from('categories').update({ name: newName }).eq('id', id); await supabase.from('expenses').update({ category_name: newName }).eq('category_name', oldName); refresh(); };
  const handleMetaChange = async (id: string, inputValue: string) => { const numericValue = parseFloat(inputValue.replace(/[R$\s.]/g, '').replace(',', '.')); if (!isNaN(numericValue)) { await supabase.from('categories').update({ monthly_goal: numericValue }).eq('id', id); refresh(); } };
  return (
    <div className="space-y-4">
      <div className="flex gap-2"><input className="flex-1 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-sm outline-none font-bold" placeholder="Nova categoria..." value={newCat} onChange={e => setNewCat(e.target.value)} /><button onClick={addCategory} className="bg-blue-600 text-white p-3 rounded-xl shadow-lg active:scale-90 transition-all"><Plus size={20}/></button></div>
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1 no-scrollbar">
        {categories.map((c: any) => (
          <div key={c.id} className="p-4 bg-slate-50 rounded-3xl border border-slate-100 space-y-3 shadow-sm">
            <div className="flex justify-between items-center"><input type="text" className="bg-transparent text-sm font-black text-slate-700 outline-none uppercase tracking-tighter w-full border-b border-transparent focus:border-slate-300" defaultValue={c.name} onBlur={(e) => handleNameChange(c.id, c.name, e.target.value)} /><button onClick={async () => { if(confirm("Apagar categoria?")) { await supabase.from('categories').delete().eq('id', c.id); refresh(); } }} className="text-slate-300 ml-2 hover:text-red-500"><Trash2 size={16}/></button></div>
            <div className="flex flex-col gap-1 bg-white p-3 rounded-2xl border border-slate-100 shadow-inner"><label className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Meta Mensal</label><input type="text" className="bg-transparent text-base font-black text-blue-600 outline-none w-full" defaultValue={formatCurrency(c.monthly_goal || 0)} onBlur={(e) => handleMetaChange(c.id, e.target.value)} onFocus={(e) => e.target.value = (c.monthly_goal || 0).toString()} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}