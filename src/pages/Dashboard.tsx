import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { format, startOfMonth, endOfMonth, parseISO, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import BottomNav from '../components/BottomNav';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis } from 'recharts';
import { 
  Trash2, Edit2, ChevronLeft, ChevronRight, Plus, X, LogOut, 
  Target, PieChart as PieIcon, BarChart3, RefreshCcw, 
  CheckCircle2, Circle, Bell, Calendar, Clock, ShoppingCart, 
  Filter, Users, StickyNote, ChevronRight as ChevronNext, Save, Wallet,
  Search, Image as ImageIcon, Moon, Sun, ArrowUpRight, ArrowDownRight, Loader2, Paperclip
} from 'lucide-react';

// COMPONENTE DE CARREGAMENTO (SKELETON)
const SkeletonCard = () => (
  <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 animate-pulse flex items-center gap-3">
    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-2xl" />
    <div className="flex-1 space-y-2">
      <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/4" />
      <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-3/4" />
    </div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('list');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [prevMonthTotal, setPrevMonthTotal] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [shoppingList, setShoppingList] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [annualChartData, setAnnualChartData] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');

  // Estados Pro (Busca e Comprovante)
  const [searchTerm, setSearchTerm] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  // Estados de formulários
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
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [currentDate, activeTab, isDarkMode]);

  // CÁLCULOS TÉCNICOS (Filtros e Comparativo)
  const stats = useMemo(() => {
    const totalMonth = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const filtered = expenses
      .filter(exp => !filterUserId || exp.user_id === filterUserId)
      .filter(exp => !filterCategory || exp.category_name === filterCategory)
      .filter(exp => !searchTerm || exp.description?.toLowerCase().includes(searchTerm.toLowerCase()) || exp.category_name?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const totalFiltered = filtered.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const diff = prevMonthTotal > 0 ? ((totalMonth - prevMonthTotal) / prevMonthTotal) * 100 : 0;
    
    return { totalMonth, totalFiltered, filtered, diff };
  }, [expenses, filterUserId, filterCategory, searchTerm, prevMonthTotal]);

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  async function fetchData() {
    setIsLoading(true);
    try {
      const { data: cats } = await supabase.from('categories').select('*').order('name');
      if (cats) setCategories(cats);

      if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profile) setUserProfile(profile);
      }

      const startM = startOfMonth(currentDate).toISOString();
      const endM = endOfMonth(currentDate).toISOString();

      // Busca mês anterior para comparativo
      const startPrev = startOfMonth(subMonths(currentDate, 1)).toISOString();
      const endPrev = endOfMonth(subMonths(currentDate, 1)).toISOString();
      const { data: prevExps } = await supabase.from('expenses').select('amount').eq('is_deleted', false).gte('created_at', startPrev).lte('created_at', endPrev);
      setPrevMonthTotal(prevExps?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0);

      if (activeTab === 'notes') {
        const { data: nts } = await supabase.from('notes').select('*').order('created_at', { ascending: false });
        if (nts) setNotes(nts);
      }
      if (activeTab === 'reminders') {
        const { data: rems } = await supabase.from('reminders').select('*, profiles(full_name, avatar_url)').gte('reminder_date', startM.split('T')[0]).lte('reminder_date', endM.split('T')[0]).order('reminder_date', { ascending: true });
        if (rems) setReminders(rems);
      }
      if (activeTab === 'shopping') {
        const { data: items } = await supabase.from('shopping_list').select('*, profiles(full_name, avatar_url)').order('is_pending', { ascending: false }).order('created_at', { ascending: false });
        if (items) setShoppingList(items);
      }

      const { data: exps } = await supabase.from('expenses').select(`*, profiles (full_name, avatar_url)`).eq('is_deleted', false).gte('created_at', startM).lte('created_at', endM).order('created_at', { ascending: false });
      if (exps) setExpenses(exps);

      const startY = new Date(currentDate.getFullYear(), 0, 1).toISOString();
      const endY = new Date(currentDate.getFullYear(), 11, 31).toISOString();
      const { data: ann } = await supabase.from('expenses').select('amount, created_at').eq('is_deleted', false).gte('created_at', startY).lte('created_at', endY);
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      setAnnualChartData(months.map((m, i) => ({ name: m, total: (ann || []).filter(e => new Date(e.created_at).getMonth() === i).reduce((acc, curr) => acc + Number(curr.amount), 0) })));
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }

  // UPLOAD DE COMPROVANTE
  const handleReceiptUpload = async (file: File) => {
    setUploadingReceipt(true);
    const fileName = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('receipts').upload(fileName, file);
    if (!error) {
      const { data } = supabase.storage.from('receipts').getPublicUrl(fileName);
      setReceiptUrl(data.publicUrl);
    }
    setUploadingReceipt(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    const payload = { amount: numericAmount, category_name: category, description, receipt_url: receiptUrl };
    
    if (editingId) await supabase.from('expenses').update(payload).eq('id', editingId);
    else await supabase.from('expenses').insert({ ...payload, user_id: user.id });
    
    setAmount(''); setCategory(''); setDescription(''); setReceiptUrl(''); setEditingId(null); setActiveTab('list'); fetchData();
  };

  const saveNote = async () => {
    if (!noteTitle) return;
    const p = { title: noteTitle, content: noteContent, user_id: user.id };
    if (editingNoteId) await supabase.from('notes').update(p).eq('id', editingNoteId);
    else await supabase.from('notes').insert(p);
    setNoteTitle(''); setNoteContent(''); setEditingNoteId(null); setIsNoteEditorOpen(false); fetchData();
  };

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

  const chartData = categories.map(cat => ({ name: cat.name, value: expenses.filter(e => e.category_name === cat.name).reduce((acc, curr) => acc + Number(curr.amount), 0) })).filter(d => d.value > 0);
  const userTotals = Object.values(expenses.reduce((acc: any, curr: any) => {
    const uid = curr.user_id;
    if (!acc[uid]) acc[uid] = { name: curr.profiles?.full_name || 'Usuário', avatar: curr.profiles?.avatar_url, value: 0 };
    acc[uid].value += Number(curr.amount);
    return acc;
  }, {}));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const USER_COLORS = ['#3b82f6', '#ec4899'];

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    const options = { minimumFractionDigits: 2 };
    const result = new Intl.NumberFormat('pt-BR', options).format(parseFloat(value) / 100);
    setAmount(result === "NaN" ? "" : result);
  };

  return (
    <div className={`pb-28 pt-4 px-4 max-w-md mx-auto min-h-screen font-sans transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4 bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}><ChevronLeft className="text-slate-400" /></button>
        <div className="flex flex-col items-center">
          <h2 className="font-black text-lg capitalize leading-none">{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</h2>
          <button onClick={() => window.location.reload()} className="flex items-center gap-1 mt-1 text-[9px] font-black text-blue-500 uppercase tracking-widest"><RefreshCcw size={10} /> ATUALIZAR</button>
        </div>
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}><ChevronRight className="text-slate-400" /></button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab + currentDate.toISOString()} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>

          {/* TELA: EXTRATO */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              
              {/* CARD DE RESUMO PRO COM BUSCA */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-[2.5rem] shadow-xl shadow-blue-500/20 text-white relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Total Filtrado</span>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black ${stats.diff > 0 ? 'bg-red-400/30' : 'bg-emerald-400/30'}`}>
                      {stats.diff > 0 ? <ArrowUpRight size={10}/> : <ArrowDownRight size={10}/>}
                      {Math.abs(stats.diff).toFixed(0)}% vs anterior
                    </div>
                  </div>
                  <h1 className="text-4xl font-black tracking-tighter">{formatCurrency(stats.totalFiltered)}</h1>
                  <div className="flex items-center gap-2 mt-4 bg-black/10 p-1 rounded-2xl">
                    <div className="bg-white/20 p-2 rounded-xl"><Search size={16}/></div>
                    <input className="bg-transparent border-none outline-none text-xs font-bold w-full placeholder:text-white/40 text-white" placeholder="Buscar no extrato..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                </div>
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
              </div>

              {/* FILTROS */}
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1 px-1">
                <button onClick={() => setFilterUserId(null)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${!filterUserId ? 'bg-slate-800 dark:bg-white dark:text-slate-900 text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'}`}>Todos</button>
                {Array.from(new Set(expenses.map(e => e.user_id))).map(uid => {
                  const exp = expenses.find(e => e.user_id === uid);
                  return (
                    <button key={uid} onClick={() => setFilterUserId(filterUserId === uid ? null : uid)} className={`flex items-center gap-2 p-1 pr-4 rounded-full border transition-all ${filterUserId === uid ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'}`}>
                      <img src={exp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${exp.profiles?.full_name}`} className="w-8 h-8 rounded-full object-cover" alt="" />
                      <span className="text-[10px] font-black uppercase">{exp.profiles?.full_name?.split(' ')[0]}</span>
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-1">
                  <button onClick={() => setFilterCategory(null)} className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase border ${!filterCategory ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'}`}><Filter size={10} /> Categorias</button>
                  {categories.filter(cat => expenses.some(e => e.category_name === cat.name)).map(cat => (
                    <button key={cat.id} onClick={() => setFilterCategory(filterCategory === cat.name ? null : cat.name)} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase whitespace-nowrap transition-all border ${filterCategory === cat.name ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 text-blue-700 dark:text-blue-300' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'}`}>{cat.name}</button>
                  ))}
              </div>

              <div className="space-y-3 pb-4">
                {isLoading ? [1,2,3].map(i => <SkeletonCard key={i}/>) : 
                  stats.filtered.map((exp) => (
                    <motion.div layout key={exp.id} className="bg-white dark:bg-slate-800 p-4 rounded-[2rem] border border-slate-50 dark:border-slate-700 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <img src={exp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${exp.profiles?.full_name}`} className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-50 dark:border-slate-700 shadow-sm" alt="" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{exp.category_name}</span>
                          <span className="font-bold truncate text-sm leading-tight text-slate-800 dark:text-slate-200">{exp.description || 'Sem descrição'}</span>
                          <div className="flex items-center gap-2">
                             <span className="text-[9px] text-slate-400 font-black uppercase">{exp.profiles?.full_name}</span>
                             {exp.receipt_url && <button onClick={() => setViewingReceipt(exp.receipt_url)} className="text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 p-1 rounded-md"><Paperclip size={10}/></button>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-2 shrink-0">
                        <span className="font-black text-slate-900 dark:text-white text-base block">{formatCurrency(exp.amount)}</span>
                        <div className="flex gap-3 justify-end mt-1">
                          <button onClick={() => { setEditingId(exp.id); setAmount(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(exp.amount)); setCategory(exp.category_name); setDescription(exp.description); setReceiptUrl(exp.receipt_url || ''); setActiveTab('add'); }} className="text-slate-300 hover:text-blue-500"><Edit2 size={16}/></button>
                          <button onClick={async () => { if(confirm("Remover?")) { await supabase.from('expenses').update({ is_deleted: true }).eq('id', exp.id); fetchData(); } }} className="text-slate-300 hover:text-red-400"><Trash2 size={16}/></button>
                        </div>
                      </div>
                    </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* TELA: NOVO GASTO */}
          {activeTab === 'add' && (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 space-y-6">
              <h3 className="font-black text-xl uppercase tracking-tighter text-blue-600">{editingId ? 'Editar' : 'Novo'} Registro</h3>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-blue-600 text-2xl">R$</span>
                  <input type="text" inputMode="numeric" placeholder="0,00" required className="w-full p-6 pl-16 bg-slate-50 dark:bg-slate-900/50 rounded-3xl text-4xl font-black outline-none text-blue-600 border-2 border-transparent focus:border-blue-500 transition-all shadow-inner" value={amount} onChange={handleCurrencyChange} />
                </div>
                <select required value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold uppercase text-xs">
                   <option value="">Categoria</option>
                   {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <input type="text" placeholder="Descrição?" className="w-full p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200" value={description} onChange={(e) => setDescription(e.target.value)} />
                <div className="flex items-center gap-4">
                  <label className="flex-1 flex items-center justify-center gap-2 p-4 bg-slate-100 dark:bg-slate-700 rounded-2xl text-xs font-black uppercase cursor-pointer">
                    {uploadingReceipt ? <Loader2 className="animate-spin" size={16}/> : <ImageIcon size={16}/>}
                    {receiptUrl ? 'Foto Anexada' : 'Anexar Comprovante'}
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handleReceiptUpload(e.target.files[0])} />
                  </label>
                  {receiptUrl && <button type="button" onClick={() => setReceiptUrl('')} className="p-4 bg-red-50 text-red-500 rounded-2xl"><X size={16}/></button>}
                </div>
                <button className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl shadow-xl active:scale-95 transition-all uppercase tracking-widest">Salvar Registro</button>
              </form>
            </div>
          )}

          {/* TELA: COMPRAS */}
          {activeTab === 'shopping' && (
            <div className="space-y-6">
              <form onSubmit={async (e) => { e.preventDefault(); if(!newItem) return; await supabase.from('shopping_list').insert({ item_name: newItem, user_id: user.id }); setNewItem(''); fetchData(); }} className="flex gap-2">
                <input className="flex-1 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 outline-none text-slate-800 dark:text-white" placeholder="O que comprar?" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
                <button className="bg-blue-600 text-white p-4 rounded-2xl active:scale-90"><Plus size={24} /></button>
              </form>
              <div className="space-y-3">
                {shoppingList.map((item) => (
                  <div key={item.id} className={`bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border transition-all ${!item.is_pending ? 'opacity-50 bg-slate-50 dark:bg-slate-900/50' : 'border-slate-100 dark:border-slate-700 shadow-sm'}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <button onClick={async () => { await supabase.from('shopping_list').update({ is_pending: !item.is_pending }).eq('id', item.id); fetchData(); }}>
                        {item.is_pending ? <Circle size={24} className="text-slate-300" /> : <CheckCircle2 size={24} className="text-emerald-500" />}
                      </button>
                      <div className="flex flex-col"><span className={`font-bold text-sm ${!item.is_pending ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{item.item_name}</span><span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">De: {item.profiles?.full_name?.split(' ')[0]}</span></div>
                    </div>
                    <button onClick={async () => { if(confirm("Apagar?")) { await supabase.from('shopping_list').delete().eq('id', item.id); fetchData(); } }} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TELA: NOTAS */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <button onClick={() => { setEditingNoteId(null); setNoteTitle(''); setNoteContent(''); setIsNoteEditorOpen(true); }} className="w-full p-5 bg-amber-400 text-slate-900 rounded-[2rem] font-black shadow-lg flex items-center justify-center gap-2 active:scale-95 uppercase text-xs"><Plus size={20} /> Criar Anotação</button>
              <div className="grid grid-cols-1 gap-3 pb-10">
                {notes.map((note) => (
                  <motion.button layout key={note.id} onClick={() => { setEditingNoteId(note.id); setNoteTitle(note.title); setNoteContent(note.content); setIsNoteEditorOpen(true); }} className="bg-white dark:bg-slate-800 p-5 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 shadow-sm text-left flex items-center justify-between">
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center text-amber-500 shrink-0"><StickyNote size={24} /></div>
                      <div className="overflow-hidden">
                        <p className="font-black text-slate-800 dark:text-slate-200 truncate uppercase tracking-tighter">{note.title}</p>
                        <p className="text-[9px] text-slate-300 uppercase font-black">{format(parseISO(note.created_at), "dd MMM yyyy", { locale: ptBR })}</p>
                      </div>
                    </div>
                    <ChevronNext size={16} className="text-slate-200" />
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* TELA: LEMBRETES */}
          {activeTab === 'reminders' && (
            <div className="space-y-6">
              <form onSubmit={handleReminderSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 space-y-4">
                <h3 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm uppercase tracking-tighter"><Bell size={16} className="text-blue-500"/> Novo Aviso</h3>
                <input className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-white" placeholder="Lembrar de?" required value={remText} onChange={e => setRemText(e.target.value)} />
                <div className="flex gap-2">
                  <div className="flex-1 relative"><Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/><input type="date" required className="w-full p-4 pl-12 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-sm text-slate-800 dark:text-white" value={remDate} onChange={e => setRemDate(e.target.value)} /></div>
                  <div className="w-32 relative"><Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/><input type="time" className="w-full p-4 pl-12 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-sm text-slate-800 dark:text-white" value={remTime} onChange={e => setRemTime(e.target.value)} /></div>
                </div>
                <button className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95">Confirmar</button>
              </form>
              <div className="space-y-3 pb-10">
                {reminders.map((rem) => (
                  <div key={rem.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-500 shrink-0"><Calendar size={20} /></div>
                      <div><p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{rem.text}</p><p className="text-[10px] text-slate-400 font-black uppercase">{format(parseISO(rem.reminder_date), "dd/MM", { locale: ptBR })} {rem.reminder_time && ` às ${rem.reminder_time}`}</p></div>
                    </div>
                    <div className="flex gap-2"><button onClick={() => {setEditRemId(rem.id); setRemText(rem.text); setRemDate(rem.reminder_date); setRemTime(rem.reminder_time || '');}} className="text-blue-500"><Edit2 size={16}/></button><button onClick={async () => { if(confirm("Apagar?")) { await supabase.from('reminders').delete().eq('id', rem.id); fetchData(); } }} className="text-red-400"><Trash2 size={16}/></button></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TELA: GRÁFICOS */}
          {activeTab === 'stats' && (
            <div className="space-y-6 pb-10 px-1">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm"><h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2"><BarChart3 size={14}/> Evolução Anual</h3><div className="h-40 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={annualChartData}><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} /><Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none'}} /><Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
              
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2"><Users size={14}/> Gastos por Pessoa</h3>
                <div className="h-56 w-full">{expenses.length > 0 ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={userTotals} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value">{userTotals.map((_, i) => <Cell key={i} fill={USER_COLORS[i % USER_COLORS.length]} />)}</Pie><Tooltip formatter={(v: any) => formatCurrency(v)} /></PieChart></ResponsiveContainer> : <p className="text-center text-slate-300 py-10 text-sm">Sem dados</p>}</div>
                <div className="mt-4 space-y-3">{userTotals.map((item: any, i: number) => (<div key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700"><div className="flex items-center gap-3"><img src={item.avatar || `https://ui-avatars.com/api/?name=${item.name}`} className="w-8 h-8 rounded-full object-cover border-2 border-white dark:border-slate-700" /><span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">{item.name.split(' ')[0]}</span></div><span className="font-black text-slate-900 dark:text-white text-sm">{formatCurrency(item.value)}</span></div>))}</div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm"><h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2"><PieIcon size={14}/> Gastos por Categoria</h3><div className="h-56 w-full">{expenses.length > 0 ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" isAnimationActive={true}>{chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: any) => formatCurrency(v)} /></PieChart></ResponsiveContainer> : <p className="text-center text-slate-300 py-10 text-sm italic">Sem dados</p>}</div></div>
              
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <h3 className="text-[10px] font-bold text-slate-400 mb-6 uppercase tracking-widest flex items-center gap-2"><Target size={14}/> Progresso das Metas</h3>
                <div className="space-y-6">
                  {categories.map((cat) => {
                    const total = expenses.filter(e => e.category_name === cat.name).reduce((acc, curr) => acc + Number(curr.amount), 0);
                    const meta = Number(cat.monthly_goal) || 0;
                    const barMax = Math.max(total, meta);
                    const blueWidth = barMax > 0 ? (Math.min(total, meta) / barMax) * 100 : 0;
                    const redWidth = (barMax > 0 && total > meta) ? ((total - meta) / barMax) * 100 : 0;
                    const isOver = meta > 0 && total > meta;
                    return (
                      <div key={cat.id} className="space-y-1.5"><div className="flex justify-between text-[11px] font-bold"><span className="text-slate-700 dark:text-slate-300">{cat.name}</span><span className={isOver ? 'text-red-500' : 'text-slate-400'}>{formatCurrency(total)} / <span className="text-slate-500 font-black">{formatCurrency(meta)}</span></span></div><div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex"><div className={`h-full transition-all duration-700 ${total >= meta && meta > 0 ? 'bg-blue-600' : 'bg-blue-400'}`} style={{ width: `${blueWidth}%` }} /><div className="h-full bg-red-500 transition-all duration-700 shadow-[0_0_8px_rgba(239,68,68,0.4)]" style={{ width: `${redWidth}%` }} /></div></div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
                 <img src={userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email}`} className="w-16 h-16 rounded-full border-2 border-white dark:border-slate-700 shadow-sm object-cover" alt="" />
                 <div className="flex-1"><p className="font-bold text-slate-800 dark:text-slate-200">{userProfile?.full_name || 'Meu Perfil'}</p><button onClick={() => window.location.hash = '/profile'} className="text-blue-600 text-xs font-black uppercase tracking-widest mt-1">Editar Perfil →</button></div>
              </div>

              {/* TEMA E LOGOUT */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-6 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2 shadow-sm active:scale-95 transition-all">
                   {isDarkMode ? <Sun className="text-amber-400" /> : <Moon className="text-indigo-500" />}
                   <span className="text-[10px] font-black uppercase tracking-widest">{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
                </button>
                <button onClick={() => supabase.auth.signOut()} className="p-6 bg-red-50 dark:bg-red-900/20 rounded-[2rem] flex flex-col items-center gap-2 shadow-sm active:scale-95 transition-all">
                   <LogOut className="text-red-500" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Sair do App</span>
                </button>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 tracking-tight uppercase text-[10px] opacity-50 tracking-widest">Categorias & Metas</h3>
                <CategoryManager categories={categories} refresh={fetchData} formatCurrency={formatCurrency} />
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* MODAL EDITOR DE NOTAS */}
      <AnimatePresence>
        {isNoteEditorOpen && (
          <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="fixed inset-0 bg-white dark:bg-slate-900 z-[100] flex flex-col p-6">
            <div className="flex items-center justify-between mb-8"><button onClick={() => setIsNoteEditorOpen(false)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 active:scale-90"><X size={24}/></button><h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter text-sm">{editingNoteId ? 'Editando Nota' : 'Nova Nota'}</h3><button onClick={saveNote} className="p-3 bg-blue-600 rounded-full text-white shadow-lg shadow-blue-100 active:scale-90"><Save size={24}/></button></div>
            <input className="text-3xl font-black text-slate-800 dark:text-white outline-none placeholder:text-slate-100 dark:placeholder:text-slate-800 mb-6 bg-transparent" placeholder="Título..." value={noteTitle} onChange={e => setNoteTitle(e.target.value)} />
            <textarea className="flex-1 w-full outline-none text-slate-600 dark:text-slate-400 text-lg leading-relaxed resize-none bg-transparent" placeholder="Comece a escrever..." value={noteContent} onChange={e => setNoteContent(e.target.value)} />
            {editingNoteId && <button onClick={() => deleteNote(editingNoteId)} className="mt-4 p-4 text-red-400 font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 border-2 border-red-50 dark:border-red-900/50 rounded-2xl active:bg-red-50 dark:active:bg-red-900/20"><Trash2 size={14}/> Apagar esta nota</button>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL VER COMPROVANTE */}
      <AnimatePresence>
        {viewingReceipt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/95 z-[200] flex flex-col p-4 backdrop-blur-xl">
            <button onClick={() => setViewingReceipt(null)} className="self-end p-4 text-white"><X size={32}/></button>
            <div className="flex-1 flex items-center justify-center">
               <img src={viewingReceipt} className="max-w-full max-h-[85vh] rounded-3xl shadow-2xl object-contain border border-white/10" alt="Comprovante" />
            </div>
            <p className="text-center text-white/50 text-[10px] font-black uppercase tracking-[0.4em] mt-6">Informação protegida</p>
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
      <div className="flex gap-2">
        <input className="flex-1 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none text-sm outline-none font-bold text-slate-800 dark:text-white" placeholder="Nova categoria..." value={newCat} onChange={e => setNewCat(e.target.value)} />
        <button onClick={addCategory} className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg active:scale-90 transition-all"><Plus size={20}/></button>
      </div>
      <div className="space-y-3 max-h-[25rem] overflow-y-auto pr-1 no-scrollbar pb-6">
        {categories.map((c: any) => (
          <div key={c.id} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-[2rem] space-y-3 border border-transparent dark:border-slate-800">
            <div className="flex justify-between items-center">
              <input type="text" className="bg-transparent text-sm font-black outline-none uppercase tracking-tighter w-full border-b border-transparent focus:border-blue-500 text-slate-800 dark:text-slate-200" defaultValue={c.name} onBlur={(e) => handleNameChange(c.id, c.name, e.target.value)} />
              <button onClick={async () => { if(confirm("Apagar categoria?")) { await supabase.from('categories').delete().eq('id', c.id); refresh(); } }} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
            </div>
            <div className="flex flex-col gap-1 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-inner">
              <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Meta Mensal</label>
              <input type="text" className="bg-transparent text-base font-black text-blue-600 dark:text-blue-400 outline-none w-full" defaultValue={formatCurrency(c.monthly_goal || 0)} onBlur={(e) => handleMetaChange(c.id, e.target.value)} onFocus={(e) => e.target.value = (c.monthly_goal || 0).toString()} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}