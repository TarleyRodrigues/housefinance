// ─── DASHBOARD.TSX ───────────────────────────────────────────────────────────
// Arquivo orquestrador — gerencia estado global, dados e renderiza as abas.

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, RefreshCcw, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import BottomNav from '../components/BottomNav';
import { Toast } from '../components/ui';
import { useDashboardData } from '../hooks/useDashboardData';
import { supabase } from '../supabase'; // ✅ NOVO: necessário para deleteExpense

import { TabExtrato }   from '../tabs/TabExtrato';
import { TabNovoGasto } from '../tabs/TabNovoGasto';
import { TabCompras }   from '../tabs/TabCompras';
import { TabNotas }     from '../tabs/TabNotas';
import { TabAvisos }    from '../tabs/TabAvisos';
import { TabGraficos }  from '../tabs/TabGraficos';
import { TabAjustes }   from '../tabs/TabAjustes';
import { TabLogs }      from '../tabs/TabLogs';

import type { Expense } from '../types';

export default function Dashboard() {
  // ── Navegação ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<string>('list');
  const [currentDate, setCurrentDate] = useState(new Date());

  // ── Tema ──────────────────────────────────────────────────────────────────
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = useCallback((msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Edição de despesa ─────────────────────────────────────────────────────
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const handleEditExpense = useCallback((exp: Expense) => {
    setEditingExpense(exp);
    setActiveTab('add');
  }, []);

  // Limpa edição ao sair da aba 'add'
  useEffect(() => {
    if (activeTab !== 'add') setEditingExpense(null);
  }, [activeTab]);

  // ── Comprovante fullscreen ────────────────────────────────────────────────
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  // ── Dados (Hook Customizado) ──────────────────────────────────────────────
  const {
    expenses,
    prevMonthExpenses,
    prevMonthTotal,
    categories,
    shoppingList,
    reminders,
    notes,
    logs,
    annualChartData,
    userProfile,
    isLoading,
    fetchData,
  } = useDashboardData(currentDate, activeTab);

  // ── Navegação de mês ──────────────────────────────────────────────────────
  const prevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  // ── ✅ NOVO: deleteExpense — lógica de banco saiu do TabExtrato ────────────
  // Usa soft-delete (is_deleted = true) para preservar histórico
  const deleteExpense = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('expenses')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) throw error;
  }, []);

  return (
    <div
      className={`pb-32 pt-4 px-4 max-w-md mx-auto min-h-screen font-sans transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Notificações (Toasts) */}
      <AnimatePresence>
        {toast && <Toast message={toast.msg} type={toast.type} />}
      </AnimatePresence>

      {/* Header com Navegação e Refresh */}
      <div className="flex items-center justify-between mb-4 bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
        <button
          onClick={prevMonth}
          aria-label="Mês anterior"
          className="p-2 active:scale-90 transition-transform"
        >
          <ChevronLeft className="text-slate-400" />
        </button>

        <div className="flex flex-col items-center">
          <h2 className="font-black text-lg capitalize leading-none text-slate-800 dark:text-white">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <button
            onClick={() => window.location.reload()}
            aria-label="Atualizar aplicativo"
            className="flex items-center gap-1 mt-1 text-[9px] font-black text-blue-500 uppercase tracking-widest active:scale-95 transition-transform"
          >
            <RefreshCcw size={10} aria-hidden="true" /> ATUALIZAR APP
          </button>
        </div>

        <button
          onClick={nextMonth}
          aria-label="Próximo mês"
          className="p-2 active:scale-90 transition-transform"
        >
          <ChevronRight className="text-slate-400" />
        </button>
      </div>

      {/* Orquestrador de Abas com Animação */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab + currentDate.toISOString()}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'list' && (
            <TabExtrato
              expenses={expenses}
              categories={categories}
              prevMonthTotal={prevMonthTotal}
              isLoading={isLoading}
              currentDate={currentDate}
              fetchData={fetchData}
              showToast={showToast}
              onEdit={handleEditExpense}
              onViewReceipt={setViewingReceipt}
              onDelete={deleteExpense} // ✅ NOVO: prop adicionada
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
            <TabCompras
              shoppingList={shoppingList}
              fetchData={fetchData}
              showToast={showToast}
            />
          )}

          {activeTab === 'notes' && (
            <TabNotas
              notes={notes}
              fetchData={fetchData}
              showToast={showToast}
            />
          )}

          {activeTab === 'reminders' && (
            <TabAvisos
              reminders={reminders}
              fetchData={fetchData}
              showToast={showToast}
            />
          )}

          {activeTab === 'stats' && (
            <TabGraficos
              expenses={expenses}
              prevMonthExpenses={prevMonthExpenses}
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
              onOpenLogs={() => setActiveTab('logs')}
            />
          )}

          {activeTab === 'logs' && (
            <TabLogs
              logs={logs}
              onBack={() => setActiveTab('config')}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Modal Visualizador de Comprovante */}
      <AnimatePresence>
        {viewingReceipt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[200] flex flex-col p-4 backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Visualizar comprovante"
          >
            <button
              onClick={() => setViewingReceipt(null)}
              aria-label="Fechar visualizador de comprovante"
              className="self-end p-4 text-white"
            >
              <X size={32} aria-hidden="true" />
            </button>
            <div className="flex-1 flex items-center justify-center">
              <img
                src={viewingReceipt}
                className="max-w-full max-h-[85vh] rounded-3xl object-contain border border-white/10 shadow-2xl"
                alt="Comprovante da despesa"
              />
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