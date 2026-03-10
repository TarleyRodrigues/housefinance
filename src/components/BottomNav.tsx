import { LayoutDashboard, PlusCircle, Settings, ShoppingCart, Bell, StickyNote, PieChart } from 'lucide-react';

export default function BottomNav({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) {
  const tabs = [
    { id: 'list', icon: LayoutDashboard, label: 'Extrato' },
    { id: 'add', icon: PlusCircle, label: 'Novo Gasto' },
    { id: 'stats', icon: PieChart, label: 'Gráficos' }, // Vírgula adicionada aqui
    { id: 'shopping', icon: ShoppingCart, label: 'Compras' },
    { id: 'notes', icon: StickyNote, label: 'Notas' },
    { id: 'reminders', icon: Bell, label: 'Avisos' },
    { id: 'config', icon: Settings, label: 'Ajustes' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex overflow-x-auto no-scrollbar pb-6 pt-3 px-4 z-50 shadow-[0_-4px_15px_rgba(0,0,0,0.08)] snap-x">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex flex-col items-center gap-1.5 transition-all min-w-[85px] flex-shrink-0 snap-center ${
            activeTab === tab.id ? 'text-blue-600 scale-110' : 'text-slate-400'
          }`}
        >
          <tab.icon size={26} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
          <span className={`text-[10px] font-black uppercase tracking-tighter ${
            activeTab === tab.id ? 'opacity-100' : 'opacity-50'
          }`}>
            {tab.label}
          </span>
          
          {activeTab === tab.id && (
            <div className="w-1 h-1 bg-blue-600 rounded-full mt-0.5" />
          )}
        </button>
      ))}
    </nav>
  );
}