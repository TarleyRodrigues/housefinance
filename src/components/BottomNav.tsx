import { 
  LayoutDashboard, 
  PlusCircle, 
  Settings, 
  ShoppingCart, 
  Bell, 
  StickyNote, 
  PieChart, 
  Clapperboard, 
  Target, 
  UtensilsCrossed 
} from 'lucide-react';

export default function BottomNav({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) {
  const tabs = [
    { id: 'list',      icon: LayoutDashboard,   label: 'Extrato'    },
    { id: 'dreams',    icon: Target,            label: 'Sonhos'     }, // NOVO
    { id: 'recipes',   icon: UtensilsCrossed,   label: 'Receitas'   }, // NOVO
    { id: 'add',       icon: PlusCircle,        label: 'Novo Gasto' },
    { id: 'shopping',  icon: ShoppingCart,      label: 'Compras'    },
    { id: 'stats',     icon: PieChart,          label: 'Gráficos'   },
    { id: 'movies',    icon: Clapperboard,      label: 'Filmes'     },
    { id: 'notes',     icon: StickyNote,        label: 'Notas'      },
    { id: 'reminders', icon: Bell,              label: 'Avisos'     },
    { id: 'config',    icon: Settings,          label: 'Ajustes'    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex overflow-x-auto no-scrollbar pb-6 pt-3 px-4 z-50 shadow-[0_-4px_15px_rgba(0,0,0,0.08)] snap-x">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          aria-label={tab.label}
          aria-current={activeTab === tab.id ? 'page' : undefined}
          className={`flex flex-col items-center gap-1.5 transition-all min-w-[75px] flex-shrink-0 snap-center ${
            activeTab === tab.id ? 'text-blue-600 scale-110' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
          <span className={`text-[9px] font-black uppercase tracking-tighter ${
            activeTab === tab.id ? 'opacity-100' : 'opacity-50'
          }`}>
            {tab.label}
          </span>
          {activeTab === tab.id && (
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-0.5" />
          )}
        </button>
      ))}
    </nav>
  );
}