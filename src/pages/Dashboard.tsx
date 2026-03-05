import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import BottomNav from '../components/BottomNav';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Trash2, Edit2, ChevronLeft, ChevronRight, Plus, X, LogOut } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('list');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Estados do formulário e Filtro
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterUserId, setFilterUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  // --- FUNÇÕES DE AUXÍLIO (UX) ---
  
  // Máscara de Moeda: transforma "1250" em "12,50" em tempo real
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
        if (profiles && profiles.length > 0) {
          setUserProfile(profiles[0]);
        } else {
          const { data: newProf } = await supabase.from('profiles')
            .upsert({ id: user.id, full_name: user.email?.split('@')[0] })
            .select().single();
          if (newProf) setUserProfile(newProf);
        }
      }

      const start = startOfMonth(currentDate).toISOString();
      const end = endOfMonth(currentDate).toISOString();

      const { data: exps, error: expError } = await supabase
        .from('expenses')
        .select(`
          id, amount, category_name, description, created_at, user_id,
          profiles (full_name, avatar_url)
        `)
        .eq('is_deleted', false)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      if (expError) throw expError;
      if (exps) setExpenses(exps);

    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Converte a máscara "1.250,50" de volta para número 1250.50
    const numericAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'));

    const payload = {
      amount: numericAmount,
      category_name: category,
      description,
      user_id: user.id
    };

    if (editingId) {
      await supabase.from('expenses').update(payload).eq('id', editingId);
    } else {
      await supabase.from('expenses').insert(payload);
    }

    setAmount(''); setCategory(''); setDescription(''); setEditingId(null);
    setActiveTab('list');
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Remover este gasto?")) {
      await supabase.from('expenses').update({ is_deleted: true }).eq('id', id);
      fetchData();
    }
  };

  const chartData = categories.map(cat => ({
    name: cat.name,
    value: expenses.filter(e => e.category_name === cat.name).reduce((acc, curr) => acc + Number(curr.amount), 0)
  })).filter(d => d.value > 0);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="pb-28 pt-4 px-4 max-w-md mx-auto min-h-screen bg-slate-50 font-sans">
      {/* Header com Navegação de Data */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}>
          <ChevronLeft className="text-slate-300" />
        </button>
        <h2 className="font-bold text-lg capitalize">{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</h2>
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}>
          <ChevronRight className="text-slate-300" />
        </button>
      </div>

      {/* TELA: EXTRATO (COM FILTRO POR USUÁRIO) */}
      {activeTab === 'list' && (
        <div className="space-y-4 animate-in fade-in duration-500">
          
          {/* Barra de Filtros por Avatar */}
          <div className="flex items-center gap-3 pb-2 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setFilterUserId(null)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${!filterUserId ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}
            >
              Todos
            </button>
            {/* Gera filtros automáticos baseados em quem postou algo no mês */}
            {Array.from(new Set(expenses.map(e => e.user_id))).map(uid => {
              const exp = expenses.find(e => e.user_id === uid);
              const isActive = filterUserId === uid;
              return (
                <button 
                  key={uid}
                  onClick={() => setFilterUserId(isActive ? null : uid)}
                  className={`flex items-center gap-2 p-1 pr-4 rounded-full transition-all border ${isActive ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-500'}`}
                >
                  <img 
                    src={exp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${exp.profiles?.full_name}`} 
                    className="w-7 h-7 rounded-full object-cover bg-slate-100" alt="" 
                  />
                  <span className="text-xs font-bold whitespace-nowrap">{exp.profiles?.full_name?.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>

          <div className="space-y-3">
            {expenses.length === 0 && <p className="text-center text-slate-400 py-10 italic">Sem gastos neste período.</p>}
            {expenses
              .filter(exp => !filterUserId || exp.user_id === filterUserId)
              .map((exp) => (
                <div key={exp.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-slate-100 group active:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 overflow-hidden">
                    <img 
                      src={exp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${exp.profiles?.full_name || 'U'}`} 
                      className="w-11 h-11 rounded-full overflow-hidden bg-slate-100 border-2 border-white shadow-sm flex-shrink-0 object-cover"
                      alt="" 
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">{exp.category_name}</span>
                      <span className="text-slate-800 font-medium truncate text-sm">{exp.description || 'Sem descrição'}</span>
                      <span className="text-[10px] text-slate-400">{exp.profiles?.full_name || 'Usuário'}</span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1 ml-2">
                    <span className="font-bold text-slate-900">
                      {Number(exp.amount).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { 
                        // Ao editar, convertemos o número de volta para a máscara do input
                        const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(exp.amount);
                        setEditingId(exp.id); setAmount(formatted); setCategory(exp.category_name); setDescription(exp.description); setActiveTab('add'); 
                      }} className="text-blue-500 p-1"><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete(exp.id)} className="text-red-400 p-1"><Trash2 size={14}/></button>
                    </div>
                  </div>
                </div>
            ))}
          </div>
        </div>
      )}

      {/* TELA: ADICIONAR (COM MÁSCARA DE MOEDA) */}
      {activeTab === 'add' && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 animate-in slide-in-from-bottom-4">
          <h3 className="font-bold text-slate-800">{editingId ? 'Editar Gasto' : 'Novo Gasto'}</h3>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-blue-600 text-2xl">R$</span>
            <input 
              type="text" 
              inputMode="numeric"
              placeholder="0,00" 
              required
              className="w-full p-4 pl-14 bg-slate-50 rounded-2xl text-3xl font-bold outline-none text-blue-600 border-2 border-transparent focus:border-blue-100 transition-all"
              value={amount} 
              onChange={handleCurrencyChange}
            />
          </div>
          <select 
            required value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-slate-600"
          >
            <option value="">Selecione a Categoria</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <input 
            type="text" placeholder="Descrição rápida (opcional)"
            className="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-slate-100"
            value={description} onChange={(e) => setDescription(e.target.value)}
          />
          <button className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all">
            {editingId ? 'Salvar Alteração' : 'Confirmar Gasto'}
          </button>
          {editingId && (
            <button type="button" onClick={() => {setEditingId(null); setAmount(''); setActiveTab('list')}} className="w-full py-2 text-slate-400 text-sm">Cancelar Edição</button>
          )}
        </form>
      )}

      {/* TELA: GRÁFICOS */}
      {activeTab === 'stats' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 animate-in fade-in duration-300">
          <div className="h-64 w-full">
            {expenses.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" isAnimationActive={true}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                <Plus size={40} />
                <p className="text-sm">Sem dados este mês</p>
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {chartData.map((d, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}/>
                  {d.name}
                </span>
                <span className="font-bold text-slate-700">R$ {d.value.toLocaleString('pt-br', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TELA: CONFIGURAÇÕES */}
      {activeTab === 'config' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 overflow-hidden border-2 border-white shadow-sm flex-shrink-0">
              <img 
                src={userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email}`}
                className="w-full h-full object-cover" alt="" 
                onError={(e) => e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + user?.email}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-lg truncate">{userProfile?.full_name || 'Meu Perfil'}</p>
              <button onClick={() => window.location.hash = '/profile'} className="text-blue-600 text-sm font-semibold">Mudar nome ou foto →</button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">Categorias de Gastos</h3>
            <CategoryManager categories={categories} refresh={fetchData} />
          </div>

          <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 rounded-2xl font-bold active:scale-95 transition-all">
            <LogOut size={20} /> Sair da Conta
          </button>
        </div>
      )}

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

// COMPONENTE DE GESTÃO DE CATEGORIAS
function CategoryManager({ categories, refresh }: { categories: any[], refresh: () => void }) {
  const [newCat, setNewCat] = useState('');

  const addCategory = async () => {
    if (!newCat) return;
    const { error } = await supabase.from('categories').insert({ name: newCat });
    if (error) alert("Erro ao salvar: a categoria pode já existir.");
    else { setNewCat(''); refresh(); }
  };

  const removeCategory = async (id: string) => {
    if (confirm("Deseja remover esta categoria?")) {
      await supabase.from('categories').delete().eq('id', id);
      refresh();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input 
          className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm"
          placeholder="Ex: Farmácia..."
          value={newCat} onChange={e => setNewCat(e.target.value)}
        />
        <button onClick={addCategory} className="bg-blue-600 text-white p-3 rounded-xl shadow-md active:scale-90 transition-all"><Plus size={20}/></button>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-2 pr-2 no-scrollbar">
        {categories.map(c => (
          <div key={c.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-700 text-sm font-medium">{c.name}</span>
            <button onClick={() => removeCategory(c.id)} className="text-slate-300 hover:text-red-500 transition-colors"><X size={16}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}