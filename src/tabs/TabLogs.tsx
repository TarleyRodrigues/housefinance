import { motion } from 'motion/react';
import { History, Plus, Edit, Trash2, ArrowLeft, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function TabLogs({ logs, onBack }: { logs: any[], onBack: () => void }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Botão Voltar */}
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
        <ArrowLeft size={16} /> Voltar aos Ajustes
      </button>

      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-none">
          <History size={24} />
        </div>
        <h2 className="text-xl font-black uppercase tracking-tighter">Histórico de Ações</h2>
      </div>

      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-700 before:to-transparent">
        {logs.map((log, i) => {
          const isInsert = log.action === 'INSERT';
          const isUpdate = log.action === 'UPDATE';
          const isDelete = log.action === 'DELETE';

          return (
            <motion.div 
              initial={{ opacity: 0, x: -10 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ delay: i * 0.05 }}
              key={log.id} 
              className="relative flex items-start gap-4 pl-1"
            >
              {/* Ícone da Ação na Timeline */}
              <div className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 border-4 border-slate-50 dark:border-slate-900 ${
                isInsert ? 'bg-emerald-500 text-white' : 
                isUpdate ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'
              }`}>
                {isInsert && <Plus size={14} strokeWidth={4} />}
                {isUpdate && <Edit size={14} strokeWidth={4} />}
                {isDelete && <Trash2 size={14} strokeWidth={4} />}
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex-1">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">
                    {log.profiles?.full_name?.split(' ')[0]}
                  </p>
                  <span className="flex items-center gap-1 text-[9px] font-bold text-slate-300">
                    <Clock size={10} />
                    {format(parseISO(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
                
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {isInsert ? 'Inseriu ' : isUpdate ? 'Editou ' : 'Excluiu '}
                  <span className="text-blue-600 dark:text-blue-400">"{log.item_description}"</span>
                </p>
                
                {log.details && (
                  <p className="text-[11px] mt-2 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-xl italic border border-slate-100 dark:border-slate-800">
                    {log.details}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
        {logs.length === 0 && <p className="text-center text-slate-400 py-20 italic">Nenhuma ação registrada.</p>}
      </div>
    </div>
  );
}