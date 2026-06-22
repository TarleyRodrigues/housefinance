// ─── BOTTOM NAVIGATION ───────────────────────────────────────────────────────

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home, PlusCircle, ShoppingCart, PieChart,
  LayoutDashboard, Settings, Bell, StickyNote,
  Clapperboard, Target, UtensilsCrossed, Repeat2,
  MoreHorizontal, X,
} from 'lucide-react';

interface Tab { id: string; icon: React.ElementType; label: string; }

const PRIMARY: Tab[] = [
  { id: 'home',     icon: Home,         label: 'Início'   },
  { id: 'add',      icon: PlusCircle,   label: 'Novo'     },
  { id: 'shopping', icon: ShoppingCart, label: 'Compras'  },
  { id: 'stats',    icon: PieChart,     label: 'Gráficos' },
];

const SECONDARY: Tab[] = [
  { id: 'list',      icon: LayoutDashboard, label: 'Extrato'  },
  { id: 'reminders', icon: Bell,            label: 'Avisos'   },
  { id: 'recurrent', icon: Repeat2,         label: 'Fixos'    },
  { id: 'notes',     icon: StickyNote,      label: 'Notas'    },
  { id: 'dreams',    icon: Target,          label: 'Objetivos' },
  { id: 'movies',    icon: Clapperboard,    label: 'Filmes'   },
  { id: 'recipes',   icon: UtensilsCrossed, label: 'Receitas' },
  { id: 'config',    icon: Settings,        label: 'Ajustes'  },
];

interface Props {
  activeTab: string;
  setActiveTab: (t: string) => void;
  hasTodayReminder: boolean;
}

export default function BottomNav({ activeTab, setActiveTab, hasTodayReminder }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isSecondaryActive = SECONDARY.some(t => t.id === activeTab);

  const handleSelect = (id: string) => {
    setActiveTab(id);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* ── Backdrop ── */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 bg-black/30 z-40"
          />
        )}
      </AnimatePresence>

      {/* ── Container fixo no fundo ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/50 shadow-[0_-2px_16px_rgba(0,0,0,0.08)]">

        {/* ── Drawer — expande acima da nav ── */}
        <AnimatePresence>
          {drawerOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 32, stiffness: 380 }}
              className="overflow-hidden border-b border-slate-100/80 dark:border-slate-800/60"
            >
              <div className="grid grid-cols-4 gap-1 px-5 pt-4 pb-3">
                {SECONDARY.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => handleSelect(tab.id)}
                    aria-label={tab.label}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                    className={`relative flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all active:scale-95 ${
                      activeTab === tab.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {tab.id === 'reminders' && hasTodayReminder && activeTab !== 'reminders' && (
                      <div className="absolute top-2.5 right-[calc(50%-14px)] w-2 h-2 bg-red-500 rounded-full" />
                    )}
                    <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                    <span className={`text-[9px] font-black uppercase tracking-tighter leading-none ${
                      activeTab === tab.id ? 'opacity-100' : 'opacity-50'
                    }`}>{tab.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Barra primária ── */}
        <nav
          className="flex items-center justify-around max-w-md mx-auto px-2 pb-6 pt-3"
          role="navigation"
          aria-label="Navegação principal"
        >
          {PRIMARY.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleSelect(tab.id)}
              aria-label={tab.label}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 transition-all min-w-[60px] active:scale-90 ${
                activeTab === tab.id ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              <span className={`text-[9px] font-black uppercase tracking-tighter leading-none ${
                activeTab === tab.id ? 'opacity-100' : 'opacity-50'
              }`}>{tab.label}</span>
              {activeTab === tab.id && (
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-0.5" />
              )}
            </button>
          ))}

          {/* ── Botão Mais ── */}
          <button
            onClick={() => setDrawerOpen(v => !v)}
            aria-label={drawerOpen ? 'Fechar menu' : 'Mais opções'}
            aria-expanded={drawerOpen}
            className={`relative flex flex-col items-center gap-1 transition-all min-w-[60px] active:scale-90 ${
              drawerOpen || isSecondaryActive ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {/* Badge de lembrete hoje */}
            {hasTodayReminder && activeTab !== 'reminders' && (
              <div className="absolute -top-0.5 right-[calc(50%-18px)] w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-950 rounded-full" />
            )}
            {drawerOpen
              ? <X size={24} strokeWidth={2.5} />
              : <MoreHorizontal size={24} strokeWidth={isSecondaryActive ? 2.5 : 2} />
            }
            <span className={`text-[9px] font-black uppercase tracking-tighter leading-none ${
              drawerOpen || isSecondaryActive ? 'opacity-100' : 'opacity-50'
            }`}>Mais</span>
            {isSecondaryActive && !drawerOpen && (
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-0.5" />
            )}
          </button>
        </nav>
      </div>
    </>
  );
}
