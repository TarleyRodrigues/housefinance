// ─── ABA: LEMBRETES / AVISOS ─────────────────────────────────────────────────

import { useState } from 'react';
import { Bell, Calendar, Clock, Edit2, Trash2 } from 'lucide-react';
import { format, parseISO, isBefore, startOfToday, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import type { Reminder } from '../types';
import { motion } from 'motion/react';

interface Props {
  reminders: Reminder[];
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
}

export function TabAvisos({ reminders, fetchData, showToast }: Props) {
  const { user } = useAuth();
  const [remText, setRemText] = useState('');
  const [remDate, setRemDate] = useState('');
  const [remTime, setRemTime] = useState('');
  const [editRemId, setEditRemId] = useState<string | null>(null);

  const today = startOfToday();

  // Gerar os dias da semana atual para o componente visual
  const daysOfCurrentWeek = eachDayOfInterval({
    start: startOfWeek(new Date(), { weekStartsOn: 0 }), // Começa no Domingo
    end: endOfWeek(new Date(), { weekStartsOn: 0 })
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { text: remText, reminder_date: remDate, reminder_time: remTime, user_id: user.id };
    if (editRemId) {
      await supabase.from('reminders').update(payload).eq('id', editRemId);
    } else {
      await supabase.from('reminders').insert(payload);
    }
    showToast('Lembrete salvo!');
    setRemText(''); setRemDate(''); setRemTime(''); setEditRemId(null);
    fetchData();
  };

  return (
    <div className="space-y-6">
      {/* 2. QUADRO DA SEMANA ATUAL (NOVO) */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Agenda da Semana</h4>
        <div className="flex justify-between overflow-x-auto no-scrollbar gap-2 pb-2 px-1 snap-x">
          {daysOfCurrentWeek.map((day, i) => {
            const isToday = isSameDay(day, new Date());
            const hasReminder = reminders.some(r => isSameDay(parseISO(r.reminder_date), day));
            
            return (
              <div 
                key={i} 
                className={`flex flex-col items-center min-w-[45px] py-3 rounded-2xl transition-all snap-center border ${
                  isToday 
                    ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-200 dark:shadow-none text-white' 
                    : 'bg-slate-50 dark:bg-slate-900/50 border-transparent text-slate-400 dark:text-slate-500'
                }`}
              >
                <span className="text-[9px] font-black uppercase mb-1">
                  {format(day, 'EEE', { locale: ptBR })}
                </span>
                <span className="text-sm font-black">
                  {format(day, 'dd')}
                </span>
                {/* Marcador de aviso existente */}
                {hasReminder && (
                  <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isToday ? 'bg-white' : 'bg-blue-500'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4 transition-colors">
        <h3 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm uppercase tracking-tighter">
          <Bell size={16} className="text-blue-500" /> {editRemId ? 'Editar Aviso' : 'Novo Aviso'}
        </h3>
        <input
          className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-white"
          placeholder="Lembrar de?"
          required
          value={remText}
          onChange={(e) => setRemText(e.target.value)}
        />
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              required
              className="w-full p-4 pl-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-sm text-slate-800 dark:text-white"
              value={remDate}
              onChange={(e) => setRemDate(e.target.value)}
            />
          </div>
          <div className="w-32 relative">
            <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="time"
              className="w-full p-4 pl-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-sm text-slate-800 dark:text-white"
              value={remTime}
              onChange={(e) => setRemTime(e.target.value)}
            />
          </div>
        </div>
        <button className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs">
          Confirmar
        </button>
      </form>

      <div className="space-y-3 pb-10">
        {reminders.map((rem) => {
          // 1. LÓGICA DE OPACIDADE (NOVO)
          const remDateObj = parseISO(rem.reminder_date);
          const isPastDate = isBefore(remDateObj, today);

          return (
            <motion.div 
              layout
              key={rem.id} 
              className={`bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between transition-all ${
                isPastDate ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isPastDate ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'
                }`}>
                  <Calendar size={20} />
                </div>
                <div>
                  <p className={`font-bold text-sm leading-tight ${
                    isPastDate ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-200'
                  }`}>
                    {rem.text}
                  </p>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                    {format(remDateObj, 'dd/MM', { locale: ptBR })}
                    {rem.reminder_time && ` às ${rem.reminder_time}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditRemId(rem.id); setRemText(rem.text); setRemDate(rem.reminder_date); setRemTime(rem.reminder_time || ''); }}
                  className="text-blue-500 active:scale-90"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={async () => {
                    if (confirm('Apagar lembrete?')) {
                      await supabase.from('reminders').delete().eq('id', rem.id);
                      showToast('Aviso removido', 'info');
                      fetchData();
                    }
                  }}
                  className="text-red-400 active:scale-90"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}