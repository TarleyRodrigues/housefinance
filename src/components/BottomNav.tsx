import { LayoutDashboard, PlusCircle, PieChart, Settings, ShoppingCart, Bell, StickyNote } from 'lucide-react';

export default function BottomNav({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) {
  const tabs = [
    { id: 'list', icon: LayoutDashboard, label: 'Extrato' },
    { id: 'shopping', icon: ShoppingCart, label: 'Compras' },
    { id: 'notes', icon: StickyNote, label: 'Notas' }, // NOVO
    { id: 'reminders', icon: Bell, label: 'Avisos' },
    { id: 'add', icon: PlusCircle, label: 'Novo' },
    { id: 'config', icon: Settings, label: 'Ajustes' },
  ];

  // Filtramos para não ficar apertado no celular (Removi o 'Gráficos' da barra principal, 
  // mas você pode escolher qual prefere manter. Geralmente 5 itens é o limite visual).
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around items-center pb-6 pt-3 px-1 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === tab.id ? 'text-blue-600 scale-110' : 'text-slate-400'}`}
        >
          <tab.icon size={20} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
          <span className="text-[9px] font-bold uppercase tracking-tighter">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}