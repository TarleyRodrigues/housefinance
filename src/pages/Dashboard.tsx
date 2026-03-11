// ─── DASHBOARD.TSX ───────────────────────────────────────────────────────────
// Arquivo orquestrador — apenas gerencia estado global e renderiza as abas.
// Para editar uma tela específica, abra o arquivo correspondente em /tabs/.

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, RefreshCcw, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import BottomNav from '../components/BottomNav';
import { Toast } from '../components/ui';
import { useDashboardData } from '../hooks/useDashboardData';

import { TabExtrato }   from '../tabs/TabExtrato';
import { TabNovoGasto } from '../tabs/TabNovoGasto';
import { TabCompras }   from '../tabs/TabCompras';
import { TabNotas }     from '../tabs/TabNotas';
import { TabAvisos }    from '../tabs/TabAvisos';
import { TabGraficos }  from '../tabs/TabGraficos';
import { TabAjustes }   from '../tabs/TabAjustes';

import type { Expense, TabName, ToastState } from '../types';

export default function Dashboard() {
  // ── Navegação ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<string>('list');
  const [currentDate, setCurrentDate] = useState(new Date());

  // ── Tema ──────────────────────────────────────────────────────────────────
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => {
    const root = window.document.documentElement;
    isDarkMode ? root.classList.add('dark') : root.classList.remove('dark');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Edição de despesa (passada do Extrato → NovoGasto) ────────────────────
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const handleEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    setActiveTab('add');
  };

  // ── Comprovante fullscreen ─────────────────────────────────────────────────
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  // ── Dados ─────────────────────────────────────────────────────────────────
  const {
    expenses, prevMonthTotal, categories, shoppingList,
    reminders, notes, annualChartData, userProfile, isLoading,
    fetchData,
  } = useDashboardData(currentDate, activeTab);

  // Limpa edição ao mudar aba
  useEffect(() => {
    if (activeTab !== 'add') setEditingExpense(null);
  }, [activeTab]);

  // ── Navegação de mês ──────────────────────────────────────────────────────
  const prevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  return (
    <div className={`pb-32 pt-4 px-4 max-w-md mx-auto min-h-screen font-sans transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={toast.msg} type={toast.type} />}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
        <button onClick={prevMonth}><ChevronLeft className="text-slate-400" /></button>
        <div className="flex flex-col items-center">
          <h2 className="font-black text-lg capitalize leading-none text-slate-800 dark:text-white">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1 mt-1 text-[9px] font-black text-blue-500 uppercase tracking-widest"
          >
            <RefreshCcw size={10} /> ATUALIZAR
          </button>
        </div>
        <button onClick={nextMonth}><ChevronRight className="text-slate-400" /></button>
      </div>

      {/* Conteúdo das abas */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab + currentDate.toISOString()}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {activeTab === 'list' && (
            <TabExtrato
              expenses={expenses}
              categories={categories}
              prevMonthTotal={prevMonthTotal}
              isLoading={isLoading}
              fetchData={fetchData}
              showToast={showToast}
              onEdit={handleEditExpense}
              onViewReceipt={setViewingReceipt}
            />
          )}

          {activeTab === 'add' && (
            <TabNovoGasto
              categories={categories}
              editingExpense={editingExpense}
              fetchData={fetchData}
              showToast={showToast}
              onSaved={() => setActiveTab('list')}
            />
          )}

          {activeTab === 'shopping' && (
            <TabCompras shoppingList={shoppingList} fetchData={fetchData} showToast={showToast} />
          )}

          {activeTab === 'notes' && (
            <TabNotas notes={notes} fetchData={fetchData} showToast={showToast} />
          )}

          {activeTab === 'reminders' && (
            <TabAvisos reminders={reminders} fetchData={fetchData} showToast={showToast} />
          )}

          {activeTab === 'stats' && (
            <TabGraficos
              expenses={expenses}
              categories={categories}
              annualChartData={annualChartData}
              currentDate={currentDate}
            />
          )}

          {activeTab === 'config' && (
            <TabAjustes
              userProfile={userProfile}
              categories={categories}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              fetchData={fetchData}
              showToast={showToast}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Visualizador de comprovante */}
      <AnimatePresence>
        {viewingReceipt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[200] flex flex-col p-4 backdrop-blur-xl"
          >
            <button onClick={() => setViewingReceipt(null)} className="self-end p-4 text-white">
              <X size={32} />
            </button>
            <div className="flex-1 flex items-center justify-center">
              <img src={viewingReceipt} className="max-w-full max-h-[85vh] rounded-3xl object-contain border border-white/10 shadow-2xl" alt="Comprovante" />
            </div>
            <p className="text-center text-white/50 text-[10px] font-black uppercase tracking-[0.4em] mt-6 leading-none">
              DOCUMENTO SALVO NO SUPABASE
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
